import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';
import { respData, respErr } from '@/shared/lib/resp';
import { getRemainingCredits } from '@/shared/models/credit';
import { getUserInfo } from '@/shared/models/user';

const DAILY_FREE_LIMIT = 5;

export async function POST(request: Request) {
  // Rate limit: max 1 request per second per client
  const rateLimitResponse = enforceMinIntervalRateLimit(request, {
    intervalMs: 1000,
    keyPrefix: 'watermark-authorize',
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const user = await getUserInfo();

    if (user) {
      // Authenticated user: check credits
      const remainingCredits = await getRemainingCredits(user.id);

      if (remainingCredits > 0) {
        return respData({
          allowed: true,
          mode: 'authenticated',
          remaining: remainingCredits,
          plan: remainingCredits >= 999000 ? 'pro' : 'free',
        });
      }

      // Authenticated but no credits — still give daily free allowance
      return respData({
        allowed: true,
        mode: 'authenticated_free',
        remaining: DAILY_FREE_LIMIT,
        plan: 'free',
      });
    }

    // Anonymous user: daily free limit (client-side enforced via localStorage)
    return respData({
      allowed: true,
      mode: 'anonymous',
      remaining: DAILY_FREE_LIMIT,
      plan: 'anonymous',
    });
  } catch (error) {
    console.error('Watermark authorize error:', error);
    return respErr('Authorization check failed');
  }
}
