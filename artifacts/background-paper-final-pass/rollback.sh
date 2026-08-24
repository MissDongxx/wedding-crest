#!/bin/sh
set -eu
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
cp "$SCRIPT_DIR/original/global.css.snapshot" "$ROOT/src/config/style/global.css"
cp "$SCRIPT_DIR/original/theme.css.snapshot" "$ROOT/src/config/style/theme.css"
rm -f "$ROOT/public/paper-noise.svg"
printf '%s\n' 'Rolled back final paper texture pass.'
