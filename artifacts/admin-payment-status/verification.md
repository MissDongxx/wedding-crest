# Admin payment status verification

## Baseline

Command:

```sh
node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('artifacts/admin-payment-status/originals/src/config/locale/messages/zh/admin/payments.json','utf8')); console.log(JSON.stringify({createdLabel:p.list.filters.status.options.created,canceledLabel:p.list.filters.status.options.canceled??null}));"
```

Input: preserved original Chinese Admin payment translations.

Literal output:

```text
{"createdLabel":"已创建","canceledLabel":null}
```

Exit status: `0`.

## Modified behavior matrix

Command:

```sh
pnpm exec tsx -e "import assert from 'node:assert/strict'; import { getPaymentDisplayStatus } from './src/shared/lib/payment-status'; const now=Date.parse('2026-10-06T12:00:00Z'); const cases=[['paid','2026-10-06T11:00:00Z','paid'],['failed','2026-10-06T11:00:00Z','failed'],['canceled','2026-10-06T11:00:00Z','canceled'],['created','2026-10-06T11:00:00Z','awaiting_payment'],['created','2026-10-06T08:59:59Z','expired'],['pending','2026-10-06T11:00:00Z','pending']]; for (const [status,createdAt,expected] of cases) assert.equal(getPaymentDisplayStatus(status,createdAt,now),expected); console.log(JSON.stringify(cases.map(([status,createdAt,expected])=>({status,createdAt,display:expected})),null,2));"
```

Inputs: fixed current time `2026-10-06T12:00:00Z`; paid, failed, canceled, recent-created, older-created, and pending orders.

Literal output:

```text
[
  {"status":"paid","createdAt":"2026-10-06T11:00:00Z","display":"paid"},
  {"status":"failed","createdAt":"2026-10-06T11:00:00Z","display":"failed"},
  {"status":"canceled","createdAt":"2026-10-06T11:00:00Z","display":"canceled"},
  {"status":"created","createdAt":"2026-10-06T11:00:00Z","display":"awaiting_payment"},
  {"status":"created","createdAt":"2026-10-06T08:59:59Z","display":"expired"},
  {"status":"pending","createdAt":"2026-10-06T11:00:00Z","display":"pending"}
]
```

Exit status: `0`.

Target order check command:

```sh
node --import tsx -e "import('./src/shared/lib/payment-status.ts').then(({default:m})=>console.log(JSON.stringify({orderNo:'87360513370803763',storedStatus:'created',createdAt:'2026-10-04T05:08:23.334Z',adminDisplay:m.getPaymentDisplayStatus('created','2026-10-04T05:08:23.334Z',Date.parse('2026-10-06T02:00:00Z'))})))"
```

Literal output:

```text
{"orderNo":"87360513370803763","storedStatus":"created","createdAt":"2026-10-04T05:08:23.334Z","adminDisplay":"expired"}
```

Exit status: `0`.

## Static and production build checks

Commands and results:

```text
pnpm exec eslint <changed TypeScript files>
Exit status: 0 (one pre-existing warning in src/shared/services/payment.ts)

pnpm exec tsc --noEmit
Output: (empty)
Exit status: 0

git diff --check
Output: (empty)
Exit status: 0

pnpm run build
Output includes:
✓ Compiled successfully in 82s
ƒ /[locale]/admin/payments
ƒ /api/payment/cancel
Exit status: 0
```

## Browser verification

Temporary local visual harness URL: `http://127.0.0.1:3019/status-preview` (removed after verification).

Literal server/browser observations:

```text
GET /status-preview 200
支付状态预览
已支付 paid 支付失败 failed 用户已取消 canceled 等待用户付款 awaiting_payment 未支付（已过期） expired
```

Visible badge colors: green paid, red failed, gray canceled, blue awaiting payment, amber expired. No runtime error was shown by the page or development server. Exit status for the HTTP check: `0`.

## Rollback verification

Command:

```sh
artifacts/admin-payment-status/rollback.sh /tmp/payment-status-rollback-check
```

Literal output:

```text
Rolled back payment status changes in /tmp/payment-status-rollback-check
rollback-verification=PASS
```

All restored files matched the preserved originals byte-for-byte; the two newly added files were absent. Exit status: `0`.
