#!/usr/bin/env python3
"""Prepare an explicitly cropped, road-only multi-extract pilot for Valhalla."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

FILTERS = ('w/highway', 'w/route=ferry', 'r/route=ferry', 'r/type=restriction', 'r/type=connectivity')


def checked(path, row):
    with path.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    if digest != row['sha256'] or path.stat().st_size != row['bytes']:
        raise ValueError(f'wrong source snapshot: {path.name}')


def run(*args):
    subprocess.run(args, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--osmium', default='osmium')
    args = parser.parse_args()
    source = args.manifest.resolve().parent
    recipe = json.loads(args.manifest.read_text())
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    if any(output.iterdir()):
        parser.error('output must be empty')
    with tempfile.TemporaryDirectory(dir=output) as temp:
        tmp = Path(temp)
        filtered = []
        for row in recipe['sources']:
            raw = (source / row['file']).resolve()
            if raw.parent != source:
                parser.error('source must be beside manifest')
            checked(raw, row)
            name = raw.name
            if 'bounds' in row:
                crop = tmp / ('crop-' + name)
                run(args.osmium, 'extract', '--strategy=complete_ways', '-b',
                    ','.join(map(str, row['bounds'])), '-o', str(crop), str(raw))
            else:
                crop = raw
            roads = tmp / ('roads-' + name)
            run(args.osmium, 'tags-filter', '-o', str(roads), str(crop), *FILTERS)
            if crop != raw:
                crop.unlink()
            filtered.append(str(roads))

        joined = tmp / 'joined.osh.pbf'
        merged = output / 'corridors.osm.pbf'
        run(args.osmium, 'merge', '-o', str(joined), *filtered)
        run(args.osmium, 'time-filter', '-o', str(merged), str(joined), recipe['snapshot_cutoff'])

    with merged.open('rb') as stream:
        sha = hashlib.file_digest(stream, 'sha256').hexdigest()
    manifest = {**recipe, 'preprocessing': {'osmium': subprocess.check_output(
        [args.osmium, '--version'], text=True).splitlines()[0], 'filters': FILTERS,
        'extract_strategy': 'complete_ways', 'merge': 'OSM object IDs then latest visible version at snapshot_cutoff'},
        'inputs': [{'file': merged.name, 'sha256': sha, 'bytes': merged.stat().st_size}]}
    pending = output / 'corridors.json.tmp'
    pending.write_text(json.dumps(manifest, indent=2) + '\n')
    pending.replace(output / 'corridors.json')
    print(f'Prepared {merged.stat().st_size} bytes', flush=True)


if __name__ == '__main__':
    main()
