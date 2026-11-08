#!/usr/bin/env python3
"""Guard regressions: corrupted evidence fails; debug validation never clears release rights."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('source_checks', ROOT / 'scripts/check-source-manifests.py')
checks = importlib.util.module_from_spec(spec); spec.loader.exec_module(checks)

class ManifestChecksTest(unittest.TestCase):
    def test_rejects_changed_checksum_and_missing_evidence(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(checks, 'ROOT', Path(tmp)):
            Path(tmp, 'notice').write_bytes(b'original')
            sha = hashlib.sha256(b'original').hexdigest()
            checks.checked('notice', sha)
            Path(tmp, 'notice').write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError, 'Checksum mismatch'): checks.checked('notice', sha)
            with self.assertRaises(FileNotFoundError): checks.checked('missing', sha)

    def test_rejects_external_paths(self):
        for name in ('../outside', '/tmp/outside', 'a/../../outside'):
            with self.assertRaisesRegex(ValueError, 'Unsafe manifest path'): checks.checked(name, '0'*64)

    def test_rejects_malformed_pin(self):
        with self.assertRaisesRegex(ValueError, 'Invalid SHA256'): checks.checked('LICENSE', 'not-a-hash')

    def test_debug_evidence_validation_reports_unresolved_rights(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp, 'audit.json')
            subprocess.run([sys.executable, str(ROOT/'scripts/check-licenses.py'), '--output', str(out)], check=True, capture_output=True)
            report = json.loads(out.read_text())
            self.assertTrue(report['release_blocked'])
            self.assertEqual(21, report['native_package_versions'])
            self.assertTrue(report['blockers'])

    def test_release_gate_refuses_incomplete_clearance(self):
        result = subprocess.run([sys.executable, str(ROOT/'scripts/check-licenses.py'), '--release'], capture_output=True, text=True)
        self.assertNotEqual(0, result.returncode)
        self.assertIn('Release blocked', result.stderr)

if __name__ == '__main__': unittest.main()
