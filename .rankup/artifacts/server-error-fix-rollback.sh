#!/usr/bin/env bash
set -euo pipefail
ROOT="${PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$ROOT"
git checkout -- \
  'src/app/[locale]/(admin)/admin/wedding/examples/_delete-button.tsx' \
  'src/app/[locale]/(admin)/admin/wedding/frames/_delete-button.tsx' \
  'src/config/locale/messages/de/pages/examples.json' \
  'src/config/locale/messages/fr/pages/examples.json' \
  'src/config/locale/messages/it/pages/examples.json' \
  'src/config/locale/messages/ko/pages/examples.json' \
  'src/config/locale/messages/pt-BR/pages/examples.json' \
  'src/config/locale/messages/th/pages/examples.json' \
  'src/config/locale/messages/zh/pages/examples.json' \
  'src/core/db/d1.ts'
rm -f 'src/shared/types/fetch-compat.d.ts'
printf '%s\n' 'Rolled back server-error-fix source changes.'
