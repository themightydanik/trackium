"""Run locally inside the private Valhalla service container.

Run through docker compose exec -T valhalla python3 -. No public endpoint.
"""
from concurrent.futures import ThreadPoolExecutor
import json
import math
import os
from pathlib import Path
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE = 'http://127.0.0.1:8002'
KYIV = (50.45036, 30.52475)
LVIV = (49.84112, 24.02999)
RZESZOW = (50.03741, 22.00709)
WARSAW = (52.23119, 21.00658)
ODESA = (46.48182, 30.73715)
BUCHAREST = (44.43546, 26.10097)
BERLIN = (52.51647, 13.38055)
PARIS = (48.85696, 2.35086)
BURSHTYN = (49.25845, 24.62936)
HOLOHORY = (49.7627, 24.7527)
MYKOLAIV = (46.96691, 31.99543)
TRUCK = {'height': 3.9, 'width': 2.5, 'length': 16, 'weight': 35, 'axle_load': 10}
UKRAINE = [
    ('Kyiv–Lviv', (KYIV, LVIV), 'auto'),
    ('Lviv–Kyiv', (LVIV, KYIV), 'auto'),
    ('Burshtyn–Holohory', (BURSHTYN, HOLOHORY), 'auto'),
    ('Lviv–Burshtyn–Holohory', (LVIV, BURSHTYN, HOLOHORY), 'auto'),
    ('Odesa–Mykolaiv', (ODESA, MYKOLAIV), 'auto'),
    ('Kyiv–Lviv truck', (KYIV, LVIV), 'truck'),
]
CROSS_BORDER = [
    ('Lviv–Rzeszów', (LVIV, RZESZOW), 'auto'),
    ('Kyiv–Warsaw', (KYIV, WARSAW), 'auto'),
    ('Odesa–Bucharest', (ODESA, BUCHAREST), 'auto'),
    ('Berlin–Warsaw', (BERLIN, WARSAW), 'auto'),
    ('Warsaw–Paris', (WARSAW, PARIS), 'auto'),
    ('Warsaw–Lviv truck', (WARSAW, LVIV), 'truck'),
]


def request(path, payload=None, origin=BASE):
    started = time.monotonic()
    data = json.dumps(payload).encode() if payload is not None else None
    try:
        with urlopen(Request(origin + path, data=data, headers={'content-type': 'application/json'}), timeout=30) as res:
            status, body = res.status, json.load(res)
    except HTTPError as exc:
        status, body = exc.code, json.load(exc)
    except (URLError, TimeoutError) as exc:
        status, body = None, {'error': type(getattr(exc, 'reason', exc)).__name__}
    return status, body, round((time.monotonic() - started) * 1000, 2)


def shape_points(encoded):
    # Native Valhalla shape coordinates use signed deltas at 10^-6 degrees.
    coordinates = []
    pair = [0, 0]
    position = 0
    for item in encoded:
        value = ord(item) - 63
        if not 0 <= value <= 63:
            raise ValueError('Invalid polyline6 byte')
        coordinates.append(value)
    result = []
    while position < len(coordinates):
        for axis in range(2):
            delta = 0
            for shift in range(0, 35, 5):
                value = coordinates[position]
                position += 1
                delta |= (value & 31) << shift
                if value < 32:
                    break
            else:
                raise ValueError('Invalid polyline6 delta')
            pair[axis] += ~(delta >> 1) if delta & 1 else delta >> 1
        lat, lon = (value / 1_000_000 for value in pair)
        if abs(lat) > 90 or abs(lon) > 180:
            raise ValueError('Invalid decoded coordinate')
        result.append((lat, lon))
    return result


