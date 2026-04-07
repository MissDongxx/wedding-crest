import { NextRequest, NextResponse } from 'next/server';
import { respErr } from '@/shared/lib/resp';
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
    // Gemini watermark is white (255, 255, 255) with variable alpha.
    // On black background: pixel = alpha * 255 + (1 - alpha) * 0 = alpha * 255
    // So alpha = pixel / 255
    alphaMap[i] = Math.max(r, g, b) / 255.0;
  }

  ALPHA_MAP_CACHE[size] = alphaMap;
  return alphaMap;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return respErr('No image provided. Please use the "image" key in multipart/form-data.');
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
          // Formula: original = (composed - logo * alpha) / (1 - alpha)
          // Since logo is white (255):
          const original = (composed - 255 * alpha) / denominator;
          data[idx + c] = Math.max(0, Math.min(255, Math.round(original)));
        }
        modified = true;
      }

      if (modified) {
        ctx.putImageData(imageData, x0, y0);
      }
    }

    // 5. Return the result
    const resultBuffer = canvas.toBuffer('image/png');

    return new NextResponse(new Uint8Array(resultBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="clean-image.png"',
      },
    });
  } catch (error) {
    console.error('Server-side watermark removal failed:', error);
    return respErr('Watermark removal failed: ' + (error instanceof Error ? error.message : String(error)));
  }
}
