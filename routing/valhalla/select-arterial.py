#!/usr/bin/env python3
"""Derive a resource-bounded intercity pilot from a prepared corridor snapshot."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

HIGHWAYS = (
    'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link',
    'secondary', 'secondary_link', 'tertiary', 'tertiary_link',
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--osmium', default='osmium')
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    prepared, = manifest['inputs']
    source = (args.manifest.resolve().parent / prepared['file']).resolve()
    if source.parent != args.manifest.resolve().parent:
        parser.error('prepared PBF must be beside its manifest')
    with source.open('rb') as stream:
        checksum = hashlib.file_digest(stream, 'sha256').hexdigest()
    if checksum != prepared['sha256'] or source.stat().st_size != prepared['bytes']:
        parser.error('wrong prepared PBF bytes')

    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    if any(output.iterdir()):
        parser.error('output must be empty')
    pbf = output / 'arterial.osm.pbf'
    filters = ['w/highway=' + ','.join(HIGHWAYS), 'w/route=ferry', 'r/route=ferry',
               'r/type=restriction', 'r/type=connectivity']
    subprocess.run([args.osmium, 'tags-filter', '-o', str(pbf), str(source), *filters], check=True)
    with pbf.open('rb') as stream:
        checksum = hashlib.file_digest(stream, 'sha256').hexdigest()
    manifest['coverage'] += '; arterial pilot, local street coverage is incomplete'
    manifest['arterial_selection'] = {'parent_pbf': prepared, 'filters': filters}
    manifest['inputs'] = [{'file': pbf.name, 'sha256': checksum, 'bytes': pbf.stat().st_size}]
    pending = output / 'arterial.json.tmp'
    pending.write_text(json.dumps(manifest, indent=2) + '\n')
    pending.replace(output / 'arterial.json')


if __name__ == '__main__':
    main()
