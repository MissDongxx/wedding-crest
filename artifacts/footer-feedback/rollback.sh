#!/bin/sh
set -eu
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repo_root"
git apply --reverse --check artifacts/footer-feedback/footer-feedback.patch
git apply --reverse artifacts/footer-feedback/footer-feedback.patch
printf '%s\n' 'Rolled back footer feedback form changes.'
