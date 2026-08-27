#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROLLBACK_ROOT:-$(git rev-parse --show-toplevel)}"

git -C "$ROOT" checkout HEAD -- \
  package.json \
  content/posts \
  src/config/index.ts \
  src/themes/default/blocks/upload-zone-block.tsx \
  'src/app/[locale]/(landing)/(ai)' \
  public/images/blog \
  public/images/examples \
  public/imgs/bg \
  public/imgs/cases \
  public/imgs/features \
  public/preview.png

rm -f \
  "$ROOT/scripts/check-public-size.mjs" \
  "$ROOT/public/preview.webp" \
  "$ROOT/public/imgs/bg/tree.webp"
rm -f "$ROOT"/public/images/blog/*.webp
rm -f "$ROOT"/public/images/examples/*.webp

echo "restored original asset tree and removed the size gate"
