#!/usr/bin/env python3
"""Prepare pinned Keets inputs. No global npm tools or sibling checkout required."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import tarfile
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    with Path(path).open('rb') as stream:
        h = hashlib.sha256()
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
        return h.hexdigest()


def checked(path, expected):
    if not Path(path).is_file() or digest(path) != expected:
        raise ValueError(f'checksum mismatch or missing file: {path}')
    return Path(path)


def run(args, **kwargs):
    print('+', ' '.join(map(str, args[:3])), flush=True)
    subprocess.run(list(map(str, args)), check=True, **kwargs)


def download(cache, pin, offline):
    path = cache / 'downloads' / pin['sha256']
    if path.exists():
        return checked(path, pin['sha256'])
    if offline:
        raise ValueError(f'offline cache miss: {pin["url"]}; run a connected build once')
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=path.parent, prefix='download-') as temp:
        pending = Path(temp) / 'archive'
        run(['curl', '--fail', '--location', '--silent', '--show-error', '--retry', '3',
             '--connect-timeout', '30', '--max-time', '900', '--proto', '=https',
             '--proto-redir', '=https', pin['url'], '-o', pending])
        checked(pending, pin['sha256'])
        os.replace(pending, path)
    return path


def extract(archive, destination):
    # Both archives have a single versioned top-level directory. Extract regular
    # files/directories only; npm's bin symlinks are not needed (we call its JS).
    with tarfile.open(archive) as tar:
        for member in tar:
            parts = Path(member.name).parts
            if member.name.startswith('/') or '..' in parts or len(parts) < 2:
                continue
            target = destination.joinpath(*parts[1:])
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            elif member.isfile():
                target.parent.mkdir(parents=True, exist_ok=True)
                with tar.extractfile(member) as source, target.open('wb') as out:
                    shutil.copyfileobj(source, out)
                target.chmod(member.mode & 0o777)


def validate_npm_lock(path):
    data = json.loads(path.read_text())
    if data.get('lockfileVersion') != 3:
        raise ValueError(f'expected npm lockfile v3: {path}')
    for name, entry in data['packages'].items():
        if name and (not entry.get('resolved', '').startswith('https://registry.npmjs.org/')
                     or not entry.get('integrity', '').startswith('sha512-')):
            raise ValueError(f'unpinned npm package: {name}')


def runtime_archive(archive, output, version):
    """Same Bare Kit AAR layout as fetch-bare-kit.sh, with deterministic ZIP metadata."""
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as source, zipfile.ZipFile(output, 'w', zipfile.ZIP_STORED) as dest:
        names = {}
        for item in source.infolist():
            prefix = 'android/bare-kit/'
            if item.filename.startswith(prefix) and not item.is_dir():
                name = item.filename[len(prefix):]
                if name.startswith('/') or '..' in Path(name).parts:
                    raise ValueError('invalid Bare Kit archive path')
                names[name] = source.read(item)
        if 'classes.jar' not in names or 'AndroidManifest.xml' not in names:
            raise ValueError('Bare Kit archive is missing Android runtime contents')
        names['META-INF/bare-kit-version'] = (version + '\n').encode()
        for name, data in sorted(names.items()):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_STORED
            info.external_attr = 0o100644 << 16
            dest.writestr(info, data)


def verify_outputs(root, pins, component='all'):
    files = pins['outputs']
    if not files:
        raise ValueError('Keets output checksums are missing from the lock')
    for name, expected in files.items():
        if component == 'runtime' and name != 'app/libs/bare-kit.aar':
            continue
        if component == 'worklet' and name == 'app/libs/bare-kit.aar':
            continue
        checked(root / name, expected)


def build(root, cache, pins, stage, offline, component='all'):
    env = os.environ.copy()
    env['KEETS_OUTPUT_ROOT'] = str(stage)
    if component != 'worklet':
        env['KEETS_RUNTIME_ARCHIVE'] = str(download(cache, pins['runtime'], offline))
        run(['bash', root / 'scripts/fetch-bare-kit.sh', '--prepared'], env=env)
    if component == 'runtime':
        return
    host = platform.system().lower() + '-' + {'aarch64': 'arm64', 'x86_64': 'x64'}.get(platform.machine(), platform.machine())
    if host not in pins['node']['platforms']:
        raise ValueError(f'unsupported build host: {host}; use macOS/Linux arm64 or x64')
    node_archive = download(cache, pins['node']['platforms'][host], offline)
    source_archive = download(cache, pins['source'], offline)
    with tempfile.TemporaryDirectory(dir=cache, prefix='build-') as temp:
        work = Path(temp)
        extract(node_archive, work / 'node')
        extract(source_archive, work / 'source')
        sidecar = work / 'source/sidecar'
        checked(sidecar / 'package-lock.json', pins['source']['lock_sha256'])
        tools = work / 'tools'
        tools.mkdir()
        for name, key in [('package.json', 'package_sha256'), ('package-lock.json', 'lock_sha256')]:
            source = checked(root / 'scripts/keets-tools' / name, pins['tools'][key])
            shutil.copy2(source, tools / name)
        node = work / 'node/bin/node'
        npm = work / 'node/lib/node_modules/npm/bin/npm-cli.js'
        env['PATH'] = str(node.parent) + os.pathsep + env.get('PATH', '')
        # Do not inherit npm credentials, registry overrides or user install hooks.
        env = {k: v for k, v in env.items() if not k.lower().startswith('npm_config_')}
        for kind in ('USER', 'GLOBAL'):
            config = work / (kind.lower() + '.npmrc')
            config.write_text('')
            env['NPM_CONFIG_' + kind + 'CONFIG'] = str(config)
        env['NPM_CONFIG_UPDATE_NOTIFIER'] = 'false'
        if subprocess.check_output([node, '--version'], text=True).strip() != pins['node']['version']:
            raise ValueError('unexpected Node version')
        if subprocess.check_output([node, npm, '--version'], text=True, env=env).strip() != pins['node']['npm']:
            raise ValueError('unexpected npm version')
        for project in (tools, sidecar):
            validate_npm_lock(project / 'package-lock.json')
            args = [node, npm, 'ci', '--ignore-scripts', '--no-audit', '--no-fund',
                    '--cache', cache / 'npm', '--registry=https://registry.npmjs.org/']
            if offline:
                args.append('--offline')
            run(args, cwd=project, env=env)
        env['KEETS_SIDECAR_DIR'] = str(sidecar)
        env['KEETS_BARE'] = str(tools / 'node_modules/bare/bin/bare')
        env['KEETS_PACK'] = str(tools / 'node_modules/bare-pack/bin.js')
        run(['bash', root / 'scripts/pack-keets-worklet.sh', '--prepared'], env=env)


def install(source, root, pins, component):
    for name in pins['outputs']:
        if component == 'runtime' and name != 'app/libs/bare-kit.aar':
            continue
        if component == 'worklet' and name == 'app/libs/bare-kit.aar':
            continue
        target = root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as out:
            pending = Path(out.name)
            try:
                with (source / name).open('rb') as incoming:
                    shutil.copyfileobj(incoming, out)
                out.flush()
                os.fsync(out.fileno())
            except BaseException:
                pending.unlink(missing_ok=True)
                raise
        os.replace(pending, target)


def prepare(root, cache, offline=False, component='all'):
    pins = json.loads((root / 'scripts/keets-dependencies.lock.json').read_text())
    cache.mkdir(parents=True, exist_ok=True)
    # Serializes shared cache writers and simultaneous Gradle/manual preparations.
    with (cache / 'prepare.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            verify_outputs(root, pins, component)
            print('Keets: pinned inputs already verified.', flush=True)
            return
        except (OSError, ValueError):
            pass
        key = hashlib.sha256(json.dumps(pins, sort_keys=True).encode()).hexdigest()
        prepared = cache / 'prepared' / key / component
        if prepared.exists():
            verify_outputs(prepared, pins, component)
            print('Keets: restoring verified cached inputs.', flush=True)
        else:
            with tempfile.TemporaryDirectory(dir=cache, prefix='prepare-') as temp:
                stage = Path(temp)
                build(root, cache, pins, stage, offline, component)
                verify_outputs(stage, pins, component)
                prepared.parent.mkdir(parents=True, exist_ok=True)
                os.replace(stage, prepared)
        install(prepared, root, pins, component)
        verify_outputs(root, pins, component)
        print('Keets: preparation and pinned checksums passed.', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--cache', type=Path, default=Path(os.environ.get('KEETS_CACHE_DIR', str(Path.home() / '.gradle/caches/minima-keets'))))
    parser.add_argument('--offline', action='store_true')
    parser.add_argument('--component', choices=('all', 'runtime', 'worklet'), default='all')
    args = parser.parse_args()
    try:
        prepare(args.root.resolve(), args.cache.resolve(), args.offline or os.environ.get('KEETS_OFFLINE') == '1', args.component)
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError, tarfile.TarError, zipfile.BadZipFile) as error:
        parser.exit(1, f'Keets preparation FAILED: {error}\nNo APK may be packaged. See docs/KEETS_BUILD.md.\n')
