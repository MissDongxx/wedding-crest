import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Regression: checkout amount
{
  const file = 'src/app/api/payment/checkout/route.ts';
  const pricing = JSON.parse(
    fs.readFileSync('src/config/locale/messages/en/pages/pricing.json', 'utf8')
  );
  const config = {
    default_payment_provider: 'waffo',
    waffo_price_mode: 'product',
    app_url: 'http://localhost:3000',
    default_locale: 'en',
    waffo_product_ids: JSON.stringify({
      wedding_identity_pack: 'PROD_fixture',
    }),
  };
  let chosen, orderSeen;
  const respond = (data) => Response.json({ code: 0, data });
  const modules = {
    'next/headers': { cookies: async () => ({ set() {} }) },
    '@/core/i18n/request': { loadMessages: async () => pricing },
    '@/extensions/payment/types': {
      PaymentInterval: { ONE_TIME: 'one-time' },
      PaymentType: { ONE_TIME: 'one-time', SUBSCRIPTION: 'subscription' },
    },
    '@/shared/lib/hash': {
      getSnowId: () => 'fixture-order',
      getUuid: () => 'fixture-id',
    },
    '@/shared/lib/resp': {
      respData: respond,
      respErr: (message) => Response.json({ code: -1, message }),
    },
    '@/shared/models/config': { getAllConfigs: async () => config },
    '@/shared/models/order': {
      OrderStatus: { PENDING: 'pending', CREATED: 'created' },
      createOrder: async () => {},
      updateOrderByOrderNo: async () => {},
    },
    '@/shared/models/user': {
      getUserInfo: async () => ({
        id: 'fixture-user',
        email: 'fixture@example.test',
      }),
    },
    '@/shared/models/wedding': {},
    '@/shared/models/wedding-checkout': {},
    '@/shared/services/payment': {
      getPaymentService: async (c) => {
        chosen = c || config;
        return {
          getProvider: (name) => ({
            name,
            createPayment: async ({ order }) => {
              orderSeen = order;
              return {
                provider: name,
                checkoutParams: order,
                checkoutResult: {},
                checkoutInfo: {
                  checkoutUrl: 'https://checkout.example.test',
                  sessionId: 'fixture',
                },
              };
            },
          }),
        };
      },
    },
    '@/shared/wedding/config': {
      WEDDING_PACK_PRODUCT_ID: 'wedding_identity_pack',
    },
  };
  const exports = {};
  const cjs = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(cjs, {
    exports,
    require: (id) => {
      if (!(id in modules)) throw new Error(`Unexpected import ${id}`);
      return modules[id];
    },
    Request,
    Response,
    URL,
    console,
  });
  const response = await exports.POST(
    new Request('http://localhost:3000/api/payment/checkout', {
      method: 'POST',
      body: JSON.stringify({
        product_id: 'wedding_identity_pack',
        locale: 'en',
        payment_provider: 'waffo',
      }),
    })
  );
  const body = await response.json();
  assert.equal(body.code, 0);
  assert.equal(
    chosen.waffo_price_mode,
    'snapshot',
    'wedding checkout must not use stale provider catalog price'
  );
  assert.equal(chosen.waffo_tax_category, 'digital_goods');
  assert.equal(orderSeen.price.amount, 290);
  assert.equal(orderSeen.price.currency, 'usd');
  assert.equal(
    config.waffo_price_mode,
    'product',
    'do not mutate shared configuration'
  );
  console.log(
    'PASS: real checkout route selects wedding-only snapshot, 290 USD cents; shared config unchanged'
  );
}

// Regression: unsent retries
{
  const file = 'src/extensions/payment/waffo.ts';
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      require: (id) =>
        id === '@waffo/pancake-ts'
          ? {
              WaffoPancake: class {
                checkout = {};
              },
            }
          : {},
      Error,
      Promise,
      Set,
      Date,
      console,
      process: { env: { NODE_ENV: 'production' } },
      setTimeout: (fn) => {
        fn();
        return 0;
      },
    }
  );
  const { WaffoProvider } = exports;
  const order = {
    productId: 'PROD_fixture',
    orderNo: 'fixture',
    price: { amount: 290, currency: 'USD' },
    metadata: {},
  };
  const success = {
    sessionId: 'fixture',
    checkoutUrl: 'https://checkout.example.test',
  };
  function provider() {
    return new WaffoProvider({
      merchantId: 'MER_fixture',
      privateKey: 'fixture',
      priceMode: 'snapshot',
      taxCategory: 'digital_goods',
    });
  }
  const unsent = () =>
    new TypeError('fetch failed', {
      cause: {
        code: 'ECONNRESET',
        message:
          'Client network socket disconnected before secure TLS connection was established',
      },
    });
  const p = provider();
  let calls = 0;
  let params;
  p.client.checkout.createSession = async (body) => {
    params = body;
    if (++calls < 3) throw unsent();
    return success;
  };
  const checkout = await p.createPayment({ order });
  assert.equal(calls, 3);
  assert.equal(params.priceSnapshot.amount, '2.90');
  assert.equal(checkout.checkoutInfo.checkoutUrl, success.checkoutUrl);
  for (const err of [
    new Error('API rejected payment'),
    new TypeError('fetch failed', {
      cause: { code: 'ECONNRESET', message: 'socket reset after sending' },
    }),
  ]) {
    const q = provider();
    let n = 0;
    q.client.checkout.createSession = async () => {
      n++;
      throw err;
    };
    await assert.rejects(
      () => q.createPayment({ order }),
      (e) => e === err
    );
    assert.equal(n, 1);
  }
  const q = provider();
  let n = 0;
  q.client.checkout.createSession = async () => {
    n++;
    throw unsent();
  };
  await assert.rejects(() => q.createPayment({ order }));
  assert.equal(n, 3);
  console.log(
    'PASS: unsent TLS failure recovers; 3 attempts maximum; API errors and post-send resets never retried; snapshot USD 2.90'
  );
}

