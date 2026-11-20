import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { envConfigs } from '@/config';
import {
  findOrderByOrderNo,
  OrderStatus,
  updateOrderByOrderNo,
} from '@/shared/models/order';
import {
  classifyPaymentDiagnosticError,
  recordPaymentDiagnostic,
} from '@/shared/models/payment-diagnostic';
import { getWeddingActor } from '@/shared/models/wedding-actor';
import {
  canAccessWeddingCheckout,
  weddingCheckoutCookie,
} from '@/shared/models/wedding-checkout';

export async function GET(req: Request) {
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
  await trace('cancel_received');
  let pricingUrl = `${envConfigs.app_url}/pricing?payment=canceled`;
  const { searchParams } = new URL(req.url);
  const orderNo = searchParams.get('order_no');

  if (orderNo) {
    try {
      const [order, actor] = await Promise.all([
        findOrderByOrderNo(orderNo),
        getWeddingActor(),
      ]);

      diagnosticOrder = order;
      // Only the account owner or checkout guest can cancel an order; only an unpaid
      // checkout may transition to canceled. The optimistic status guard also
      // prevents a late cancel redirect from overwriting a paid order.
      const guestId = (await cookies()).get(
        weddingCheckoutCookie(orderNo)
      )?.value;
      if (
        order &&
        (await canAccessWeddingCheckout(
          order,
          actor.user?.id,
          guestId,
          actor.guestOwnerId
        ))
      ) {
        if (order.status === OrderStatus.PAID) {
          pricingUrl = order.callbackUrl || pricingUrl;
          await trace('cancel_ignored', 'already_paid');
        } else {
          if (order.callbackUrl) {
            const returnUrl = new URL(order.callbackUrl);
            returnUrl.searchParams.delete('paid');
            returnUrl.searchParams.delete('prepaid');
            returnUrl.searchParams.set('payment', 'canceled');
            pricingUrl = returnUrl.toString();
          }
          const canceled = await updateOrderByOrderNo(
            orderNo,
            { status: OrderStatus.CANCELED },
            { expectedStatus: OrderStatus.CREATED }
          );
          // A payment webhook may win between our read and cancellation.
          const current = canceled
            ? undefined
            : await findOrderByOrderNo(orderNo);
          if (current?.status === OrderStatus.PAID) {
            pricingUrl = current.callbackUrl || order.callbackUrl || pricingUrl;
            await trace('cancel_ignored', 'already_paid');
          } else {
            await trace(
              canceled ? 'cancel_applied' : 'cancel_ignored',
              canceled ? 'buyer_canceled' : 'order_not_cancelable'
            );
          }
        }
      }
    } catch (error) {
      const failure = classifyPaymentDiagnosticError(error);
      await trace('cancel_failed', failure.reason, failure.details);
      // The buyer should always make it back to pricing. A transient database
      // failure leaves the order as `created`, which the Admin page will later
      // display as expired rather than risking a false canceled status.
    }
  }

  await trace(
    'cancel_redirect',
    pricingUrl.includes('payment=canceled')
      ? 'payment_canceled'
      : 'already_paid'
  );
  redirect(pricingUrl);
}
