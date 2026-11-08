#!/usr/bin/env python3
"""Reject APK inputs missing the generated Keets worklet or its linked addons.

The header framing follows bare-bundle.fromBuffer: decimal byte count followed
by a JSON header (including both newlines), then the concatenated source files.
"""
import argparse
import json
import hashlib
import importlib.util
import struct
from pathlib import Path
import re
import zipfile

ABIS = ('arm64-v8a', 'armeabi-v7a', 'x86_64')


def required_addons(data):
    prefix = re.match(rb'(?:#![^\n]*\n)?([0-9]+)(?=\n)', data)
    if not prefix:
        raise ValueError('invalid Keets bundle header')
    start = prefix.end()
    end = start + int(prefix.group(1))
    if end > len(data):
        raise ValueError('truncated Keets bundle header')
    header = json.loads(data[start:end])
    if header.get('version') != 0:
        raise ValueError('unsupported Keets bundle version')
    files = header.get('files', {})
    if not files or header.get('main') not in files:
        raise ValueError('Keets bundle entry point is missing')
    offset = 0
    for info in files.values():
        length = info.get('length')
        if type(length) is not int or length < 0 or info.get('offset') != offset:
            raise ValueError('invalid Keets bundle file table')
        offset += length
    if offset != len(data) - end:
        raise ValueError('truncated or invalid Keets bundle payload')
    addons = header.get('addons', [])
    if not addons or any(not isinstance(a, str) or not re.fullmatch(
            r'linked:lib[A-Za-z0-9_.-]+\.so', a) for a in addons):
        raise ValueError('Keets bundle must declare linked Android addons')
    return {a.removeprefix('linked:') for a in addons}


def verify(root, abis):
    bundle = root / 'app/src/main/assets/keets.bundle'
    addons = required_addons(bundle.read_bytes())
    for abi in abis:
        for name in sorted(addons):
            path = root / 'app/src/main/jniLibs' / abi / name
            with path.open('rb') as library:
                if library.read(4) != b'\x7fELF':
                    raise ValueError(f'invalid native addon: {abi}/{name}')
    with zipfile.ZipFile(root / 'app/libs/bare-kit.aar') as runtime:
        for abi in abis:
            for name in ('libbare-kit.so', 'libc++_shared.so'):
                with runtime.open(f'jni/{abi}/{name}') as library:
                    if library.read(4) != b'\x7fELF':
                        raise ValueError(f'invalid Bare runtime: {abi}/{name}')
    return len(addons)


def pinned_outputs(root):
    spec = importlib.util.spec_from_file_location('prepare_keets', root / 'scripts/prepare-keets.py')
    prepare = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(prepare)
    pins = json.loads((root / 'scripts/keets-dependencies.lock.json').read_text())
    prepare.verify_outputs(root, pins)


def elf_sections(data, abi):
    """Compare loadable contents, which Android's debug-symbol stripping preserves."""
    if data[:4] != b'\x7fELF' or data[5] != 1 or data[4] not in (1, 2):
        raise ValueError('unsupported native library format')
    machine = struct.unpack_from('<H', data, 18)[0]
    if machine != {'arm64-v8a': 183, 'armeabi-v7a': 40, 'x86_64': 62}[abi]:
        raise ValueError(f'wrong native library architecture for {abi}')
    wide = data[4] == 2
    start = struct.unpack_from('<Q' if wide else '<I', data, 40 if wide else 32)[0]
    size, count, names = struct.unpack_from('<HHH', data, 58 if wide else 46)
    fmt = '<IIQQQQIIQQ' if wide else '<IIIIIIIIII'
    if size != struct.calcsize(fmt) or not count or names >= count:
        raise ValueError('invalid native section table')
    headers = [struct.unpack_from(fmt, data, start + i * size) for i in range(count)]
    table = headers[names]
    strings = data[table[4]:table[4] + table[5]]
    result = {}
    for section in headers:
        name, kind, flags, address, offset, length = section[:6]
        if not flags & 2:  # SHF_ALLOC: runtime sections, not debug/symbol tables
            continue
        end = strings.find(b'\0', name)
        if end < name or (kind != 8 and offset + length > len(data)):
            raise ValueError('truncated native library')
        key = strings[name:end]
        content = b'' if kind == 8 else data[offset:offset + length]  # SHT_NOBITS
        result[key] = (kind, flags, address, length, hashlib.sha256(content).hexdigest())
    if not result:
        raise ValueError('native library has no runtime sections')
    return result


def verify_apk(root, apk):
    bundle = (root / 'app/src/main/assets/keets.bundle').read_bytes()
    addons = required_addons(bundle)
    with zipfile.ZipFile(apk) as package, zipfile.ZipFile(root / 'app/libs/bare-kit.aar') as runtime:
        if package.read('assets/keets.bundle') != bundle:
            raise ValueError(f'{apk}: missing or changed Keets bundle')
        names = package.namelist()
        if len(names) != len(set(names)):
            raise ValueError(f'{apk}: duplicate ZIP entries')
        abis = {name.split('/')[1] for name in names if name.startswith('lib/') and name.endswith('.so')}
        if not abis or not abis.issubset(ABIS):
            raise ValueError(f'{apk}: missing or unsupported native ABIs')
        for abi in sorted(abis):
            for name in sorted(addons | {'libbare-kit.so', 'libc++_shared.so'}):
                source = ((root / 'app/src/main/jniLibs' / abi / name).read_bytes()
                          if name in addons else runtime.read(f'jni/{abi}/{name}'))
                packaged = package.read(f'lib/{abi}/{name}')
                if elf_sections(source, abi) != elf_sections(packaged, abi):
                    raise ValueError(f'{apk}: changed native code/data in {abi}/{name}')
    print(f'{apk.name}: exact Keets bundle and {len(addons)} addons/runtime per ABI verified.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--abi', choices=ABIS, action='append')
    parser.add_argument('--apk-dir', type=Path)
    parser.add_argument('--remove-invalid-apk', action='store_true')
    args = parser.parse_args()
    try:
        pinned_outputs(args.root)
        count = verify(args.root, args.abi or ABIS)
        if args.apk_dir:
            apks = list(args.apk_dir.glob('*.apk'))
            if not apks:
                raise ValueError(f'no APKs found in {args.apk_dir}')
            for apk in apks:
                try:
                    verify_apk(args.root, apk)
                except (OSError, ValueError, KeyError, struct.error, IndexError, zipfile.BadZipFile):
                    if args.remove_invalid_apk and apk.resolve().is_relative_to(
                            (args.root / 'app/build/outputs/apk').resolve()):
                        apk.unlink(missing_ok=True)
                    raise
    except (OSError, ValueError, KeyError, TypeError, AttributeError, zipfile.BadZipFile, struct.error, IndexError) as error:
        parser.exit(1, f'Keets artifacts are incomplete: {error}\n'
                    'Run python3 scripts/prepare-keets.py; see docs/KEETS_BUILD.md.\n')
    print(f'Keets bundle, {count} linked addons per ABI, and Bare runtime verified.')
