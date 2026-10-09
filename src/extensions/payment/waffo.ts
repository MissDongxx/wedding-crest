import {
  type CreateCheckoutSessionParams,
  type TaxCategory,
  type WebhookEvent,
  type WebhookEventData,
  WaffoPancake,
  verifyWebhook,
} from '@waffo/pancake-ts';

import {
  CheckoutSession,
  PaymentConfigs,
  PaymentEvent,
  PaymentEventType,
  PaymentInterval,
  PaymentOrder,
  PaymentProvider,
  PaymentSession,
  PaymentStatus,
  SubscriptionInfo,
  SubscriptionStatus,
} from './types';

/**
 * Waffo Pancake payment provider configs
 * @docs https://docs.waffo.ai/
 * @sdk https://www.npmjs.com/package/@waffo/pancake-ts
 */
export interface WaffoConfigs extends PaymentConfigs {
  /** Merchant ID, `MER_{base62}`. Sent as the `X-Merchant-Id` header. */
  merchantId: string;
  /** RSA private key in PEM format. Every request is signed with RSA-SHA256. */
  privateKey: string;
  /** Store ID, `STO_{base62}`. Required to register/list webhooks via the SDK. */
  storeId?: string;
  /** Which Waffo environment to talk to. API keys are per-environment. */
  environment?: 'test' | 'prod';
  /**
   * How the charged amount is decided:
   * - `product` (default): use the price configured on the Waffo product.
   * - `snapshot`: override it per session with `priceSnapshot` built from the
   *   server-side pricing table. Requires `taxCategory`.
   */
  priceMode?: 'product' | 'snapshot';
  /** Tax category for `priceSnapshot` mode. */
  taxCategory?: string;
  /** Optional override for the webhook signature public key (per environment). */
  webhookPublicKey?: string;
}

/**
 * Currency exponents we care about. Most currencies use 2 minor digits, but a
 * handful (JPY is the one that matters for this store) have none. Waffo takes
 * **display amounts** (`"9.99"`) while this codebase stores **minor units**
 * (`990`), so every boundary crossing has to convert explicitly — mixing the
 * two silently charges 100x the intended price.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

/**
 * Map a Waffo billing period onto this codebase's interval + count pair.
 */
function mapBillingPeriod(billingPeriod?: string): {
  interval: PaymentInterval;
  count: number;
} {
  switch (billingPeriod) {
    case 'weekly':
      return { interval: PaymentInterval.WEEK, count: 1 };
    case 'monthly':
      return { interval: PaymentInterval.MONTH, count: 1 };
    case 'quarterly':
      return { interval: PaymentInterval.MONTH, count: 3 };
    case 'yearly':
      return { interval: PaymentInterval.YEAR, count: 1 };
    default:
      return { interval: PaymentInterval.MONTH, count: 1 };
  }
}

/**
 * Waffo order status -> local subscription status.
 *
 * `past_due` has no exact counterpart in the local enum. Pausing is the least
 * destructive approximation: access is suspended but the subscription is not
 * destroyed, and a successful retry emits `subscription.recovered`, which
 * writes the status back to `active`.
 *
 * Returns `undefined` for an unknown/absent status instead of throwing, so the
 * caller can fall back to deriving the status from the event type.
 */
function mapSubscriptionStatus(
  status?: string
): SubscriptionStatus | undefined {
  switch (status) {
    case 'active':
      return SubscriptionStatus.ACTIVE;
    case 'canceling':
      return SubscriptionStatus.PENDING_CANCEL;
    case 'canceled':
    case 'closed':
      return SubscriptionStatus.CANCELED;
    case 'expired':
      return SubscriptionStatus.EXPIRED;
    case 'past_due':
      return SubscriptionStatus.PAUSED;
    default:
      return undefined;
  }
}

/**
 * Fallback status for subscription events that omit `orderStatus`.
 *
 * The upstream route rejects a subscription update with no status, so every
 * `subscription.*` event must resolve to one.
 */
function statusFromEventType(eventType: string): SubscriptionStatus {
  switch (eventType) {
    case 'subscription.canceling':
      return SubscriptionStatus.PENDING_CANCEL;
    case 'subscription.canceled':
      return SubscriptionStatus.CANCELED;
    case 'subscription.past_due':
      return SubscriptionStatus.PAUSED;
    default:
      // activated / uncanceled / plan_changed / renewed / recovered
      return SubscriptionStatus.ACTIVE;
  }
}

