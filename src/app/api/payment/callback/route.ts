import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { envConfigs } from '@/config';
import { PaymentStatus, PaymentType } from '@/extensions/payment/types';
import { findOrderByOrderNo, OrderStatus } from '@/shared/models/order';
import {
  classifyPaymentDiagnosticError,
  recordPaymentDiagnostic,
} from '@/shared/models/payment-diagnostic';
import { getWeddingActor } from '@/shared/models/wedding-actor';
import {
  canAccessWeddingCheckout,
  weddingCheckoutCookie,
} from '@/shared/models/wedding-checkout';
import {
  getPaymentService,
  handleCheckoutSuccess,
} from '@/shared/services/payment';
import { isWeddingCheckoutProduct } from '@/shared/wedding/config';

export async function GET(req: Request) {
  let redirectUrl = '';
  let ownedWeddingReturn = '';
  let weddingCallback = false;
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  let diagnosticOrder: Awaited<ReturnType<typeof findOrderByOrderNo>>;
  const trace = (
    stage: string,
    reason?: string,
    details?: Record<string, any>
  ) =>
    recordPaymentDiagnostic({
      source: 'server',
      stage,
      reason,
      requestId,
      orderNo: diagnosticOrder?.orderNo,
      ownerId: diagnosticOrder?.userId,
      provider: diagnosticOrder?.paymentProvider,
      projectId: diagnosticOrder?.projectId || undefined,
      latencyMs: Date.now() - startedAt,
      details,
    }).catch(() => {});
  await trace('callback_received');

  try {
    // get callback params
    const { searchParams } = new URL(req.url);
    const orderNo = searchParams.get('order_no');

    if (!orderNo) {
      throw new Error('invalid callback params');
    }

    // get sign user
    const actor = await getWeddingActor();
    const user = actor.user;

    // get order
    const order = await findOrderByOrderNo(orderNo);
    if (!order) {
      throw new Error('order not found');
    }

    diagnosticOrder = order;
    weddingCallback = isWeddingCheckoutProduct(order.productId);

    // validate order and user
    if (!order.paymentSessionId || !order.paymentProvider) {
      throw new Error('invalid order');
    }

    const guestId = (await cookies()).get(
      weddingCheckoutCookie(orderNo)
    )?.value;
    if (
      !(await canAccessWeddingCheckout(
        order,
        user?.id,
        guestId,
        actor.guestOwnerId
      ))
    ) {
      await trace('callback_rejected', 'identity_mismatch');
      throw new Error('order and user not match');
    }

    if (isWeddingCheckoutProduct(order.productId) && order.callbackUrl)
      ownedWeddingReturn = order.callbackUrl;
    const paymentService = await getPaymentService();

    const paymentProvider = paymentService.getProvider(order.paymentProvider);
    if (!paymentProvider) {
      throw new Error('payment provider not found');
    }

    await trace('callback_identity_verified');
    // get payment session
    const session = await paymentProvider.getPaymentSession({
      sessionId: order.paymentSessionId,
    });

    await trace(
      'callback_payment_lookup',
      session.paymentResult?.diagnosticReason === 'provider_query_error'
        ? 'provider_query_error'
        : session.paymentResult?.diagnosticReason === 'no_payment_record'
          ? 'no_payment_record'
          : session.paymentStatus === PaymentStatus.SUCCESS
            ? 'payment_succeeded'
            : session.paymentStatus === PaymentStatus.FAILED
              ? 'provider_payment_failed'
              : session.paymentStatus === PaymentStatus.CANCELED
                ? 'provider_payment_canceled'
                : 'payment_processing',
      { paymentStatus: session.paymentStatus }
    );
    await handleCheckoutSuccess({
      order,
      session,
    });

    await trace('callback_payment_synchronized', undefined, {
      paymentStatus: session.paymentStatus,
    });

    if (
      weddingCallback &&
      ownedWeddingReturn &&
      (session.paymentStatus === PaymentStatus.FAILED ||
        session.paymentStatus === PaymentStatus.CANCELED)
    ) {
      const current = await findOrderByOrderNo(orderNo);
      if (current?.status !== OrderStatus.PAID) {
        const failed = new URL(ownedWeddingReturn);
        failed.searchParams.delete('prepaid');
        failed.searchParams.delete('paid');
        failed.searchParams.set(
          'payment',
          session.paymentStatus === PaymentStatus.CANCELED
            ? 'canceled'
            : 'failed'
        );
        redirectUrl = failed.toString();
      }
    }
    redirectUrl ||=
      order.callbackUrl ||
      (order.paymentType === PaymentType.SUBSCRIPTION
        ? `${envConfigs.app_url}/settings/billing`
        : `${envConfigs.app_url}/settings/payments`);
  } catch (error) {
    const failure = classifyPaymentDiagnosticError(error);
    await trace('callback_failed', failure.reason, failure.details);
    if (ownedWeddingReturn) {
      const pending = new URL(ownedWeddingReturn);
      pending.searchParams.set('payment', 'pending');
      redirectUrl = pending.toString();
    } else
      redirectUrl = weddingCallback
        ? `${envConfigs.app_url}/create?payment=access_required`
        : `${envConfigs.app_url}/pricing`;
  }

  await trace(
    'callback_redirect',
    redirectUrl.includes('payment=pending')
      ? 'payment_pending'
      : redirectUrl.includes('payment=access_required')
        ? 'access_required'
        : redirectUrl.includes('payment=failed')
          ? 'payment_failed'
          : redirectUrl.includes('payment=canceled')
            ? 'payment_canceled'
            : 'return_to_merchant'
  );
  redirect(redirectUrl);
}
