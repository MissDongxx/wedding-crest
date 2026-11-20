'use client';

export type CheckoutEntry = 'wizard' | 'result' | 'pricing' | 'human_design';
type Provider = 'waffo' | 'stripe' | 'paypal' | 'creem';
type Stage =
  | 'clicked'
  | 'request_failed'
  | 'session_created'
  | 'redirect_started'
  | 'redirect_left'
  | 'redirect_not_left'
  | 'returned'
  | 'access_unconfirmed';
type Reason =
  | 'network_error'
  | 'timeout'
  | 'invalid_response'
  | 'http_error'
  | 'checkout_initializing'
  | 'checkout_ended'
  | 'invalid_checkout_url'
  | 'redirect_error'
  | 'redirect_timeout'
  | 'returned_paid'
  | 'returned_prepaid'
  | 'returned_pending'
  | 'returned_failed'
  | 'returned_canceled'
  | 'returned_access_required'
  | 'returned_unknown'
  | 'access_unconfirmed';

interface Context {
  attemptId: string;
  entry: CheckoutEntry;
  provider?: Provider;
  projectId?: string;
  requestId?: string;
  orderNo?: string;
}
interface PendingCheckout extends Context {
  startedAt: number;
  redirectedAt?: number;
  left?: boolean;
  returned?: boolean;
  unconfirmed?: boolean;
}
type Envelope = {
  code?: number;
  data?: {
    checkoutUrl?: string;
    url?: string;
    attemptId?: string;
    requestId?: string;
    orderNo?: string;
    reasonCode?: string;
  };
  checkoutUrl?: string;
  url?: string;
};

const KEY = 'wedding_checkout_diagnostic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_ID = /^[a-zA-Z0-9_-]{1,120}$/;
const PROVIDERS = new Set(['waffo', 'stripe', 'paypal', 'creem']);
let volatilePending: PendingCheckout | undefined;

function uuid() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const value = Math.floor(Math.random() * 16);
      return (c === 'x' ? value : (value & 3) | 8).toString(16);
    })
  );
}

function save(value: PendingCheckout) {
  volatilePending = value;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Payment still works when browser storage is denied.
  }
}

function load(): PendingCheckout | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (
      value &&
      UUID.test(value.attemptId) &&
      ['wizard', 'result', 'pricing', 'human_design'].includes(value.entry) &&
      Date.now() - value.startedAt < 7 * 86400000
    )
      return value;
  } catch {}
  return volatilePending;
}

/** Whitelisted facts only: never a checkout URL, email, brief or error text. */
function send(
  context: Context,
  stage: Stage,
  detail: { reason?: Reason; httpStatus?: number; latencyMs?: number } = {}
) {
  try {
    const body = JSON.stringify({
      stage,
      entry: context.entry,
      attemptId: context.attemptId,
      ...(context.requestId && UUID.test(context.requestId)
        ? { requestId: context.requestId }
        : {}),
      ...(context.orderNo && SAFE_ID.test(context.orderNo)
        ? { orderNo: context.orderNo }
        : {}),
      ...(context.projectId && SAFE_ID.test(context.projectId)
        ? { projectId: context.projectId }
        : {}),
      ...(context.provider && PROVIDERS.has(context.provider)
        ? { provider: context.provider }
        : {}),
      ...detail,
    });
    if (
      typeof navigator !== 'undefined' &&
      navigator.sendBeacon?.(
        '/api/payment/diagnostics',
        new Blob([body], { type: 'application/json' })
      )
    )
      return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    void fetch('/api/payment/diagnostics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      signal: controller.signal,
    })
      .catch(() => {})
      .finally(() => clearTimeout(timeout));
  } catch {
    // Diagnostics never blocks checkout, including serialization/transport errors.
  }
}