/** Add a billing interval to a date, for period end back-fill. */
function addInterval(
  start: Date,
  interval: PaymentInterval,
  count: number
): Date {
  const end = new Date(start.getTime());
  switch (interval) {
    case PaymentInterval.WEEK:
      end.setDate(end.getDate() + 7 * count);
      break;
    case PaymentInterval.YEAR:
      end.setMonth(end.getMonth() + 12 * count);
      break;
    default:
      end.setMonth(end.getMonth() + count);
      break;
  }
  return end;
}

/**
 * Waffo Pancake payment provider implementation.
 *
 * Waffo is a merchant of record, so it owns tax calculation, invoicing and the
 * hosted checkout page. This provider only drives the checkout redirect and
 * translates Waffo's webhook vocabulary into the local payment model.
 *
 * @website https://waffo.ai/
 */
export class WaffoProvider implements PaymentProvider {
  readonly name = 'waffo';
  configs: WaffoConfigs;

  private client: WaffoPancake;

  constructor(configs: WaffoConfigs) {
    this.configs = configs;

    if (!configs.merchantId) {
      throw new Error('Waffo merchant id is required');
    }
    if (!configs.privateKey) {
      throw new Error('Waffo private key is required');
    }

    this.client = new WaffoPancake({
      merchantId: configs.merchantId,
      privateKey: configs.privateKey,
      environment: this.environment,
      webhookPublicKey: configs.webhookPublicKey,
    });
  }

  private get environment(): 'test' | 'prod' {
    return this.configs.environment === 'prod' ? 'prod' : 'test';
  }

  /**
   * Create a hosted checkout session.
   *
   * Note on `checkoutInfo.sessionId`: Waffo exposes no
   * "look up a checkout session" endpoint — `createSession()` returns an
   * opaque `cs_<uuid>` that can never be resolved again. The success callback
   * (`/api/payment/callback`) only receives `order.paymentSessionId` and hands
   * it straight back to `getPaymentSession()`, so the stored value has to be
   * something Waffo can resolve. The one stable, queryable business key we
   * control is `orderMerchantExternalId`, which we set to our own order
   * number — so that is what we persist. The real `cs_` id is kept in
   * `checkoutResult` for support/debugging.
   */
  async createPayment({
    order,
  }: {
    order: PaymentOrder;
  }): Promise<CheckoutSession> {
    if (!order.productId) {
      throw new Error(
        'waffo requires a Waffo product id (PROD_xxx); map it in Admin > Payment > Waffo Product IDs'
      );
    }

    const currency = (order.price?.currency || 'USD').toUpperCase();

    const params: CreateCheckoutSessionParams = {
      productId: order.productId,
      currency,
      orderMerchantExternalId: order.orderNo,
      successUrl: order.successUrl,
      buyerEmail: order.customer?.email,
      metadata: this.toMetadata(order),
    };

    // Dynamic pricing is opt-in: by default the Waffo product's own price wins,
    // which keeps the product dashboard as the single source of truth.
    if (this.configs.priceMode === 'snapshot') {
      if (!this.configs.taxCategory) {
        throw new Error(
          'waffo priceMode=snapshot requires a tax category (Admin > Payment > Waffo Tax Category)'
        );
      }
      if (!order.price?.amount) {
        throw new Error('waffo priceMode=snapshot requires an order price');
      }
      params.priceSnapshot = {
        amount: this.toDisplayAmount(order.price.amount, currency),
        taxCategory: this.configs.taxCategory as TaxCategory,
      };
    }

    const result = await this.client.checkout.createSession(params);

    return {
      provider: this.name,
      checkoutParams: params,
      checkoutInfo: {
        sessionId: order.orderNo || result.sessionId,
        checkoutUrl: result.checkoutUrl,
      },
      checkoutResult: result,
      metadata: order.metadata || {},
    };
  }

