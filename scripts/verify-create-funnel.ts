import assert from 'node:assert/strict';

import {
  classifyFunnel,
  funnelInput,
  type FunnelRow,
} from '../src/shared/wedding/funnel';

const start = new Date('2026-10-10T00:00:00Z');
const now = new Date('2026-10-12T00:00:00Z');
const e = (
  eventName: string,
  projectId?: string,
  flowId = 'flow'
): FunnelRow => ({
  anonymousId: 'actor',
  userId: null,
  flowId,
  projectId,
  eventName,
  createdAt: start,
  isTest: false,
});
const events = [
  e('create_clicked'),
  e('project_created', 'p'),
  e('result_viewed', 'p'),
  e('unlock_viewed', 'p'),
  e('unlock_clicked', 'p'),
];
const order = {
  projectId: 'p',
  productId: 'wedding_identity_pack',
  createdAt: start,
  checkoutUrl: 'https://checkout.example',
};
assert.equal(classifyFunnel(events, [], [order], now)[0].stage, 5);
assert.equal(
  classifyFunnel(events, [], [{ ...order, checkoutUrl: null }], now)[0].stage,
  4
);
assert.equal(
  classifyFunnel(events, [], [{ ...order, projectId: 'other' }], now)[0].stage,
  4
);
assert.equal(
  classifyFunnel(
    events,
    [],
    [{ ...order, createdAt: new Date(+start - 1) }],
    now
  )[0].stage,
  4
);
assert.equal(
  classifyFunnel(
    events,
    [],
    [{ ...order, createdAt: new Date(+start + 86400001) }],
    now
  )[0].stage,
  4
);
assert.equal(
  classifyFunnel(
    [...events, e('project_created', 'other', 'unrelated')],
    [],
    [{ ...order, projectId: 'other' }],
    now
  )[0].stage,
  4
);
assert.equal(
  classifyFunnel(
    [...events, { ...e('unlock_viewed', 'p'), isTest: true }],
    [],
    [],
    now
  ).length,
  0
);
assert.equal(
  classifyFunnel(events, [], [], new Date(+start + 1000))[0].observing,
  true
);
assert.equal(classifyFunnel([...events, ...events], [], [], now).length, 1);
assert.equal(
  classifyFunnel(
    [e('create_clicked'), e('project_created', 'p')],
    [
      {
        projectId: 'p',
        status: 'selected',
        createdAt: start,
        updatedAt: start,
      },
    ],
    [],
    now
  )[0].stage,
  1
);
assert.equal(
  funnelInput.safeParse({
    id: crypto.randomUUID(),
    anonymousId: crypto.randomUUID(),
    eventName: 'create_clicked',
    flowId: 'f',
    entryPosition: 'wizard',
    email: 'private@example.com',
  }).success,
  false
);
assert.equal(
  funnelInput.safeParse({
    id: crypto.randomUUID(),
    anonymousId: crypto.randomUUID(),
    eventName: 'checkout_created',
    flowId: 'f',
    entryPosition: 'wizard',
  }).success,
  false
);
console.log(
  'PASS: 12 create-funnel cohort, matching, test exclusion and privacy assertions'
);

async function verifyImmediatePurchaseDispatch() {
  const { trackWeddingFunnel } = await import(
    '../src/shared/wedding/funnel-client'
  );
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    'localStorage'
  );
  const storage = new Map<string, string>();
  const calls: { eventName: string; keepalive: boolean | undefined }[] = [];
  let releaseCreate: (() => void) | undefined;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) || null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  globalThis.fetch = async (_url, options) => {
    const eventName = JSON.parse(String(options?.body)).eventName;
    calls.push({ eventName, keepalive: options?.keepalive });
    if (eventName === 'create_clicked')
      await new Promise<void>((resolve) => {
        releaseCreate = resolve;
      });
    return new Response(null, { status: 204 });
  };
  try {
    const create = trackWeddingFunnel(
      'create_clicked',
      undefined,
      undefined,
      'flow'
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const association = trackWeddingFunnel(
      'project_created',
      'project',
      undefined,
      'flow'
    );
    const clicked = trackWeddingFunnel('unlock_clicked', 'project');
    const failed = trackWeddingFunnel('checkout_failed', 'project');
    assert.deepEqual(
      calls.map((c) => c.eventName),
      ['create_clicked', 'unlock_clicked', 'checkout_failed']
    );
    assert.equal(calls[1].keepalive, true);
    assert.equal(calls[2].keepalive, true);
    releaseCreate?.();
    await Promise.all([create, association, clicked, failed]);
    assert.equal(calls[3].eventName, 'project_created');
    console.log(
      'PASS: immediate purchase keepalive dispatch bypasses blocked create queue; association stays ordered'
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage)
      Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}
verifyImmediatePurchaseDispatch().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
