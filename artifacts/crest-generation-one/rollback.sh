#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
backup="$root/artifacts/crest-generation-one/original"

while IFS= read -r -d '' file; do
  rel="${file#$backup/}"
  if [[ "$rel" == *.ts.snapshot ]]; then
    target_rel="${rel%.snapshot}"
  else
    target_rel="$rel"
  fi
  mkdir -p "$root/$(dirname "$target_rel")"
  cp "$file" "$root/$target_rel"
done < <(find "$backup" -type f -print0)

echo "Restored crest-generation-one baseline files."