def distance_m(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 12_742_000 * math.asin(min(1, math.sqrt(h)))


def route(case, truck=TRUCK):
    name, points, profile = case
    payload = {'locations': [{'lat': lat, 'lon': lon} for lat, lon in points],
               'costing': profile, 'units': 'kilometers'}
    if profile == 'truck':
        payload['costing_options'] = {'truck': truck}
    status, data, elapsed = request('/route', payload)
    result = {'route': name, 'profile': profile, 'http_status': status, 'latency_ms': elapsed}
    if status == 200:
        trip = data['trip']
        legs = trip['legs']
        assert len(legs) == len(points) - 1 and all(leg.get('shape') and leg.get('maneuvers') for leg in legs)
        assert all('type' in step and 'instruction' in step for leg in legs for step in leg['maneuvers'])
        assert trip['summary']['length'] > 0 and trip['summary']['time'] > 0
        shapes = [shape_points(leg['shape']) for leg in legs]
        assert all(len(shape) >= 2 for shape in shapes)
        snap_m = max(distance_m(shape[0 if end == 0 else -1], points[i + end])
                     for i, shape in enumerate(shapes) for end in (0, 1))
        assert snap_m <= 1000, (name, snap_m)
        result.update(distance_km=trip['summary']['length'], duration_s=trip['summary']['time'],
                      geometry_points=sum(map(len, shapes)), max_snap_m=round(snap_m, 1),
                      legs=len(legs), maneuvers=sum(len(leg['maneuvers']) for leg in legs),
                      warnings=['OSM snapshot. No live closures, delays or guarantee of access.'])
        if profile == 'truck':
            result['warnings'].append('Missing HGV tags do not imply clearance.')
    else:
        result.update(error_code=data.get('error_code'), error=data.get('error'))
    return result


def stats(samples):
    times = sorted(sample['latency_ms'] for sample in samples)
    return {'count': len(times), 'failures': sum(sample['http_status'] != 200 for sample in samples),
            **{f'p{q}_ms': times[math.ceil(len(times) * q / 100) - 1] for q in (50, 95, 99)}}


def regression():
    limits = {'height': 2.5, 'width': 2, 'length': 6, 'weight': 6, 'axle_load': 3}
    case = ('synthetic restriction fixture', ((48, 11.001), (48, 11.039)), 'truck')
    low = route(case, limits)
    car = route((*case[:2], 'auto'))
    assert low['http_status'] == car['http_status'] == 200 and low['distance_km'] == car['distance_km']
    results = {'passenger': car, 'truck_under_limits': low}
    for field, value in TRUCK.items():
        high = route(case, {**limits, field: value})
        assert high['http_status'] == 200 and high['distance_km'] > low['distance_km'] * 1.2, (field, low, high)
        results[field] = high
    disconnected = route(('synthetic disconnected fixture', (case[1][0], (48.3, 11.08)), 'auto'))
    assert disconnected['error_code'] in (170, 171, 442), disconnected
    closed = route(('synthetic motor vehicle closure', (case[1][0], (48, 11.085)), 'auto'))
    assert closed['error_code'] in (170, 171, 442), closed
    oversized, _, _ = request('/route', {
        'costing': 'auto', 'locations': [{'lat': 48, 'lon': 11.001 + i * .002} for i in range(13)]
    })
    assert oversized == 400, oversized
    actions, status, _ = request('/status')
    assert actions == 200 and set(status['available_actions']) == {'route', 'status'}
    return {**results, 'disconnected': disconnected, 'closed': closed, 'excessive_locations_http_status': oversized}


def service_resources():
    # In the reference Compose service Valhalla is PID 1.
    status = Path('/proc/1/status').read_text().splitlines()
    fields = Path('/proc/1/stat').read_text().rsplit(')', 1)[1].split()
    return {**{line.split(':')[0]: int(line.split()[1]) for line in status
               if line.startswith(('VmRSS:', 'VmHWM:'))},
            'cpu_seconds': round((int(fields[11]) + int(fields[12])) / os.sysconf('SC_CLK_TCK'), 2)}


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'corridors'
    if mode not in ('ukraine', 'corridors', 'fixture'):
        raise SystemExit('mode must be ukraine, corridors or fixture')
    status_code, status, _ = request('/status?json=%7B%22verbose%22%3Atrue%7D')
    assert status_code == 200 and status['version'] == '3.6.3' and status['has_tiles'] is True
    release = json.loads(Path('/graph/release.json').read_text())
    unavailable, failure, _ = request('/status', origin='http://127.0.0.1:9')
    assert unavailable is None
    report = {'graph_id': release['graph_id'],
              'engine': {key: status.get(key) for key in (
                  'version', 'has_tiles', 'has_admins', 'has_timezones', 'has_live_traffic', 'osm_changeset')},
              'unavailable_service': failure['error']}
    if mode == 'fixture':
        report['synthetic_restrictions'] = regression()
        print(json.dumps(report, indent=2))
        return
    cases = [UKRAINE[0], *CROSS_BORDER] if mode == 'corridors' else UKRAINE
    report['service_before_routes'] = service_resources()
    benchmark = CROSS_BORDER[4] if mode == 'corridors' else UKRAINE[0]
    report['first_route_after_start'] = route(benchmark)
    report['routes'] = [route(case) for case in cases]
    if report['first_route_after_start']['http_status'] == 200:
        report['warm_sequential'] = stats([route(benchmark) for _ in range(20)])
        with ThreadPoolExecutor(max_workers=4) as workers:
            report['warm_concurrency_4'] = stats(list(workers.map(route, [benchmark] * 32)))
    report['service_after_routes'] = service_resources()
    print(json.dumps(report, indent=2))
    if any(row['http_status'] != 200 for row in report['routes']):
        sys.exit(1)


if __name__ == '__main__':
    main()
