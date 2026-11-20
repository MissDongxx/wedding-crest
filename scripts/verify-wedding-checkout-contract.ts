import assert from 'node:assert/strict';

import {
  assertWeddingPaymentMatches,
  receiptEmail,
  weddingCheckoutId,
  weddingCheckoutReturnUrl,
} from '../src/shared/wedding/checkout-contract';

async function main() {
  const base = {
    appUrl: 'https://fixture.invalid',
    locale: 'zh',
    defaultLocale: 'en',
    resumeWizard: true,
  };
  const returned = new URL(
    weddingCheckoutReturnUrl({
      ...base,
      resumePath:
        '/zh/create?style=botanical_watercolor&exampleId=example&prepaid=0&redirect=https://evil.invalid',
    })
  );
  assert.equal(returned.origin, 'https://fixture.invalid');
  assert.equal(returned.pathname, '/zh/create');
  assert.equal(returned.searchParams.get('style'), 'botanical_watercolor');
  assert.equal(returned.searchParams.get('exampleId'), 'example');
  assert.equal(returned.searchParams.get('prepaid'), '1');
  assert.equal(returned.searchParams.has('redirect'), false);
  for (const resumePath of [
    'https://evil.invalid/create',
    '//evil.invalid/create',
    '/api/payment/cancel',
    '/zh/create/evil',
    '/\\evil.invalid/create',
  ]) {
    const url = new URL(weddingCheckoutReturnUrl({ ...base, resumePath }));
    assert.equal(url.origin, 'https://fixture.invalid');
    assert.equal(url.pathname, '/zh/create');
  }
  assert.equal(
    new URL(
      weddingCheckoutReturnUrl({
        ...base,
        projectId: 'project',
        resumeWizard: false,
      })
    ).pathname,
    '/zh/design/project'
  );
  assert.equal(
    await weddingCheckoutId('guest-a', 'request'),
    await weddingCheckoutId('guest-a', 'request')
  );
  assert.notEqual(
    await weddingCheckoutId('guest-a', 'request'),
    await weddingCheckoutId('guest-b', 'request')
  );
  assert.notEqual(
    await weddingCheckoutId('guest-a', 'request'),
    await weddingCheckoutId('guest-a', 'other')
  );
  assert.equal(receiptEmail(' user@example.test '), 'user@example.test');
  for (const value of [undefined, {}, 'bad', 'a@b', 'a@b.com\r\nBcc:x@y.test'])
    assert.equal(receiptEmail(value), undefined);
  const order = {
    orderNo: 'order-a',
    userId: 'guest-a',
    paymentProvider: 'fixture',
    amount: 590,
    currency: 'usd',
  };
  const session = {
    provider: 'fixture',
    paymentStatus: 'paid',
    metadata: { order_no: 'order-a', user_id: 'guest-a' },
    paymentInfo: { paymentAmount: 590, paymentCurrency: 'USD' },
  };
  assert.doesNotThrow(() => assertWeddingPaymentMatches(order, session));
  assert.doesNotThrow(() =>
    assertWeddingPaymentMatches(order, {
      ...session,
      paymentInfo: { paymentAmount: 650, paymentCurrency: 'USD' },
    })
  );
  for (const bad of [
    { ...session, provider: 'other' },
    { ...session, metadata: { order_no: 'other', user_id: 'guest-a' } },
    { ...session, metadata: { order_no: 'order-a', user_id: 'other' } },
    { ...session, paymentInfo: { paymentAmount: 1, paymentCurrency: 'USD' } },
    { ...session, paymentInfo: { paymentAmount: 590, paymentCurrency: 'EUR' } },
    { ...session, paymentInfo: undefined },
    { ...session, paymentInfo: { paymentAmount: NaN, paymentCurrency: 'USD' } },
  ])
    assert.throws(() => assertWeddingPaymentMatches(order, bad));
  assert.throws(() =>
    assertWeddingPaymentMatches(order, {
      ...session,
      paymentInfo: {
        paymentAmount: 490,
        paymentCurrency: 'USD',
        discountAmount: 100,
        discountCurrency: 'USD',
      },
    })
  );
  assert.doesNotThrow(() =>
    assertWeddingPaymentMatches(
      { ...order, discountCode: 'server-coupon' },
      {
        ...session,
        paymentInfo: {
          paymentAmount: 490,
          paymentCurrency: 'USD',
          discountAmount: 100,
          discountCurrency: 'USD',
        },
      }
    )
  );
  console.log(
    'PASS: local-only locale/example return URLs; owner-scoped checkout idempotency; receipt validation; trusted provider/order/owner/currency/amount binding and configured discounts.'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
