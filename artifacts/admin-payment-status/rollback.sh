#!/bin/sh
set -eu

ROOT="${1:-/Users/xumingyue/Downloads/MyProjects/wedding-crest2}"
ART="/Users/xumingyue/Downloads/MyProjects/wedding-crest2/artifacts/admin-payment-status/originals"

restore() {
  source_path="$1"
  target_path="$2"
  mkdir -p "$(dirname "$ROOT/$target_path")"
  cp "$ART/$source_path" "$ROOT/$target_path"
}

restore 'src/app/[locale]/(admin)/admin/payments/page.tsx.original' 'src/app/[locale]/(admin)/admin/payments/page.tsx'
restore 'src/app/api/payment/checkout/route.ts.original' 'src/app/api/payment/checkout/route.ts'
restore 'src/shared/models/order.ts.original' 'src/shared/models/order.ts'
restore 'src/shared/services/payment.ts.original' 'src/shared/services/payment.ts'
for locale in de en fr it ko pt-BR th zh; do
  restore "src/config/locale/messages/$locale/admin/payments.json" "src/config/locale/messages/$locale/admin/payments.json"
done
rm -f "$ROOT/src/app/api/payment/cancel/route.ts"
rm -f "$ROOT/src/shared/lib/payment-status.ts"
printf 'Rolled back payment status changes in %s\n' "$ROOT"
