#!/usr/bin/env python3
"""Create an explicit-allowlist MiniDapp archive, without backend, secrets or caches."""
import argparse
import json
import re
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent

def package(output):
    output = Path(output).resolve()
    if output.is_relative_to(ROOT):
        raise ValueError('Write the archive outside the checkout')
    config = json.loads((ROOT / 'dapp.conf').read_text())
    assert re.fullmatch(r'\d+\.\d+\.\d+', config['version'])
    files = [ROOT / name for name in ('index.html', 'local-core.html', 'legacy.html', 'service.js', 'mds.js', 'dapp.conf', 'icon.png')]
    files += [p for p in (ROOT / 'assets').rglob('*') if p.is_file() and p.suffix.lower() in ('.js', '.css', '.png', '.svg', '.jpg', '.webp')]
    if any(p.is_symlink() or not p.resolve().is_relative_to(ROOT) for p in files):
        raise ValueError('Refusing symlink or path outside checkout')
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        for path in sorted(files):
            archive.write(path, path.relative_to(ROOT))
    with ZipFile(output) as archive:
        assert archive.testzip() is None
        assert 'dapp.conf' in archive.namelist()
    print(f'Packaged {len(files)} files: {output}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('output', help='Archive path outside the checkout, e.g. /tmp/trackium-cargo-v2.mds.zip')
    package(parser.parse_args().output)
