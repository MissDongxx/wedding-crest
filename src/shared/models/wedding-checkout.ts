import { and, desc, eq } from 'drizzle-orm';

import { db } from '@/core/db';
import { order as orderTable, user } from '@/config/db/schema';
import { OrderStatus, type Order } from '@/shared/models/order';
import { canAccessWeddingProject } from '@/shared/models/wedding';
import { receiptEmail } from '@/shared/wedding/checkout-contract';
import {
  isWeddingCheckoutProduct,
  WEDDING_PACK_PRODUCT_ID,
} from '@/shared/wedding/config';

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
  guestId?: string,
  guestOwnerId?: string
) {
  if (userId && order.userId === userId) return true;
  if (
    isWeddingCheckoutProduct(order.productId) &&
    guestOwnerId &&
    order.userId === guestOwnerId
  )
    return true;
  if (
    !guestId ||
    !order.projectId ||
    !isWeddingCheckoutProduct(order.productId)
  )
    return false;
  return canAccessWeddingProject({ id: order.projectId, guestId });
}

/** Only an authenticated account or server-cookie owner can request these facts. */
export async function getWeddingReceiptState(ownerId: string) {
  const rows = await db()
    .select({
      paymentEmail: orderTable.paymentEmail,
      userEmail: orderTable.userEmail,
    })
    .from(orderTable)
    .where(
      and(
        eq(orderTable.userId, ownerId),
        eq(orderTable.productId, WEDDING_PACK_PRODUCT_ID),
        eq(orderTable.status, OrderStatus.PAID)
      )
    )
    .orderBy(desc(orderTable.createdAt));
  const hasReceiptEmail = rows.some(
    (row: { paymentEmail: string | null; userEmail: string | null }) =>
      receiptEmail(row.paymentEmail) || receiptEmail(row.userEmail)
  );
  return {
    hasReceiptEmail,
    receiptEmailMissing: rows.length > 0 && !hasReceiptEmail,
  };
}

/** User-supplied contact is not provider paymentEmail and never changes an account. */
export async function saveWeddingReceiptContact(
  ownerId: string,
  email: string
) {
  const [saved] = await db()
    .update(orderTable)
    .set({ userEmail: email })
    .where(
      and(
        eq(orderTable.userId, ownerId),
        eq(orderTable.productId, WEDDING_PACK_PRODUCT_ID),
        eq(orderTable.status, OrderStatus.PAID)
      )
    )
    .returning({ id: orderTable.id });
  return Boolean(saved);
}
