import { NextRequest, NextResponse } from 'next/server';
import { respErr } from '@/shared/lib/resp';
import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';
import { getUserInfo } from '@/shared/models/user';
import { getRemainingCredits, consumeCredits } from '@/shared/models/credit';
import { findApikeyByKey } from '@/shared/models/apikey';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import fs from 'fs';

// Force nodejs runtime for 'canvas'
export const runtime = 'nodejs';

const DAILY_FREE_LIMIT = 5;

/**
 * GEMINI WATERMARK PARAMETERS
 */
interface WatermarkParams {
  size: number;
  margin: number;
}

function getWatermarkParams(width: number, height: number): WatermarkParams {
  return width > 1024 && height > 1024
    ? { size: 96, margin: 64 }
    : { size: 48, margin: 32 };
}

/**
 * ALPHA MAP LOADER (SERVER-SIDE)
 */
const ALPHA_MAP_CACHE: Record<number, Float32Array> = {};

async function getServerAlphaMap(size: number): Promise<Float32Array> {
  if (ALPHA_MAP_CACHE[size]) return ALPHA_MAP_CACHE[size];

  // Resolve path to the public assets
  const assetPath = path.join(process.cwd(), 'public', 'watermark-assets', `bg_${size}.png`);

  if (!fs.existsSync(assetPath)) {
    throw new Error(`Watermark asset not found: ${assetPath}`);
  }

  const img = await loadImage(assetPath);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, size, size);
  const pixels = imageData.data;

  const alphaMap = new Float32Array(size * size);
  for (let i = 0; i < alphaMap.length; i++) {
    const idx = i * 4;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    alphaMap[i] = Math.max(r, g, b) / 255.0;
  }

  ALPHA_MAP_CACHE[size] = alphaMap;
  return alphaMap;
}

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

    // 1. Load the original image
    const image = await loadImage(buffer);
    const { width, height } = image;

    // 2. Setup canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    // 3. Determine watermark position and size
    const { size: wmSize, margin } = getWatermarkParams(width, height);
    const x0 = width - margin - wmSize;
    const y0 = height - margin - wmSize;

    // 4. Run reverse alpha blending if within bounds
    if (x0 >= 0 && y0 >= 0) {
      const alphaMap = await getServerAlphaMap(wmSize);
      const imageData = ctx.getImageData(x0, y0, wmSize, wmSize);
      const data = imageData.data;

      let modified = false;
      for (let i = 0; i < wmSize * wmSize; i++) {
        const alpha = alphaMap[i];
        if (alpha < 0.01) continue;

        const denominator = 1 - alpha;
        if (denominator < 0.01) continue;

        const idx = i * 4;
        for (let c = 0; c < 3; c++) {
          const composed = data[idx + c];
          const original = (composed - 255 * alpha) / denominator;
          data[idx + c] = Math.max(0, Math.min(255, Math.round(original)));
        }
        modified = true;
      }

      if (modified) {
        ctx.putImageData(imageData, x0, y0);
      }
    }

    // 5. Consume credits for members only
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

    // 6. Return the result
    const resultBuffer = canvas.toBuffer('image/png');

    return new NextResponse(new Uint8Array(resultBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="clean-image-from-remove-gemini-watermark.png"',
      },
    });
  } catch (error) {
    console.error('Server-side watermark removal failed:', error);
    return respErr('Watermark removal failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}
