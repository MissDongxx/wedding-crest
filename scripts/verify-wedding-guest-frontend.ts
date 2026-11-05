import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

import {
  fetchWeddingAccess,
  requestWeddingCheckout,
  stableWeddingRequestId,
  weddingResumePath,
} from '../src/shared/wedding/purchase-client';

class MemoryStorage implements Storage {
  values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}
function declaration(path: string, name: string) {
  const source = readFileSync(path, 'utf8');
  const ast = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let found: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some(
        (d) => d.name.getText(ast) === name
      )
    )
      found = node;
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(found, `${path}: ${name}`);
  return found.getText(ast);
}
function evaluate(code: string, globals: Record<string, unknown>) {
  const context = vm.createContext(globals);
  vm.runInContext(
    ts.transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText,
    context
  );
  return context;
}
const wizardPath = 'src/themes/default/blocks/wedding-wizard.tsx';
const resultPath = 'src/themes/default/blocks/wedding-result.tsx';
const draftKey = 'wedding_wizard_state_v1';
const draft = {
  step: 6,
  partner1: 'Emma',
  partner2: 'James',
  style: 'coastal',
  location: 'Como',
  venue: 'Villa',
  showLocation: true,
  matchExample: {
    border: true,
    palette: false,
    flowers: true,
    elements: false,
  },
};
const inactive = {
  purchased: false,
  active: false,
  canCreateProject: false,
  identityScope: 'guest',
};
const active = {
  ...inactive,
  purchased: true,
  active: true,
  canCreateProject: true,
  receiptEmailMissing: true,
};
async function runWizard({
  search = '?style=coastal&exampleId=example',
  paid = false,
  storage = new MemoryStorage(),
  attempts = 1,
  loseFirstGenerationResponse = false,
  dailyLimit = false,
  editId = null as string | null,
} = {}) {
  const requests: { url: string; init: RequestInit }[] = [];
  const states: string[] = [];
  const navigations: string[] = [];
  let accessReads = 0;
  let generationCalls = 0;
  const errors: string[] = [];
  const submitting: boolean[] = [];
  const location = {
    pathname: '/zh/create',
    search,
    href: '',
    assign: (value: string) => navigations.push(value),
  };
  const context = evaluate(
    `${declaration(wizardPath, 'checkoutForWizard')}\n${declaration(wizardPath, 'submit')}\nglobalThis.run = submit;`,
    {
      console,
      Error,
      JSON,
      URLSearchParams,
      Promise,
      crypto: { randomUUID },
      setTimeout: (resolve: () => void) => {
        resolve();
        return 0;
      },
      localStorage: storage,
      window: { location },
      document: { documentElement: { lang: 'zh' } },
      draftKey,
      draftSnapshot: draft,
      isHydrated: true,
      isEditPrefilled: true,
      examplePending: false,
      isEditMode: editId !== null,
      editId,
      savedProjectId: { current: null },
      submitInFlight: { current: false },
      user: null,
      partner1: 'Emma',
      partner2: 'James',
      weddingDate: '2026-12-20',
      style: 'coastal',
      typography: 'editorial_rose',
      palette: [],
      location: 'Como',
      venue: 'Villa',
      showLocation: true,
      flowers: [],
      personalElements: [],
      personalImages: [],
      frameId: null,
      complexity: 'medium',
      nameDisplay: 'initials_amp',
      fromExampleStyle: 'coastal',
      matchExample: draft.matchExample,
      searchParams: new URLSearchParams(search),
      stableWeddingRequestId,
      weddingResumePath,
      requestWeddingCheckout,
      fetchWeddingAccess: async () => {
        accessReads++;
        return paid
          ? {
              ...active,
              ...(dailyLimit
                ? { allowance: { reasonCode: 'daily_limit' } }
                : {}),
            }
          : inactive;
      },
      setPendingCreation: () => {},
      setAccess: () => {},
      setSubmitting: (value: boolean) => submitting.push(value),
      setPaymentState: (value: string) => states.push(value),
      showAccessRecovery: () => {
        throw new Error('unexpected recovery');
      },
      clearPersistedWizardState: (key: string) => storage.removeItem(key),
      trackWeddingFunnel: () => Promise.resolve(true),
      t: (key: string) => key,
      toast: {
        error: (message: string) => {
          errors.push(message);
        },
      },
      fetch: async (url: string, init: RequestInit) => {
        requests.push({ url, init });
        assert.ok(
          storage.getItem(draftKey),
          'latest draft saved before any network POST'
        );
        if (url.endsWith('/generate')) {
          generationCalls++;
          if (loseFirstGenerationResponse && generationCalls === 1)
            throw new Error('fixture: generation response lost');
        }
        return Response.json({
          code: 0,
          data:
            url === '/api/payment/checkout'
              ? { checkoutUrl: '/fixture-checkout' }
              : !url.endsWith('/generate')
                ? { project: { id: 'project-1' } }
                : { candidates: ['candidate'] },
        });
      },
    }
  );
  for (let i = 0; i < attempts; i++)
    await (context.run as () => Promise<void>)();
  return {
    requests,
    states,
    navigations,
    accessReads,
    storage,
    location,
    errors,
    submitting,
  };
}
async function main() {
  assert.equal(
    weddingResumePath(
      '/zh/create',
      '?style=coastal&exampleId=abc&prepaid=1&payment=pending'
    ),
    '/zh/create?style=coastal&exampleId=abc'
  );
  const storage = new MemoryStorage();
  const first = await stableWeddingRequestId(storage, 'checkout');
  assert.equal(await stableWeddingRequestId(storage, 'checkout'), first);
  assert.equal(
    await stableWeddingRequestId(storage, 'project', 'checkout'),
    first
  );
  console.log(
    'PASS stable checkout/project IDs and source example/style/locale return path'
  );
  let checkoutCalls = 0;
  let ended = false;
  const initialized = await requestWeddingCheckout(
    async () => {
      checkoutCalls++;
      return checkoutCalls < 3
        ? Response.json(
            { code: -1, data: { reasonCode: 'checkout_initializing' } },
            { status: 409 }
          )
        : Response.json({ code: 0, data: { checkoutUrl: '/checkout' } });
    },
    () => {
      ended = true;
    },
    async () => {}
  );
  assert.equal(checkoutCalls, 3);
  assert.equal(initialized.body.data?.checkoutUrl, '/checkout');
  assert.equal(ended, false);
  await requestWeddingCheckout(
    async () =>
      Response.json(
        { code: -1, data: { reasonCode: 'checkout_ended' } },
        { status: 409 }
      ),
    () => {
      ended = true;
    },
    async () => {}
  );
  assert.equal(ended, true);
  checkoutCalls = 0;
  await requestWeddingCheckout(
    async () => {
      checkoutCalls++;
      return Response.json(
        { code: -1, data: { reasonCode: 'checkout_initializing' } },
        { status: 409 }
      );
    },
    () => {},
    async () => {}
  );
  assert.equal(checkoutCalls, 4);
  console.log(
    'PASS initializing checkout bounded retries and ended-checkout key reset callback'
  );

  const originalFetch = globalThis.fetch;
  let resolveResponse!: (response: Response) => void;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
  };
  const one = fetchWeddingAccess();
  const two = fetchWeddingAccess();
  assert.equal(one, two);
  assert.equal(calls, 1);
  resolveResponse(Response.json({ code: 0, data: inactive }));
  await Promise.all([one, two]);
  globalThis.fetch = originalFetch;
  console.log(
    'PASS actual access bootstrap: concurrent callers share one cookieless request'
  );

  const unpaid = await runWizard();
  assert.deepEqual(
    unpaid.requests.map((r) => r.url),
    ['/api/payment/checkout']
  );
  const checkout = unpaid.requests[0];
  const checkoutBody = JSON.parse(String(checkout.init.body));
  assert.equal(
    checkoutBody.metadata.resume_path,
    '/zh/create?style=coastal&exampleId=example'
  );
  assert.equal(checkoutBody.metadata.resume_wizard, true);
  assert.ok(
    (checkout.init.headers as Record<string, string>)['x-wedding-checkout-id']
  );
  assert.equal(
    JSON.parse(unpaid.storage.getItem(draftKey)!).showLocation,
    true
  );
  assert.deepEqual(unpaid.navigations, ['/fixture-checkout']);
  console.log(
    'PASS actual anonymous wizard: latest draft preserved, direct checkout without auth, stable id, full resume path'
  );

  const pending = await runWizard({
    search: '?style=coastal&exampleId=example&prepaid=1',
  });
  assert.equal(pending.accessReads, 8);
  assert.equal(pending.requests.length, 0);
  assert.equal(pending.states.at(-1), 'unconfirmed');
  assert.ok(pending.storage.getItem(draftKey));
  console.log(
    'PASS forged/pending prepaid URL: bounded 8 server checks, no checkout or generation, draft retained'
  );

  const paidStorage = new MemoryStorage();
  paidStorage.setItem(`${draftKey}:checkout`, first);
  const paid = await runWizard({
    search: '?style=coastal&exampleId=example&prepaid=1',
    paid: true,
    storage: paidStorage,
  });
  assert.deepEqual(
    paid.requests.map((r) => r.url),
    ['/api/projects', '/api/projects/project-1/generate']
  );
  const payload = JSON.parse(String(paid.requests[0].init.body));
  assert.equal(payload.showLocation, true);
  assert.equal(payload.exampleId, 'example');
  assert.equal(payload.exampleStyle, 'coastal');
  assert.equal(
    (paid.requests[0].init.headers as Record<string, string>)[
      'x-wedding-request-id'
    ],
    first
  );
  assert.equal(
    (paid.requests[1].init.headers as Record<string, string>)[
      'x-wedding-generation-id'
    ],
    first
  );
  assert.equal(paid.location.href, '/zh/design/project-1');
  assert.equal(paid.storage.getItem(`${draftKey}:return-project`), 'project-1');
  console.log(
    'PASS actual paid guest resume: server rights required, same example/showLocation, owner-stable project/generation id, locale retained'
  );

  const lost = await runWizard({
    paid: true,
    attempts: 2,
    loseFirstGenerationResponse: true,
  });
  assert.deepEqual(
    lost.requests.map((r) => [r.url, r.init.method]),
    [
      ['/api/projects', 'POST'],
      ['/api/projects/project-1/generate', 'POST'],
      ['/api/projects', 'POST'],
      ['/api/projects/project-1/generate', 'POST'],
    ],
    'create retry replays POST, never PATCHes a project after generation may have started'
  );
  const keys = lost.requests.map((r) => {
    const headers = r.init.headers as Record<string, string>;
    return (
      headers['x-wedding-request-id'] || headers['x-wedding-generation-id']
    );
  });
  assert.ok(keys.every((key) => key === keys[0]));
  assert.equal(lost.location.href, '/zh/design/project-1');
  assert.deepEqual(lost.submitting, [true, false, true]);
  console.log(
    'PASS lost generation response: unchanged POST replay, identical project/generation IDs, retry unlocked only on failure'
  );

  const duplicate = await runWizard({ paid: true, attempts: 2 });
  assert.equal(
    duplicate.requests.length,
    2,
    'successful navigation keeps the submit lock until unload'
  );
  assert.deepEqual(duplicate.submitting, [true]);
  console.log(
    'PASS successful handoff: repeated click before navigation submits no second project or generation'
  );

  const limitStorage = new MemoryStorage();
  limitStorage.setItem(`${draftKey}:request:guest`, first);
  const atLimit = await runWizard({
    paid: true,
    dailyLimit: true,
    storage: limitStorage,
  });
  assert.equal(
    atLimit.requests.length,
    2,
    'existing request can reach server idempotent replay at daily limit'
  );
  assert.equal(atLimit.location.href, '/zh/design/project-1');
  const newAtLimit = await runWizard({ paid: true, dailyLimit: true });
  assert.equal(
    newAtLimit.requests.length,
    0,
    'new requests still stop at daily limit'
  );
  assert.deepEqual(newAtLimit.errors, ['daily_limit']);
  console.log(
    'PASS daily limit: pending request reaches server replay; fresh request remains blocked'
  );

  const edited = await runWizard({ paid: true, editId: 'project-1' });
  assert.deepEqual(
    edited.requests.map((r) => [r.url, r.init.method]),
    [
      ['/api/projects/project-1', 'PATCH'],
      ['/api/projects/project-1/generate', 'POST'],
    ]
  );
  assert.equal(edited.location.href, '/zh/design/project-1');
  console.log(
    'PASS explicit edit mode retains PATCH → generate → localized design handoff'
  );

  const resetContext = evaluate(
    `${declaration(wizardPath, 'resetWizard')}\nglobalThis.run = resetWizard;`,
    {
      submitInFlight: { current: true },
      setStep: () => {
        throw new Error('in-flight reset mutated draft');
      },
    }
  );
  (resetContext.run as () => void)();
  console.log(
    'PASS same-frame Start over guard preserves in-flight draft and request key'
  );

  const resultRequests: { url: string; init: RequestInit }[] = [];
  const resultContext = evaluate(
    `${declaration(resultPath, 'checkout')}\nglobalThis.run = checkout;`,
    {
      console,
      JSON,
      localStorage: new MemoryStorage(),
      stableWeddingRequestId,
      weddingResumePath,
      requestWeddingCheckout,
      window: {
        location: { pathname: '/zh/design/project-1', search: '', href: '' },
      },
      document: { documentElement: { lang: 'zh' } },
      useCallback: (callback: unknown) => callback,
      project: { id: 'project-1' },
      paying: false,
      guestId: null,
      paymentState: 'idle',
      user: null,
      setPaying: () => {},
      setPaymentRetry: () => {},
      trackWeddingFunnel: () => {},
      t: (key: string) => key,
      toast: {
        error: () => {
          throw new Error('unexpected checkout error');
        },
      },
      fetch: async (url: string, init: RequestInit) => {
        resultRequests.push({ url, init });
        return Response.json({
          code: 0,
          data: { checkoutUrl: '/fixture-checkout' },
        });
      },
    }
  );
  await (resultContext.run as () => Promise<void>)();
  assert.equal(resultRequests.length, 1);
  assert.equal(resultRequests[0].url, '/api/payment/checkout');
  assert.ok(
    (resultRequests[0].init.headers as Record<string, string>)[
      'x-wedding-checkout-id'
    ]
  );
  console.log(
    'PASS actual result checkout: anonymous caller reaches checkout directly with stable id'
  );

  const resultSource = readFileSync(resultPath, 'utf8');
  const wizardSource = readFileSync(wizardPath, 'utf8');
  assert.ok(!resultSource.includes('setIsShowSignModal'));
  assert.ok(!wizardSource.includes('setIsShowSignModal'));
  assert.ok(resultSource.includes('if (current?.paid)'));
  assert.ok(
    wizardSource.includes("payment === 'canceled' || payment === 'failed'")
  );
  assert.ok(
    wizardSource.includes(
      'window.location.replace(`${localePrefix}/design/${completed}`)'
    )
  );
  for (const locale of ['en', 'zh', 'de', 'fr', 'it', 'ko', 'pt-BR', 'th']) {
    for (const page of ['create', 'design']) {
      const text = JSON.parse(
        readFileSync(
          `src/config/locale/messages/${locale}/pages/${page}.json`,
          'utf8'
        )
      );
      for (const key of [
        'purchase_access_lost',
        'draft_storage_error',
        ...(page === 'create' ? ['pending_creation_retry'] : []),
        'payment_confirming',
        'payment_retry_confirmation',
        'payment_unconfirmed',
        'payment_canceled',
        'payment_failed',
        'receipt_email_missing',
        'receipt_email_label',
        'receipt_email_save',
        'receipt_email_saved',
        'receipt_email_error',
      ])
        assert.ok(text[key], `${locale}/${page}/${key}`);
    }
  }
  console.log(
    'PASS result paid-state gate, canceled/failure draft retention, completed-return redirect, 8 locale purchase/receipt copy'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
