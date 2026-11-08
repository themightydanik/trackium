#!/usr/bin/env bash
# Fetch the checksum-pinned Bare Kit prebuild and retain its Android AAR layout.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "${1:-}" != "--prepared" ]; then
  exec python3 scripts/prepare-keets.py --component runtime "$@"
fi
: "${KEETS_RUNTIME_ARCHIVE:?verified archive required}"
: "${KEETS_OUTPUT_ROOT:?prepared output directory required}"
python3 - <<'PYTHON'
import importlib.util, json, os
from pathlib import Path
spec = importlib.util.spec_from_file_location('prepare', 'scripts/prepare-keets.py')
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
pins = json.loads(Path('scripts/keets-dependencies.lock.json').read_text())
archive = module.checked(Path(os.environ['KEETS_RUNTIME_ARCHIVE']), pins['runtime']['sha256'])
module.runtime_archive(archive, Path(os.environ['KEETS_OUTPUT_ROOT']) / 'app/libs/bare-kit.aar', pins['runtime']['version'])
print('Keets: checksum-verified Bare Kit AAR prepared.')
PYTHON
