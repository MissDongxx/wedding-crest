#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
TARGET="${1:-$ROOT/src/themes/default/blocks/wedding-result.tsx}"
BACKUP="$ROOT/.rankup/artifacts/wedding-result.tsx.before"

if [ ! -f "$BACKUP" ]; then
  echo "backup not found: $BACKUP" >&2
  exit 1
fi

cp "$BACKUP" "$TARGET"
printf 'restored %s from %s\n' "$TARGET" "$BACKUP"
