import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

import * as paymentTypes from '../src/extensions/payment/types';
import * as contract from '../src/shared/wedding/checkout-contract';
import { classifyProviderPaymentReason } from '../src/shared/wedding/payment-diagnostics-contract';

// Actual route/provider source, synthetic dependencies only. Never connects to a DB or payment API.
const sourceRoot = process.argv.includes('--baseline')
  ? `${process.cwd()}/artifacts/payment-flow-observability-20261117/baseline`
  : process.cwd();
type Row = Record<string, any>;
const ownerId = 'wedding_guest_fixture';
const attemptId = '11111111-1111-4111-8111-111111111111';
const appUrl = 'https://studio.fixture';
const events: Row[] = [];
let diagnosticSinkFails = false;
const diagnostics = {
  recordPaymentDiagnostic: async (event: Row) => {
    if (diagnosticSinkFails) throw new Error('diagnostic sink unavailable');
    events.push(event);
  },
  classifyPaymentDiagnosticError: () => ({
    reason: 'provider_transport_error',
    details: { errorType: 'TypeError', errorCode: 'ECONNRESET' },
  }),
};
const OrderStatus = {
  PENDING: 'pending',
  CREATED: 'created',
  COMPLETED: 'completed',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELED: 'canceled',
};
let currentOrder: Row;
let reserveCreated = false;
let providerCreates = 0;
let raceToPaid = false;
let paymentStatus = paymentTypes.PaymentStatus.PROCESSING;
let paymentResult: Row = {};
let webhookValid = true;
const provider = {
  name: 'waffo',
  createPayment: async ({ order }: Row) => {
    providerCreates++;
    return {
      provider: 'waffo',
      checkoutParams: { metadata: order.metadata },
      checkoutInfo: {
        sessionId: order.orderNo,
        checkoutUrl: 'https://cashier.fixture/session',
      },
      checkoutResult: {
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    };
  },
  getPaymentSession: async () => ({
    provider: 'waffo',
    paymentStatus,
    paymentResult,
  }),
  getPaymentEvent: async () => {
    if (!webhookValid)
      throw new Error('invalid signature SECRET_EMAIL@example.test');
    return {
      eventType: paymentTypes.PaymentEventType.CHECKOUT_SUCCESS,
      paymentSession: {
        provider: 'waffo',
        paymentStatus: paymentTypes.PaymentStatus.SUCCESS,
        metadata: {
          order_no: currentOrder.orderNo,
          payment_attempt_id: attemptId,
        },
      },
    };
  },
};
const modules: Row = {
  'next/headers': {
    cookies: async () => ({ get: () => undefined, set: () => {} }),
  },
  'next/navigation': {
    redirect: (destination: string) => {
      throw { destination };
    },
  },
  '@/config': { envConfigs: { app_url: appUrl } },
  '@/core/i18n/request': {
    loadMessages: async () => ({
      page: {
        sections: {
          pricing: {
            items: [
              {
                product_id: 'wedding_identity_pack',
                amount: 590,
                currency: 'usd',
                interval: 'one-time',
                payment_product_id: 'PROD_fixture',
              },
            ],
          },
        },
      },
    }),
  },
  '@/extensions/payment/types': paymentTypes,
  '@/shared/lib/hash': {
    getUuid: () => crypto.randomUUID(),
    getSnowId: () => 'fixture-order',
  },
  '@/shared/lib/resp': {
    respData: (data: unknown) => Response.json({ code: 0, data }),
    respErr: (message: string, status = 200, data?: unknown) =>
      Response.json({ code: -1, message, data }, { status }),
  },
  '@/shared/models/config': {
    getAllConfigs: async () => ({
      app_url: appUrl,
      default_locale: 'en',
      default_payment_provider: 'waffo',
    }),
  },
  '@/shared/models/payment-diagnostic': diagnostics,
  '@/shared/models/order': {
    OrderStatus,
    createOrder: async (order: Row) => {
      currentOrder = { ...order };
    },
    reserveWeddingCheckoutOrder: async (order: Row) => {
      if (reserveCreated) currentOrder = { ...order };
      return { created: reserveCreated, order: currentOrder };
    },
    findOrderByOrderNo: async () => currentOrder,
    findOrderByTransactionId: async () => undefined,
    updateOrderByOrderNo: async (_no: string, update: Row, options?: Row) => {
      if (raceToPaid) {
        currentOrder = { ...currentOrder, status: 'paid' };
        return undefined;
      }
      if (
        options?.expectedStatus &&
        currentOrder.status !== options.expectedStatus
      )
        return undefined;
      Object.assign(currentOrder, update);
      return currentOrder;
    },
  },
  '@/shared/models/wedding': {
    canAccessWeddingProject: async () => true,
    getWeddingProject: async () => undefined,
  },
  '@/shared/models/wedding-actor': {
    getWeddingActor: async () => ({
      user: null,
      ownerId,
      guestOwnerId: ownerId,
      guestToken: 'f'.repeat(64),
    }),
    getWeddingProjectOwner: () => undefined,
  },
  '@/shared/models/wedding-checkout': {
    ensureWeddingGuestBuyer: async () => ownerId,
    weddingCheckoutCookie: (id: string) => `wedding_checkout_${id}`,
    canAccessWeddingCheckout: async () => true,
  },
  '@/shared/models/subscription': {
    findSubscriptionByProviderSubscriptionId: async () => undefined,
  },
  '@/shared/services/payment': {
    getPaymentService: async () => ({ getProvider: () => provider }),
    handleCheckoutSuccess: async ({ session }: Row) => {
      if (session.paymentStatus === paymentTypes.PaymentStatus.SUCCESS)
        currentOrder.status = 'paid';
    },
    handleSubscriptionCanceled: async () => {},
    handleSubscriptionRenewal: async () => {},
    handleSubscriptionUpdated: async () => {},
  },
  '@/shared/wedding/checkout-contract': contract,
  '@/shared/wedding/config': {
    HUMAN_DESIGN_AMOUNT: 9900,
    HUMAN_DESIGN_PRODUCT_ID: 'wedding_human_design',
    isWeddingCheckoutProduct: (id: string) => id === 'wedding_identity_pack',
  },
  '@/shared/wedding/human-design': {
    humanDesignCheckoutSchema: {
      safeParse: () => ({ success: true, data: {} }),
    },
  },
};
function load(file: string, dependencies = modules): Row {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(`${sourceRoot}/${file}`, 'utf8'), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText,
    {
      exports,
      require: (id: string) => {
        assert.ok(id in dependencies, `unexpected import ${id}`);
        return dependencies[id];
      },
      crypto,
      Request,
      Response,
      Headers,
      URL,
      Date,
      TextEncoder,
      Uint8Array,
      Buffer,
      Set,
      Map,
      Error,
      TypeError,
      Promise,
      console: { error: () => {} },
      process: { env: { NODE_ENV: 'production' } },
      setTimeout,
      clearTimeout,
    }
  );
  return exports;
}
const checkout = load('src/app/api/payment/checkout/route.ts').POST;
const cancel = load('src/app/api/payment/cancel/route.ts').GET;
const callback = load('src/app/api/payment/callback/route.ts').GET;
const notify = load('src/app/api/payment/notify/[provider]/route.ts').POST;
function request() {
  return new Request(`${appUrl}/api/payment/checkout`, {
    method: 'POST',
    headers: {
      origin: appUrl,
      'content-type': 'application/json',
      'x-wedding-checkout-id': attemptId,
    },
    body: JSON.stringify({ product_id: 'wedding_identity_pack' }),
  });
}
function order(
  status = 'created',
  expiresAt = new Date(Date.now() - 10000).toISOString()
) {
  return {
    orderNo: 'wc_fixture',
    userId: ownerId,
    status,
    productId: 'wedding_identity_pack',
    paymentProvider: 'waffo',
    paymentSessionId: 'wc_fixture',
    checkoutUrl: 'https://cashier.fixture/expired',
    checkoutResult: JSON.stringify({ expiresAt }),
    callbackUrl: `${appUrl}/create?prepaid=1`,
  };
}
async function destination(
  route: (request: Request) => Promise<unknown>,
  path: string
) {
  try {
    await route(
      new Request(`${appUrl}/api/payment/${path}?order_no=wc_fixture`)
    );
  } catch (error) {
    if ((error as Row).destination) return (error as Row).destination as string;
    throw error;
  }
  throw new Error('expected redirect');
}
async function main() {
  if (process.argv.includes('--only-paid-cancel')) {
    currentOrder = order('paid');
    assert.equal(
      new URL(await destination(cancel, 'cancel')).searchParams.get('payment'),
      null,
      'paid cancellation must not show canceled'
    );
    console.log('PASS paid cancellation preserves successful return');
    return;
  }
  currentOrder = order();
  const expired = await checkout(request());
  assert.equal(
    expired.status,
    409,
    'expired Waffo checkout must not be reused'
  );
  assert.equal((await expired.json()).data.reasonCode, 'checkout_ended');
  assert.equal(
    currentOrder.status,
    'created',
    'keep expired order open for late successful webhook'
  );
  assert.equal(
    providerCreates,
    0,
    'expiry check never creates a replacement payment implicitly'
  );
  console.log(
    'PASS expired checkout returns 409 checkout_ended; old order remains created; no provider write'
  );

  currentOrder = order('created', new Date(Date.now() + 3600000).toISOString());
  const reused = await (await checkout(request())).json();
  assert.equal(reused.data.reused, true);
  assert.equal(reused.data.attemptId, attemptId);
  assert.match(reused.data.requestId, /^[0-9a-f-]{36}$/i);
  assert.ok(reused.data.orderNo);
  assert.equal(providerCreates, 0);

  currentOrder = order('paid');
  assert.equal(
    new URL(await destination(cancel, 'cancel')).searchParams.get('payment'),
    null
  );
  assert.equal(currentOrder.status, 'paid');
  raceToPaid = true;
  currentOrder = order();
  assert.equal(
    new URL(await destination(cancel, 'cancel')).searchParams.get('payment'),
    null
  );
  assert.equal(currentOrder.status, 'paid');
  raceToPaid = false;
  console.log(
    'PASS live checkout reuses safely; correlated IDs returned; paid and racing-paid cancel preserve success return'
  );

  reserveCreated = true;
  const fresh = await (await checkout(request())).json();
  assert.equal(fresh.code, 0);
  assert.equal(
    JSON.parse(currentOrder.checkoutInfo).metadata.payment_attempt_id,
    attemptId
  );
  assert.ok(
    events.some(
      (event) =>
        event.stage === 'provider_create_succeeded' &&
        event.orderNo === fresh.data.orderNo
    )
  );
  reserveCreated = false;

  paymentResult = { diagnosticReason: 'provider_query_error' };
  await destination(callback, 'callback');
  paymentResult = { diagnosticReason: 'no_payment_record' };
  await destination(callback, 'callback');
  assert.ok(
    events.some(
      (event) =>
        event.stage === 'callback_payment_lookup' &&
        event.reason === 'provider_query_error'
    )
  );
  assert.ok(
    events.some(
      (event) =>
        event.stage === 'callback_payment_lookup' &&
        event.reason === 'no_payment_record'
    )
  );
  webhookValid = false;
  assert.equal(
    (
      await notify(
        new Request(`${appUrl}/api/payment/notify/waffo`, { method: 'POST' }),
        { params: Promise.resolve({ provider: 'waffo' }) }
      )
    ).status,
    500
  );
  webhookValid = true;
  assert.equal(
    (
      await notify(
        new Request(`${appUrl}/api/payment/notify/waffo`, { method: 'POST' }),
        { params: Promise.resolve({ provider: 'waffo' }) }
      )
    ).status,
    200
  );
  assert.equal(currentOrder.status, 'paid');
  assert.ok(
    events.some(
      (event) =>
        event.stage === 'webhook_completed' && event.attemptId === attemptId
    )
  );
  console.log(
    'PASS callback query-error/empty distinguished; webhook failure and success persisted; late success still fulfills'
  );

  const sdk: Row = {
    WaffoPancake: class {
      checkout = {};
      graphql = {};
    },
    verifyWebhook: () => {
      throw new Error('invalid signature');
    },
  };
  const WaffoProvider = load('src/extensions/payment/waffo.ts', {
    '@waffo/pancake-ts': sdk,
    './types': paymentTypes,
    '@/shared/models/payment-diagnostic': diagnostics,
    '@/shared/wedding/payment-diagnostics-contract': {
      classifyProviderPaymentReason,
    },
  }).WaffoProvider;
  const waffo = new WaffoProvider({
    merchantId: 'MER_fixture',
    privateKey: 'fixture',
  });
  waffo.client.graphql.query = async () => ({ data: { payments: [] } });
  const empty = await waffo.getPaymentSession({ sessionId: 'wc_fixture' });
  assert.equal(empty.paymentResult.diagnosticReason, 'no_payment_record');
  waffo.client.graphql.query = async () => {
    throw new Error('SECRET_EMAIL@example.test token=SECRET_TOKEN');
  };
  const queryFailed = await waffo.getPaymentSession({
    sessionId: 'wc_fixture',
  });
  assert.equal(
    queryFailed.paymentStatus,
    paymentTypes.PaymentStatus.PROCESSING
  );
  assert.equal(
    queryFailed.paymentResult.diagnosticReason,
    'provider_query_error'
  );
  assert.ok(!JSON.stringify(queryFailed.paymentResult).includes('SECRET_'));
  waffo.client.graphql.query = async () => ({
    data: {
      payments: [
        {
          id: 'PAY_fixture',
          status: 'failed',
          failureReason: 'insufficient_funds SECRET_EMAIL@example.test',
          createdAt: new Date().toISOString(),
          snapshotAmountDetails: {
            currency: 'USD',
            subtotal: '5.90',
            total: '5.90',
          },
        },
      ],
    },
  });
  const declined = await waffo.getPaymentSession({ sessionId: 'wc_fixture' });
  assert.equal(declined.paymentStatus, paymentTypes.PaymentStatus.FAILED);
  assert.ok(
    events.some(
      (event) =>
        event.reason === 'provider_payment_failed' &&
        event.details.providerReason === 'insufficient_funds'
    )
  );
  assert.ok(!JSON.stringify(declined.paymentResult).includes('SECRET_'));
  assert.ok(!JSON.stringify(events).includes('SECRET_'));
  assert.ok(
    events.every(
      (event) =>
        !('checkoutUrl' in event) && !('email' in event) && !('cookie' in event)
    )
  );
  console.log(
    'PASS actual Waffo empty/query-error/provider-failed distinct; query errors stay processing; diagnostics omit raw PII, secrets and checkout URL'
  );
  diagnosticSinkFails = true;
  currentOrder = order('created', new Date(Date.now() + 3600000).toISOString());
  assert.equal((await checkout(request())).status, 200);
  currentOrder = order('paid');
  assert.equal(
    new URL(await destination(cancel, 'cancel')).searchParams.get('payment'),
    null
  );
  await destination(callback, 'callback');
  assert.equal(
    (
      await notify(
        new Request(`${appUrl}/api/payment/notify/waffo`, { method: 'POST' }),
        { params: Promise.resolve({ provider: 'waffo' }) }
      )
    ).status,
    200
  );
  waffo.client.graphql.query = async () => ({ data: { payments: [] } });
  assert.equal(
    (await waffo.getPaymentSession({ sessionId: 'wc_fixture' })).paymentStatus,
    paymentTypes.PaymentStatus.PROCESSING
  );
  console.log(
    'PASS unavailable diagnostic sink never changes checkout/callback/cancel/webhook/provider behavior'
  );
  console.log(
    'PASS payment flow diagnostics regression suite (synthetic dependencies, zero external payment/DB I/O)'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
