#!/usr/bin/env python3
"""Check captured legal evidence, not a legal clearance. Unknown rights block release."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import importlib.util
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('source_checks', ROOT / 'scripts/check-source-manifests.py')
checks = importlib.util.module_from_spec(spec); spec.loader.exec_module(checks)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--release', action='store_true', help='Fail if any rights remain unresolved')
    args = parser.parse_args()
    pins = json.loads((ROOT / 'scripts/keets-dependencies.lock.json').read_text())
    evidence_pins = json.loads((ROOT / 'UPSTREAM_NOTICES/license-evidence-pins.json').read_text())
    for name, sha in evidence_pins['files'].items(): checks.checked(name, sha)
    checks.checked('UPSTREAM_NOTICES/keets-sidecar-package-lock.json', pins['source']['lock_sha256'])
    lock = json.loads((ROOT / 'UPSTREAM_NOTICES/keets-sidecar-package-lock.json').read_text())
    spec2 = importlib.util.spec_from_file_location('prepare', ROOT / 'scripts/prepare-keets.py')
    prepare = importlib.util.module_from_spec(spec2); spec2.loader.exec_module(prepare)
    prepare.validate_npm_lock(ROOT / 'UPSTREAM_NOTICES/keets-sidecar-package-lock.json')
    sidecar = json.loads((ROOT / 'UPSTREAM_NOTICES/keets-sidecar-package.json').read_text())
    checks.require(sidecar['license'] == 'MIT', 'Sidecar licence declaration changed')
    native = json.loads((ROOT / 'UPSTREAM_NOTICES/native-license-evidence.json').read_text())
    checks.require(native['source_revision'] == pins['source']['revision'], 'Native evidence revision mismatch')
    checks.require(native['source_lock_sha256'] == pins['source']['lock_sha256'], 'Native evidence lock mismatch')
    expected = {n for n in pins['outputs'] if '/arm64-v8a/' in n}
    checks.require({x['native_output_arm64'] for x in native['native_packages']} == expected, 'Native package coverage incomplete')
    for row in native['native_packages']:
        entry = lock['packages'][row['path']]
        for key, lock_key in [('version','version'),('integrity','integrity'),('resolved','resolved'),('declared_license','license')]:
            checks.require(row[key] == entry[lock_key], 'Native evidence differs from pinned npm lock')
        checks.require(bool(row['legal_files']), 'Native package has no captured legal file')
        for f in row['legal_files']: checks.checked(f['file'], f['sha256'])
    blockers = json.loads((ROOT / 'UPSTREAM_NOTICES/release-blockers.json').read_text())
    checks.require(blockers['release_blocked'] == bool(blockers['blockers']), 'Inconsistent release status')
    checks.require((ROOT / 'NOTICE').is_file(), 'Project NOTICE missing')
    report = {'review_date': evidence_pins['review_date'], 'scope':'Captured evidence only; not legal clearance',
              'sidecar_declared_license':sidecar['license'],
              'sidecar_lock_entries':len(lock['packages']),
              'declared_licenses':dict(Counter(x.get('license','UNKNOWN') for x in lock['packages'].values())),
              'native_package_versions':len(native['native_packages']), **blockers}
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report,indent=2))
    if args.release and blockers['release_blocked']:
        raise SystemExit('Release blocked: unresolved distribution rights/NOTICE inventory')

if __name__ == '__main__': main()
