"""Private HTTP boundary binding responses to the verified mounted graph."""
import datetime
import hashlib
from http.client import HTTPConnection, HTTPException
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import signal
import subprocess
import tempfile
import threading

MAX_REQUEST = 8192
MAX_RESPONSE = 1024 * 1024
ENGINE = '3.6.3'
ROOT = Path('/graph')


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def verified_release():
    manifest = json.loads((ROOT / 'release.json').read_text())
    identity = {key: manifest[key] for key in (
        'source', 'engine', 'configuration_sha256', 'graph_manifest_sha256')}
    expected = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
    if expected != manifest['graph_id'] or digest(ROOT / 'config.json') != identity['configuration_sha256']:
        raise ValueError('Invalid graph release or configuration digest')
    pinned = Path('/opt/trackium-routing/image.env').read_text().strip().split('=', 1)[1]
    if identity['engine'] != pinned or subprocess.check_output(
            ['valhalla_service', '--version'], text=True).strip() != ENGINE:
        raise ValueError('Unexpected engine')
    tiles = ROOT / 'tiles'
    files = sorted(tiles.rglob('*.gph'))
    graph = hashlib.sha256()
    for tile in files:
        if tile.is_symlink() or not tile.resolve().is_relative_to(tiles):
            raise ValueError('Graph files must be inside the tile mount')
        graph.update(f'{tile.relative_to(tiles).as_posix()} {digest(tile)}\n'.encode())
    if not files or graph.hexdigest() != identity['graph_manifest_sha256']:
        raise ValueError('Unexpected mounted graph tiles')
    source = identity['source']
    snapshots = {row.get('snapshot') for row in source.get('sources', source['inputs'])}
    if snapshots == {None} and source.get('coverage') == 'synthetic restriction regression only':
        snapshot = 'synthetic'
    elif len(snapshots) == 1:
        snapshot, = snapshots
        if not isinstance(snapshot, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z)?', snapshot):
            raise ValueError('Invalid OSM snapshot')
        datetime.datetime.fromisoformat(snapshot)
    else:
        raise ValueError('OSM snapshot must be consistent')
    config = json.loads((ROOT / 'config.json').read_text())
    storage = config['mjolnir']
    if storage['tile_dir'] != '/graph/tiles' or storage.get('tile_extract') or storage.get('tile_url'):
        raise ValueError('Verified release must use only mounted tiles')
    config['httpd']['service']['listen'] = 'tcp://127.0.0.1:8003'
    return expected, snapshot, config


class BoundedServer(ThreadingHTTPServer):
    daemon_threads = True
    slots = threading.BoundedSemaphore(8)

    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            try:
                request.settimeout(.25)
                request.sendall(b'HTTP/1.0 503 Service Unavailable\r\nContent-Length: 0\r\n\r\n')
            finally:
                self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.slots.release()


def start(graph_id, snapshot):
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            self.request.settimeout(8)
            super().setup()

        def log_message(self, *_args):
            pass

        def reply(self, status, data):
            self.send_response_only(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('X-Trackium-Graph-Id', graph_id)
            self.send_header('X-Trackium-Engine-Version', ENGINE)
            self.send_header('X-Trackium-OSM-Snapshot', snapshot)
            self.end_headers()
            self.wfile.write(data)

        def forward(self, path, payload=None):
            conn = HTTPConnection('127.0.0.1', 8003, timeout=8)
            try:
                conn.request(self.command, path, body=payload, headers={'Content-Type': 'application/json'})
                response = conn.getresponse()
                data = response.read(MAX_RESPONSE + 1)
                status = response.status
            except (OSError, HTTPException):
                status, data = 503, b'{}'
            finally:
                conn.close()
            self.reply(status if len(data) <= MAX_RESPONSE else 422, data if len(data) <= MAX_RESPONSE else b'{}')

        def do_GET(self):
            if self.path == '/status':
                self.forward('/status?json=%7B%22verbose%22%3Atrue%7D')
            else:
                self.reply(404, b'{}')

        def do_POST(self):
            if self.path != '/route':
                self.reply(404, b'{}')
                return
            length = self.headers.get_all('Content-Length', [])
            if (self.headers.get('Transfer-Encoding') or len(length) != 1 or
                    not re.fullmatch(r'[0-9]{1,4}', length[0]) or not 1 <= int(length[0]) <= MAX_REQUEST):
                self.reply(400, b'{}')
                return
            self.forward('/route', self.rfile.read(int(length[0])))

    return BoundedServer(('0.0.0.0', 8002), Handler)


if __name__ == '__main__':
    release_id, osm_snapshot, engine_config = verified_release()
    with tempfile.TemporaryDirectory() as scratch:
        config_path = Path(scratch) / 'config.json'
        config_path.write_text(json.dumps(engine_config))
        engine = subprocess.Popen(['valhalla_service', str(config_path), '2'])
        def stop(_signum, _frame):
            raise KeyboardInterrupt
        signal.signal(signal.SIGTERM, stop)
        try:
            with start(release_id, osm_snapshot) as server:
                server.timeout = 1
                while engine.poll() is None:
                    server.handle_request()
        except KeyboardInterrupt:
            pass
        finally:
            if engine.poll() is None:
                engine.terminate()
                try:
                    engine.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    engine.kill()
                    engine.wait()