// Regression: development transport
{
  const file = 'src/extensions/payment/waffo.ts';
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  for (const env of [
    { NODE_ENV: 'development', HTTPS_PROXY: 'http://127.0.0.1:7897' },
    { NODE_ENV: 'production', HTTPS_PROXY: 'http://127.0.0.1:7897' },
  ]) {
    let config,
      request,
      imports = 0;
    const exports = {};
    const expected = {};
    vm.runInNewContext(source, {
      exports,
      require: (id) => {
        if (id === '@waffo/pancake-ts')
          return {
            WaffoPancake: class {
              constructor(c) {
                config = c;
              }
            },
          };
        if (id === 'undici') {
          imports++;
          return {
            ProxyAgent: class {
              constructor(url) {
                this.url = url;
              }
            },
            fetch: async (input, init) => {
              request = { input, init };
              return expected;
            },
          };
        }
        return {};
      },
      process: { env },
      URL,
      Error,
      Promise,
      Set,
      Date,
      console,
      setTimeout,
    });
    new exports.WaffoProvider({
      merchantId: 'MER_fixture',
      privateKey: 'fixture',
    });
    if (env.NODE_ENV === 'development') {
      assert.equal(
        typeof config.fetch,
        'function',
        'SDK must use explicit proxy, independent of Next global fetch'
      );
      assert.equal(
        await config.fetch('https://api.example.test', {
          method: 'POST',
          body: 'fixture',
          headers: { 'x-idempotency-key': 'fixture' },
        }),
        expected
      );
      assert.equal(request.init.dispatcher.url, env.HTTPS_PROXY);
      assert.equal(request.init.body, 'fixture');
      assert.equal(imports, 1);
    } else {
      assert.equal(config.fetch, undefined);
      assert.equal(imports, 0);
    }
  }
  console.log(
    'PASS: SDK uses explicit local proxy in development; body/headers preserved; production never imports proxy transport'
  );
}

// Regression: guest CTA
{
  const src = fs.readFileSync('src/themes/default/blocks/pricing.tsx', 'utf8');
  const start = src.indexOf('  const handlePayment =');
  const end = src.indexOf('  const getAffiliateMetadata', start);
  assert.ok(start >= 0 && end > start);
  const code = ts.transpileModule(
    src.slice(start, end) + '\nexports.handlePayment=handlePayment;',
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }
  ).outputText;
  async function run(user, id, select = 'true') {
    const calls = [];
    const exports = {};
    vm.runInNewContext(code, {
      exports,
      user,
      WEDDING_PACK_PRODUCT_ID: 'wedding_identity_pack',
      router: { push: (url) => calls.push(['navigate', url]) },
      configs: {
        select_payment_enabled: select,
        default_payment_provider: 'waffo',
      },
      itemCurrencies: {},
      setIsShowSignModal: (v) => calls.push(['login', v]),
      setPricingItem: (item) => calls.push(['item', item.product_id]),
      setIsShowPaymentModal: (v) => calls.push(['paymentModal', v]),
      handleCheckout: (item, provider) =>
        calls.push(['checkout', item.product_id, provider]),
    });
    await exports.handlePayment({
      product_id: id,
      currency: 'USD',
      amount: 290,
    });
    return JSON.parse(JSON.stringify(calls));
  }
  assert.deepEqual(await run(null, 'wedding_identity_pack'), [
    ['navigate', '/create'],
  ]);
  assert.deepEqual(await run(null, 'other_product'), [['login', true]]);
  assert.deepEqual(await run({ id: 'user' }, 'wedding_identity_pack'), [
    ['item', 'wedding_identity_pack'],
    ['paymentModal', true],
  ]);
  assert.deepEqual(
    await run({ id: 'user' }, 'wedding_identity_pack', 'false'),
    [['checkout', 'wedding_identity_pack', 'waffo']]
  );
  console.log(
    'PASS: guest wedding pack enters /create without login/payment request; other products keep auth; signed-in provider selection and checkout unchanged'
  );
}

// Regression: every locale must display and charge the same promotion.
for (const locale of ['en', 'zh', 'de', 'fr', 'it', 'ko', 'pt-BR', 'th']) {
  const dir = `src/config/locale/messages/${locale}/pages`;
  const pricing = JSON.parse(fs.readFileSync(`${dir}/pricing.json`, 'utf8'));
  const item = pricing.page.sections.pricing.items.find(
    (item) => item.product_id === 'wedding_identity_pack'
  );
  assert.equal(item.amount, 290);
  assert.equal(item.currency, 'USD');
  assert.equal(item.price, '$2.9');
  assert.equal(item.original_price, '$9.9');
  const design = JSON.parse(fs.readFileSync(`${dir}/design.json`, 'utf8'));
  assert.ok(design.unlock_offer);
  assert.ok(design.unlock_savings.includes('$7'));
  assert.ok(design.unlock_cta.includes('$2.9'));
}
console.log(
  'PASS: all 8 locales display $2.9, reference $9.9, save $7, charge 290 USD cents'
);
