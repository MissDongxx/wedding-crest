import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const baseline = process.argv.includes('--baseline');
const source = (file) =>
  fs.readFileSync(
    baseline &&
      fs.existsSync(`artifacts/purchase-comparison-20261102/originals/${file}`)
      ? `artifacts/purchase-comparison-20261102/originals/${file}`
      : file,
    'utf8'
  );
function evaluate(file, modules, globals = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(source(file), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      require: (id) => (id in modules ? modules[id] : require(id)),
      crypto,
      TextEncoder,
      Request,
      Response,
      URL,
      console,
      ...globals,
    }
  );
  return exports;
}
const configModule = evaluate('src/shared/wedding/config.ts', {
  './types': {},
});
const schemaModule = evaluate('src/shared/wedding/human-design.ts', {});
const contract = evaluate('src/shared/wedding/checkout-contract.ts', {});
const product = 'wedding_human_design';
assert.ok(
  !source('src/shared/components/wedding/human-design-purchase.tsx').includes(
    '<Input'
  ),
  'No contact form before checkout'
);
assert.ok(
  source('src/shared/components/wedding/human-design-purchase.tsx').includes(
    'data-design-option="ai"'
  )
);
assert.ok(
  source('src/shared/components/wedding/human-design-purchase.tsx').includes(
    'data-design-option="human"'
  )
);
assert.equal(
  (
    source('src/themes/default/blocks/wedding-result.tsx').match(
      /<HumanDesignPurchase/g
    ) || []
  ).length,
  1,
  'One comparison block, not duplicate upsells'
);
for (const locale of ['en', 'zh', 'de', 'fr', 'it', 'pt-BR', 'ko', 'th']) {
  const data = JSON.parse(
    source(`src/config/locale/messages/${locale}/pages/create.json`)
  ).human_design;
  for (const key of [
    'compare_title',
    'ai_title',
    'human_speed',
    'after_payment',
    'details_saved',
    'submit_details',
  ])
    assert.ok(data[key], `${locale} ${key}`);
  const item = JSON.parse(
    source(`src/config/locale/messages/${locale}/pages/pricing.json`)
  ).page.sections.pricing.items.find((i) => i.product_id === product);
  assert.equal(item.amount, 3000);
  assert.equal(item.currency, 'USD');
  assert.equal(item.features.length, 3);
}
console.log(
  'PASS equal-weight AI/human comparison, no prepayment contact fields, one result comparison, 8 locales, unchanged $30 product'
);

let stored,
  chosen,
  providerOrder,
  sent = 0,
  notice,
  failEmail = false;
const status = {
  PENDING: 'pending',
  CREATED: 'created',
  PAID: 'paid',
  COMPLETED: 'completed',
};
const config = {
  app_url: 'https://example.test',
  default_locale: 'en',
  default_payment_provider: 'paypal',
  waffo_product_ids: JSON.stringify({ [product]: 'PROD_human' }),
};
const respond = (data) => Response.json({ code: 0, data });
const errors = (message, code = 400, data) =>
  Response.json({ code: -1, message, data }, { status: code });
