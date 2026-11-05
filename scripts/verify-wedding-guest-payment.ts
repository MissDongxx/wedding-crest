import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';

import * as paymentTypes from '../src/extensions/payment/types';
import { weddingAccess } from '../src/shared/wedding/access';
import * as contract from '../src/shared/wedding/checkout-contract';
import * as identity from '../src/shared/wedding/guest-identity';

// Independent deterministic harness: actual route bodies/service/model functions,
// with an in-memory query engine and synthetic provider. No external I/O.
const ROOT = process.cwd();
const PRODUCT = 'wedding_identity_pack';
const HUMAN_PRODUCT = 'wedding_human_design';
const unexpectedHumanBranch = () => {
  throw new Error(
    'Human-design branch must not run in the AI-wedding payment fixture'
  );
};
const isWeddingCheckoutProduct = (productId: string) => {
  if (productId === HUMAN_PRODUCT) unexpectedHumanBranch();
  return productId === PRODUCT;
};
type Row = Record<string, any>;
type Predicate = (row: Row) => boolean;
function actualDeclarations(file: string, names: string[]) {
  const source = readFileSync(`${ROOT}/${file}`, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  return names
    .map((name) => {
      const node = ast.statements.find(
        (item) =>
          (ts.isFunctionDeclaration(item) || ts.isEnumDeclaration(item)) &&
          item.name?.text === name
      );
      assert.ok(node, `${file}: ${name}`);
      return node.getText(ast).replace(/^export /, '');
    })
    .join('\n');
}
function execute(source: string, globals: Row) {
  const context = vm.createContext({
    Buffer,
    Request,
    Response,
    Headers,
    URL,
    Date,
    TextEncoder,
    TextDecoder,
    crypto,
    process,
    console,
    ...globals,
  });
  vm.runInContext(
    ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText,
    context
  );
  return context;
}
function actualRoute(file: string, modules: Record<string, any>) {
  return execute(readFileSync(`${ROOT}/${file}`, 'utf8'), {
    exports: {},
    require: (name: string) => {
      assert.ok(name in modules, `Unexpected route dependency ${name}`);
      return modules[name];
    },
  }).exports as Row;
}
const stores: Record<string, Map<string, Row>> = {
  orders: new Map(),
  users: new Map(),
};
function table(name: string) {
  return new Proxy(
    { __name: name },
    {
      get: (target, key) =>
        key === '__name' ? target.__name : { table: name, key },
    }
  );
}
const orderTable = table('orders');
const userTable = table('users');
const eq =
  (column: Row, value: unknown): Predicate =>
  (row) =>
    row[column.key] === value;
const and =
  (...conditions: (Predicate | undefined)[]): Predicate =>
  (row) =>
    conditions.every((test) => !test || test(row));
const or =
  (...conditions: Predicate[]): Predicate =>
  (row) =>
    conditions.some((test) => test(row));
const isNull =
  (column: Row): Predicate =>
  (row) =>
    row[column.key] == null;
function db() {
  return {
    insert: (target: Row) => ({
      values: (value: Row) => {
        const perform = () => {
          const store = stores[target.__name];
          if (store.has(value.id)) return [];
          store.set(value.id, { ...value });
          return [{ ...value }];
        };
        const query = {
          onConflictDoNothing: () => query,
          returning: async () => perform(),
          then: (resolve: (rows: Row[]) => unknown) =>
            Promise.resolve(perform()).then(resolve),
        };
        return query;
      },
    }),
    select: (fields?: Record<string, Row>) => ({
      from: (target: Row) => {
        let predicate: Predicate = () => true;
        const rows = () =>
          [...stores[target.__name].values()]
            .filter(predicate)
            .map((row) =>
              fields
                ? Object.fromEntries(
                    Object.entries(fields).map(([key, column]) => [
                      key,
                      row[column.key],
                    ])
                  )
                : { ...row }
            );
        const query = {
          where: (test: Predicate) => {
            predicate = test;
            return query;
          },
          orderBy: () => query,
          then: (resolve: (rows: Row[]) => unknown) =>
            Promise.resolve(rows()).then(resolve),
        };
        return query;
      },
    }),
    update: (target: Row) => ({
      set: (update: Row) => ({
        where: (predicate: Predicate) => ({
          returning: async (fields?: Record<string, Row>) => {
            const rows = [...stores[target.__name].values()].filter(predicate);
            rows.forEach((row) =>
              Object.assign(
                row,
                Object.fromEntries(
                  Object.entries(update).filter(
                    ([, value]) => value !== undefined
                  )
                )
              )
            );
            return rows.map((row) =>
              fields
                ? Object.fromEntries(
                    Object.entries(fields).map(([key, column]) => [
                      key,
                      row[column.key],
                    ])
                  )
                : { ...row }
            );
          },
        }),
      }),
    }),
  };
}
const modelContext = execute(
  actualDeclarations('src/shared/models/order.ts', [
    'OrderStatus',
    'findOrderById',
    'findOrderByOrderNo',
    'updateOrderByOrderNo',
    'reserveWeddingCheckoutOrder',
  ]) +
    '\nglobalThis.api={OrderStatus,findOrderById,findOrderByOrderNo,updateOrderByOrderNo,reserveWeddingCheckoutOrder};',
  { db, order: orderTable, eq, and, or, isNull }
);
const model = modelContext.api as Row;
let sessionUser: Row | null = null;
const jar = new Map<string, string>();
const cookieWrites: Row[] = [];
const cookieApi = {
  get: (key: string) => (jar.has(key) ? { value: jar.get(key)! } : undefined),
  set: (key: string, value: string, options: Row) => {
    jar.set(key, value);
    cookieWrites.push({ key, value, options });
  },
};
const accountAccess = async (ownerId: string) =>
  weddingAccess(
    [...stores.orders.values()]
      .filter(
        (order) =>
          order.userId === ownerId && order.status === model.OrderStatus.PAID
      )
      .map((order) => ({
        id: order.id,
        paidAt: order.paidAt,
        createdAt: order.createdAt,
      })),
    0
  );
const actorContext = execute(
  actualDeclarations('src/shared/models/wedding-actor.ts', [
    'getWeddingActor',
    'getWeddingPurchaseOwner',
  ]) + '\nglobalThis.api={getWeddingActor,getWeddingPurchaseOwner};',
  {
    cookies: async () => cookieApi,
    headers: async () => new Headers({ 'x-forwarded-proto': 'https' }),
    getUserInfo: async () => sessionUser,
    getWeddingAccountAccess: accountAccess,
    ...identity,
  }
);
const actor = actorContext.api as Row;
const checkoutModelContext = execute(
  actualDeclarations('src/shared/models/wedding-checkout.ts', [
    'ensureWeddingGuestBuyer',
    'canAccessWeddingCheckout',
    'getWeddingReceiptState',
    'saveWeddingReceiptContact',
  ]) +
    '\nglobalThis.api={ensureWeddingGuestBuyer,canAccessWeddingCheckout,getWeddingReceiptState,saveWeddingReceiptContact};',
  {
    db,
    user: userTable,
    orderTable,
    eq,
    and,
    desc: (column: Row) => column,
    receiptEmail: contract.receiptEmail,
    OrderStatus: model.OrderStatus,
    canAccessWeddingProject: async () => false,
    WEDDING_PACK_PRODUCT_ID: PRODUCT,
    HUMAN_DESIGN_PRODUCT_ID: HUMAN_PRODUCT,
    isWeddingCheckoutProduct,
  }
);
const checkoutModel = checkoutModelContext.api as Row;
const serviceContext = execute(
  actualDeclarations('src/shared/services/payment.ts', [
    'handleCheckoutSuccess',
    'handleWeddingCheckoutResult',
  ]) + '\nglobalThis.api={handleCheckoutSuccess,handleWeddingCheckoutResult};',
  {
    ...model,
    assertWeddingPaymentMatches: contract.assertWeddingPaymentMatches,
    receiptEmail: contract.receiptEmail,
    ...paymentTypes,
    WEDDING_PACK_PRODUCT_ID: PRODUCT,
    HUMAN_DESIGN_PRODUCT_ID: HUMAN_PRODUCT,
    isWeddingCheckoutProduct,
  }
);
const service = serviceContext.api as Row;
let providerCreates = 0;
let providerQueries = 0;
let providerState = paymentTypes.PaymentStatus.SUCCESS;
let providerEmail: string | undefined = 'existing-account@example.test';
let providerBarrier: (() => void) | undefined;
let providerWait: Promise<void> | undefined;
let providerLastOrder: Row | undefined;
const provider = {
  name: 'fixture',
  getPaymentEvent: async ({ req }: { req: Request }) => {
    if (req.headers.get('x-fixture-signature') !== 'fixture-valid')
      throw new Error('synthetic signature rejected');
    const body = await req.json();
    const row = await model.findOrderByOrderNo(body.orderNo);
    return {
      eventType: paymentTypes.PaymentEventType.CHECKOUT_SUCCESS,
      paymentSession: await provider.getPaymentSession({
        sessionId: row.paymentSessionId,
      }),
    };
  },
  createPayment: async ({ order }: { order: Row }) => {
    providerCreates++;
    providerLastOrder = order;
    if (providerWait) await providerWait;
    return {
      provider: 'fixture',
      checkoutInfo: {
        checkoutUrl: 'https://provider.fixture/checkout',
        sessionId: `session-${order.metadata.order_no}`,
      },
      checkoutParams: order,
      checkoutResult: {},
    };
  },
  getPaymentSession: async ({ sessionId }: { sessionId: string }) => {
    providerQueries++;
    const order = [...stores.orders.values()].find(
      (row) => row.paymentSessionId === sessionId
    )!;
    return {
      provider: 'fixture',
      paymentStatus: providerState,
      metadata: { order_no: order.orderNo, user_id: order.userId },
      paymentInfo: {
        paymentAmount: order.amount,
        paymentCurrency: order.currency,
        paymentEmail: providerEmail,
        transactionId: `tx-${order.orderNo}`,
      },
      paymentResult: {},
    };
  },
};
const configs = {
  app_url: 'https://studio.fixture',
  default_locale: 'en',
  default_payment_provider: 'fixture',
  app_name: 'Fixture',
};
const response = {
  respData: (data: unknown) => ({ status: 200, code: 0, data }),
  respErr: (message: string, status = 400, data?: unknown) => ({
    status,
    code: -1,
    message,
    data,
  }),
};
class Redirect extends Error {
  constructor(public url: string) {
    super(url);
  }
}
const projects = new Map<string, Row>();
const common: Row = {
  'next/headers': { cookies: async () => cookieApi },
  'next/navigation': {
    redirect: (url: string) => {
      throw new Redirect(url);
    },
  },
  '@/config': { envConfigs: configs },
  '@/extensions/payment/types': paymentTypes,
  '@/shared/lib/resp': response,
  '@/shared/lib/hash': {
    getUuid: () => crypto.randomUUID(),
    getSnowId: () => crypto.randomUUID(),
  },
  '@/shared/models/order': {
    ...model,
    createOrder: async (order: Row) =>
      stores.orders.set(order.id, { ...order }),
  },
  '@/shared/models/wedding-actor': {
    ...actor,
    getWeddingProjectOwner: identity.getWeddingProjectOwner,
  },
  '@/shared/models/wedding-checkout': {
    ...checkoutModel,
    weddingCheckoutCookie: (orderNo: string) => `wedding_checkout_${orderNo}`,
  },
  '@/shared/models/wedding': {
    canAccessWeddingProject: async ({ id, userId }: Row) =>
      projects.get(id)?.userId === userId && Boolean(userId),
    getWeddingProject: async (id: string) => projects.get(id) ?? null,
    getWeddingAccountAccess: accountAccess,
  },
  '@/shared/services/payment': {
    ...service,
    getPaymentService: async () => ({
      getProvider: (name: string) => (name === 'fixture' ? provider : null),
    }),
  },
  '@/shared/models/config': { getAllConfigs: async () => configs },
  '@/shared/wedding/config': {
    WEDDING_PACK_PRODUCT_ID: PRODUCT,
    HUMAN_DESIGN_PRODUCT_ID: HUMAN_PRODUCT,
    HUMAN_DESIGN_AMOUNT: 3000,
    isWeddingCheckoutProduct,
  },
  '@/shared/wedding/human-design': {
    humanDesignRequestSchema: { safeParse: unexpectedHumanBranch },
  },
  '@/shared/services/human-design': {
    notifyHumanDesignOrder: unexpectedHumanBranch,
  },
  '@/shared/wedding/checkout-contract': contract,
  '@/core/i18n/request': {
    loadMessages: async () => ({
      page: {
        sections: {
          pricing: {
            items: [
              {
                product_id: PRODUCT,
                product_name: 'Fixture image pack',
                amount: 590,
                currency: 'usd',
                interval: paymentTypes.PaymentInterval.ONE_TIME,
                payment_providers: ['fixture'],
              },
              {
                product_id: 'other-product',
                product_name: 'Other',
                amount: 590,
                currency: 'usd',
                payment_providers: ['fixture'],
              },
            ],
          },
        },
      },
    }),
  },
  zod: { z },
};
const checkout = actualRoute(
  'src/app/api/payment/checkout/route.ts',
  common
).POST;
const callback = actualRoute(
  'src/app/api/payment/callback/route.ts',
  common
).GET;
const notify = actualRoute('src/app/api/payment/notify/[provider]/route.ts', {
  ...common,
  '@/shared/models/subscription': {
    findSubscriptionByProviderSubscriptionId: async () => null,
  },
}).POST;
const cancel = actualRoute('src/app/api/payment/cancel/route.ts', common).GET;
const receipt = actualRoute(
  'src/app/api/wedding/receipt/route.ts',
  common
).POST;
function request(
  body: Row,
  requestId = '11111111-1111-4111-8111-111111111111',
  headers: Row = {}
) {
  return new Request('https://studio.fixture/api/payment/checkout', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://studio.fixture',
      'x-wedding-checkout-id': requestId,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
async function destination(
  handler: (req: Request) => Promise<unknown>,
  orderNo: string
) {
  try {
    await handler(
      new Request(
        `https://studio.fixture/api/payment/callback?order_no=${orderNo}`
      )
    );
  } catch (error) {
    assert.ok(error instanceof Redirect);
    return error.url;
  }
  assert.fail('expected redirect');
}
async function main() {
  const existingAccount = {
    id: 'registered-account',
    email: providerEmail,
    emailVerified: true,
    name: 'Existing account',
  };
  stores.users.set(existingAccount.id, { ...existingAccount });
  const first = await checkout(
    request({
      product_id: PRODUCT,
      locale: 'zh',
      metadata: {
        resume_wizard: true,
        resume_path:
          '/zh/create?exampleId=example-a&style=botanical_watercolor',
        user_id: 'victim',
      },
    })
  );
  assert.equal(first.code, 0);
  assert.equal(providerCreates, 1);
  assert.equal(sessionUser, null);
  assert.ok(
    identity.isWeddingGuestToken(jar.get(identity.WEDDING_GUEST_COOKIE))
  );
  assert.ok(
    cookieWrites[0].options.httpOnly &&
      cookieWrites[0].options.secure &&
      cookieWrites[0].options.sameSite === 'lax'
  );
  assert.ok(cookieWrites[0].options.maxAge >= 7 * 86400);
  const firstOrder = [...stores.orders.values()][0];
  assert.ok(firstOrder.userId.startsWith('wedding_guest_'));
  assert.notEqual(firstOrder.userId, 'victim');
  assert.equal(firstOrder.projectId, null);
  assert.equal(providerLastOrder!.customer, undefined);
  assert.equal(providerLastOrder!.metadata.user_id, firstOrder.userId);
  assert.match(firstOrder.callbackUrl, /\/zh\/create\?/);
  assert.match(firstOrder.callbackUrl, /exampleId=example-a/);
  const repeat = await checkout(
    request({ product_id: PRODUCT, metadata: { resume_wizard: true } })
  );
  assert.equal(repeat.code, 0);
  assert.equal(repeat.data.reused, true);
  assert.equal(providerCreates, 1);
  assert.equal(stores.orders.size, 1);
  console.log(
    'PASS actual checkout + actor/model: server HttpOnly identity, synthetic billing only, server metadata, draft return, sequential idempotency'
  );

  const realToken = jar.get(identity.WEDDING_GUEST_COOKIE)!;
  jar.set(identity.WEDDING_GUEST_COOKIE, 'a'.repeat(64));
  const beforeQueries = providerQueries;
  assert.match(
    await destination(callback, firstOrder.orderNo),
    /payment=access_required/
  );
  assert.equal(providerQueries, beforeQueries);
  assert.equal(firstOrder.status, model.OrderStatus.CREATED);
  jar.set(identity.WEDDING_GUEST_COOKIE, realToken);
  const returned = await destination(callback, firstOrder.orderNo);
  assert.match(returned, /exampleId=example-a/);
  const paid = await model.findOrderByOrderNo(firstOrder.orderNo);
  assert.equal(paid.status, model.OrderStatus.PAID);
  assert.equal(paid.paymentEmail, providerEmail);
  assert.equal(sessionUser, null);
  assert.equal(stores.users.size, 2);
  assert.equal(stores.users.get(firstOrder.userId)!.emailVerified, false);
  assert.deepEqual(stores.users.get(existingAccount.id), existingAccount);
  const userEmail = stores.users.get(firstOrder.userId)!.email;
  assert.ok(userEmail.endsWith('@guest.invalid'));
  assert.notEqual(userEmail, providerEmail);
  await destination(callback, firstOrder.orderNo);
  await destination(cancel, firstOrder.orderNo);
  assert.equal(
    (await model.findOrderByOrderNo(firstOrder.orderNo)).status,
    model.OrderStatus.PAID
  );
  console.log(
    'PASS actual callback/cancel/service: wrong cookie denied before provider query, trusted confirmation persists email without login/account binding, repeats/cancel never downgrade PAID'
  );

  providerEmail = undefined;
  const second = await checkout(
    request({ product_id: PRODUCT }, '22222222-2222-4222-8222-222222222222')
  );
  assert.equal(second.code, 0);
  const secondOrder = [...stores.orders.values()].at(-1)!;
  providerState = paymentTypes.PaymentStatus.PROCESSING;
  await destination(callback, secondOrder.orderNo);
  assert.notEqual(
    (await model.findOrderByOrderNo(secondOrder.orderNo)).status,
    model.OrderStatus.PAID
  );
  providerState = paymentTypes.PaymentStatus.SUCCESS;
  await destination(callback, secondOrder.orderNo);
  assert.equal(
    (await model.findOrderByOrderNo(secondOrder.orderNo)).status,
    model.OrderStatus.PAID
  );
  providerEmail = 'late-receipt@example.test';
  await destination(callback, secondOrder.orderNo);
  assert.equal(
    (await model.findOrderByOrderNo(secondOrder.orderNo)).paymentEmail,
    providerEmail
  );
  const stale = { ...secondOrder, status: model.OrderStatus.CREATED };
  await service.handleWeddingCheckoutResult(stale, {
    provider: 'fixture',
    paymentStatus: paymentTypes.PaymentStatus.FAILED,
    metadata: { order_no: secondOrder.orderNo },
    paymentResult: {},
  });
  assert.equal(
    (await model.findOrderByOrderNo(secondOrder.orderNo)).status,
    model.OrderStatus.PAID
  );
  console.log(
    'PASS actual service + CAS model: processing stays unpaid, success without email retains paid access, late email backfills, stale failure cannot overwrite paid'
  );

  for (const session of [
    {
      provider: 'wrong',
      paymentStatus: 'paid',
      paymentInfo: { paymentAmount: 590, paymentCurrency: 'usd' },
    },
    {
      provider: 'fixture',
      paymentStatus: 'paid',
      metadata: { order_no: 'other-order' },
      paymentInfo: { paymentAmount: 590, paymentCurrency: 'usd' },
    },
    {
      provider: 'fixture',
      paymentStatus: 'paid',
      paymentInfo: { paymentAmount: 1, paymentCurrency: 'usd' },
    },
    {
      provider: 'fixture',
      paymentStatus: 'paid',
      paymentInfo: { paymentAmount: 590, paymentCurrency: 'eur' },
    },
  ])
    await assert.rejects(service.handleWeddingCheckoutResult(paid, session));
  const deniedProduct = await checkout(
    request({ product_id: 'other-product' })
  );
  assert.equal(deniedProduct.status, 401);
  const deniedOrigin = await checkout(
    request({ product_id: PRODUCT }, undefined, {
      origin: 'https://attacker.fixture',
    })
  );
  assert.equal(deniedOrigin.status, 403);
  console.log(
    'PASS actual payment validation and routes: mismatched provider/order/amount/currency rejected; guest other-product and cross-origin checkout denied'
  );

  providerWait = new Promise<void>((resolve) => {
    providerBarrier = resolve;
  });
  const createsBefore = providerCreates;
  const requestId = '33333333-3333-4333-8333-333333333333';
  const pending = checkout(request({ product_id: PRODUCT }, requestId));
  while (providerCreates === createsBefore)
    await new Promise((resolve) => setTimeout(resolve, 0));
  const concurrent = await checkout(
    request({ product_id: PRODUCT }, requestId)
  );
  assert.equal(concurrent.status, 409);
  assert.equal(concurrent.data.reasonCode, 'checkout_initializing');
  providerBarrier!();
  assert.equal((await pending).code, 0);
  providerWait = undefined;
  assert.equal(providerCreates, createsBefore + 1);
  console.log(
    'PASS actual reservation model + checkout concurrency: one insert/provider session, concurrent request receives initializing then reuses'
  );

  const fallback = await receipt(
    new Request('https://studio.fixture/api/wedding/receipt', {
      method: 'POST',
      headers: {
        origin: 'https://studio.fixture',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email: 'optional-contact@example.test' }),
    })
  );
  assert.equal(fallback.code, 0);
  assert.equal(sessionUser, null);
  assert.equal(stores.users.get(firstOrder.userId)!.email, userEmail);
  assert.deepEqual(stores.users.get(existingAccount.id), existingAccount);
  assert.equal(
    (await model.findOrderByOrderNo(firstOrder.orderNo)).paymentEmail,
    'existing-account@example.test'
  );
  const badReceipt = await receipt(
    new Request('https://studio.fixture/api/wedding/receipt', {
      method: 'POST',
      headers: { origin: 'https://attacker.fixture' },
      body: JSON.stringify({ email: 'overwrite@example.test' }),
    })
  );
  assert.equal(badReceipt.status, 403);
  console.log(
    'PASS actual receipt route/model: paid owner optional contact only, no account or provider-email mutation, cross-origin denied'
  );
  jar.set(identity.WEDDING_GUEST_COOKIE, identity.createWeddingGuestToken());
  providerEmail = undefined;
  await checkout(
    request({ product_id: PRODUCT }, '44444444-4444-4444-8444-444444444444')
  );
  const webhookOrder = [...stores.orders.values()].at(-1)!;
  const webhookReq = (valid: boolean) =>
    new Request('https://studio.fixture/api/payment/notify/fixture', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-fixture-signature': valid ? 'fixture-valid' : 'invalid',
      },
      body: JSON.stringify({ orderNo: webhookOrder.orderNo }),
    });
  const webhookParams = { params: Promise.resolve({ provider: 'fixture' }) };
  assert.equal((await notify(webhookReq(false), webhookParams)).status, 500);
  assert.notEqual(
    (await model.findOrderByOrderNo(webhookOrder.orderNo)).status,
    model.OrderStatus.PAID
  );
  assert.equal((await notify(webhookReq(true), webhookParams)).status, 200);
  assert.equal(
    (await model.findOrderByOrderNo(webhookOrder.orderNo)).status,
    model.OrderStatus.PAID
  );
  assert.equal(
    (await checkoutModel.getWeddingReceiptState(webhookOrder.userId))
      .receiptEmailMissing,
    true
  );
  providerEmail = 'late-webhook@example.test';
  assert.equal((await notify(webhookReq(true), webhookParams)).status, 200);
  assert.equal(
    (await checkoutModel.getWeddingReceiptState(webhookOrder.userId))
      .hasReceiptEmail,
    true
  );
  assert.equal(stores.orders.size, 4);
  assert.equal(sessionUser, null);
  assert.deepEqual(stores.users.get(existingAccount.id), existingAccount);
  console.log(
    'PASS actual notify route + service/model: provider event rejection never unlocks; asynchronous confirmed webhook grants once; missing receipt explicit, later duplicate backfills email; existing same-email account unchanged'
  );
  // A real session may coexist with this browser's guest-owned purchase.
  jar.set(identity.WEDDING_GUEST_COOKIE, realToken);
  sessionUser = { ...existingAccount };
  projects.set('own-guest-project', {
    id: 'own-guest-project',
    userId: firstOrder.userId,
  });
  projects.set('foreign-project', {
    id: 'foreign-project',
    userId: 'unrelated-owner',
  });
  const contactRequest = (projectId: string) =>
    new Request('https://studio.fixture/api/wedding/receipt', {
      method: 'POST',
      headers: {
        origin: 'https://studio.fixture',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'guest-project-contact@example.test',
        projectId,
      }),
    });
  assert.equal((await receipt(contactRequest('foreign-project'))).status, 404);
  assert.equal((await receipt(contactRequest('own-guest-project'))).code, 0);
  const topup = await checkout(
    request(
      { product_id: PRODUCT, metadata: { project_id: 'own-guest-project' } },
      '55555555-5555-4555-8555-555555555555'
    )
  );
  assert.equal(topup.code, 0);
  assert.equal([...stores.orders.values()].at(-1)!.userId, firstOrder.userId);
  assert.notEqual(
    [...stores.orders.values()].at(-1)!.userId,
    existingAccount.id
  );
  assert.deepEqual(stores.users.get(existingAccount.id), existingAccount);
  assert.equal(sessionUser.id, existingAccount.id);
  sessionUser = null;
  console.log(
    'PASS actual receipt/checkout mixed identities: wrong project denied; real login plus owned guest cookie can contact/recharge guest project without moving quota to account or mutating real account'
  );
  providerState = paymentTypes.PaymentStatus.FAILED;
  const stalePaidReturn = new URL(
    await destination(callback, firstOrder.orderNo)
  );
  assert.notEqual(stalePaidReturn.searchParams.get('payment'), 'failed');
  assert.equal(
    (await model.findOrderByOrderNo(firstOrder.orderNo)).status,
    model.OrderStatus.PAID
  );
  const failedKey = '66666666-6666-4666-8666-666666666666';
  await checkout(request({ product_id: PRODUCT }, failedKey));
  const failedOrder = [...stores.orders.values()].at(-1)!;
  const failedReturn = new URL(
    await destination(callback, failedOrder.orderNo)
  );
  assert.equal(failedReturn.searchParams.get('payment'), 'failed');
  assert.equal(failedReturn.searchParams.has('prepaid'), false);
  assert.equal(failedReturn.searchParams.has('paid'), false);
  const ended = await checkout(request({ product_id: PRODUCT }, failedKey));
  assert.equal(ended.status, 409);
  assert.equal(ended.data.reasonCode, 'checkout_ended');
  const retryCheckout = await checkout(
    request({ product_id: PRODUCT }, '77777777-7777-4777-8777-777777777777')
  );
  assert.equal(retryCheckout.code, 0);
  const retryOrder = [...stores.orders.values()].at(-1)!;
  providerState = paymentTypes.PaymentStatus.CANCELED;
  const canceledReturn = new URL(
    await destination(callback, retryOrder.orderNo)
  );
  assert.equal(canceledReturn.searchParams.get('payment'), 'canceled');
  assert.equal(canceledReturn.searchParams.has('prepaid'), false);
  providerState = paymentTypes.PaymentStatus.SUCCESS;
  console.log(
    'PASS actual failed/canceled callback recovery: pending markers removed, ended key denied, fresh checkout succeeds; stale failed session cannot downgrade or mislabel an already-paid order'
  );
  console.log(
    'PASS independent guest payment harness: actual functions/routes + in-memory query engine + synthetic provider; no real database/payment calls'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
