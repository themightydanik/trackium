#!/usr/bin/env python3
"""Create an explicit-allowlist MiniDapp archive, without backend, secrets or caches."""
import argparse
import json
import re
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent

# Every new browser script, asset or entry point needs explicit review here.
FILES = (
    'dapp.conf', 'icon.png', 'index.html', 'local-core.html', 'mds.js', 'service.js',
    'assets/v2/appearance.js',
    'assets/v2/background-database.js',
    'assets/v2/brand/app-32.png',
    'assets/v2/brand/app-48.png',
    'assets/v2/brand/app-180.png',
    'assets/v2/brand/app-192.png',
    'assets/v2/brand/app-512.png',
    'assets/v2/brand/mark.png',
    'assets/v2/brand/site.webmanifest',
    'assets/v2/cargo.css',
    'assets/v2/cargo.js',
    'assets/v2/demo-data.js',
    'assets/v2/design-tokens.css',
    'assets/v2/lite-design-system.css',
    'assets/v2/fleet-map.css',
    'assets/v2/premium-surfaces.css',
    'assets/v2/visual/terminal-480.webp',
    'assets/v2/visual/terminal-960.webp',
    'assets/v2/visual/warehouse-480.webp',
    'assets/v2/visual/warehouse-960.webp',
    'assets/v2/visual/matte-grain.webp',
    'assets/v2/map-icons.js',
    'assets/v2/gateway-client.js',
    'assets/v2/gateway-model.js',
    'assets/v2/leaflet.css',
    'assets/v2/leaflet.js',
    'assets/v2/local-core-page.js',
    'assets/v2/local-core.css',
    'assets/v2/local-core.js',
    'assets/v2/mds-bridge.js',
    'assets/v2/server-client.js',
    'assets/v2/customer-ui.js',
    'assets/v2/server-workspace.js',
    'assets/v2/workspace-components.js',
    'assets/v2/route-planner.js',
    'assets/v2/route-lifecycle.js',
    'assets/v2/workspace-ui.js',
    'assets/v2/world-map.js',
)


def package(output):
    output = Path(output).resolve()
    if output.is_relative_to(ROOT):
        raise ValueError('Write the archive outside the checkout')
    files = [ROOT / name for name in FILES]
    if any(path.resolve() != path or not path.is_file() for path in files):
        raise ValueError('Each allowlisted input must be a regular file without symlinks')
    config = json.loads((ROOT / 'dapp.conf').read_text())
    if not re.fullmatch(r'\d+\.\d+\.\d+', config['version']):
        raise ValueError('Invalid MiniDapp version')
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, path.relative_to(ROOT))
    with ZipFile(output) as archive:
        if archive.namelist() != list(FILES) or archive.testzip() is not None:
            raise ValueError('Unexpected or damaged MiniDapp archive')
    print(f'Packaged {len(files)} files: {output}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('output', help='Archive path outside the checkout, e.g. /tmp/trackium-cargo-v2.mds.zip')
    package(parser.parse_args().output)
