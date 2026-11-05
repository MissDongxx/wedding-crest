import { updateOrderByOrderNo, type Order } from '@/shared/models/order';
import { getEmailService } from '@/shared/services/email';
import { humanDesignRequestSchema } from '@/shared/wedding/human-design';

/** At-least-once support delivery. Failure is retried by the payment webhook. */
export async function notifyHumanDesignOrder(order: Order) {
  const result = order.checkoutResult ? JSON.parse(order.checkoutResult) : {};
  if (result.human_design_notified) return;
  const info = JSON.parse(order.checkoutInfo || '{}');
  const details = humanDesignRequestSchema.safeParse(
    info.metadata?.human_design
  );
  // Payment is valid before contact exists. Delivery starts after the paid owner's form submission.
  if (!details.success) return;
  const request = details.data;
  const email = await getEmailService();
  const sent = await email.sendEmail({
    to: 'support@weddingcrestdesign.com',
    replyTo: request.email,
    subject: `[Human Design · $30 · reply within 8h] ${order.orderNo}`,
    text: `Payment confirmed. Reply to the customer within 8 hours.\nOrder: ${order.orderNo}\nContact: ${request.email}\nProject: ${order.projectId || 'New design'}\nDesign brief:\n${request.brief}\nNotes:\n${request.notes}`,
  });
  if (!sent.success)
    throw new Error(
      'Human design notification pending; retry payment confirmation'
    );
  await updateOrderByOrderNo(order.orderNo, {
    checkoutResult: JSON.stringify({ ...result, human_design_notified: true }),
  });
}
