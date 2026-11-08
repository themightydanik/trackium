#!/usr/bin/env bash
# Explicit opt-in only; never clears data or imports wallets.
set -euo pipefail
cd "$(dirname "$0")/.."
serial=${1:?Usage: test-disposable-emulator.sh emulator-NNNN fresh\|restart}
phase=${2:?Explicit fresh or restart phase required}
[[ "$serial" == emulator-* ]] || { echo 'Only a disposable emulator serial is permitted' >&2; exit 2; }
[[ "$phase" == fresh || "$phase" == restart ]] || exit 2
[[ "$(adb -s "$serial" shell getprop ro.kernel.qemu | tr -d '\r')" == 1 ]] || exit 2
# The instrumentation also checks emulator hardware, exact package ID, and fresh data
# or the fixture's public-key marker. It refuses an existing non-fixture wallet.
if [[ "$phase" == restart ]]; then adb -s "$serial" shell am force-stop tech.trackium.core.prototype; fi
out=$(mktemp)
trap 'rm -f "$out"' EXIT
adb -s "$serial" shell am instrument -w -r \
    -e class tech.trackium.core.TrackiumCoreIntegrationTest \
    -e trackiumDisposable true -e trackiumPhase "$phase" \
    tech.trackium.core.prototype.test/androidx.test.runner.AndroidJUnitRunner > "$out" 2>&1
cat "$out"
grep -q 'OK (1 test)' "$out"
