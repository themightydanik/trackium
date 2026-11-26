#!/usr/bin/env bash
set -euo pipefail

apk=${1:?Usage: check-core-app-links.sh CORE_APK [--check-live]}
mode=${2:-}
if [[ $# -gt 2 || ( -n "$mode" && "$mode" != --check-live ) ]]; then
  exit 2
fi
apk_signer=${TRACKIUM_APKSIGNER:-apksigner}
aapt=${TRACKIUM_AAPT2:-aapt2}
package=$("$aapt" dump badging "$apk" | sed -n "s/^package: name='\([^']*\)'.*/\1/p")
if [[ "$package" != tech.trackium.core.prototype ]]; then
  echo 'Unexpected Core APK package' >&2
  exit 1
fi
signing=$("$apk_signer" verify --print-certs "$apk")
digests=$(printf '%s\n' "$signing" | sed -n 's/^Signer #[0-9]* certificate SHA-256 digest: //p')
if [[ ! "$digests" =~ ^[a-fA-F0-9]{64}$ ]]; then
  echo 'Expected exactly one verified APK signing certificate' >&2
  exit 1
fi
fingerprint=$(printf '%s' "${digests^^}" | sed 's/../&:/g; s/:$//')
printf 'CORE_ANDROID_CERT_SHA256=%s\n' "$fingerprint"
if [[ "$mode" != --check-live ]]; then
  exit 0
fi

# Deliberately omit redirect following. Android expects a direct HTTPS response.
body=$(mktemp)
trap 'rm -f "$body"' EXIT
result=$(curl --silent --show-error --proto '=https' --max-time 12 \
  --output "$body" --write-out '%{http_code} %{content_type}' \
  'https://trackium-gateway-production.up.railway.app/.well-known/assetlinks.json')
if [[ ! "$result" =~ ^200\ application/json([[:space:]]*\;.*)?$ ]]; then
  printf 'Digital Asset Links expected direct HTTP 200 with JSON, received %s\n' "$result" >&2
  exit 1
fi
node - "$body" "$package" "$fingerprint" <<'JS'
const fs = require('node:fs');
const [path, packageName, fingerprint] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(path,'utf8'));
const android = Array.isArray(rows) ? rows.filter(r => r?.target?.namespace === 'android_app') : [];
if (android.length !== 1 ||
    !android[0].relation?.includes('delegate_permission/common.handle_all_urls') ||
    android[0].target.package_name !== packageName ||
    JSON.stringify(android[0].target.sha256_cert_fingerprints) !== JSON.stringify([fingerprint])) {
  console.error('Digital Asset Links statement differs from this signed Core APK');
  process.exitCode = 1;
} else {
  console.log('Digital Asset Links matches this signed Core APK');
}
JS
