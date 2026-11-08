#!/usr/bin/env bash
# Explicit official SDK bootstrap: no reliance on a runner's preinstalled PATH.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${RUNNER_TEMP:?This installer is for an ephemeral Actions runner}"
: "${GITHUB_ENV:?Actions environment output required}"
: "${GITHUB_PATH:?Actions PATH output required}"
sdk_root="$RUNNER_TEMP/trackium-android-sdk"
archive="$RUNNER_TEMP/trackium-commandline-tools.zip"
readarray -t pin < <(python3 - <<'PY'
import json
j=json.load(open('scripts/android-tools.lock.json'))['command_line_tools']
print(j['url']);print(j['sha256'])
PY
)
test "${#pin[@]}" -eq 2
test ! -e "$sdk_root"
curl --fail --location --silent --show-error --retry 3 --connect-timeout 30 --max-time 900 \
  --proto '=https' --proto-redir '=https' "${pin[0]}" -o "$archive"
printf '%s  %s\n' "${pin[1]}" "$archive" | sha256sum -c -
mkdir -p "$sdk_root/cmdline-tools"
unzip -q "$archive" -d "$sdk_root/cmdline-tools"
mv "$sdk_root/cmdline-tools/cmdline-tools" "$sdk_root/cmdline-tools/latest"
export ANDROID_HOME="$sdk_root"
export ANDROID_SDK_ROOT="$sdk_root"
sdkmanager="$sdk_root/cmdline-tools/latest/bin/sdkmanager"
printf 'y\n%.0s' {1..100} > "$RUNNER_TEMP/trackium-sdk-licenses.txt"
"$sdkmanager" --sdk_root="$sdk_root" --licenses < "$RUNNER_TEMP/trackium-sdk-licenses.txt" > /dev/null
readarray -t packages < <(python3 -c 'import json;print("\n".join(json.load(open("scripts/android-tools.lock.json"))["packages"]))')
"$sdkmanager" --sdk_root="$sdk_root" "${packages[@]}" < "$RUNNER_TEMP/trackium-sdk-licenses.txt"
printf 'ANDROID_HOME=%s\nANDROID_SDK_ROOT=%s\n' "$sdk_root" "$sdk_root" >> "$GITHUB_ENV"
printf '%s\n%s\n' "$sdk_root/cmdline-tools/latest/bin" "$sdk_root/platform-tools" >> "$GITHUB_PATH"
