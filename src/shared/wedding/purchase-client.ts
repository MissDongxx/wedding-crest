'use client';

import type { WeddingAccess } from './access';

export type WeddingClientAccess = WeddingAccess & {
  identityScope?: 'account' | 'guest';
  allowance?: { allowed?: boolean; reasonCode?: string };
  receiptEmailMissing?: boolean;
  hasReceiptEmail?: boolean;
};

let pendingAccess: Promise<WeddingClientAccess> | undefined;

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
  storage: Storage,
  key: string,
  fallbackKey?: string
): Promise<string> {
  return withBrowserLock(`wedding-request:${key}`, () => {
    let id =
      storage.getItem(key) ||
      (fallbackKey ? storage.getItem(fallbackKey) : null);
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) id = crypto.randomUUID();
    storage.setItem(key, id);
    return id;
  });
}

export interface WeddingCheckoutEnvelope {
  code?: number;
  message?: string;
  error?: string;
  checkoutUrl?: string;
  url?: string;
  data?: { checkoutUrl?: string; url?: string; reasonCode?: string };
}

/** Retry a still-initializing order with the same key, never create a second one. */
export async function requestWeddingCheckout(
  request: () => Promise<Response>,
  onEnded: () => void,
  wait: () => Promise<void> = () =>
    new Promise((resolve) => setTimeout(resolve, 1000))
): Promise<{ response: Response; body: WeddingCheckoutEnvelope }> {
  for (let attempt = 0; ; attempt++) {
    const response = await request();
    const body = (await response
      .json()
      .catch(() => ({}))) as WeddingCheckoutEnvelope;
    if (
      response.status === 409 &&
      body.data?.reasonCode === 'checkout_initializing' &&
      attempt < 3
    ) {
      await wait();
      continue;
    }
    if (body.data?.reasonCode === 'checkout_ended') onEnded();
    return { response, body };
  }
}
