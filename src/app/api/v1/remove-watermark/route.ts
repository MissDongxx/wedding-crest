import { NextRequest, NextResponse } from 'next/server';
import { respErr } from '@/shared/lib/resp';
import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';
import { getUserInfo } from '@/shared/models/user';
import { getRemainingCredits, consumeCredits } from '@/shared/models/credit';
import { findApikeyByKey } from '@/shared/models/apikey';
import { removeWatermarkPureJS } from '@/shared/lib/pure-image';

export const runtime = 'nodejs';

const DAILY_FREE_LIMIT = 5;

/**
 * Simple in-memory daily usage tracker for free users.
 * Resets when the date changes.
 */
const dailyUsageMap = new Map<string, { date: string; count: number }>();

function checkDailyFreeUsage(key: string): { allowed: boolean; remaining: number } {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const usage = dailyUsageMap.get(key);

  if (!usage || usage.date !== today) {
    // New day or first use
    dailyUsageMap.set(key, { date: today, count: 1 });
    return { allowed: true, remaining: DAILY_FREE_LIMIT - 1 };
  }

  if (usage.count >= DAILY_FREE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  usage.count += 1;
  return { allowed: true, remaining: DAILY_FREE_LIMIT - usage.count };
}

/**
 * Authenticate user via API Key or session.
 * Returns user ID if authenticated, null otherwise.
 */
async function authenticateUser(request: NextRequest): Promise<string | null> {
  // 1. Try API Key from Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.slice(7).trim();
    if (apiKey) {
      const keyRecord = await findApikeyByKey(apiKey);
      if (keyRecord?.userId) {
        return keyRecord.userId;
      }
    }
  }

  // 2. Try API Key from URL query parameter (for shortcuts)
  const urlKey = request.nextUrl.searchParams.get('key');
  if (urlKey) {
    const keyRecord = await findApikeyByKey(urlKey);
    if (keyRecord?.userId) {
      return keyRecord.userId;
    }
  }

  // 3. Fallback to session-based auth (for web users)
  const user = await getUserInfo();
  return user?.id || null;
}

/**
 * Get client IP for daily free usage tracking.
 */
function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

export async function POST(request: NextRequest) {
  // Rate limit: max 1 request per 2 seconds per client
  const rateLimitResponse = enforceMinIntervalRateLimit(request, {
    intervalMs: 2000,
    keyPrefix: 'remove-watermark',
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Authenticate user
    const userId = await authenticateUser(request);
    let isMember = false;

    if (userId) {
      const remainingCredits = await getRemainingCredits(userId);
      if (remainingCredits > 0) {
        // Member with credits: unlimited use
        isMember = true;
      } else {
        // Authenticated but no credits: fall back to daily free limit
        const freeKey = `user:${userId}`;
        const { allowed, remaining } = checkDailyFreeUsage(freeKey);
        if (!allowed) {
          return NextResponse.json(
            { code: -1, message: 'Daily free limit reached (5 images/day). Purchase credits for unlimited use.', data: { remaining: 0, plan: 'free' } },
            { status: 403 }
          );
        }
      }
    } else {
      // Anonymous user: daily free limit tracked by IP
      const clientIp = getClientIp(request);
      const freeKey = `ip:${clientIp}`;
      const { allowed, remaining } = checkDailyFreeUsage(freeKey);
      if (!allowed) {
        return NextResponse.json(
          { code: -1, message: 'Daily free limit reached (5 images/day). Sign in and purchase credits for unlimited use.', data: { remaining: 0, plan: 'anonymous' } },
          { status: 403 }
        );
      }
    }

    // Parse image from form data
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return respErr('No image provided. Please use the "image" field in multipart/form-data.');
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer());

    // Remove watermark using pure JS (works on Cloudflare Workers)
    const { buffer: resultBuffer, isJPEG } = removeWatermarkPureJS(buffer);

    // Consume credits for members only
    if (isMember && userId) {
      try {
        await consumeCredits({
          userId,
          credits: 1,
          scene: 'watermark_removal',
          description: 'Watermark removal: 1 image (Shortcut API)',
        });
      } catch (creditErr) {
        console.warn('Credit consumption failed:', creditErr);
      }
    }

    // Return the result
    return new NextResponse(new Uint8Array(resultBuffer), {
      headers: {
        'Content-Type': isJPEG ? 'image/jpeg' : 'image/png',
        'Content-Disposition': `attachment; filename="clean-image-from-remove-gemini-watermark.${isJPEG ? 'jpg' : 'png'}"`,
      },
    });
  } catch (error) {
    console.error('Server-side watermark removal failed:', error);
    return respErr('Watermark removal failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}
