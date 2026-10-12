import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { envConfigs } from '@/config';
import {
  findOrderByOrderNo,
  OrderStatus,
  updateOrderByOrderNo,
} from '@/shared/models/order';
import { getUserInfo } from '@/shared/models/user';
import {
  canAccessWeddingCheckout,
  weddingCheckoutCookie,
} from '@/shared/models/wedding-checkout';

export async function GET(req: Request) {
  let pricingUrl = `${envConfigs.app_url}/pricing?payment=canceled`;
  const { searchParams } = new URL(req.url);
  const orderNo = searchParams.get('order_no');

  if (orderNo) {
    try {
      const [order, user] = await Promise.all([
        findOrderByOrderNo(orderNo),
        getUserInfo(),
      ]);

      // Only the account owner or checkout guest can cancel an order; only an unpaid
      // checkout may transition to canceled. The optimistic status guard also
      // prevents a late cancel redirect from overwriting a paid order.
      const guestId = (await cookies()).get(
        weddingCheckoutCookie(orderNo)
      )?.value;
      if (order && (await canAccessWeddingCheckout(order, user?.id, guestId))) {
        if (order.projectId && order.callbackUrl) {
          const returnUrl = new URL(order.callbackUrl);
          returnUrl.searchParams.delete('paid');
          returnUrl.searchParams.set('payment', 'canceled');
          pricingUrl = returnUrl.toString();
        }
        await updateOrderByOrderNo(
          orderNo,
          { status: OrderStatus.CANCELED },
          { expectedStatus: OrderStatus.CREATED }
        );
      }
    } catch {
      // The buyer should always make it back to pricing. A transient database
      // failure leaves the order as `created`, which the Admin page will later
      // display as expired rather than risking a false canceled status.
    }
  }

  redirect(pricingUrl);
}
