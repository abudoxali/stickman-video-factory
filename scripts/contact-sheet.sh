#!/usr/bin/env bash
# Build labelled contact sheets from a video for sequential-motion QA.
# Usage: scripts/contact-sheet.sh <video> <outdir> [every_n_frames=6] [cols=6] [rows=4] [start_frame=0] [end_frame=end]
set -euo pipefail
VID="$1"; OUT="$2"; N="${3:-6}"; COLS="${4:-6}"; ROWS="${5:-4}"; START="${6:-0}"; END="${7:-999999}"
mkdir -p "$OUT"
rm -f "$OUT"/sheet_*.png
ffmpeg -v error -y -i "$VID" -vf "select='between(n\,${START}\,${END})*not(mod(n-${START}\,${N}))',scale=270:-1,drawtext=text='%{eif\:n*${N}+${START}\:d}':x=6:y=6:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6,tile=${COLS}x${ROWS}:padding=4:color=white" -vsync vfr "$OUT/sheet_%02d.png"
ls "$OUT"/sheet_*.png
