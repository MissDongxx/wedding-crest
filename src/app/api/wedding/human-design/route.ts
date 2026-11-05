import { cookies } from 'next/headers';
import { z } from 'zod';

import { respData, respErr } from '@/shared/lib/resp';
import {
  findOrderByOrderNo,
  OrderStatus,
  updateOrderByOrderNo,
} from '@/shared/models/order';
import { getWeddingActor } from '@/shared/models/wedding-actor';
import {
  canAccessWeddingCheckout,
  weddingCheckoutCookie,
} from '@/shared/models/wedding-checkout';
import { notifyHumanDesignOrder } from '@/shared/services/human-design';
import { HUMAN_DESIGN_PRODUCT_ID } from '@/shared/wedding/config';
import { humanDesignRequestSchema } from '@/shared/wedding/human-design';

async function ownedOrder(orderNo: string) {
  const [order, actor] = await Promise.all([
    findOrderByOrderNo(orderNo),
    getWeddingActor(),
  ]);
  if (
    !order ||
    order.productId !== HUMAN_DESIGN_PRODUCT_ID ||
    !(await canAccessWeddingCheckout(
      order,
      actor.user?.id,
      (await cookies()).get(weddingCheckoutCookie(orderNo))?.value,
      actor.guestOwnerId
    ))
  )
    return;
  return order;
}

export async function GET(request: Request) {
  try {
    const orderNo = new URL(request.url).searchParams.get('order_no');
    if (!orderNo || orderNo.length > 100)
      return respErr('order not found', 404);
    const order = await ownedOrder(orderNo);
    if (!order) return respErr('order not found', 404);
    const info = JSON.parse(order.checkoutInfo || '{}');
    const result = JSON.parse(order.checkoutResult || '{}');
    return Response.json(
      {
        code: 0,
        data: {
          paid: order.status === OrderStatus.PAID,
          submitted: result.human_design_notified === true,
          contactEmail:
            info.metadata?.human_design?.email ||
            order.paymentEmail ||
            order.userEmail ||
            '',
          notes: info.metadata?.human_design?.notes || '',
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch {
    return respErr('Order status is temporarily unavailable.', 503);
  }
}

/** Details follow payment. A forged return URL never grants form submission rights. */
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (
      (origin && origin !== new URL(request.url).origin) ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    )
      return respErr('invalid origin', 403);
    const body = z
      .object({
        orderNo: z.string().min(1).max(100),
        email: z.string().trim().email().max(254),
        notes: z.string().trim().max(2000).default(''),
      })
      .strict()
      .parse(await request.json());
    const order = await ownedOrder(body.orderNo);
    if (!order) return respErr('order not found', 404);
    if (order.status !== OrderStatus.PAID)
      return respErr(
        'Payment confirmation is required before submitting your details.',
        403
      );
    if (JSON.parse(order.checkoutResult || '{}').human_design_notified === true)
      return respData({ submitted: true });
    const info = JSON.parse(order.checkoutInfo || '{}');
    const details = humanDesignRequestSchema.safeParse({
      email: body.email,
      notes: body.notes,
      brief: info.metadata?.human_design?.brief || '',
    });
    if (!details.success)
      return respErr(
        'Please enter your contact email and design requirements.',
        400
      );
    const saved = await updateOrderByOrderNo(
      order.orderNo,
      {
        userEmail: details.data.email,
        checkoutInfo: JSON.stringify({
          ...info,
          metadata: { ...info.metadata, human_design: details.data },
        }),
      },
      { expectedStatus: OrderStatus.PAID }
    );
    if (!saved) return respErr('Please retry saving your details.', 409);
    await notifyHumanDesignOrder(saved);
    return respData({ submitted: true });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return respErr(
        'Please check your contact email and design requirements.',
        400
      );
    // Saved details are retained, and retries reuse the paid order instead of charging again.
    return respErr(
      'Your payment is confirmed. Please retry submitting your details.',
      503
    );
  }
}
