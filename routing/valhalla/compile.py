"""Container-side build for the version pinned in image.env."""
import hashlib
import json
from pathlib import Path
import resource
import subprocess
import sys
import time

config = json.loads(subprocess.check_output([
    'valhalla_build_config', '--mjolnir-tile-dir', '/graph/tiles',
    '--mjolnir-tile-extract', '', '--mjolnir-concurrency', '4',
    '--mjolnir-admin', '', '--mjolnir-timezone', '',
]))
config['loki']['actions'] = ['route', 'status']
config['httpd']['service']['timeout_seconds'] = 30
config['service_limits']['status']['allow_verbose'] = True
for profile in ('auto', 'truck'):
    config['service_limits'][profile].update(max_locations=12, max_distance=3_000_000)
config['mjolnir']['max_cache_size'] = 256 * 1024 * 1024
config_path = Path('/graph/config.json')
config_path.write_text(json.dumps(config, indent=2) + '\n')

started = time.monotonic()
subprocess.run(['valhalla_build_tiles', '-c', str(config_path), '-j', '4', *sys.argv[1:]], check=True)
wall_seconds = time.monotonic() - started
usage = resource.getrusage(resource.RUSAGE_CHILDREN)
tiles = sorted(Path('/graph/tiles').rglob('*.gph'))
if not tiles:
    raise SystemExit('Valhalla build produced no graph tiles')

digest = hashlib.sha256()
for tile in tiles:
    with tile.open('rb') as file:
        tile_digest = hashlib.file_digest(file, 'sha256').hexdigest()
    digest.update(f'{tile.relative_to("/graph/tiles").as_posix()} {tile_digest}\n'.encode())
metrics = {
    'wall_seconds': round(wall_seconds, 2), 'cpu_user_seconds': usage.ru_utime,
    'cpu_system_seconds': usage.ru_stime, 'peak_builder_rss_kib': usage.ru_maxrss,
    'tile_count': len(tiles), 'tile_bytes': sum(tile.stat().st_size for tile in tiles),
    'graph_manifest_sha256': digest.hexdigest(),
}
Path('/graph/build-metrics.json').write_text(json.dumps(metrics, indent=2) + '\n')
