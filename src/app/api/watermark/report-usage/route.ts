import { respData, respErr } from '@/shared/lib/resp';
import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';
import { getUserInfo } from '@/shared/models/user';
import { consumeCredits } from '@/shared/models/credit';

export async function POST(request: Request) {
  // Rate limit: max 1 request per 500ms
  const rateLimitResponse = enforceMinIntervalRateLimit(request, {
    intervalMs: 500,
    keyPrefix: 'watermark-report',
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { imageCount = 1 } = body;

    const user = await getUserInfo();

    if (user) {
      // Authenticated user: consume credits
      try {
        await consumeCredits({
          userId: user.id,
          credits: imageCount,
          scene: 'watermark_removal',
          description: `Watermark removal: ${imageCount} image(s)`,
        });
      } catch (err) {
        // Insufficient credits — still record but don't block
        console.warn('Credit consumption failed:', err);
      }
    }

    // Anonymous users: no server-side tracking needed
    return respData({ recorded: true });
  } catch (error) {
    console.error('Watermark report-usage error:', error);
    return respErr('Usage reporting failed');
  }
}
