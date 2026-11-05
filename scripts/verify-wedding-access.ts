import assert from 'node:assert/strict';

import {
  countsTowardDailyImages,
  weddingAccess,
  weddingGenerationAllowance,
} from '../src/shared/wedding/access';

const now = new Date('2026-11-02T12:00:00Z');
const buy = (id: string, date: string) => ({
  id,
  paidAt: date,
  createdAt: date,
});
const first = buy('first', '2026-11-01T12:00:00Z');
assert.equal(weddingAccess([], 0, now).canCreateProject, false);
assert.equal(
  weddingGenerationAllowance(weddingAccess([], 0, now), 0).reasonCode,
  'payment_required'
);
console.log('PASS unpaid account cannot generate or create a project');
let access = weddingAccess([first], 3, now);
assert.equal(access.projectsRemaining, 2);
assert.equal(access.expiresAt, '2026-11-08T12:00:00.000Z');
access = weddingAccess([first, buy('second', '2026-11-02T12:00:00Z')], 3, now);
assert.equal(access.projectsRemaining, 7);
assert.equal(access.expiresAt, '2026-11-15T12:00:00.000Z');
assert.equal(weddingAccess([first, first], 3, now).projectLimit, 5);
assert.deepEqual(
  weddingAccess([first, buy('second', '2026-11-02T12:00:00Z')], 3, now),
  weddingAccess([buy('second', '2026-11-02T12:00:00Z'), first], 3, now)
);
console.log(
  'PASS repeat purchase: 5 -> 10 projects; 3 used -> 7 remaining; adds 7 days; duplicate and out-of-order callbacks do not double count'
);
access = weddingAccess(
  [first, buy('later', '2026-11-20T12:00:00Z')],
  5,
  new Date('2026-11-20T12:00:00Z')
);
assert.equal(access.expiresAt, '2026-11-27T12:00:00.000Z');
assert.equal(access.projectsRemaining, 5);
assert.equal(weddingAccess([first], 5, now).canCreateProject, false);
assert.equal(
  weddingGenerationAllowance(weddingAccess([first], 5, now), 0).allowed,
  true
);
assert.equal(
  weddingGenerationAllowance(
    weddingAccess([first], 0, new Date('2026-11-08T12:00:00Z')),
    0
  ).reasonCode,
  'access_expired'
);
console.log(
  'PASS expired repurchase starts new week; exact expiration boundary denied; full project capacity still allows existing design generations'
);
assert.equal(weddingGenerationAllowance(access, 9).allowed, true);
assert.equal(weddingGenerationAllowance(access, 10).reasonCode, 'daily_limit');
assert.equal(
  weddingGenerationAllowance(
    weddingAccess([first, buy('third', now.toISOString())], 0, now),
    10
  ).allowed,
  false
);
const counted = (status: string, cost = 0, date = now.toISOString()) =>
  countsTowardDailyImages({ status, cost, createdAt: date }, now);
assert.equal(counted('complete'), true);
assert.equal(counted('reserved'), true);
assert.equal(counted('generating'), true);
assert.equal(counted('failed'), false);
assert.equal(counted('failed', -1), true);
assert.equal(counted('complete', 0, '2026-11-01T23:59:59Z'), false);
console.log(
  'PASS tenth image accepted, eleventh denied across purchases; UTC day reset; confirmed failures released and pending/unknown submissions reserved'
);
