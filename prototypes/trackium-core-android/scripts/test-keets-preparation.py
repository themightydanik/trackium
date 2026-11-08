#!/usr/bin/env python3
"""Exercise cache, checksum and failure boundaries without network or global tools."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location('prepare', Path(__file__).with_name('prepare-keets.py'))
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


class PreparationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'checkout'
        self.cache = Path(self.temp.name) / 'cache'
        (self.root / 'scripts').mkdir(parents=True)
        self.output = 'app/src/main/assets/keets.bundle'
        self.good = b'fixture verified bundle'
        self.pins = {'outputs': {self.output: hashlib.sha256(self.good).hexdigest()}}
        (self.root / 'scripts/keets-dependencies.lock.json').write_text(json.dumps(self.pins))
        key = hashlib.sha256(json.dumps(self.pins, sort_keys=True).encode()).hexdigest()
        self.prepared = self.cache / 'prepared' / key / 'all'

    def put(self, root, data):
        p = root / self.output
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)

    def test_verified_checkout_needs_no_network_or_tools(self):
        self.put(self.root, self.good)
        with patch.object(prepare, 'build') as build:
            prepare.prepare(self.root, self.cache, True)
            build.assert_not_called()

    def test_verified_cache_repairs_missing_or_corrupt_checkout_offline(self):
        self.put(self.prepared, self.good)
        for previous in (None, b'corrupt'):
            if previous: self.put(self.root, previous)
            with patch.object(prepare, 'build') as build:
                prepare.prepare(self.root, self.cache, True)
                build.assert_not_called()
            self.assertEqual(self.good, (self.root / self.output).read_bytes())

    def test_corrupt_cached_output_is_not_installed(self):
        self.put(self.prepared, b'corrupt')
        with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
            prepare.prepare(self.root, self.cache, True)
        self.assertFalse((self.root / self.output).exists())

    def test_offline_download_miss_never_attempts_network(self):
        with patch.object(prepare, 'run') as run:
            with self.assertRaisesRegex(ValueError, 'offline cache miss'):
                prepare.download(self.cache, {'url': 'https://example.invalid/file', 'sha256': '0' * 64}, True)
            run.assert_not_called()

    def test_download_checksum_failure_never_populates_cache(self):
        def bad(args): Path(args[-1]).write_bytes(b'wrong archive')
        pin = {'url': 'https://example.invalid/file', 'sha256': '0' * 64}
        with patch.object(prepare, 'run', side_effect=bad):
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                prepare.download(self.cache, pin, False)
        self.assertFalse((self.cache / 'downloads' / pin['sha256']).exists())

    def test_bad_build_does_not_replace_existing_files_or_cache(self):
        self.put(self.root, b'old')
        def build(root, cache, pins, stage, offline, component): self.put(stage, b'bad')
        with patch.object(prepare, 'build', side_effect=build):
            with self.assertRaises(ValueError): prepare.prepare(self.root, self.cache)
        self.assertEqual(b'old', (self.root / self.output).read_bytes())
        self.assertFalse(self.prepared.exists())

    def test_successful_build_creates_verified_offline_cache(self):
        def build(root, cache, pins, stage, offline, component): self.put(stage, self.good)
        with patch.object(prepare, 'build', side_effect=build): prepare.prepare(self.root, self.cache)
        self.assertEqual(self.good, (self.prepared / self.output).read_bytes())
        (self.root / self.output).unlink()
        with patch.object(prepare, 'build') as build:
            prepare.prepare(self.root, self.cache, True)
            build.assert_not_called()
        self.assertEqual(self.good, (self.root / self.output).read_bytes())

    def test_npm_packages_without_integrity_are_rejected(self):
        p = self.root / 'package-lock.json'
        p.write_text(json.dumps({'lockfileVersion': 3, 'packages': {'node_modules/test': {'resolved': 'https://registry.npmjs.org/test.tgz'}}}))
        with self.assertRaisesRegex(ValueError, 'unpinned npm'): prepare.validate_npm_lock(p)

    def test_runtime_repack_is_deterministic_and_excludes_other_platforms(self):
        archive = self.root / 'runtime.zip'
        with zipfile.ZipFile(archive, 'w') as z:
            z.writestr('android/bare-kit/classes.jar', b'classes')
            z.writestr('android/bare-kit/AndroidManifest.xml', b'manifest')
            z.writestr('ios/unrelated', b'unrelated')
        a, b = self.root / 'a.aar', self.root / 'b.aar'
        prepare.runtime_archive(archive, a, 'v2.5.5')
        prepare.runtime_archive(archive, b, 'v2.5.5')
        self.assertEqual(a.read_bytes(), b.read_bytes())
        with zipfile.ZipFile(a) as z:
            self.assertEqual(b'v2.5.5\n', z.read('META-INF/bare-kit-version'))
            self.assertNotIn('ios/unrelated', z.namelist())


if __name__ == '__main__': unittest.main()
