#!/bin/sh
set -eu
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repo_root"
git apply --reverse --check artifacts/brevo-sender-fix/brevo-sender-fix.patch
git apply --reverse artifacts/brevo-sender-fix/brevo-sender-fix.patch
printf '%s\n' 'Rolled back Brevo sender-name fix (code only).'
printf '%s\n' 'NOTE: the production config row was changed too — to revert that, set'
printf '%s\n' '      "wedding-crest".config.brevo_sender_name back to an empty string.'
