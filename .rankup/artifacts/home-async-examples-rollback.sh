#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
PATCH="$ROOT/.rankup/artifacts/home-async-examples.patch"
cd "$ROOT"
git apply --reverse --check "$PATCH"
git apply --reverse "$PATCH"
printf '%s\n' 'Rollback applied: homepage async-examples patch reversed.'
