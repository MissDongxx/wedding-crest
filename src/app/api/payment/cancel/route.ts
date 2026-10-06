import { redirect } from 'next/navigation';

import { envConfigs } from '@/config';
import {
  findOrderByOrderNo,
  OrderStatus,
  updateOrderByOrderNo,
} from '@/shared/models/order';
import { getUserInfo } from '@/shared/models/user';

export async function GET(req: Request) {
  const pricingUrl = `${envConfigs.app_url}/pricing?payment=canceled`;
  const { searchParams } = new URL(req.url);
  const orderNo = searchParams.get('order_no');

  if (orderNo) {
    try {
      const [order, user] = await Promise.all([
        findOrderByOrderNo(orderNo),
        getUserInfo(),
      ]);

      // Only the signed-in owner can cancel an order, and only an unpaid
      // checkout may transition to canceled. The optimistic status guard also
      // prevents a late cancel redirect from overwriting a paid order.
      if (order && user && order.userId === user.id) {
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
