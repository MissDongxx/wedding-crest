#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
PATCH="$ROOT/.rankup/artifacts/perf-fix.patch"
cd "$ROOT"
git apply --reverse --check "$PATCH"
git apply --reverse "$PATCH"
printf '%s\n' 'Rollback applied: homepage performance patch reversed.'
