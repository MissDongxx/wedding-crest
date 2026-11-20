import assert from 'node:assert/strict';

import {
  beginCheckoutAttempt,
  recordCheckoutAccessUnconfirmed,
  recordCheckoutReturned,
  validCheckoutUrl,
} from '../src/shared/wedding/checkout-telemetry-client';
import {
  requestWeddingCheckout,
  stableWeddingRequestId,
  weddingCheckoutStorage,
} from '../src/shared/wedding/purchase-client';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

async function main() {
  const originals = new Map(
    [
      'window',
      'document',
      'navigator',
      'sessionStorage',
      'localStorage',
      'fetch',
      'setTimeout',
      'clearTimeout',
    ].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  );
  const timers = new Map<number, { callback: () => void; delay: number }>();
  const events: Record<string, unknown>[] = [];
  const queued: Promise<void>[] = [];
  const navigation: string[] = [];
  const target = new EventTarget();
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  let nextTimer = 0;
  let beacon = true;
  const windowFixture = {
    location: {
      origin: 'https://app.invalid',
      assign: (url: string) => navigation.push(url),
    },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  };
  const set = (key: string, value: unknown) =>
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  const drain = async () => {
    await Promise.all(queued.splice(0));
    await Promise.resolve();
  };
  const runTimer = (delay: number) => {
    for (const [id, timer] of timers)
      if (timer.delay === delay) {
        timers.delete(id);
        timer.callback();
      }
  };
  let checkout: (init: RequestInit) => Promise<Response> = async () =>
    Response.json({
      code: 0,
      data: { checkoutUrl: 'https://pay.invalid/checkout?token=PRIVATE' },
    });
  try {
    set('window', windowFixture);
    set('document', { visibilityState: 'visible' });
    set('localStorage', local);
    set('sessionStorage', session);
    set('navigator', {
      sendBeacon: (_url: string, body: Blob) => {
        if (!beacon) return false;
        queued.push(
          body.text().then((value) => {
            events.push(JSON.parse(value));
          })
        );
        return true;
      },
    });
    set('setTimeout', (callback: () => void, delay: number) => {
      const id = ++nextTimer;
      timers.set(id, { callback, delay });
      return id;
    });
    set('clearTimeout', (id: number) => timers.delete(id));
    set('fetch', async (url: string, init: RequestInit) => {
      if (url === '/api/payment/diagnostics') {
        events.push(JSON.parse(String(init.body)));
        throw new Error('telemetry offline');
      }
      assert.equal(url, '/api/payment/checkout');
      return checkout(init);
    });

    const trace = beginCheckoutAttempt({ entry: 'wizard' });
    assert.equal(
      events.length,
      0,
      'clicked waits for checkout response; no cookie race'
    );
    const requestId = crypto.randomUUID();
    const orderNo = 'wc_test_order';
    checkout = async (init) => {
      assert.equal(
        new Headers(init.headers).get('x-checkout-attempt-id'),
        trace.attemptId
      );
      return Response.json({
        code: 0,
        data: {
          checkoutUrl: 'https://pay.invalid/checkout?token=PRIVATE',
          orderNo,
          requestId,
        },
      });
    };
    const good = await requestWeddingCheckout(
      () =>
        trace.fetch({
          method: 'POST',
          body: JSON.stringify({ email: 'PRIVATE@example.invalid' }),
        }),
      () => {},
      async () => {},
      trace
    );
    trace.redirect(good.body.data!.checkoutUrl!);
    await drain();
    assert.deepEqual(
      events.map((e) => e.stage),
      ['clicked', 'session_created', 'redirect_started']
    );
    assert.equal(events[1].orderNo, orderNo);
    assert.equal(events[1].requestId, requestId);
    assert.equal(
      events[0].orderNo,
      orderNo,
      'queued click uses parsed order correlation'
    );
    target.dispatchEvent(new Event('pagehide'));
    runTimer(5000);
    recordCheckoutReturned(new URLSearchParams('paid=1&email=PRIVATE'));
    recordCheckoutReturned(new URLSearchParams('paid=1'));
    recordCheckoutAccessUnconfirmed('wizard');
    recordCheckoutAccessUnconfirmed('wizard');
    await drain();
    assert.deepEqual(
      events.slice(3).map((e) => [e.stage, e.reason]),
      [
        ['redirect_left', undefined],
        ['returned', 'returned_paid'],
        ['access_unconfirmed', 'access_unconfirmed'],
      ]
    );
    assert.equal(events[3].requestId, requestId);
    assert.equal(events[3].orderNo, orderNo);
    assert.equal(timers.size, 0, 'navigation releases all watchdogs');
    assert.equal(JSON.stringify(events).includes('PRIVATE'), false);
    assert.equal(
      JSON.stringify([...session.values]).includes('pay.invalid'),
      false
    );
    console.log(
      'PASS correlated stages; deferred click; private URL/body excluded; return dedupe; pagehide cleanup'
    );

    events.length = 0;
    let notLeft = false;
    const stuck = beginCheckoutAttempt({
      entry: 'result',
      projectId: 'project_1',
    });
    stuck.redirect('https://pay.invalid/session', () => {
      notLeft = true;
    });
    runTimer(5000);
    await drain();
    assert.equal(notLeft, true);
    assert.equal(events.at(-1)?.stage, 'redirect_not_left');
    assert.equal(events.at(-1)?.reason, 'redirect_timeout');
    assert.equal(timers.size, 0);
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,test',
      'https://user:password@pay.invalid',
      'garbage',
      '/create',
      '//host',
      '   ',
    ])
      assert.equal(validCheckoutUrl(url), false);
    assert.throws(
      () => stuck.redirect('javascript:alert(1)'),
      /invalid payment link/
    );
    console.log(
      'PASS visible-page redirect watchdog, cleanup and http(s)-only payment links'
    );

    events.length = 0;
    const back = beginCheckoutAttempt({ entry: 'result' });
    back.redirect('https://pay.invalid/back-test');
    target.dispatchEvent(new Event('pagehide'));
    recordCheckoutReturned(new URLSearchParams());
    await drain();
    assert.equal(
      events.at(-1)?.reason,
      'returned_unknown',
      'Back navigation can return without query flags'
    );
    console.log(
      'PASS Back/bfcache return without query parameters remains a bounded unknown'
    );

    events.length = 0;
    let calls = 0;
    const keys: string[] = [];
    const expired = beginCheckoutAttempt({ entry: 'human_design' });
    checkout = async (init) => {
      calls++;
      keys.push(new Headers(init.headers).get('x-wedding-checkout-id')!);
      return calls === 1
        ? Response.json(
            { code: -1, data: { reasonCode: 'checkout_ended' } },
            { status: 409 }
          )
        : Response.json({
            code: 0,
            data: { checkoutUrl: 'https://pay.invalid/new' },
          });
    };
    await requestWeddingCheckout(
      async () =>
        expired.fetch({
          headers: {
            'x-wedding-checkout-id': await stableWeddingRequestId(
              weddingCheckoutStorage,
              'expired-test'
            ),
          },
        }),
      () => weddingCheckoutStorage.removeItem('expired-test'),
      async () => {},
      expired
    );
    assert.equal(calls, 2);
    assert.notEqual(keys[0], keys[1]);
    checkout = async () => {
      calls++;
      return Response.json(
        { code: -1, data: { reasonCode: 'checkout_ended' } },
        { status: 409 }
      );
    };
    calls = 0;
    await requestWeddingCheckout(
      () => checkout({}),
      () => {},
      async () => {}
    );
    assert.equal(calls, 2, 'at most one expired replacement');
    console.log(
      'PASS expired checkout rotates idempotency key once; retry bounded'
    );

    events.length = 0;
    calls = 0;
    const timeout = beginCheckoutAttempt({ entry: 'pricing' });
    checkout = (init) => {
      calls++;
      return new Promise((_resolve, reject) =>
        init.signal!.addEventListener('abort', () => reject(new Error('abort')))
      );
    };
    const timedOut = requestWeddingCheckout(
      () => timeout.fetch({}, 15),
      () => {},
      async () => {},
      timeout
    );
    runTimer(15);
    await assert.rejects(timedOut, /taking longer/);
    await drain();
    assert.equal(calls, 1, 'timeout never retries a potentially created order');
    assert.equal(events.at(-1)?.reason, 'timeout');
    console.log(
      'PASS request timeout emits fixed reason without automatically creating a second order'
    );

    events.length = 0;
    calls = 0;
    const network = beginCheckoutAttempt({ entry: 'pricing' });
    checkout = async () => {
      calls++;
      throw new Error('PRIVATE network diagnostic');
    };
    await assert.rejects(
      requestWeddingCheckout(
        () => network.fetch({}),
        () => {},
        async () => {},
        network
      ),
      /could not connect/
    );
    await drain();
    assert.equal(calls, 1);
    assert.equal(events.at(-1)?.reason, 'network_error');
    assert.equal(JSON.stringify(events).includes('PRIVATE'), false);
    console.log(
      'PASS network errors record fixed categories, not exception text; no duplicate order request'
    );

    events.length = 0;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('storage denied');
      },
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('storage denied');
      },
    });
    beacon = false;
    const fallback = beginCheckoutAttempt({ entry: 'wizard' });
    const firstKey = await stableWeddingRequestId(
      weddingCheckoutStorage,
      'storage-denied'
    );
    assert.equal(
      await stableWeddingRequestId(weddingCheckoutStorage, 'storage-denied'),
      firstKey
    );
    checkout = async () =>
      new Response('<html>bad gateway</html>', { status: 200 });
    await requestWeddingCheckout(
      () => fallback.fetch({}),
      () => {},
      async () => {},
      fallback
    );
    await drain();
    assert.equal(events.at(-1)?.reason, 'invalid_response');
    for (const invalid of [null, [], 'not-an-envelope']) {
      const invalidTrace = beginCheckoutAttempt({ entry: 'wizard' });
      checkout = async () => Response.json(invalid);
      await requestWeddingCheckout(
        () => invalidTrace.fetch({}),
        () => {},
        async () => {},
        invalidTrace
      );
      await drain();
      assert.equal(events.at(-1)?.reason, 'invalid_response');
    }
    checkout = async () =>
      Response.json({
        code: 0,
        data: { checkoutUrl: 'https://pay.invalid/working' },
      });
    const offlineAnalytics = beginCheckoutAttempt({ entry: 'wizard' });
    const result = await requestWeddingCheckout(
      () => offlineAnalytics.fetch({}),
      () => {},
      async () => {},
      offlineAnalytics
    );
    offlineAnalytics.redirect(result.body.data!.checkoutUrl!);
    target.dispatchEvent(new Event('pagehide'));
    await drain();
    assert.equal(navigation.at(-1), 'https://pay.invalid/working');
    assert.equal(timers.size, 0);
    console.log(
      'PASS blocked storage, malformed JSON and offline diagnostics do not block checkout navigation'
    );
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
