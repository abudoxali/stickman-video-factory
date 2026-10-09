#!/usr/bin/env bash
# Deterministic final render: Remotion PNG frames -> pinned ffmpeg/x264 encode.
# (Remotion's built-in JPEG+encode path showed sub-LSB frame drift between runs;
#  PNG frames and this encode are byte-reproducible — see STATUS.md.)
# Usage: scripts/render-final.sh <CompositionId> <out.mp4> [concurrency=4]
set -euo pipefail
COMP="$1"; OUT="$2"; CONC="${3:-4}"
FRAMES="out/frames/${COMP}-$$"
rm -rf "$FRAMES"; mkdir -p "$FRAMES" "$(dirname "$OUT")"
start=$(date +%s)
npx remotion render "$COMP" "$FRAMES" --sequence --image-format=png --concurrency="$CONC" --log=error
mid=$(date +%s)
COUNT=$(ls "$FRAMES"/*.png | wc -l)
echo "rendered $COUNT PNG frames"
# zero-padded names sort correctly, so a glob input keeps frame order
ffmpeg -v error -y -framerate 30 -pattern_type glob -i "$FRAMES/*.png" \
  -c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p -tune animation \
  -movflags +faststart "$OUT"
end=$(date +%s)
rm -rf "$FRAMES"
echo "rendered $COMP -> $OUT (frames ${mid}-${start}=$((mid-start))s, encode $((end-mid))s)"
