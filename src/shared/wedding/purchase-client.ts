'use client';

import type { WeddingAccess } from './access';
import {
  CheckoutRequestError,
  type CheckoutAttempt,
} from './checkout-telemetry-client';

export type WeddingClientAccess = WeddingAccess & {
  identityScope?: 'account' | 'guest';
  allowance?: { allowed?: boolean; reasonCode?: string };
  receiptEmailMissing?: boolean;
  hasReceiptEmail?: boolean;
};

let pendingAccess: Promise<WeddingClientAccess> | undefined;
const checkoutMemory = new Map<string, string>();

/** Keep checkout usable when browser storage is denied; existing keys win. */
export const weddingCheckoutStorage = {
  getItem(key: string) {
    try {
      return localStorage.getItem(key) ?? checkoutMemory.get(key) ?? null;
    } catch {
      return checkoutMemory.get(key) ?? null;
    }
  },
  setItem(key: string, value: string) {
    checkoutMemory.set(key, value);
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
  removeItem(key: string) {
    checkoutMemory.delete(key);
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

async function withBrowserLock<T>(
  key: string,
  task: () => Promise<T> | T
): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(key, task);
  }
  return task();
}

/** Bootstrap and submit share one request; Web Locks also serialize browser tabs. */
export function fetchWeddingAccess(): Promise<WeddingClientAccess> {
  if (pendingAccess) return pendingAccess;
  pendingAccess = withBrowserLock('wedding-guest-bootstrap', async () => {
    const response = await fetch('/api/wedding/access', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok || body.code !== 0 || !body.data) {
      throw new Error(body.message || 'Could not confirm purchase access.');
    }
    return body.data as WeddingClientAccess;
  }).finally(() => {
    pendingAccess = undefined;
  });
  return pendingAccess;
}

/** Keep source example, style and locale; never send a cross-origin return URL. */
export function weddingResumePath(pathname: string, search: string): string {
  const url = new URL(pathname + search, 'https://wedding.invalid');
  for (const marker of ['prepaid', 'payment', 'checkout', 'paid'])
    url.searchParams.delete(marker);
  return url.pathname + url.search;
}

export async function stableWeddingRequestId(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  key: string,
  fallbackKey?: string
): Promise<string> {
  return withBrowserLock(`wedding-request:${key}`, () => {
    let id: string | null = null;
    try {
      id =
        storage.getItem(key) ||
        (fallbackKey ? storage.getItem(fallbackKey) : null);
    } catch {
      id = checkoutMemory.get(key) || null;
    }
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) id = crypto.randomUUID();
    checkoutMemory.set(key, id);
    try {
      storage.setItem(key, id);
    } catch {}
    return id;
  });
}

export interface WeddingCheckoutEnvelope {
  code?: number;
  message?: string;
  error?: string;
  checkoutUrl?: string;
  url?: string;
  data?: {
    checkoutUrl?: string;
    url?: string;
    reasonCode?: string;
    attemptId?: string;
    requestId?: string;
    orderNo?: string;
  };
}

/** Retry a still-initializing order with the same key, never create a second one. */
export async function requestWeddingCheckout(
  request: () => Promise<Response>,
  onEnded: () => void,
  wait: () => Promise<void> = () =>
    new Promise((resolve) => setTimeout(resolve, 1000)),
  telemetry?: CheckoutAttempt
): Promise<{ response: Response; body: WeddingCheckoutEnvelope }> {
  let endedRetries = 0;
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await request();
    } catch (error) {
      telemetry?.failure(
        error instanceof CheckoutRequestError ? error.reason : 'network_error'
      );
      throw error;
    }
    const raw: unknown = await response.json().catch(() => ({}));
    const body = (
      raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
    ) as WeddingCheckoutEnvelope;
    if (
      response.status === 409 &&
      body.data?.reasonCode === 'checkout_initializing' &&
      attempt < 3
    ) {
      await wait();
      continue;
    }
    if (body.data?.reasonCode === 'checkout_ended') {
      onEnded();
      // A server-confirmed expired checkout is safe to replace once. Network
      // failures/timeouts never cause an automatic second creation request.
      if (response.status === 409 && endedRetries++ < 1) continue;
    }
    telemetry?.response(response, body);
    return { response, body };
  }
}
