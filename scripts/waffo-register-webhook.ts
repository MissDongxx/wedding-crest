/**
 * Waffo Pancake webhook registration script
 *
 * Registers the Waffo webhook that drives order fulfilment. Without it the
 * integration still works through the post-payment redirect callback, but the
 * webhook is the authoritative path — renewals, cancellations and refunds only
 * arrive this way.
 *
 * The webhook endpoint is the shared notification route, so Waffo events land
 * in the same handler as Stripe / Creem / PayPal:
 *
 *   {app_url}/api/payment/notify/waffo
 *
 * Usage (env vars, see .env.example):
 *   WAFFO_MERCHANT_ID=MER_xxx \
 *   WAFFO_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..." \
 *   WAFFO_STORE_ID=STO_xxx \
 *   WAFFO_ENVIRONMENT=test \
 *   NEXT_PUBLIC_APP_URL=https://weddingcrestdesign.com \
 *   npx tsx scripts/with-env.ts npx tsx scripts/waffo-register-webhook.ts
 *
 * Optional flags:
 *   --url=...        override the webhook URL (defaults to
 *                    NEXT_PUBLIC_APP_URL + /api/payment/notify/waffo)
 *   --prod           register the production webhook (testMode: false)
 *
 * Notes:
 * - API keys are per-environment. A test key registers a test webhook, a prod
 *   key a prod one — do not mix them.
 * - Events mirror what WaffoProvider actually handles. Anything else (refunds,
 *   scheduled plan changes) is deliberately not subscribed; if it ever arrives
 *   the provider rejects it loudly rather than silently ignoring it.
 */

import {
  WebhookEventType,
  WaffoPancake,
  WaffoPancakeError,
} from '@waffo/pancake-ts';

const SUBSCRIBED_EVENTS: `${WebhookEventType}`[] = [
  // One-time purchase paid / subscription first payment
  WebhookEventType.OrderCompleted,
  WebhookEventType.SubscriptionActivated,
  // Recurring charges
  WebhookEventType.SubscriptionRenewed,
  WebhookEventType.SubscriptionRecovered,
  // Status changes
  WebhookEventType.SubscriptionCanceling,
  WebhookEventType.SubscriptionUncanceled,
  WebhookEventType.SubscriptionPlanChanged,
  WebhookEventType.SubscriptionCanceled,
  WebhookEventType.SubscriptionPastDue,
];

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

async function main() {
  const merchantId = process.env.WAFFO_MERCHANT_ID;
  const privateKey = process.env.WAFFO_PRIVATE_KEY;
  const storeId = process.env.WAFFO_STORE_ID;
  const environment = process.env.WAFFO_ENVIRONMENT === 'prod' ? 'prod' : 'test';
  const testMode = readArg('prod') === undefined && environment !== 'prod';

  if (!merchantId || !privateKey) {
    console.error(
      'WAFFO_MERCHANT_ID and WAFFO_PRIVATE_KEY are required.\n' +
        'Both live on Dashboard → API & Development → "Create an API Key".\n' +
        'Use the test key for test and the live key for production.'
    );
    process.exit(1);
  }
  if (!storeId) {
    console.error(
      'WAFFO_STORE_ID is required (Dashboard → Settings → Store Profile).'
    );
    process.exit(1);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '');
  const url =
    readArg('url') ||
    (appUrl ? `${appUrl}/api/payment/notify/waffo` : undefined);

  if (!url) {
    console.error(
      'No webhook URL resolved. Set NEXT_PUBLIC_APP_URL or pass --url=https://...'
    );
    process.exit(1);
  }

  const client = new WaffoPancake({
    merchantId,
    privateKey,
    environment,
  });

  console.log(
    `Registering ${testMode ? 'test' : 'production'} webhook for ${storeId}\n` +
      `  url:    ${url}\n` +
      `  events: ${SUBSCRIBED_EVENTS.join(', ')}\n`
  );

  try {
    const { webhook } = await client.webhooks.add({
      storeId,
      channel: 'http',
      url,
      events: SUBSCRIBED_EVENTS,
      testMode,
    });

    console.log('Webhook registered:');
    console.log(JSON.stringify(webhook, null, 2));
    console.log(
      `\nNext: open the Waffo dashboard and confirm the webhook shows as active, ` +
        `then run a test payment with card 4576 7500 0000 0110.`
    );
  } catch (err) {
    if (err instanceof WaffoPancakeError) {
      console.error(`Waffo error (HTTP ${err.status}):`);
      console.error(JSON.stringify(err.errors, null, 2));
      if (err.status === 409) {
        console.error(
          '\n409 usually means this URL is already registered for the store. ' +
            'List the existing webhooks in the dashboard before adding another.'
        );
      }
    } else {
      console.error('Unexpected error:', err);
    }
    process.exit(1);
  }
}

main();
