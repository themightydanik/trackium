#!/usr/bin/env python3
"""Export only the verified debug APK and safe provenance, never an entire workspace."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import xml.etree.ElementTree as ET
ROOT = Path(__file__).resolve().parents[1]

def main():
    if subprocess.check_output(['git','status','--porcelain','--untracked-files=normal'], cwd=ROOT, text=True).strip():
        raise ValueError('Commit the reviewed source before exporting an APK with commit provenance')
    sdk = Path(os.environ.get('ANDROID_HOME') or os.environ['ANDROID_SDK_ROOT'])
    tools = sdk/'build-tools/35.0.0'
    apk = ROOT/'app/build/outputs/apk/block/debug/app-block-debug.apk'
    badging = subprocess.check_output([str(tools/'aapt'), 'dump', 'badging', str(apk)], text=True)
    if "package: name='tech.trackium.core.prototype'" not in badging or 'application-debuggable' not in badging:
        raise ValueError('Only the isolated debuggable prototype may be exported')
    signature = subprocess.check_output([str(tools/'apksigner'), 'verify', '--verbose', '--print-certs', str(apk)], text=True)
    if 'Verified using v2 scheme (APK Signature Scheme v2): true' not in signature or 'CN=Android Debug' not in signature:
        raise ValueError('Expected an independently generated Android debug signature')
    certificate = re.search(r'Signer #1 certificate SHA-256 digest: ([0-9a-f]{64})', signature).group(1)
    destination = ROOT/'dist'; destination.mkdir(exist_ok=True)
    output = destination/'trackium-core-debug.apk'; shutil.copyfile(apk, output)
    sha = hashlib.sha256(output.read_bytes()).hexdigest()
    (destination/'SHA256SUMS').write_text(sha+'  trackium-core-debug.apk\n')
    (destination/'apk-signature.txt').write_text(signature)
    commit = subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    summary = {}
    for module, task in [('app','testBlockDebugUnitTest'),('integrated/trackium','testDebugUnitTest'),('minimaapi','testDebugUnitTest'),('localization','testDebugUnitTest'),('integrated/history','testDebugUnitTest'),('core-regression','test')]:
        roots = [ET.parse(p).getroot() for p in (ROOT/module/'build/test-results'/task).glob('TEST-*.xml')]
        if not roots: raise ValueError('Missing test evidence: '+module)
        counts = {k:sum(int(x.get(k,0)) for x in roots) for k in ['tests','failures','errors','skipped']}
        if counts['failures'] or counts['errors']: raise ValueError('Failed tests: '+module)
        summary[module] = counts
    lint = ET.parse(ROOT/'app/build/reports/lint-results-blockDebug.xml').getroot()
    from collections import Counter
    lint_counts = Counter(x.get('severity') for x in lint)
    if lint_counts['Error'] or lint_counts['Fatal']: raise ValueError('Host lint errors remain')
    report = {'application_id':'tech.trackium.core.prototype','source_commit':commit,
              'repository':os.environ.get('GITHUB_REPOSITORY','local'), 'run_id':os.environ.get('GITHUB_RUN_ID'),
              'sha256':sha,'bytes':output.stat().st_size,'signer_sha256':certificate,
              'engine_sha256':hashlib.sha256((ROOT/'app/libs/minima.jar').read_bytes()).hexdigest(),
              'java_version':subprocess.check_output(['java','--version'],text=True).splitlines()[0],
              'build_tools':'35.0.0','lint':dict(lint_counts),'tests':summary,
              'release_blocked':json.loads((destination/'license-audit.json').read_text())['release_blocked']}
    (destination/'build-evidence.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__ == '__main__': main()
