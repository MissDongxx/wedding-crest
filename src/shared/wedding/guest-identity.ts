/** High-entropy server-issued browser capability; never an email or account session. */
export const WEDDING_GUEST_COOKIE = 'wedding_guest_identity';
export const WEDDING_GUEST_MAX_AGE = 365 * 24 * 60 * 60;

export function isWeddingGuestToken(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

export function createWeddingGuestToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

/** Same SHA-256/prefix as legacy ensureWeddingGuestBuyer, keyed by capability now. */
export async function getWeddingGuestBuyerId(token: string): Promise<string> {
  if (!isWeddingGuestToken(token))
    throw new Error('invalid wedding guest identity');
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token)
  );
  return `wedding_guest_${Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export interface WeddingOwnerIdentity {
  user: { id: string } | null;
  ownerId?: string;
  guestOwnerId?: string;
}

/** A logged-in session does not invalidate this browser's separately purchased designs. */
export function getWeddingProjectOwner(
  actor: WeddingOwnerIdentity,
  project: { userId?: string | null }
): string | undefined {
  if (actor.user?.id && project.userId === actor.user.id) return actor.user.id;
  if (actor.guestOwnerId && project.userId === actor.guestOwnerId)
    return actor.guestOwnerId;
  return undefined;
}
