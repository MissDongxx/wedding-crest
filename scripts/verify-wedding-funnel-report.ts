import assert from 'node:assert/strict';

import {
  summarizeFunnelInteractions,
  summarizeFunnelPayments,
} from '../src/shared/wedding/funnel-report';

type Diagnostic = Parameters<typeof summarizeFunnelPayments>[0][number];
let index = 0;
const event = (
  stage: string,
  fields: Partial<Diagnostic> = {}
): Diagnostic => ({
  id: String(++index),
  source: 'client',
  stage,
  reason: null,
  details: null,
  ownerId: 'buyer',
  attemptId: 'attempt',
  requestId: 'request',
  orderNo: null,
  orderStatus: null,
  ...fields,
});
const linked = { orderNo: 'paid-order', orderStatus: 'paid' };
const stats = summarizeFunnelPayments(
  [
    event('checkout_received', { source: 'server', ownerId: null }),
    event('clicked'),
    event('session_created', linked),
    event('redirect_started', linked),
    event('redirect_left', linked),
    event('redirect_left', linked),
    event('returned', { ...linked, reason: 'returned_paid' }),
    event('returned', { ...linked, reason: 'returned_paid' }),
    event('checkout_received', {
      attemptId: 'orphan',
      requestId: 'orphan-r',
      ownerId: null,
    }),
    event('checkout_failed', {
      source: 'server',
      attemptId: 'orphan',
      requestId: 'orphan-r',
      reason: 'network_error',
      // A reserved number is not evidence that the order row was inserted.
      orderNo: 'not-persisted',
    }),
    event('request_failed', {
      attemptId: 'orphan',
      requestId: 'orphan-r',
      reason: 'network_error',
    }),
    event('checkout_rejected', {
      source: 'server',
      attemptId: 'unauthenticated',
      requestId: 'unauthenticated-r',
      ownerId: null,
      reason: 'identity_required',
    }),
    event('provider_payment_lookup', {
      source: 'provider',
      attemptId: null,
      ownerId: null,
      orderNo: 'old-failed',
      orderStatus: 'failed',
      reason: 'provider_payment_failed',
      details:
        '{"providerReason":"insufficient_funds","extra":"do not expose"}',
    }),
    event('returned', {
      attemptId: 'pending',
      orderNo: 'pending-order',
      orderStatus: 'created',
      reason: 'returned_paid',
    }),
    event('redirect_not_left', {
      attemptId: 'pending',
      orderNo: 'pending-order',
      orderStatus: 'created',
      reason: 'redirect_timeout',
    }),
  ],
  [
    { orderNo: 'paid-order', status: 'paid' },
    { orderNo: 'canceled-order', status: 'canceled' },
    { orderNo: 'failed-setup', status: 'completed' },
  ]
);

assert.deepEqual(stats.signals, {
  started: 2,
  ready: 1,
  redirect_started: 1,
  redirect_left: 1,
  redirect_not_left: 1,
  returned: 2,
  access_unconfirmed: 0,
});
assert.deepEqual(stats.results, {
  paid: 1,
  failed: 1,
  canceled: 1,
  completed: 1,
  created: 1,
  pending: 0,
});
assert.deepEqual(stats.returns, [{ label: '返回页显示已付款', count: 2 }]);
assert.equal(stats.failuresWithoutOrder, 2);
assert.deepEqual(stats.reasons, [
  { reason: 'identity_required', withOrder: 0, withoutOrder: 1 },
  { reason: 'insufficient_funds', withOrder: 1, withoutOrder: 0 },
  { reason: 'network_error', withOrder: 0, withoutOrder: 1 },
  { reason: 'redirect_timeout', withOrder: 1, withoutOrder: 0 },
  { reason: 'unspecified', withOrder: 1, withoutOrder: 0 },
]);

const acrossOwners = summarizeFunnelPayments(
  [
    event('request_failed', { requestId: null, reason: 'timeout' }),
    event('request_failed', {
      ownerId: 'buyer-2',
      requestId: null,
      reason: 'timeout',
    }),
  ],
  []
);
assert.equal(acrossOwners.failuresWithoutOrder, 2);

const interactions = summarizeFunnelInteractions([
  ...[
    'regenerate_clicked',
    'download_clicked',
    'feedback_liked',
    'feedback_adjust',
    'feedback_unsatisfied',
  ].map((eventName) => ({ eventName, anonymousId: 'a', isTest: false })),
  { eventName: 'download_clicked', anonymousId: 'a', isTest: false },
  { eventName: 'download_clicked', anonymousId: 'test', isTest: false },
  { eventName: 'result_viewed', anonymousId: 'test', isTest: true },
]);
assert.deepEqual(
  interactions.map(({ events, browsers }) => [events, browsers]),
  [
    [1, 1],
    [2, 1],
    [1, 1],
    [1, 1],
    [1, 1],
  ]
);
console.log(
  'PASS: payment signals, no-order failures, order outcomes, reason deduplication and five result interactions'
);
