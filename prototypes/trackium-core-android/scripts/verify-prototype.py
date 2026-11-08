#!/usr/bin/env python3
"""Verify immutable engine and report imported source changes; no network/secrets."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    lock = json.loads((ROOT / 'sources.lock.json').read_text())
    expected = lock['eurobuddha/minima-core-android']['minima_jar_sha256']
    assert digest(ROOT / 'app/libs/minima.jar') == expected, 'Preserved Eurobuddha engine checksum mismatch'
    imported = json.loads((ROOT / 'UPSTREAM_NOTICES/import-hashes.json').read_text())
    changed, omitted, unchanged = [], [], 0
    for name, original in sorted(imported.items()):
        path = ROOT / name
        if not path.exists():
            omitted.append(name)
        elif digest(path) != original:
            changed.append(name)
        else:
            unchanged += 1
    report = {'engine_sha256': expected, 'unchanged_imports': unchanged,
              'modified_imports': changed, 'omitted_imports': omitted}
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
