#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
TARGET="${1:-$ROOT/src/themes/default/blocks/header.tsx}"
BACKUP="$ROOT/.rankup/artifacts/header.tsx.before-mobile-menu-auto-close"

test -f "$BACKUP"
cp "$BACKUP" "$TARGET"
printf 'restored %s from %s\n' "$TARGET" "$BACKUP"