export function validCheckoutUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 8192) return false;
  try {
    const url = new URL(value);
    return (
      ['https:', 'http:'].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export class CheckoutRequestError extends Error {
  constructor(
    public readonly reason: 'timeout' | 'network_error',
    message: string
  ) {
    super(message);
    this.name = 'CheckoutRequestError';
  }
}

export function beginCheckoutAttempt(input: {
  entry: CheckoutEntry;
  provider?: string;
  projectId?: string;
}) {
  let context: Context = {
    attemptId: uuid(),
    entry: input.entry,
    ...(input.provider && PROVIDERS.has(input.provider)
      ? { provider: input.provider as Provider }
      : {}),
    ...(input.projectId && SAFE_ID.test(input.projectId)
      ? { projectId: input.projectId }
      : {}),
  };
  let clickedQueued = true;
  let failed = false;
  const startedAt = Date.now();
  const flushClicked = () => {
    if (!clickedQueued) return;
    clickedQueued = false;
    send(context, 'clicked');
  };
  const persist = () => save({ ...context, startedAt });
  persist();
  return {
    get attemptId() {
      return context.attemptId;
    },
    /** Timeout aborts one request; it does not automatically create another order. */
    async fetch(init: RequestInit, timeoutMs = 30000) {
      const headers = new Headers(init.headers);
      headers.set('x-checkout-attempt-id', context.attemptId);
      const requestId = headers.get('x-wedding-checkout-id');
      if (requestId && UUID.test(requestId)) context.requestId = requestId;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch('/api/payment/checkout', {
          ...init,
          headers,
          signal: controller.signal,
        });
        // The caller parses this response before flushing the queued click.
        // Set-Cookie has already been applied: diagnostics cannot race a first
        // checkout by minting a different browser identity.
        const body = await response.text();
        return new Response(body || null, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      } catch {
        throw new CheckoutRequestError(
          controller.signal.aborted ? 'timeout' : 'network_error',
          controller.signal.aborted
            ? 'Checkout is taking longer than expected. Check your connection and retry.'
            : 'Checkout could not connect. Check your connection and retry.'
        );
      } finally {
        clearTimeout(timeout);
      }
    },
    response(response: Response, body: Envelope) {
      const data = body.data;
      if (data?.attemptId && UUID.test(data.attemptId))
        context.attemptId = data.attemptId;
      if (data?.requestId && UUID.test(data.requestId))
        context.requestId = data.requestId;
      if (data?.orderNo && SAFE_ID.test(data.orderNo))
        context.orderNo = data.orderNo;
      flushClicked();
      const url =
        data?.checkoutUrl || data?.url || body.checkoutUrl || body.url;
      if (
        !response.ok ||
        (body.code !== undefined && body.code !== 0) ||
        !url
      ) {
        const code = data?.reasonCode;
        this.failure(
          code === 'checkout_ended' || code === 'checkout_initializing'
            ? code
            : response.ok
              ? 'invalid_response'
              : 'http_error',
          response.status
        );
      } else if (!validCheckoutUrl(url)) {
        this.failure('invalid_checkout_url', response.status);
      } else {
        persist();
        send(context, 'session_created', {
          httpStatus: response.status,
          latencyMs: Math.min(120000, Math.max(0, Date.now() - startedAt)),
        });
      }
    },
    failure(reason: Reason, httpStatus?: number) {
      flushClicked();
      if (failed) return;
      failed = true;
      persist();
      send(context, 'request_failed', {
        reason,
        ...(httpStatus ? { httpStatus } : {}),
        latencyMs: Math.min(120000, Math.max(0, Date.now() - startedAt)),
      });
    },
    redirect(url: string, onNotLeft?: () => void) {
      if (!validCheckoutUrl(url)) {
        this.failure('invalid_checkout_url');
        throw new Error(
          'Checkout returned an invalid payment link. Please retry.'
        );
      }
      flushClicked();
      const pending: PendingCheckout = {
        ...context,
        startedAt,
        redirectedAt: Date.now(),
      };
      save(pending);
      send(context, 'redirect_started');
      let left = false;
      const onPageHide = () => {
        left = true;
        save({ ...pending, left: true });
        send(context, 'redirect_left');
        cleanup();
      };
      const timeout = setTimeout(() => {
        cleanup();
        // This is only an original-page navigation signal. It cannot inspect
        // cross-origin payment page loading, card fields or bank declines.
        if (!left && document.visibilityState === 'visible') {
          send(context, 'redirect_not_left', { reason: 'redirect_timeout' });
          onNotLeft?.();
        }
      }, 5000);
      const cleanup = () => {
        clearTimeout(timeout);
        window.removeEventListener('pagehide', onPageHide);
      };
      window.addEventListener('pagehide', onPageHide, { once: true });
      try {
        window.location.assign(url);
      } catch (error) {
        cleanup();
        this.failure('redirect_error');
        throw error;
      }
    },
  };
}

export type CheckoutAttempt = ReturnType<typeof beginCheckoutAttempt>;

export function recordCheckoutReturned(params: Pick<URLSearchParams, 'get'>) {
  const pending = load();
  if (!pending || pending.returned) return;
  const state = params.get('payment') || params.get('checkout');
  const reason: Reason | undefined =
    state === 'canceled'
      ? 'returned_canceled'
      : state === 'failed'
        ? 'returned_failed'
        : state === 'pending'
          ? 'returned_pending'
          : state === 'access_required'
            ? 'returned_access_required'
            : params.get('paid') === '1'
              ? 'returned_paid'
              : params.get('prepaid') === '1'
                ? 'returned_prepaid'
                : pending.left
                  ? 'returned_unknown'
                  : undefined;
  if (!reason) return;
  save({ ...pending, returned: true });
  send(pending, 'returned', { reason });
}

export function recordCheckoutAccessUnconfirmed(entry: CheckoutEntry) {
  const pending = load();
  if (!pending || pending.entry !== entry || pending.unconfirmed) return;
  save({ ...pending, unconfirmed: true });
  send(pending, 'access_unconfirmed', { reason: 'access_unconfirmed' });
}
