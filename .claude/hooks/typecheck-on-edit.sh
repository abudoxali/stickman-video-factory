#!/usr/bin/env bash
# PostToolUse hook: after an Edit/Write to a TypeScript file under src/ or
# tests/, run the TypeScript typecheck (~5 s). Exit 2 feeds errors back to
# Claude. Never installs packages, never renders, never touches files.
set -uo pipefail
input="$(cat)"
file="$(printf '%s' "$input" | python3 -c 'import sys,json; d=json.load(sys.stdin); print((d.get("tool_input") or {}).get("file_path",""))' 2>/dev/null)"
case "$file" in
  */src/*.ts|*/src/*.tsx|*/tests/*.ts|*/scripts/*.ts) ;;
  *) exit 0 ;;
esac
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}" || exit 0
[ -d node_modules ] || exit 0
if ! out="$(npx --no-install tsc --noEmit 2>&1)"; then
  echo "TypeScript errors after editing $file:" >&2
  echo "$out" | head -30 >&2
  exit 2
fi
exit 0
