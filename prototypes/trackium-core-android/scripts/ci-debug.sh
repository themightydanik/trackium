#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/check-source-manifests.py
python3 scripts/verify-prototype.py
python3 scripts/check-licenses.py --output dist/license-audit.json
python3 scripts/test-keets-artifacts.py
python3 scripts/test-keets-preparation.py
python3 scripts/test_manifest_checks.py
# One Gradle invocation: never race test result writers against a second build.
./gradlew --no-daemon --max-workers=2 \
  :app:assembleBlockDebug :app:lintBlockDebug :integrated-trackium:lintDebug \
  :app:testBlockDebugUnitTest :integrated-trackium:testDebugUnitTest \
  :minimaapi:testDebugUnitTest :localization:testDebugUnitTest \
  :integrated-history:testDebugUnitTest :core-regression:test :maxima-core:test
python3 scripts/package-debug.py