const updateOrder = async (_, patch) => {
  stored = { ...stored, ...patch };
  return stored;
};
const modules = {
  'next/headers': { cookies: async () => ({ set() {} }) },
  '@/core/i18n/request': {
    loadMessages: async () =>
      JSON.parse(source('src/config/locale/messages/en/pages/pricing.json')),
  },
  '@/extensions/payment/types': {
    PaymentInterval: { ONE_TIME: 'one-time' },
    PaymentType: { ONE_TIME: 'one-time', SUBSCRIPTION: 'subscription' },
  },
  '@/shared/lib/hash': {
    getSnowId: () => 'order',
    getUuid: () => 'fcd2da08-339e-4cb5-9f6a-ae9e2809b79e',
  },
  '@/shared/lib/resp': { respData: respond, respErr: errors },
  '@/shared/models/config': { getAllConfigs: async () => config },
  '@/shared/models/order': {
    OrderStatus: status,
    createOrder: async () => {},
    reserveWeddingCheckoutOrder: async (order) => {
      stored = order;
      return { order, created: true };
    },
    updateOrderByOrderNo: updateOrder,
  },
  '@/shared/models/wedding': {},
  '@/shared/models/wedding-actor': {
    getWeddingActor: async () => ({
      guestToken: 'guest',
      guestOwnerId: 'owner',
    }),
    getWeddingProjectOwner: () => undefined,
  },
  '@/shared/models/wedding-checkout': {
    ensureWeddingGuestBuyer: async () => 'guest-owner',
    weddingCheckoutCookie: () => 'cookie',
  },
  '@/shared/services/payment': {
    getPaymentService: async (options) => {
      chosen = options;
      return {
        getProvider: (name) => ({
          name,
          createPayment: async ({ order }) => {
            providerOrder = order;
            return {
              provider: name,
              checkoutParams: { metadata: { human_design: '[object Object]' } },
              checkoutResult: { id: 'session' },
              checkoutInfo: {
                sessionId: 'session',
                checkoutUrl: 'https://checkout.example.test/human',
              },
            };
          },
        }),
      };
    },
  },
  '@/shared/wedding/checkout-contract': contract,
  '@/shared/wedding/config': configModule,
  '@/shared/wedding/human-design': schemaModule,
};
const checkout = evaluate('src/app/api/payment/checkout/route.ts', modules);
const request = (metadata) =>
  new Request('https://example.test/api/payment/checkout', {
    method: 'POST',
    headers: {
      origin: 'https://example.test',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      product_id: product,
      amount: 1,
      payment_provider: 'paypal',
      metadata,
    }),
  });
