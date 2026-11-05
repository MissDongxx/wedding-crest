import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { envConfigs } from '@/config';
import { PaymentStatus, PaymentType } from '@/extensions/payment/types';
import { findOrderByOrderNo, OrderStatus } from '@/shared/models/order';
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
      throw new Error('order and user not match');
    }

    if (isWeddingCheckoutProduct(order.productId) && order.callbackUrl)
      ownedWeddingReturn = order.callbackUrl;
    const paymentService = await getPaymentService();

    const paymentProvider = paymentService.getProvider(order.paymentProvider);
    if (!paymentProvider) {
      throw new Error('payment provider not found');
    }

    // get payment session
    const session = await paymentProvider.getPaymentSession({
      sessionId: order.paymentSessionId,
    });

    await handleCheckoutSuccess({
      order,
      session,
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
  } catch {
    if (ownedWeddingReturn) {
      const pending = new URL(ownedWeddingReturn);
      pending.searchParams.set('payment', 'pending');
      redirectUrl = pending.toString();
    } else
      redirectUrl = weddingCallback
        ? `${envConfigs.app_url}/create?payment=access_required`
        : `${envConfigs.app_url}/pricing`;
  }

  redirect(redirectUrl);
}
