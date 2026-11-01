#!/usr/bin/env bash
# Subset the open-source brand fonts to the glyphs this site actually uses.
# Requires: python3 -m pip install fonttools brotli
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p assets/fonts

python3 - <<'PY'
ascii_chars = "".join(chr(c) for c in range(0x20, 0x7F))
extra = "手拭い—–·×÷±≤≥→←↑↓●○◆◇・「」、。©®’‘“”…€£¥"
with open("tools/brandchars.txt", "w", encoding="utf-8") as f:
    f.write(ascii_chars + extra)
with open("tools/latinchars.txt", "w", encoding="utf-8") as f:
    f.write(ascii_chars + extra.replace("手拭い", ""))
PY

subset() {
  local src="$1" out="$2" chars="$3"
  python3 -m fontTools.subset "$src" \
    --text-file="$chars" \
    --layout-features='*' \
    --flavor=woff2 \
    --desubroutinize \
    --no-hinting \
    --output-file="$out"
}

subset tools/DelaGothicOne-Regular.ttf assets/fonts/dela-gothic.woff2 tools/brandchars.txt
subset tools/inter-400.ttf assets/fonts/inter-400.woff2 tools/latinchars.txt
subset tools/inter-500.ttf assets/fonts/inter-500.woff2 tools/latinchars.txt
subset tools/inter-600.ttf assets/fonts/inter-600.woff2 tools/latinchars.txt
subset tools/plex-mono-400.ttf assets/fonts/plex-mono-400.woff2 tools/latinchars.txt
subset tools/plex-mono-500.ttf assets/fonts/plex-mono-500.woff2 tools/latinchars.txt

cp tools/OFL-DelaGothicOne.txt assets/fonts/OFL-DelaGothicOne.txt
cp tools/OFL-Inter.txt assets/fonts/OFL-Inter.txt
cp tools/OFL-IBMPlexMono.txt assets/fonts/OFL-IBMPlexMono.txt

ls -lh assets/fonts
