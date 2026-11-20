/** Account-wide, additive purchase rights. Dates are UTC; downloads never expire. */
export const WEDDING_ACCESS_DAYS = 7;
export const WEDDING_PROJECTS_PER_PURCHASE = 5;
export const WEDDING_DAILY_IMAGE_LIMIT = 10;
const WEEK_MS = WEDDING_ACCESS_DAYS * 86400000;

export interface WeddingPurchase {
  id: string;
  paidAt: Date | string | null;
  createdAt: Date | string;
}

export function weddingAccess(
  purchases: WeddingPurchase[],
  projectCount: number,
  now = new Date()
) {
  // One row per order, not per callback. Sorting also handles out-of-order notifications.
  const unique = [...new Map(purchases.map((p) => [p.id, p])).values()];
  const times = unique
    .map((p) => new Date(p.paidAt ?? p.createdAt).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  let end = 0;
  for (const paidAt of times) end = Math.max(end, paidAt) + WEEK_MS;
  const active = end > now.getTime();
  const projectLimit = times.length * WEDDING_PROJECTS_PER_PURCHASE;
  return {
    purchased: times.length > 0,
    active,
    expiresAt: end ? new Date(end).toISOString() : null,
    projectLimit,
    projectsRemaining: Math.max(0, projectLimit - projectCount),
    canCreateProject: active && projectCount < projectLimit,
  };
}

export type WeddingAccess = ReturnType<typeof weddingAccess>;

export function weddingGenerationAllowance(
  access: Pick<WeddingAccess, 'purchased' | 'active'>,
  todayImages: number
) {
  const base = { maxBatches: WEDDING_DAILY_IMAGE_LIMIT };
  if (!access.purchased)
    return {
      ...base,
      allowed: false,
      reasonCode: 'payment_required',
      reason: 'Purchase your image pack to start generating.',
    };
  if (!access.active)
    return {
      ...base,
      allowed: false,
      reasonCode: 'access_expired',
      reason:
        'Your generation access has expired. Purchase again to continue. Your designs are saved.',
    };
  if (todayImages >= WEDDING_DAILY_IMAGE_LIMIT)
    return {
      ...base,
      allowed: false,
      reasonCode: 'daily_limit',
      reason:
        'Image generation resources are busy. Please try again tomorrow. Your designs are saved.',
    };
  return { ...base, allowed: true, reasonCode: undefined, reason: undefined };
}

/** Pending/ambiguous submissions reserve one image; confirmed failures release it. */
export function countsTowardDailyImages(
  row: {
    status: string;
    cost: number | null;
    createdAt: Date | string;
  },
  now = new Date()
) {
  const date = new Date(row.createdAt);
  return (
    date.toISOString().slice(0, 10) === now.toISOString().slice(0, 10) &&
    (row.status !== 'failed' || row.cost === -1)
  );
}
