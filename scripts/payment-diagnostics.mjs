#!/usr/bin/env node
/** Read-only: node scripts/payment-diagnostics.mjs --order ORD [--platform] */
import fs from 'node:fs';
import { WaffoPancake } from '@waffo/pancake-ts';
import dotenv from 'dotenv';
import postgres from 'postgres';

const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) {
  console.log(
    'Usage: node scripts/payment-diagnostics.mjs (--order ORDER_NO | --owner OWNER_ID) [--platform]\nRead-only order + lifecycle timeline; --platform queries current Waffo payment records. No charge/refund/write operations.'
  );
  process.exit(0);
}
const value = (key) =>
  args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
const orderNo = value('--order');
const ownerId = value('--owner');
if (
  (!orderNo && !ownerId) ||
  (orderNo && ownerId) ||
  !/^[A-Za-z0-9_-]{1,100}$/.test(orderNo || ownerId)
) {
  console.error('Specify exactly one valid --order or --owner identifier.');
  process.exit(1);
}
const fileEnv = (path) =>
  fs.existsSync(path) ? dotenv.parse(fs.readFileSync(path)) : {};
const env = {
  ...fileEnv('.env.local'),
  ...fileEnv('.dev.vars'),
  ...process.env,
};
const sql = postgres(env.DATABASE_URL, {
  max: 1,
  connect_timeout: 15,
  prepare: false,
});
const schema = env.DB_SCHEMA || 'wedding-crest';
const safeCode = (value) =>
  typeof value === 'string' &&
  /^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/.test(value) &&
  !/\d{12}/.test(value)
    ? value
    : undefined;
function providerReasonCode(value) {
  if (!value) return undefined;
  const patterns = [
    [/insufficient.?fund/i, 'insufficient_funds'],
    [/expired.?card|card.?expired/i, 'expired_card'],
    [/cvc|cvv/i, 'incorrect_cvc'],
    [/incorrect.?number|invalid.?card.?number/i, 'incorrect_card_number'],
    [/authentication|3ds|3.?d.?secure/i, 'authentication_required'],
    [/fraud|risk/i, 'risk_rejected'],
    [/do.?not.?honor/i, 'do_not_honor'],
    [/declin/i, 'card_declined'],
    [/unsupported|not.?supported/i, 'payment_method_unsupported'],
    [/cancel/i, 'canceled'],
    [/timeout|timed.?out/i, 'provider_timeout'],
    [/expired/i, 'checkout_expired'],
  ];
  return (
    patterns.find(([pattern]) => pattern.test(String(value)))?.[1] ||
    'provider_rejected'
  );
}
try {
  const result = await sql.begin('read only', async (tx) => {
    await tx`set local statement_timeout='15000'`;
    const orders =
      await tx`select order_no, user_id, status, amount, currency, payment_provider, created_at, updated_at, paid_at, transaction_id, checkout_result from ${tx(`${schema}.order`)} where ${orderNo ? tx`order_no=${orderNo}` : tx`user_id=${ownerId}`} order by created_at desc limit 20`;
    const output = [];
    for (const order of orders) {
      let checkoutExpiresAt;
      try {
        checkoutExpiresAt = JSON.parse(order.checkout_result || '{}').expiresAt;
      } catch {
        /* Legacy malformed payload. */
      }
      const safeOrder = { ...order };
      delete safeOrder.checkout_result;
      output.push({
        ...safeOrder,
        checkoutExpiresAt,
        checkoutExpiryPassed:
          !!checkoutExpiresAt &&
          new Date(checkoutExpiresAt).getTime() < Date.now(),
      });
    }
    const [{ exists }] =
      await tx`select exists(select 1 from information_schema.tables where table_schema=${schema} and table_name='payment_diagnostic_event') as exists`;
    const events = exists
      ? await tx`select source,stage,reason,request_id,attempt_id,order_no,provider,entry,http_status,latency_ms,details,created_at from ${tx(`${schema}.payment_diagnostic_event`)} where ${orderNo ? tx`order_no=${orderNo}` : tx`owner_id=${ownerId}`} order by created_at asc limit 200`
      : [];
    const config = args.includes('--platform')
      ? Object.fromEntries(
          (
            await tx`select name,value from ${tx(`${schema}.config`)} where name like 'waffo%'`
          ).map((row) => [row.name, row.value])
        )
      : undefined;
    return {
      orders: output,
      events,
      diagnosticsTableAvailable: exists,
      config,
    };
  });
  const { config, ...records } = result;
  const platform = [];
  if (config) {
    const client = new WaffoPancake({
      merchantId: config.waffo_merchant_id,
      privateKey: config.waffo_private_key,
      environment: config.waffo_environment === 'prod' ? 'prod' : 'test',
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(25_000) }),
    });
    for (const order of result.orders.filter(
      (row) => row.payment_provider === 'waffo'
    )) {
      try {
        const { data, errors } = await client.graphql.query({
          query:
            'query ($ref: String!) { payments(filter: { orderMerchantExternalId: { eq: $ref } }) { id status failureReason createdAt } }',
          variables: { ref: order.order_no },
        });
        if (errors?.length) {
          platform.push({ orderNo: order.order_no, outcome: 'query_error' });
          continue;
        }
        const payments = data?.payments || [];
        platform.push({
          orderNo: order.order_no,
          outcome: payments.length
            ? 'payment_records_found'
            : 'no_payment_records',
          payments: payments.map(
            ({ id, status, failureReason, createdAt }) => ({
              id,
              status,
              failureReasonCode: providerReasonCode(failureReason),
              createdAt,
            })
          ),
        });
      } catch (error) {
        platform.push({
          orderNo: order.order_no,
          outcome: 'query_error',
          errorType: safeCode(error.name),
          errorCode: safeCode(error.code || error.cause?.code),
        });
      }
    }
  }
  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        ...records,
        ...(config ? { platform } : {}),
        interpretation:
          'created is not a decline; expired-without-payment does not prove why the buyer stopped. redirect_not_left is a browser navigation observation only. Provider query errors are not failed payments.',
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(
    JSON.stringify({
      outcome: 'query_error',
      errorType: safeCode(error.name),
      errorCode: safeCode(error.code || error.cause?.code),
    })
  );
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 2 });
}