assert.equal(
  (await checkout.POST(request({ human_design: { brief: 'x'.repeat(12001) } })))
    .status,
  400
);
let result = await checkout.POST(
  request({
    human_design: { brief: 'Emma & James, botanical crest' },
    malicious: 'discard',
  })
);
assert.equal(result.status, 200);
assert.equal(
  (await result.json()).data.checkoutUrl,
  'https://checkout.example.test/human'
);
assert.equal(stored.amount, 3000);
assert.equal(stored.userEmail, '');
assert.equal(stored.paymentProvider, 'waffo');
assert.equal(providerOrder.customer, undefined);
assert.equal(providerOrder.orderNo, providerOrder.metadata.order_no, 'Waffo external reference, idempotency and callback lookup must bind the local order');
assert.equal(providerOrder.productId, 'PROD_human');
assert.equal(chosen.waffo_price_mode, 'snapshot');
assert.equal(providerOrder.metadata.malicious, undefined);
assert.match(stored.callbackUrl, /\/human-design\?order_no=/);
assert.ok(!stored.callbackUrl.includes('prepaid'));
assert.equal(
  JSON.parse(stored.checkoutInfo).metadata.human_design.email,
  undefined
);
assert.equal(
  JSON.parse(stored.checkoutInfo).metadata.human_design.brief,
  'Emma & James, botanical crest'
);
assert.notEqual(
  await contract.weddingCheckoutId('guest-owner', 'id'),
  await contract.weddingCheckoutId('guest-owner:human-design', 'id')
);
console.log(
  'PASS real checkout: no contact required, server $30 and Waffo enforced, design context retained, distinct order identity and non-AI return route'
);
const notifier = evaluate('src/shared/services/human-design.ts', {
  '@/shared/models/order': { updateOrderByOrderNo: updateOrder },
  '@/shared/services/email': {
    getEmailService: async () => ({
      sendEmail: async (message) => {
        if (failEmail) return { success: false };
        sent++;
        notice = message;
        return { success: true };
      },
    }),
  },
  '@/shared/wedding/human-design': schemaModule,
});
await notifier.notifyHumanDesignOrder({ ...stored, status: 'paid' });
assert.equal(
  sent,
  0,
  'Paid orders without details must not break fulfillment or send empty notifications'
);
let allowed = true;
const detailModules = {
  'next/headers': { cookies: async () => ({ get: () => undefined }) },
  '@/shared/lib/resp': { respData: respond, respErr: errors },
  '@/shared/models/order': {
    findOrderByOrderNo: async () => stored,
    OrderStatus: status,
    updateOrderByOrderNo: updateOrder,
  },
  '@/shared/models/wedding-actor': {
    getWeddingActor: async () => ({ guestOwnerId: 'owner' }),
  },
  '@/shared/models/wedding-checkout': {
    canAccessWeddingCheckout: async () => allowed,
    weddingCheckoutCookie: () => 'cookie',
  },
  '@/shared/services/human-design': notifier,
  '@/shared/wedding/config': configModule,
  '@/shared/wedding/human-design': schemaModule,
};
const details = evaluate(
  'src/app/api/wedding/human-design/route.ts',
  detailModules
);
const statusReq = new Request(
  'https://example.test/api/wedding/human-design?order_no=wc_fixture'
);
const postDetails = (
  body = {
    orderNo: 'wc_fixture',
    email: 'couple@example.test',
    notes: 'Blue flowers and a hand-drawn border',
  },
  origin = 'https://example.test'
) =>
  new Request('https://example.test/api/wedding/human-design', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
let response = await details.GET(statusReq);
assert.equal(response.headers.get('cache-control'), 'private, no-store');
assert.equal((await response.json()).data.paid, false);
assert.equal((await details.POST(postDetails())).status, 403);
assert.equal(sent, 0);
stored = { ...stored, status: 'paid' };
allowed = false;
assert.equal((await details.POST(postDetails())).status, 404);
assert.equal((await details.GET(statusReq)).status, 404);
allowed = true;
assert.equal(
  (await details.POST(postDetails(undefined, 'https://other.test'))).status,
  403
);
assert.equal(
  (await details.POST(postDetails({ orderNo: 'wc_fixture', email: 'bad' })))
    .status,
  400
);
failEmail = true;
assert.equal((await details.POST(postDetails())).status, 503);
assert.equal(stored.status, 'paid');
assert.equal(stored.userEmail, 'couple@example.test');
assert.equal(sent, 0);
failEmail = false;
response = await details.POST(postDetails());
assert.equal(response.status, 200);
assert.equal((await response.json()).data.submitted, true);
assert.equal(sent, 1);
assert.equal(notice.replyTo, 'couple@example.test');
assert.match(notice.text, /Blue flowers/);
assert.match(notice.text, /Emma & James/);
assert.equal(stored.userEmail, 'couple@example.test');
response = await details.GET(statusReq);
assert.equal((await response.json()).data.submitted, true);
await details.POST(postDetails());
assert.equal(
  sent,
  1,
  'Submitted request retries do not send another support email'
);
assert.ok(
  !source('src/shared/models/wedding.ts').includes('isWeddingCheckoutProduct')
);
console.log(
  'PASS real post-payment API: unpaid/other-owner/cross-origin denied, contact saved only on paid order, full brief emailed once, private status and AI rights unchanged'
);

const jsx = (type, props) => ({ type, props });
function hookHarness(initial = []) {
  const values = [...initial];
  let index = 0;
  return {
    values,
    reset: () => {
      index = 0;
    },
    react: {
      useId: () => 'fixture',
      useEffect: () => {},
      useCallback: (fn) => fn,
      useState: (value) => {
        const i = index++;
        if (!(i in values)) values[i] = value;
        return [
          values[i],
          (next) => {
            values[i] = next;
          },
        ];
      },
    },
  };
}
const find = (node, predicate) => {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const match = find(child, predicate);
    if (match) return match;
  }
};
const hooks = hookHarness(),
  storage = new Map();
let posted,
  assigned,
  aiClicks = 0,
  brief = 'Emma & James, botanical crest';
const localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
const widget = evaluate(
  'src/shared/components/wedding/human-design-purchase.tsx',
  {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: hooks.react,
    'next-intl': { useLocale: () => 'zh', useTranslations: () => (key) => key },
    '@/shared/components/ui/button': { Button: 'button' },
    '@/shared/wedding/config': configModule,
    '@/shared/wedding/pricing': {
      WEDDING_PACK_PRICING: {
        price: `$${JSON.parse(source('src/config/wedding-pricing.json')).priceUsd}`,
      },
    },
    '@/shared/wedding/purchase-client': {
      requestWeddingCheckout: async (submit) => {
        const response = await submit();
        return { response, body: await response.json() };
      },
      stableWeddingRequestId: async (store, key) => {
        let id = store.getItem(key);
        if (!id) {
          id = crypto.randomUUID();
          store.setItem(key, id);
        }
        return id;
      },
    },
  },
  {
    localStorage,
    window: {
      location: {
        assign: (url) => {
          assigned = url;
        },
      },
    },
    fetch: async (_, options) => {
      posted = options;
      return respond({ checkoutUrl: 'https://checkout.example.test/human' });
    },
  }
);
const render = () => {
  hooks.reset();
  return widget.HumanDesignPurchase({
    brief,
    aiAction: jsx('button', { onClick: () => aiClicks++ }),
  });
};
let tree = render();
const ai = find(tree, (n) => n.props?.['data-design-option'] === 'ai'),
  human = find(tree, (n) => n.props?.['data-design-option'] === 'human');
