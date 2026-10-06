#!/bin/sh
set -eu
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repo_root"
git apply --reverse --check artifacts/sign-in-loading-fix/sign-in-loading.patch
git apply --reverse artifacts/sign-in-loading-fix/sign-in-loading.patch
printf '%s\n' 'Rolled back sign-in loading fix.'
