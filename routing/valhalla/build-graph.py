#!/usr/bin/env python3
"""Build one immutable Valhalla release from locally verified OSM inputs."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

HERE = Path(__file__).resolve().parent
IMAGE = (HERE / 'image.env').read_text().strip().split('=', 1)[1]


def sha(path):
    with path.open('rb') as file:
        return hashlib.file_digest(file, 'sha256').hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--container-user', default=f'{os.getuid()}:{os.getgid()}')
    args = parser.parse_args()
    if not re.fullmatch(r'[1-9]\d*:[0-9]+', args.container_user):
        parser.error('container user must be a non-root numeric uid:gid')
    manifest = json.loads(args.manifest.read_text())
    inputs = manifest['inputs']
    if not isinstance(inputs, list) or not inputs:
        parser.error('manifest must list at least one input')
    source_dir = args.manifest.resolve().parent
    output = args.output.resolve()
    files = set()
    for item in inputs:
        name = item['file']
        if not re.fullmatch(r'[A-Za-z0-9._-]+\.osm\.pbf', name) or name in files:
            parser.error(f'invalid or duplicate PBF name: {name}')
        files.add(name)
        source = source_dir / name
        if source.resolve().parent != source_dir or sha(source) != item['sha256']:
            parser.error(f'checksum mismatch or input outside manifest directory: {name}')
        if source.stat().st_size != item['bytes']:
            parser.error(f'byte count mismatch: {name}')
    output.mkdir(parents=True, exist_ok=True)
    if any(output.iterdir()):
        parser.error('build output must be empty')
    if output == source_dir or output.is_relative_to(source_dir):
        parser.error('build output must be separate from the input directory')

    subprocess.run([
        'docker', 'run', '--rm', '--network', 'none', '--cpus', '4', '--memory', '22g',
        '--user', args.container_user, '--pids-limit', '96', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
        '--mount', f'type=bind,src={source_dir},dst=/data,readonly',
        '--mount', f'type=bind,src={output},dst=/graph',
        '--mount', f'type=bind,src={HERE},dst=/tools,readonly',
        '--workdir', '/graph', '--entrypoint', 'python3', IMAGE,
        '/tools/compile.py', *('/data/' + item['file'] for item in inputs),
    ], check=True)
    metrics = json.loads((output / 'build-metrics.json').read_text())
    configuration = sha(output / 'config.json')
    identity = {'source': manifest, 'engine': IMAGE, 'configuration_sha256': configuration,
                'graph_manifest_sha256': metrics['graph_manifest_sha256']}
    graph_id = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
    metadata = {**identity, 'graph_id': graph_id, 'built_at': datetime.datetime.now(datetime.UTC).isoformat(),
                'metrics': metrics}
    pending = output / 'release.json.tmp'
    pending.write_text(json.dumps(metadata, indent=2) + '\n')
    pending.replace(output / 'release.json')
    print('Graph ID:', graph_id, flush=True)


if __name__ == '__main__':
    main()
