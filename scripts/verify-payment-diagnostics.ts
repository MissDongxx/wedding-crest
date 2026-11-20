import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createClient } from '@libsql/client';
import ts from 'typescript';
import * as zod from 'zod';

function load(
  path: string,
  imports: Record<string, unknown>,
  globals: Record<string, unknown> = {}
) {
  const exports: Record<string, any> = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    {
      exports,
      require: (name: string) => {
        if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
        return imports[name];
      },
      console,
      crypto: webcrypto,
      TextEncoder,
      TextDecoder,
      Response,
      Request,
      URL,
      Uint8Array,
      setTimeout,
      clearTimeout,
      ...globals,
    }
  );
  return exports;
}
async function main() {
  const contract = load('src/shared/wedding/payment-diagnostics-contract.ts', {
    zod,
  });
  const attemptId = '2467d346-642d-4f32-a45e-98c1e2a917b1';
  const clicked = { stage: 'clicked', entry: 'wizard', attemptId };
  assert.ok(contract.checkoutClientDiagnosticSchema.safeParse(clicked).success);
  for (const invalid of [
    { ...clicked, ownerId: 'somebody' },
    { ...clicked, email: 'buyer@example.test' },
    { ...clicked, source: 'server' },
    { ...clicked, details: { body: 'secret' } },
    { ...clicked, reason: 'buyer@example.test' },
    { ...clicked, latencyMs: -1 },
    { ...clicked, orderNo: 'https://evil.test/token' },
  ]) {
    assert.equal(
      contract.checkoutClientDiagnosticSchema.safeParse(invalid).success,
      false
    );
  }
  const sanitized = contract.sanitizePaymentDiagnosticDetails({
    errorType: 'TypeError',
    errorCode: 'ECONNRESET',
    httpStatus: 502,
    paymentStatus: 'failed',
    providerReason: 'Your card was declined, customer buyer@example.test',
    email: 'buyer@example.test',
    url: 'https://secret.example/token',
    token: 'a'.repeat(64),
    body: 'raw',
  });
  for (const reason of [
    'insufficient_funds',
    'expired_card',
    'incorrect_cvc',
    'incorrect_card_number',
    'authentication_required',
    'risk_rejected',
    'do_not_honor',
    'card_declined',
    'payment_method_unsupported',
    'canceled',
    'provider_timeout',
    'checkout_expired',
    'provider_error',
    'provider_rejected',
  ]) {
    assert.equal(
      contract.classifyProviderPaymentReason(reason),
      reason,
      `canonical provider reason remains stable: ${reason}`
    );
    assert.equal(
      contract.sanitizePaymentDiagnosticDetails({ providerReason: reason })
        .providerReason,
      reason
    );
  }
  const cardNumberReason = contract.classifyProviderPaymentReason(
    'Invalid card number'
  );
  assert.equal(cardNumberReason, 'incorrect_card_number');
  assert.equal(
    contract.classifyProviderPaymentReason(cardNumberReason),
    cardNumberReason
  );
  assert.equal(sanitized.providerReason, 'card_declined');
  assert.equal(sanitized.httpStatus, 502);
  assert.equal(sanitized.email, undefined);
  assert.equal(
    contract.sanitizePaymentDiagnosticDetails({
      errorCode: 'sk_live_abcdef',
      errorType: 'TokenAbcdef',
      paymentStatus: 'secret',
    }),
    undefined
  );
  assert.ok(!JSON.stringify(sanitized).includes('buyer@example.test'));
  assert.equal(
    contract.safePaymentCode('sk_live_' + '1'.repeat(32)),
    undefined
  );

  let stored: any[] = [],
    warnings: unknown[][] = [],
    shouldFail = false,
    cloudflare = false;
  let background: Promise<void> | undefined;
  const drizzle = {
    and: (...x: unknown[]) => x,
    eq: (...x: unknown[]) => x,
    gte: (...x: unknown[]) => x,
    count: () => 1,
  };
  const db = () => ({
    insert: () => ({
      values: (value: any) => ({
        onConflictDoNothing: async () => {
          if (shouldFail) throw new Error('postgres://secret@host credentials');
          stored.push(value);
        },
      }),
    }),
  });
  const model = load(
    'src/shared/models/payment-diagnostic.ts',
    {
      '@opennextjs/cloudflare': {
        getCloudflareContext: () => {
          if (!cloudflare) throw new Error('not Worker');
          return {
            ctx: {
              waitUntil: (promise: Promise<void>) => {
                background = promise;
              },
            },
          };
        },
      },
      'drizzle-orm': drizzle,
      '@/core/db': { db },
      '@/config/db/schema': { paymentDiagnosticEvent: {} },
      '@/shared/wedding/payment-diagnostics-contract': contract,
    },
    { console: { warn: (...args: unknown[]) => warnings.push(args) } }
  );
  assert.equal(
    model.classifyPaymentDiagnosticError(
      Object.assign(new Error('buyer@example.test'), {
        cause: { code: 'ECONNRESET' },
      })
    ).reason,
    'network_error'
  );
  assert.equal(
    model.classifyPaymentDiagnosticError(
      Object.assign(new Error('https://secret.test'), { name: 'AbortError' })
    ).reason,
    'timeout'
  );
  await model.recordPaymentDiagnostic({
    source: 'client',
    stage: 'clicked',
    ownerId: 'owner',
    attemptId,
    details: { email: 'buyer@example.test' },
  });
  await model.recordPaymentDiagnostic({
    source: 'client',
    stage: 'clicked',
    ownerId: 'owner',
    attemptId,
  });
  assert.equal(stored.length, 2);
  assert.equal(stored[0].id, stored[1].id, 'same event has stable dedupe key');
  assert.equal(stored[0].details, undefined);
  cloudflare = true;
  await model.recordPaymentDiagnostic({
    source: 'server',
    stage: 'checkout_created',
    orderNo: 'wc_fixture',
  });
  assert.ok(background);
  await background;
  shouldFail = true;
  await model.recordPaymentDiagnostic({
    source: 'server',
    stage: 'checkout_create_failed',
    details: { token: 'raw', errorCode: 'ECONNRESET' },
  });
  await background;
  assert.ok(!JSON.stringify(warnings).includes('postgres://'));

  let actor: any = { user: null, guestOwnerId: 'guest_owner' },
    recordCalls: any[] = [],
    actorArgs: unknown[][] = [],
    allowed = true,
    projectOwned = true;
  const endpoint = load('src/app/api/payment/diagnostics/route.ts', {
    '@/shared/models/order': {
      findOrderByOrderNo: async (id: string) =>
        id === 'wc_not_inserted'
          ? undefined
          : { userId: id === 'wc_owned' ? 'guest_owner' : 'stranger' },
    },
    '@/shared/models/payment-diagnostic': {
      canRecordClientPaymentDiagnostic: async () => allowed,
      recordPaymentDiagnostic: async (event: any) => {
        recordCalls.push(event);
      },
    },
    '@/shared/models/wedding': {
      getWeddingProject: async () => ({
        userId: projectOwned ? 'guest_owner' : 'stranger',
      }),
      canAccessWeddingProject: async () => projectOwned,
    },
    '@/shared/models/wedding-actor': {
      getWeddingActor: async (...args: unknown[]) => {
        actorArgs.push(args);
        return actor;
      },
      getWeddingProjectOwner: (_actor: unknown, project: any) =>
        project.userId === 'guest_owner' ? 'guest_owner' : undefined,
    },
    '@/shared/wedding/payment-diagnostics-contract': contract,
  });
  const request = (body: unknown, origin = 'https://shop.example.test') =>
    new Request('https://shop.example.test/api/payment/diagnostics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin },
      body: JSON.stringify(body),
    });
  assert.equal((await endpoint.POST(request(clicked))).status, 204);
  assert.equal(recordCalls.length, 1);
  assert.equal(recordCalls[0].source, 'client');
  assert.equal(recordCalls[0].ownerId, 'guest_owner');
  assert.equal(
    actorArgs[0].length,
    0,
    'analytics never creates/rotates guest cookie'
  );
  assert.equal(
    (await endpoint.POST(request(clicked, 'https://evil.test'))).status,
    403
  );
  assert.equal(
    (await endpoint.POST(request({ ...clicked, ownerId: 'stranger' }))).status,
    400
  );
  assert.equal(
    (await endpoint.POST(request({ ...clicked, orderNo: 'wc_stranger' })))
      .status,
    404
  );
  assert.equal(
    (await endpoint.POST(request({ ...clicked, orderNo: 'wc_owned' }))).status,
    204
  );
  const noOrderFailure = {
    ...clicked,
    stage: 'request_failed',
    reason: 'http_error',
    orderNo: 'wc_not_inserted',
    projectId: 'project',
  };
  assert.equal((await endpoint.POST(request(noOrderFailure))).status, 204);
  assert.equal(recordCalls.at(-1).orderNo, undefined);
  assert.equal(recordCalls.at(-1).ownerId, 'guest_owner');
  assert.equal(
    (await endpoint.POST(request({ ...noOrderFailure, orderNo: 'wc_stranger' })))
      .status,
    404
  );
  assert.equal(
    (await endpoint.POST(request({ ...clicked, orderNo: 'wc_not_inserted' })))
      .status,
    404
  );
  projectOwned = false;
  assert.equal((await endpoint.POST(request(noOrderFailure))).status, 404);
  assert.equal(
    (await endpoint.POST(request({ ...clicked, projectId: 'project' }))).status,
    404
  );
  projectOwned = true;
  allowed = false;
  assert.equal((await endpoint.POST(request(clicked))).status, 429);
  allowed = true;
  actor = { user: null };
  const before = recordCalls.length;
  assert.equal((await endpoint.POST(request(clicked))).status, 204);
  assert.equal(
    recordCalls.length,
    before,
    'no guest identity: discard event without minting Cookie'
  );
  const large = new Request(
    'https://shop.example.test/api/payment/diagnostics',
    {
      method: 'POST',
      body: 'x'.repeat(2049),
    }
  );
  assert.equal((await endpoint.POST(large)).status, 413);

  const sqlite = createClient({ url: ':memory:' });
  try {
    await sqlite.executeMultiple(
      readFileSync(
        'src/config/db/migrations_sqlite/0006_payment_diagnostic_events.sql',
        'utf8'
      )
    );
    await sqlite.execute({
      sql: 'insert into payment_diagnostic_event(id,source,stage,created_at) values(?,?,?,?)',
      args: ['event', 'server', 'checkout_created', Date.now()],
    });
    assert.equal(
      (
        await sqlite.execute(
          'select count(*) as total from payment_diagnostic_event'
        )
      ).rows[0].total,
      1
    );
    await sqlite.executeMultiple(
      readFileSync(
        'artifacts/payment-flow-observability-20261117/rollback-payment-diagnostics-sqlite.sql',
        'utf8'
      )
    );
    assert.equal(
      (
        await sqlite.execute(
          "select count(*) as total from sqlite_master where name='payment_diagnostic_event'"
        )
      ).rows[0].total,
      0
    );
  } finally {
    sqlite.close();
  }
  console.log(
    'PASS: strict PII-free input; provider error canonicalization; idempotent keys; best-effort Worker persistence; same-origin/ownership/rate/size validation; telemetry never creates guest identity; SQLite migration and rollback.'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
