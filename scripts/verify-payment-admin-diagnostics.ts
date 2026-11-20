import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createElement } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as zod from 'zod';

function evaluate(
  code: string,
  imports: Record<string, unknown>,
  globals: Record<string, unknown> = {}
) {
  const exports: Record<string, any> = {};
  const context = vm.createContext({
    exports,
    require(name: string) {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
    console,
    Date,
    ...globals,
  });
  vm.runInContext(
    ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
    context
  );
  return { exports, context };
}
const load = (
  path: string,
  imports: Record<string, unknown>,
  globals: Record<string, unknown> = {}
) => evaluate(readFileSync(path, 'utf8'), imports, globals).exports;

async function main() {
  const contract = load('src/shared/wedding/payment-diagnostics-contract.ts', {
    zod,
  });
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let nextTimer = 0;
  const observations: any[] = [];
  const queries: any[] = [];
  let sinkFails = false;
  let query: () => Promise<any> = async () => ({ paymentStatus: 'paid' });
  let serviceCalls = 0;
  let writeCalls = 0;
  let missingProvider = false;
  const forbiddenWrite = () => {
    writeCalls++;
    throw new Error(
      'Read-only platform inspection attempted a payment mutation'
    );
  };
  const platform = load(
    'src/shared/models/payment-diagnostic-platform.ts',
    {
      '@/shared/models/payment-diagnostic': {
        recordPaymentDiagnostic: async (event: unknown) => {
          observations.push(event);
          if (sinkFails) throw new Error('diagnostics unavailable');
        },
      },
      '@/shared/services/payment': {
        getPaymentService: async () => {
          serviceCalls++;
          return {
            getProvider: (name: string) => {
              assert.equal(name, 'waffo');
              return missingProvider
                ? undefined
                : {
                    getPaymentSession: async (input: unknown) => {
                      queries.push(input);
                      return query();
                    },
                    createPayment: forbiddenWrite,
                    cancelPayment: forbiddenWrite,
                    refundPayment: forbiddenWrite,
                  };
            },
            handleCheckoutSuccess: forbiddenWrite,
            updateOrderByOrderNo: forbiddenWrite,
          };
        },
      },
      '@/shared/wedding/payment-diagnostics-contract': contract,
    },
    {
      setTimeout: (callback: () => void, delay: number) => {
        const id = ++nextTimer;
        timers.set(id, { callback, delay });
        return id;
      },
      clearTimeout: (id: number) => timers.delete(id),
    }
  );
  const order = Object.freeze({
    orderNo: 'wc_admin_fixture',
    userId: 'guest_owner_a',
    paymentProvider: 'waffo',
    paymentSessionId: 'checkout_fixture',
  });
  const inspect = async (expectedStatus: string, expectedReason: string) => {
    const result = await platform.inspectPaymentPlatform(order);
    assert.equal(result.paymentStatus, expectedStatus);
    assert.equal(result.reason, expectedReason);
    assert.match(result.checkedAt, /^\d{4}-\d\d-\d\dT/);
    assert.equal(
      timers.size,
      0,
      'platform observation releases its deadline timer'
    );
    const event = observations.at(-1);
    assert.equal(event.source, 'provider');
    assert.equal(event.stage, 'admin_platform_checked');
    assert.equal(event.orderNo, order.orderNo);
    assert.equal(event.ownerId, order.userId);
    assert.equal(event.details.paymentStatus, expectedStatus);
    return result;
  };
  await inspect('paid', 'payment_succeeded');
  query = async () => ({
    paymentStatus: 'failed',
    paymentResult: {
      failureReason: 'Card declined for PRIVATE@example.invalid; token=PRIVATE',
      email: 'PRIVATE@example.invalid',
      cardNumber: 'PRIVATE',
    },
  });
  const declined = await inspect('failed', 'provider_payment_failed');
  assert.equal(declined.providerReason, 'card_declined');
  assert.equal(observations.at(-1).details.providerReason, 'card_declined');
  assert.equal(
    JSON.stringify([declined, observations]).includes('PRIVATE'),
    false
  );
  query = async () => ({
    paymentStatus: 'processing',
    paymentResult: { diagnosticReason: 'no_payment_record' },
  });
  await inspect('processing', 'no_payment_record');
  query = async () => ({
    paymentStatus: 'processing',
    paymentResult: { diagnosticReason: 'provider_query_error' },
  });
  await inspect('processing', 'provider_query_error');
  query = async () => {
    throw new Error('PRIVATE credentials and customer information');
  };
  await inspect('unknown', 'provider_query_error');
  missingProvider = true;
  await inspect('unknown', 'provider_query_error');
  missingProvider = false;
  const beforeNoSession = serviceCalls;
  const noSession = await platform.inspectPaymentPlatform({
    ...order,
    paymentSessionId: null,
  });
  assert.equal(noSession.paymentStatus, 'unknown');
  assert.equal(noSession.reason, 'no_checkout_session');
  assert.equal(
    serviceCalls,
    beforeNoSession,
    'no session does not invoke a provider'
  );
  console.log(
    'PASS real platform inspector: paid/declined/no-payment/query-error canonicalization; PII excluded; missing session/provider bounded'
  );

  query = () => new Promise(() => {});
  const deadline = platform.inspectPaymentPlatform(order);
  assert.equal(timers.size, 1);
  const timeout = [...timers.values()][0];
  assert.equal(timeout.delay, 8000);
  timeout.callback();
  const timedOut = await deadline;
  assert.equal(timedOut.paymentStatus, 'unknown');
  assert.equal(timedOut.reason, 'provider_query_error');
  assert.equal(timers.size, 0);
  sinkFails = true;
  query = async () => ({ paymentStatus: 'paid' });
  await inspect('paid', 'payment_succeeded');
  assert.equal(
    writeCalls,
    0,
    'inspection never fulfils, updates, creates, cancels or refunds an order'
  );
  assert.ok(
    queries.every((input) => Object.keys(input).join(',') === 'sessionId')
  );
  assert.equal(JSON.stringify(observations).includes('PRIVATE'), false);
  console.log(
    'PASS real platform inspector: exact 8s timeout, timer cleanup, failed sink tolerated and zero payment mutations'
  );

  let unsupportedServiceCalls = 0;
  let unsupportedProviderCalls = 0;
  let captureCapableQueryCalls = 0;
  const unsupportedPlatform = load(
    'src/shared/models/payment-diagnostic-platform.ts',
    {
      '@/shared/models/payment-diagnostic': {
        recordPaymentDiagnostic: async (event: any) => {
          assert.equal(event.reason, 'platform_read_not_supported');
        },
      },
      '@/shared/services/payment': {
        getPaymentService: async () => {
          unsupportedServiceCalls++;
          return {
            getProvider: () => {
              unsupportedProviderCalls++;
              return {
                getPaymentSession: async () => {
                  captureCapableQueryCalls++;
                  // Mirrors the hazardous APPROVED -> capture behavior, without
                  // performing any real payment operation in this regression.
                  throw new Error(
                    'PayPal APPROVED query would capture payment'
                  );
                },
              };
            },
          };
        },
      },
      '@/shared/wedding/payment-diagnostics-contract': contract,
    },
    { setTimeout, clearTimeout }
  );
  for (const paymentProvider of ['paypal', 'stripe', 'unknown_provider']) {
    const unsupported = await unsupportedPlatform.inspectPaymentPlatform({
      ...order,
      paymentProvider,
      paymentSessionId: 'APPROVED',
    });
    assert.equal(unsupported.paymentStatus, 'unknown');
    assert.equal(unsupported.reason, 'platform_read_not_supported');
  }
  assert.equal(unsupportedServiceCalls, 0);
  assert.equal(unsupportedProviderCalls, 0);
  assert.equal(captureCapableQueryCalls, 0);
  console.log(
    'PASS read-only provider allowlist: PayPal APPROVED, Stripe and unknown providers perform zero service/provider/session calls'
  );

  const pagePath = 'src/app/[locale]/(admin)/admin/payments/page.tsx';
  const pageSource = readFileSync(pagePath, 'utf8');
  const ast = ts.createSourceFile(
    pagePath,
    pageSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let declaration: ts.VariableStatement | undefined;
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some(
        (item) => item.name.getText(ast) === 'diagnosticEventsFor'
      )
    )
      declaration = node;
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(
    declaration,
    'extract actual owner+attempt event association from page AST'
  );
  const diagnostics = [
    {
      id: 'a_order',
      orderNo: 'wc_a',
      ownerId: 'owner_a',
      attemptId: 'same-attempt',
    },
    {
      id: 'b_order',
      orderNo: 'wc_b',
      ownerId: 'owner_b',
      attemptId: 'same-attempt',
    },
    {
      id: 'a_click',
      orderNo: null,
      ownerId: 'owner_a',
      attemptId: 'same-attempt',
    },
    {
      id: 'b_click',
      orderNo: null,
      ownerId: 'owner_b',
      attemptId: 'same-attempt',
    },
    {
      id: 'anonymous_click',
      orderNo: null,
      ownerId: null,
      attemptId: 'same-attempt',
    },
    {
      id: 'other_attempt',
      orderNo: null,
      ownerId: 'owner_a',
      attemptId: 'different-attempt',
    },
  ];
  const association = evaluate(
    `${declaration.getText(ast)}\nglobalThis.select = diagnosticEventsFor;`,
    {},
    { diagnostics }
  ).context;
  const select = association.select as (
    orderNo: string
  ) => Array<{ id: string }>;
  assert.deepEqual(
    Array.from(select('wc_a'), (item) => item.id),
    ['a_order', 'a_click']
  );
  assert.deepEqual(
    Array.from(select('wc_b'), (item) => item.id),
    ['b_order', 'b_click']
  );
  assert.equal(select('wc_missing').length, 0);
  console.log(
    'PASS actual admin AST association: same attempt ID across owners cannot mix unbound events'
  );

  const view = load('src/shared/components/wedding/payment-diagnostics.tsx', {
    'react/jsx-runtime': jsxRuntime,
  });
  let allowed = true;
  const calls: string[] = [];
  let payments: Array<{
    orderNo: string;
    userId: string;
    paymentProvider: string;
    paymentSessionId: string;
  }> = [order];
  const page = load(pagePath, {
    'react/jsx-runtime': jsxRuntime,
    'next-intl/server': {
      setRequestLocale: () => calls.push('locale'),
      getTranslations: async () => (key: string) => key,
    },
    '@/core/rbac': {
      PERMISSIONS: { PAYMENTS_READ: 'payments.read' },
      requirePermission: async (input: { code: string }) => {
        calls.push('permission');
        assert.equal(input.code, 'payments.read');
        if (!allowed) throw new Error('permission_denied');
      },
    },
    '@/shared/blocks/dashboard': {
      Header: 'header',
      Main: 'main',
      MainHeader: 'h1',
    },
    '@/shared/blocks/table': { TableCard: 'section' },
    '@/shared/components/ui/badge': { Badge: 'span' },
    '@/shared/components/wedding/payment-diagnostics': view,
    '@/shared/lib/payment-status': { getPaymentDisplayStatus: () => 'paid' },
    '@/shared/models/order': {
      OrderStatus: {
        PAID: 'paid',
        CREATED: 'created',
        FAILED: 'failed',
        CANCELED: 'canceled',
      },
      getOrdersCount: async () => {
        calls.push('count');
        return payments.length;
      },
      getOrders: async () => {
        calls.push('orders');
        return payments;
      },
    },
    '@/shared/models/payment-diagnostic': {
      getPaymentDiagnosticsForOrders: async () => {
        calls.push('diagnostics');
        return diagnostics;
      },
    },
    '@/shared/models/payment-diagnostic-platform': {
      inspectPaymentPlatform: async () => {
        calls.push('inspect');
        return {
          paymentStatus: 'paid',
          reason: 'payment_succeeded',
          checkedAt: '2026-11-17T00:00:00.000Z',
        };
      },
    },
  });
  const renderPage = (search: Record<string, string>) =>
    page.default({
      params: Promise.resolve({ locale: 'zh' }),
      searchParams: Promise.resolve(search),
    });
  await renderPage({ orderNo: order.orderNo, refresh: '1' });
  assert.ok(calls.indexOf('permission') < calls.indexOf('inspect'));
  assert.ok(calls.indexOf('permission') < calls.indexOf('orders'));
  calls.length = 0;
  allowed = false;
  await assert.rejects(
    renderPage({ orderNo: order.orderNo, refresh: '1' }),
    /permission_denied/
  );
  assert.deepEqual(calls, ['locale', 'permission']);
  allowed = true;
  const nonPollingSearches: Record<string, string>[] = [
    { orderNo: order.orderNo },
    { orderNo: 'wrong-order', refresh: '1' },
    { refresh: '1' },
  ];
  for (const search of nonPollingSearches) {
    calls.length = 0;
    await renderPage(search);
    assert.equal(calls.includes('inspect'), false);
  }
  payments = [order, { ...order, orderNo: 'wc_second' }];
  calls.length = 0;
  await renderPage({ orderNo: order.orderNo, refresh: '1' });
  assert.equal(
    calls.includes('inspect'),
    false,
    'broad/multiple order lists never trigger provider polling'
  );
  console.log(
    'PASS real admin page: permission precedes reads/inspection; denial performs no data access; only explicit exact one-order refresh polls provider'
  );

  const malicious = '<script>alert("PRIVATE")</script>';
  const markup = renderToStaticMarkup(
    createElement(view.PaymentDiagnostics, {
      locale: 'zh',
      events: [
        {
          source: malicious,
          stage: 'redirect_not_left',
          reason: 'redirect_timeout',
          createdAt: '2026-11-17T00:00:00.000Z',
          httpStatus: 502,
          latencyMs: 5000,
          details: JSON.stringify({ text: malicious }),
        },
      ],
    })
  );
  assert.match(markup, /<details/);
  assert.match(markup, /弱信号/);
  assert.match(markup, /不代表银行拒付/);
  assert.match(markup, /UTC/);
  assert.match(markup, /HTTP 502/);
  assert.match(markup, /5000 ms/);
  assert.match(markup, /2026-11-17T00:00:00.000Z/);
  assert.match(markup, /&lt;script&gt;/);
  assert.equal(markup.includes('<script>'), false);
  assert.equal(
    view.paymentDiagnosticLabel('card_declined', 'zh'),
    '支付平台报告银行卡被拒'
  );
  const zhEmpty = renderToStaticMarkup(
    createElement(view.PaymentDiagnostics, { locale: 'zh', events: [] })
  );
  const enEmpty = renderToStaticMarkup(
    createElement(view.PaymentDiagnostics, { locale: 'en', events: [] })
  );
  assert.match(zhEmpty, /暂无埋点记录（含上线前订单）/);
  assert.match(enEmpty, /No recorded diagnostics \(including older orders\)/);
  console.log(
    'PASS real diagnostics SSR: expandable details, explicit weak-signal/UTC warning, source/details HTML escaping and older-order empty state'
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
