import { PayPalProvider } from '../../../src/extensions/payment/paypal';
import { PaymentType } from '../../../src/extensions/payment/types';

const originalFetch = globalThis.fetch;
let calls = 0;
const requestIds: Array<string | null> = [];

globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  calls += 1;
  requestIds.push(new Headers(init?.headers).get('PayPal-Request-Id'));
  if (calls === 1 || calls === 2 || calls === 4 || calls === 5) {
    const error = new TypeError('fetch failed') as TypeError & { cause?: Error & { code?: string } };
    error.cause = Object.assign(new Error('socket reset'), { code: 'ECONNRESET' });
    throw error;
  }
  if (calls === 3) {
    return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(
    JSON.stringify({
      id: 'ORDER-OK',
      status: 'CREATED',
      links: [{ rel: 'approve', href: 'https://www.paypal.com/checkoutnow?token=ORDER-OK' }],
    }),
    { status: 201, headers: { 'Content-Type': 'application/json' } }
  );
}) as typeof fetch;

async function main() {
try {
  const provider = new PayPalProvider({
    clientId: 'client',
    clientSecret: 'secret',
    environment: 'production',
  });
  const result = await provider.createPayment({
    order: {
      type: PaymentType.ONE_TIME,
      description: 'Test order',
      price: { amount: 990, currency: 'usd' },
      metadata: { order_no: 'ORDER-NO-123' },
      successUrl: 'http://localhost/success',
      cancelUrl: 'http://localhost/cancel',
    },
  });
  console.log(JSON.stringify({ calls, checkoutUrl: result.checkoutInfo.checkoutUrl, requestIds }));
  if (calls !== 6) throw new Error(`expected 6 fetch calls, received ${calls}`);
  if (result.checkoutInfo.checkoutUrl !== 'https://www.paypal.com/checkoutnow?token=ORDER-OK') {
    throw new Error('checkout URL mismatch');
  }
  if (requestIds.slice(3).some((value) => value !== 'ORDER-NO-123-order')) {
    throw new Error(`missing stable idempotency key: ${JSON.stringify(requestIds)}`);
  }
} finally {
  globalThis.fetch = originalFetch;
}
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