  /**
   * Resolve a checkout by our own order number.
   *
   * Deliberately never throws: this runs on the post-payment redirect, and the
   * webhook is the authoritative fulfilment path. If the read query fails (or
   * the payment has not been indexed yet) we degrade to `PROCESSING`, which
   * leaves the order open for the webhook instead of turning a successful
   * purchase into a redirect back to /pricing.
   */
  async getPaymentSession({
    sessionId,
  }: {
    sessionId: string;
  }): Promise<PaymentSession> {
    try {
      const { data, errors } = await this.client.graphql.query<{
        payments: Array<{
          id: string;
          status: string;
          createdAt: string;
          snapshotAmountDetails?: Record<string, any>;
          onetimeOrder?: Record<string, any> | null;
          subscriptionOrder?: Record<string, any> | null;
        }>;
      }>({
        query: `query ($ref: String!) {
          payments(filter: { orderMerchantExternalId: { eq: $ref } }) {
            id
            status
            createdAt
            snapshotAmountDetails { currency subtotal taxAmount total taxCategory }
            onetimeOrder { id status buyerEmail currency }
            subscriptionOrder {
              id status buyerEmail currency billingPeriod
              currentPeriodStart currentPeriodEnd canceledAt
            }
          }
        }`,
        variables: { ref: sessionId },
      });

      if (errors?.length) {
        throw new Error(errors.map((e: any) => e.message).join('; '));
      }

      const payments = data?.payments ?? [];
      if (payments.length === 0) {
        // No payment recorded yet — the buyer may still be on the cashier page.
        return {
          provider: this.name,
          paymentStatus: PaymentStatus.PROCESSING,
          paymentResult: { sessionId },
          metadata: {},
        };
      }

      const succeeded = payments.find((p) => p.status === 'succeeded');
      const payment = succeeded || payments[0];

      return this.buildPaymentSession({
        payment,
        paymentStatus: succeeded
          ? PaymentStatus.SUCCESS
          : payment.status === 'failed'
            ? PaymentStatus.FAILED
            : payment.status === 'canceled'
              ? PaymentStatus.CANCELED
              : PaymentStatus.PROCESSING,
      });
    } catch (e: any) {
      console.error('waffo getPaymentSession failed:', e?.message || e);
      return {
        provider: this.name,
        paymentStatus: PaymentStatus.PROCESSING,
        paymentResult: { sessionId, error: e?.message || String(e) },
        metadata: {},
      };
    }
  }

  /**
   * Verify and translate a Waffo webhook delivery.
   *
   * The body must be read as raw text: `verifyWebhook` re-derives the RSA-SHA256
   * signature over `${timestamp}.${rawBody}`, so parsing to JSON first changes
   * the bytes and every signature fails.
   */
  async getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent> {
    const rawBody = await req.text();
    const signature = req.headers.get('x-waffo-signature');

    if (!rawBody || !signature) {
      throw new Error('Invalid webhook request');
    }

    let event: WebhookEvent<WebhookEventData>;
    try {
      event = verifyWebhook<WebhookEventData>(rawBody, signature, {
        environment: this.environment,
      });
    } catch (e: any) {
      throw new Error(`Invalid webhook signature: ${e?.message || e}`);
    }

    const eventType = this.mapEventType(event.eventType);
    const paymentSession = this.buildPaymentSessionFromEvent(event, eventType);

    return {
      eventType,
      eventResult: event,
      paymentSession,
    };
  }

  /**
   * Cancel a subscription.
   *
   * `subscriptionId` is the Waffo subscription order id (`ORD_xxx`), which is
   * what `WebhookEventData.orderId` gives us and what we persist as the local
   * `subscriptionId`.
   */
  async cancelSubscription({
    subscriptionId,
  }: {
    subscriptionId: string;
  }): Promise<PaymentSession> {
    const result = await this.client.orders.cancelSubscription({
      orderId: subscriptionId,
    });

    // "canceled" = was pending, terminates now.
    // "canceling" = was active, terminates at the end of the current period.
    const status =
      result.status === 'canceled'
        ? SubscriptionStatus.CANCELED
        : SubscriptionStatus.PENDING_CANCEL;

    return {
      provider: this.name,
      subscriptionId,
      subscriptionInfo: {
        subscriptionId,
        status,
        canceledAt: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      },
      subscriptionResult: result,
    };
  }

  /* ------------------------------------------------------------------ */
  /* internals                                                           */
  /* ------------------------------------------------------------------ */

