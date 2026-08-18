import { NextRequest, NextResponse } from 'next/server';

import { removeWatermarkPureJS } from '@/shared/lib/pure-image';
import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';
import { respErr } from '@/shared/lib/resp';
import { findApikeyByKey } from '@/shared/models/apikey';
import { consumeCredits, getRemainingCredits } from '@/shared/models/credit';
import { getUserInfo } from '@/shared/models/user';

export const runtime = 'nodejs';

// Increase max request body size for large images (default is ~1MB in some environments)
export const config = {
  maxDuration: 60,
};

const DAILY_FREE_LIMIT = 5;

/**
 * Simple in-memory daily usage tracker for free users.
 * Resets when the date changes.
 */
const dailyUsageMap = new Map<string, { date: string; count: number }>();

function checkDailyFreeUsage(key: string): {
  allowed: boolean;
  remaining: number;
} {
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
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const contentLength = request.headers.get('content-length');
  const contentType = request.headers.get('content-type');
  const userAgent = request.headers.get('user-agent');
  console.log(`[remove-watermark] === Request received ===`);
  console.log(`[remove-watermark] Time: ${new Date().toISOString()}`);
  console.log(`[remove-watermark] Content-Length: ${contentLength}`);
  console.log(`[remove-watermark] Content-Type: ${contentType?.slice(0, 80)}`);
  console.log(`[remove-watermark] User-Agent: ${userAgent?.slice(0, 100)}`);
  console.log(`[remove-watermark] URL: ${request.url}`);

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
            {
              code: -1,
              message:
                'Daily free limit reached (5 images/day). Purchase credits for unlimited use.',
              data: { remaining: 0, plan: 'free' },
            },
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
          {
            code: -1,
            message:
              'Daily free limit reached (5 images/day). Sign in and purchase credits for unlimited use.',
            data: { remaining: 0, plan: 'anonymous' },
          },
          { status: 403 }
        );
      }
    }

    // Parse image from form data
    console.log(
      `[remove-watermark] Parsing formData... (+${Date.now() - startTime}ms)`
    );
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return respErr(
        'No image provided. Please use the "image" field in multipart/form-data.'
      );
    }

    console.log(
      `[remove-watermark] formData parsed (+${Date.now() - startTime}ms), reading buffer...`
    );
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    console.log(
      `[remove-watermark] Input image size: ${buffer.length} bytes, type: ${imageFile.type} (+${Date.now() - startTime}ms)`
    );

    // Remove watermark using pure JS (works on Cloudflare Workers)
    console.log(
      `[remove-watermark] Starting watermark removal... (+${Date.now() - startTime}ms)`
    );
    const { buffer: resultBuffer, isJPEG } = removeWatermarkPureJS(buffer);
    console.log(
      `[remove-watermark] Watermark removed. Output: ${resultBuffer.length} bytes, isJPEG: ${isJPEG} (+${Date.now() - startTime}ms)`
    );

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

    // Return the result — use Response for maximum compatibility
    const respContentType = isJPEG ? 'image/jpeg' : 'image/png';
    const body = new Uint8Array(resultBuffer);
    console.log(
      `[remove-watermark] Responding with ${body.length} bytes, Content-Type: ${respContentType} (+${Date.now() - startTime}ms)`
    );

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': respContentType,
        'Content-Length': String(body.length),
      },
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    // Handle client disconnection gracefully
    const errorCode = (error as any)?.code;
    const errorMessage = error instanceof Error ? error.message : '';
    const isDisconnect =
      errorCode === 'ECONNRESET' ||
      errorCode === 'ECONNABORTED' ||
      errorCode === 'ERR_STREAM_PREMATURE_CLOSE' ||
      errorMessage === 'aborted' ||
      errorMessage.includes('aborted') ||
      errorMessage.includes('client disconnected');

    if (isDisconnect) {
      console.warn(
        `[remove-watermark] Client disconnected after ${elapsed}ms (code: ${errorCode}, msg: ${errorMessage})`
      );
      return new Response(null, { status: 499 }); // Nginx-style: client closed request
    }
    console.error(`[remove-watermark] Failed after ${elapsed}ms:`, error);
    return respErr(
      'Watermark removal failed: ' +
        (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}
