/** Only local create/design routes can be payment return destinations. */
export function weddingCheckoutReturnUrl(input: {
  appUrl: string;
  locale?: string;
  defaultLocale?: string;
  resumePath?: unknown;
  projectId?: string;
  resumeWizard?: boolean;
}) {
  const base = new URL(input.appUrl);
  const locale = /^(en|zh|pt-BR|it|de|fr|ko|th)$/.test(input.locale || '')
    ? input.locale
    : undefined;
  const prefix = locale && locale !== input.defaultLocale ? `/${locale}` : '';
  const fallback =
    input.projectId && !input.resumeWizard
      ? `${prefix}/design/${encodeURIComponent(input.projectId)}`
      : `${prefix}/create`;
  let url = new URL(fallback, base);
  if (
    typeof input.resumePath === 'string' &&
    input.resumePath.startsWith('/') &&
    !input.resumePath.startsWith('//')
  ) {
    const requested = new URL(input.resumePath, base);
    if (
      requested.origin === base.origin &&
      /^\/(?:en\/|zh\/|pt-BR\/|it\/|de\/|fr\/|ko\/|th\/)?create$/.test(
        requested.pathname
      )
    ) {
      url = new URL(requested.pathname, base);
      for (const key of ['style', 'exampleId', 'edit']) {
        const value = requested.searchParams.get(key);
        if (value && value.length <= 120) url.searchParams.set(key, value);
      }
    }
  }
  if (url.pathname.endsWith('/create')) {
    if (input.projectId && input.resumeWizard)
      url.searchParams.set('edit', input.projectId);
    url.searchParams.set('prepaid', '1');
  } else url.searchParams.set('paid', '1');
  return url.toString();
}

export async function weddingCheckoutId(ownerId: string, requestId: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`wedding-checkout:${ownerId}:${requestId}`)
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
}

export function receiptEmail(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const email = value.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : undefined;
}

/** Runs only on trusted provider queries or verified webhook sessions, never browser input. */
export function assertWeddingPaymentMatches(
  order: {
    orderNo: string;
    userId: string;
    paymentProvider: string | null;
    amount: number;
    currency: string;
    discountCode?: string | null;
  },
  session: {
    provider: string;
    paymentStatus?: string;
    metadata?: Record<string, unknown>;
    paymentInfo?: {
      paymentAmount: number;
      paymentCurrency: string;
      discountAmount?: number;
      discountCurrency?: string;
    };
  }
) {
  if (session.provider !== order.paymentProvider)
    throw new Error('payment provider mismatch');
  if (session.metadata?.order_no && session.metadata.order_no !== order.orderNo)
    throw new Error('payment order mismatch');
  if (session.metadata?.user_id && session.metadata.user_id !== order.userId)
    throw new Error('payment owner mismatch');
  if (session.paymentStatus !== 'paid') return;
  const info = session.paymentInfo;
  if (
    !info ||
    !Number.isFinite(info.paymentAmount) ||
    info.paymentAmount <= 0 ||
    info.paymentCurrency.toLowerCase() !== order.currency.toLowerCase()
  )
    throw new Error('payment currency or amount mismatch');
  const discount = order.discountCode ? (info.discountAmount ?? 0) : 0;
  if (
    !Number.isFinite(discount) ||
    discount < 0 ||
    discount > order.amount ||
    (discount > 0 &&
      info.discountCurrency?.toLowerCase() !== order.currency.toLowerCase()) ||
    info.paymentAmount < order.amount - discount
  )
    throw new Error('payment amount mismatch');
}