  private toMetadata(order: PaymentOrder): Record<string, string> {
    // Waffo metadata is a flat string map. `order_no` is what the notification
    // route reads back to find the local order, so it must always be present.
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(order.metadata || {})) {
      if (value === undefined || value === null) continue;
      out[key] = typeof value === 'string' ? value : String(value);
    }
    if (order.orderNo && !out.order_no) {
      out.order_no = order.orderNo;
    }
    return out;
  }

  private toDisplayAmount(minorUnits: number, currency: string): string {
    const code = currency.toUpperCase();
    if (ZERO_DECIMAL_CURRENCIES.has(code)) {
      return String(Math.round(minorUnits));
    }
    return (minorUnits / 100).toFixed(2);
  }

  private toMinorUnits(displayAmount: string | number, currency: string): number {
    const value =
      typeof displayAmount === 'number'
        ? displayAmount
        : Number.parseFloat(displayAmount);
    if (!Number.isFinite(value)) return 0;
    const code = currency.toUpperCase();
    if (ZERO_DECIMAL_CURRENCIES.has(code)) {
      return Math.round(value);
    }
    return Math.round(value * 100);
  }

  private mapEventType(eventType: string): PaymentEventType {
    switch (eventType) {
      // One-time purchase paid, or a subscription's first payment.
      case 'order.completed':
      case 'subscription.activated':
        return PaymentEventType.CHECKOUT_SUCCESS;

      // Recurring charges — the subscription already exists locally.
      case 'subscription.payment_succeeded':
      case 'subscription.renewed':
      case 'subscription.recovered':
        return PaymentEventType.PAYMENT_SUCCESS;

      // Status-only changes.
      case 'subscription.canceling':
      case 'subscription.uncanceled':
      case 'subscription.plan_changed':
      case 'subscription.past_due':
        return PaymentEventType.SUBSCRIBE_UPDATED;

      case 'subscription.canceled':
        return PaymentEventType.SUBSCRIBE_CANCELED;

      default:
        // refund.* / subscription.plan_change_scheduled / plan_change_failed
        // are intentionally not subscribed to; reaching here means the webhook
        // on the Waffo side was misconfigured.
        throw new Error(`Not handle waffo event type: ${eventType}`);
    }
  }

  private buildPaymentSessionFromEvent(
    event: WebhookEvent<WebhookEventData>,
    eventType: PaymentEventType
  ): PaymentSession {
    const data = event.data || ({} as WebhookEventData);
    const currency = (data.currency || 'USD').toUpperCase();
    const rawEventType = event.eventType;

    const metadata: Record<string, any> = { ...(data.orderMetadata || {}) };
    // Fallback for events that omit order metadata: we always send our order
    // number as `orderMerchantExternalId`, so it can stand in.
    if (!metadata.order_no && data.orderMerchantExternalId) {
      metadata.order_no = data.orderMerchantExternalId;
    }

    const charged = data.chargedAmount ?? data.amount;
    const listTotal = data.listPrice?.total ?? data.planPrice?.total ?? data.total;

    const session: PaymentSession = {
      provider: this.name,
      metadata,
      paymentResult: event,
    };

    if (
      eventType === PaymentEventType.CHECKOUT_SUCCESS ||
      eventType === PaymentEventType.PAYMENT_SUCCESS
    ) {
      session.paymentStatus = PaymentStatus.SUCCESS;
      session.paymentInfo = {
        description: data.productDescription,
        transactionId: data.paymentId || event.eventId,
        amount: this.toMinorUnits(listTotal ?? charged ?? 0, currency),
        currency,
        discountCode: '',
        discountAmount: 0,
        discountCurrency: currency,
        paymentAmount: this.toMinorUnits(charged ?? 0, currency),
        paymentCurrency: currency,
        paymentEmail: data.buyerEmail,
        paymentUserId: data.merchantProvidedBuyerIdentity,
        paidAt: data.paymentDate
          ? new Date(data.paymentDate)
          : new Date(event.timestamp),
        invoiceId: '',
        invoiceUrl: '',
      };
    }

    // Everything under `subscription.*` needs a subscription attached; a
    // one-time `order.completed` does not.
    if (!rawEventType.startsWith('subscription.')) {
      return session;
    }

    if (!data.orderId) {
      throw new Error(`waffo ${rawEventType} event has no order id`);
    }

    session.subscriptionId = data.orderId;
    session.subscriptionResult = data;

    const hasPeriod = Boolean(data.currentPeriodStart && data.currentPeriodEnd);

    // A renewal charge (`subscription.payment_succeeded`) carries neither a
    // period nor an order status by design — it describes one charge only.
    // Attaching a guessed period here would overwrite the real billing window,
    // so we leave the subscription unattached and let the notification route
    // degrade to its idempotent no-op path. `subscription.renewed` is the
    // authoritative period roll-forward and is subscribed separately.
    if (eventType === PaymentEventType.PAYMENT_SUCCESS && !hasPeriod) {
      return session;
    }

    const { interval, count } = mapBillingPeriod(data.billingPeriod);
    const start = data.currentPeriodStart
      ? new Date(data.currentPeriodStart)
      : new Date(event.timestamp);
    const end = data.currentPeriodEnd
      ? new Date(data.currentPeriodEnd)
      : addInterval(start, interval, count);

    const subscriptionInfo: SubscriptionInfo = {
      subscriptionId: data.orderId,
      description: data.productName,
      amount: this.toMinorUnits(listTotal ?? charged ?? 0, currency),
      currency,
      interval,
      intervalCount: count,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      status:
        mapSubscriptionStatus(data.orderStatus) ??
        statusFromEventType(rawEventType),
      metadata,
    };

    if (data.canceledAt) {
      subscriptionInfo.canceledAt = new Date(data.canceledAt);
    } else if (
      rawEventType === 'subscription.canceled' ||
      rawEventType === 'subscription.canceling'
    ) {
      // `handleSubscriptionCanceled` refuses a cancellation with no timestamp.
      subscriptionInfo.canceledAt = new Date(event.timestamp);
    }

    session.subscriptionInfo = subscriptionInfo;

    return session;
  }

  private buildPaymentSession({
    payment,
    paymentStatus,
  }: {
    payment: {
      id: string;
      status: string;
      createdAt: string;
      snapshotAmountDetails?: Record<string, any>;
      onetimeOrder?: Record<string, any> | null;
      subscriptionOrder?: Record<string, any> | null;
    };
    paymentStatus: PaymentStatus;
  }): PaymentSession {
    const order = payment.subscriptionOrder || payment.onetimeOrder || {};
    const currency = (order.currency || 'USD').toUpperCase();
    const total = payment.snapshotAmountDetails?.total;

    const session: PaymentSession = {
      provider: this.name,
      paymentStatus,
      paymentInfo: {
        transactionId: payment.id,
        amount: this.toMinorUnits(total ?? 0, currency),
        currency,
        discountCode: '',
        discountAmount: 0,
        discountCurrency: currency,
        paymentAmount: this.toMinorUnits(total ?? 0, currency),
        paymentCurrency: currency,
        paymentEmail: order.buyerEmail,
        paidAt: payment.createdAt ? new Date(payment.createdAt) : undefined,
        invoiceId: '',
        invoiceUrl: '',
      },
      paymentResult: payment,
      metadata: {},
    };

    if (payment.subscriptionOrder) {
      const { interval, count } = mapBillingPeriod(order.billingPeriod);
      session.subscriptionId = order.id;
      session.subscriptionResult = order;
      session.subscriptionInfo = {
        subscriptionId: order.id,
        description: undefined,
        amount: this.toMinorUnits(total ?? 0, currency),
        currency,
        interval,
        intervalCount: count,
        currentPeriodStart: order.currentPeriodStart
          ? new Date(order.currentPeriodStart)
          : new Date(payment.createdAt),
        currentPeriodEnd: order.currentPeriodEnd
          ? new Date(order.currentPeriodEnd)
          : new Date(payment.createdAt),
        canceledAt: order.canceledAt ? new Date(order.canceledAt) : undefined,
        status: mapSubscriptionStatus(order.status),
      };
    }

    return session;
  }
}

/**
 * Create Waffo Pancake provider with configs
 */
export function createWaffoProvider(configs: WaffoConfigs): WaffoProvider {
  return new WaffoProvider(configs);
}
