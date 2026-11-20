import { recordPaymentDiagnostic } from '@/shared/models/payment-diagnostic';
import { getPaymentService } from '@/shared/services/payment';
import { classifyProviderPaymentReason } from '@/shared/wedding/payment-diagnostics-contract';

/** Called only after the admin page's PAYMENTS_READ check, for one selected order. */
export async function inspectPaymentPlatform(order: {
  orderNo: string;
  userId: string;
  paymentProvider: string;
  paymentSessionId?: string | null;
}) {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let result: {
    paymentStatus: string;
    reason: string;
    providerReason?: string;
  };
  try {
    // getPaymentSession is not universally read-only: PayPal captures APPROVED
    // orders there. Only Waffo's query-only GraphQL lookup is permitted here.
    if (order.paymentProvider !== 'waffo') {
      result = { paymentStatus: 'unknown', reason: 'platform_read_not_supported' };
    } else if (!order.paymentSessionId) {
      result = { paymentStatus: 'unknown', reason: 'no_checkout_session' };
    } else {
      const session = await Promise.race([
        (async () => {
          const service = await getPaymentService();
          const provider = service.getProvider(order.paymentProvider);
          if (!provider) throw new Error('missing_provider');
          return provider.getPaymentSession({
            sessionId: order.paymentSessionId!,
          });
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('query_timeout')), 8000);
        }),
      ]);
      const status = ['paid', 'failed', 'canceled', 'processing'].includes(
        session.paymentStatus || ''
      )
        ? session.paymentStatus!
        : 'unknown';
      const observedReason = session.paymentResult?.diagnosticReason;
      const reason =
        observedReason === 'provider_query_error' ||
        observedReason === 'no_payment_record'
          ? observedReason
          : status === 'paid'
            ? 'payment_succeeded'
            : status === 'failed'
              ? 'provider_payment_failed'
              : status === 'canceled'
                ? 'provider_payment_canceled'
                : 'payment_processing';
      const providerReason =
        status === 'failed'
          ? classifyProviderPaymentReason(session.paymentResult?.failureReason)
          : undefined;
      result = {
        paymentStatus: status,
        reason,
        ...(providerReason ? { providerReason } : {}),
      };
    }
  } catch {
    // A failed read is not a failed payment, and never changes the order state.
    result = { paymentStatus: 'unknown', reason: 'provider_query_error' };
  } finally {
    if (timer) clearTimeout(timer);
  }
  await recordPaymentDiagnostic({
    source: 'provider',
    stage: 'admin_platform_checked',
    reason: result.reason,
    orderNo: order.orderNo,
    ownerId: order.userId,
    provider: order.paymentProvider,
    latencyMs: Date.now() - started,
    details: {
      paymentStatus: result.paymentStatus,
      ...(result.providerReason
        ? { providerReason: result.providerReason }
        : {}),
    },
  }).catch(() => {});
  return { ...result, checkedAt: new Date().toISOString() };
}
