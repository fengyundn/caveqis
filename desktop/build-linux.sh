#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

root="$(cd .. && pwd)"
python=.build/venv/bin/python
if [[ ! -x "$python" ]]; then
    python3 -m venv .build/venv
fi

"$python" -m pip install -r ../requirements.txt -r requirements-build.txt
npm ci --no-audit --no-fund
"$python" prepare_resources.py
"$python" -m PyInstaller --noconfirm --onedir --name caveqis-engine \
    --paths "$root" --add-data "$root/static:static" --exclude-module PIL \
    --specpath .build --workpath .build/pyinstaller --distpath .build/engine engine_entry.py
npm run build:linux
