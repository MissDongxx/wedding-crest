#!/bin/sh
set -eu
ROOT="${ROLLBACK_ROOT:-/Users/xumingyue/Downloads/MyProjects/wedding-crest2}"
ART="$ROOT/.rankup/artifacts/runware-svg-frame-fix"
mkdir -p "$ROOT/src/app/api/projects/[id]/generate"
cp "$ART/original/generate-route.ts" "$ROOT/src/app/api/projects/[id]/generate/route.ts"
if [ "${ROLLBACK_SKIP_DATA:-0}" != "1" ]; then
  cd "$ROOT"
  node "$ART/rollback-data.mjs" --apply
fi
printf '%s\n' 'rollback complete'
