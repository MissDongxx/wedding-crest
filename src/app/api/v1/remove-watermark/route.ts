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

  // 2. Fallback to session-based auth (for web users)
  const user = await getUserInfo();
  return user?.id || null;
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

    if (!userId) {
      return NextResponse.json(
        { code: -1, message: 'Authentication required. Please provide a valid API Key via Authorization header (Bearer <key>).' },
        { status: 401 }
      );
    }

    // Check remaining credits
    const remainingCredits = await getRemainingCredits(userId);
    if (remainingCredits <= 0) {
      return NextResponse.json(
        { code: -1, message: 'Insufficient credits. Please purchase credits to continue.', data: { remainingCredits } },
        { status: 403 }
      );
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

    // 5. Consume credits after successful processing
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
