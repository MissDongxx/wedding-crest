import { db } from '@/core/db';
import { user } from '@/config/db/schema';
import type { Order } from '@/shared/models/order';
import { canAccessWeddingProject } from '@/shared/models/wedding';
import { WEDDING_PACK_PRODUCT_ID } from '@/shared/wedding/config';

export const weddingCheckoutCookie = (orderNo: string) =>
  `wedding_checkout_${orderNo}`;

/** A billing-only identity satisfies the existing order FK. No login/session is created.
 * Never associate an unverified buyer email with an existing registered account.
 * Actual receipt email is collected by the payment provider and stored in paymentEmail.
 */
export async function ensureWeddingGuestBuyer(projectId: string) {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(projectId)
  );
  const digest = Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
  const id = `wedding_guest_${digest}`;
  await db()
    .insert(user)
    .values({
      id,
      name: 'Wedding guest buyer',
      email: `${digest}@guest.invalid`,
      emailVerified: false,
    })
    .onConflictDoNothing();
  return id;
}

export async function canAccessWeddingCheckout(
  order: Order,
  userId?: string,
  guestId?: string
) {
  if (userId && order.userId === userId) return true;
  if (
    !guestId ||
    !order.projectId ||
    order.productId !== WEDDING_PACK_PRODUCT_ID
  )
    return false;
  return canAccessWeddingProject({ id: order.projectId, guestId });
}