assert.ok(ai && human);
assert.equal(ai.props.className, human.props.className);
assert.equal(
  find(tree, (n) => ['input', 'form', 'textarea'].includes(n.type)),
  undefined
);
find(ai, (n) => n.type === 'button').props.onClick();
assert.equal(aiClicks, 1);
assert.equal(posted, undefined);
const chooseHuman = () =>
  find(
    find(render(), (n) => n.props?.['data-design-option'] === 'human'),
    (n) => n.type === 'button'
  ).props.onClick();
await chooseHuman();
assert.equal(JSON.parse(posted.body).product_id, product);
assert.equal(JSON.parse(posted.body).metadata.human_design.email, undefined);
assert.equal(JSON.parse(posted.body).metadata.human_design.notes, undefined);
assert.equal(assigned, 'https://checkout.example.test/human');
const first = posted.headers['x-wedding-checkout-id'];
await chooseHuman();
assert.equal(posted.headers['x-wedding-checkout-id'], first);
brief = 'Updated brief';
await chooseHuman();
assert.notEqual(posted.headers['x-wedding-checkout-id'], first);
localStorage.getItem = () => {
  throw new Error('storage denied');
};
await chooseHuman();
assert.equal(hooks.values[0], false);
assert.equal(hooks.values[1], true);
console.log(
  'PASS real comparison UI: equal cards, original AI action retained, human checkout with no email fields, stable retries and edited-brief keys'
);

const formHooks = hookHarness([false, false, false, false, '', '', false]);
let contactPost,
  failContact = false;
const form = evaluate(
  'src/shared/components/wedding/human-design-order.tsx',
  {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: formHooks.react,
    'next-intl': { useTranslations: () => (key) => key },
    'next/navigation': {
      useSearchParams: () => new URLSearchParams('order_no=wc_fixture'),
    },
    '@/shared/components/ui/button': { Button: 'button' },
    '@/shared/components/ui/input': { Input: 'input' },
    '@/shared/components/ui/label': { Label: 'label' },
  },
  {
    localStorage: {},
    fetch: async (url, options) => {
      contactPost = { url, ...options };
      return failContact ? errors('retry', 503) : respond({ submitted: true });
    },
  }
);
const renderForm = () => {
  formHooks.reset();
  return form.HumanDesignOrder();
};
assert.equal(
  find(renderForm(), (n) => n.type === 'form'),
  undefined,
  'No details form for unverified payment'
);
formHooks.values[0] = true;
tree = renderForm();
assert.ok(find(tree, (n) => n.type === 'form'));
find(tree, (n) => n.type === 'input').props.onChange({
  target: { value: 'couple@example.test' },
});
find(tree, (n) => n.type === 'textarea').props.onChange({
  target: { value: 'Blue flowers' },
});
await find(renderForm(), (n) => n.type === 'form').props.onSubmit({
  preventDefault() {},
});
assert.equal(contactPost.url, '/api/wedding/human-design');
assert.equal(JSON.parse(contactPost.body).email, 'couple@example.test');
assert.equal(formHooks.values[1], true);
assert.equal(
  find(renderForm(), (n) => n.type === 'form'),
  undefined
);
formHooks.values[1] = false;
failContact = true;
await find(renderForm(), (n) => n.type === 'form').props.onSubmit({
  preventDefault() {},
});
assert.equal(formHooks.values[0], true);
assert.equal(formHooks.values[3], false);
assert.equal(formHooks.values[6], true);
console.log(
  'PASS real paid-details UI: form appears only after verified payment, saves contact to same order, confirms submission, retries without another checkout'
);
