#!/usr/bin/env bash
# Build the keets worklet from the keets repo sidecar (single source of truth):
#   app/src/main/assets/keets.bundle           — bare-pack output (android-arm64 + android-arm)
#   app/src/main/jniLibs/<abi>/lib<mod>.<ver>.so — the addons' android prebuilds, in the
#                                                  linked: naming bare resolves at runtime
# Neither output is committed; this script is how CI and a fresh clone produce them.
# bare-pack is run under the bare runtime — its native lexer segfaults under node >= 24.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "${1:-}" != "--prepared" ]; then
  exec python3 scripts/prepare-keets.py --component worklet "$@"
fi
: "${KEETS_OUTPUT_ROOT:?prepared output directory required}"
: "${KEETS_SIDECAR_DIR:?pinned sidecar required}"
: "${KEETS_BARE:?pinned Bare executable required}"
: "${KEETS_PACK:?pinned bare-pack required}"
SIDECAR="$KEETS_SIDECAR_DIR"
PACK="$KEETS_PACK"

# node builtins → bare equivalents, applied at pack time only (the sidecar picks them at
# runtime itself; node's loader can't express this map, bare-pack's --imports can).
WORK="$(mktemp -d)"
IMPORTS="$WORK/imports.json"
trap 'rm -rf "$WORK"' EXIT
cat > "$IMPORTS" <<'EOF'
{ "net": "bare-tcp", "fs": "bare-fs", "path": "bare-path", "process": "bare-process", "http": "bare-http1" }
EOF

mkdir -p "$KEETS_OUTPUT_ROOT/app/src/main/assets"
( cd "$SIDECAR" && "$KEETS_BARE" "$PACK" \
    --host android-arm64 --host android-arm --host android-x64 \
    --linked --imports "$IMPORTS" \
    --out "$KEETS_OUTPUT_ROOT/app/src/main/assets/keets.bundle" index.js )
echo "packed app/src/main/assets/keets.bundle ($(du -h "$KEETS_OUTPUT_ROOT/app/src/main/assets/keets.bundle" | cut -f1))"

# addon prebuilds → jniLibs, named lib<module>.<version>.so (bare's linked: convention).
# Walk node_modules RECURSIVELY: npm nests a second copy when versions conflict
# (bare-tty/node_modules/bare-signals@5 vs top-level @4), and the bundle requires the
# nested version — missing it is a native CANNOT_LOAD abort on-device (proven 2026-10-13).
declare -a MAP=("android-arm64:arm64-v8a" "android-arm:armeabi-v7a" "android-x64:x86_64")
COUNT=0
while IFS= read -r predir; do
  moddir="$(dirname "$predir")"
  mod="$(basename "$moddir")"
  for pair in "${MAP[@]}"; do
    host="${pair%%:*}"; abi="${pair##*:}"
    pre="$predir/$host/$mod.bare"
    if [ -f "$pre" ]; then
      ver="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$moddir/package.json" | head -1)"
      mkdir -p "$KEETS_OUTPUT_ROOT/app/src/main/jniLibs/$abi"
      cp "$pre" "$KEETS_OUTPUT_ROOT/app/src/main/jniLibs/$abi/lib$mod.$ver.so"
      COUNT=$((COUNT+1))
    fi
  done
done < <(find "$SIDECAR/node_modules" -type d -name prebuilds)
echo "linked $COUNT addon prebuilds into app/src/main/jniLibs/"
