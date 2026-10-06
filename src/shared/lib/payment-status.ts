import { OrderStatus } from '@/shared/models/order';

export const PAYPAL_ORDER_EXPIRY_MS = 3 * 60 * 60 * 1000;

export type PaymentDisplayStatus =
  | 'paid'
  | 'failed'
  | 'canceled'
  | 'expired'
  | 'awaiting_payment'
  | 'pending';

export function getPaymentDisplayStatus(
  status: string,
  createdAt: Date | string,
  now = Date.now()
): PaymentDisplayStatus {
  if (status === OrderStatus.PAID) return 'paid';
  if (status === OrderStatus.FAILED) return 'failed';
  if (status === OrderStatus.CANCELED) return 'canceled';

  if (status === OrderStatus.CREATED) {
    const createdAtMs = new Date(createdAt).getTime();
    const isExpired =
      Number.isFinite(createdAtMs) &&
      now - createdAtMs >= PAYPAL_ORDER_EXPIRY_MS;

    return isExpired ? 'expired' : 'awaiting_payment';
  }

  return 'pending';
}
