import { cookies, headers } from 'next/headers';

import { getUserInfo } from '@/shared/models/user';
import { getWeddingAccountAccess } from '@/shared/models/wedding';
import {
  createWeddingGuestToken,
  getWeddingGuestBuyerId,
  isWeddingGuestToken,
  WEDDING_GUEST_COOKIE,
  WEDDING_GUEST_MAX_AGE,
} from '@/shared/wedding/guest-identity';

export { getWeddingProjectOwner } from '@/shared/wedding/guest-identity';

export interface WeddingActor {
  user: NonNullable<Awaited<ReturnType<typeof getUserInfo>>> | null;
  ownerId?: string;
  guestOwnerId?: string;
  guestToken?: string;
}

/** Read capability only from the HttpOnly cookie, never a client owner/email/header. */
export async function getWeddingActor({
  createGuest = false,
}: { createGuest?: boolean } = {}): Promise<WeddingActor> {
  const user = (await getUserInfo()) ?? null;
  const jar = await cookies();
  const candidate = jar.get(WEDDING_GUEST_COOKIE)?.value;
  let guestToken = isWeddingGuestToken(candidate) ? candidate : undefined;
  if (!guestToken && createGuest) {
    const requestHeaders = await headers();
    if (requestHeaders.get('sec-fetch-site') === 'cross-site')
      throw new Error('Guest checkout requires a same-site request.');
    guestToken = createWeddingGuestToken();
    const https =
      requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim() ===
        'https' ||
      process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://') === true;
    jar.set(WEDDING_GUEST_COOKIE, guestToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: https,
      path: '/',
      maxAge: WEDDING_GUEST_MAX_AGE,
    });
  }
  const guestOwnerId = guestToken
    ? await getWeddingGuestBuyerId(guestToken)
    : undefined;
  return { user, ownerId: user?.id ?? guestOwnerId, guestOwnerId, guestToken };
}

/** Consistent access/create selection: a real purchase wins; otherwise use this browser's purchase. */
export async function getWeddingPurchaseOwner(
  actor: WeddingActor
): Promise<string | undefined> {
  const account = actor.user
    ? await getWeddingAccountAccess(actor.user.id)
    : null;
  const guest = actor.guestOwnerId
    ? await getWeddingAccountAccess(actor.guestOwnerId)
    : null;
  if (account?.active) return actor.user!.id;
  if (guest?.active) return actor.guestOwnerId;
  if (account?.purchased) return actor.user!.id;
  if (guest?.purchased) return actor.guestOwnerId;
  return actor.ownerId;
}
