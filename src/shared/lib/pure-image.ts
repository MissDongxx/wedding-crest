/**
 * Pure JavaScript watermark removal — no Canvas API needed.
 * Works in Cloudflare Workers and other non-browser environments.
 *
 * Uses pngjs / jpeg-js for image decode/encode and the same
 * reverse-alpha-blending algorithm as the client-side remover.
 *
 * Loads the SAME pre-captured watermark alpha maps as the client-side
 * code (from public/watermark-assets/) for pixel-perfect accuracy.
 */
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Alpha map loading from pre-captured watermark images (same as client-side)
// ---------------------------------------------------------------------------

const ALPHA_MAP_CACHE: Record<number, Float32Array> = {};

/**
 * Load the pre-captured watermark on black background and compute alpha map.
 * This is the exact same algorithm as client-side alpha-map.ts:
 *   alpha = max(R, G, B) / 255
 */
function getAlphaMap(size: number): Float32Array {
  if (ALPHA_MAP_CACHE[size]) return ALPHA_MAP_CACHE[size];

  const filePath = join(process.cwd(), 'public', 'watermark-assets', `bg_${size}.png`);
  const fileBuffer = readFileSync(filePath);
  const png = PNG.sync.read(fileBuffer);

  const alphaMap = new Float32Array(size * size);
  for (let i = 0; i < alphaMap.length; i++) {
    const idx = i * 4;
    const r = png.data[idx];
    const g = png.data[idx + 1];
    const b = png.data[idx + 2];
    alphaMap[i] = Math.max(r, g, b) / 255.0;
  }

  ALPHA_MAP_CACHE[size] = alphaMap;
  return alphaMap;
}

// ---------------------------------------------------------------------------
// Watermark size auto-detection (same logic as remover.ts)
// ---------------------------------------------------------------------------

function getWatermarkParams(width: number, height: number) {
  return width > 1024 && height > 1024
    ? { size: 96, margin: 64 }
    : { size: 48, margin: 32 };
}

// ---------------------------------------------------------------------------
// Core: remove watermark from raw RGBA pixels
// ---------------------------------------------------------------------------

function removeWatermarkFromRGBA(
  pixels: Uint8Array,
  width: number,
  height: number,
): boolean {
  const { size: wmSize, margin } = getWatermarkParams(width, height);
  const alphaMap = getAlphaMap(wmSize);

  const x0 = width - margin - wmSize;
  const y0 = height - margin - wmSize;

  if (x0 < 0 || y0 < 0) return false;

  let modified = false;

  for (let wy = 0; wy < wmSize; wy++) {
    for (let wx = 0; wx < wmSize; wx++) {
      const alpha = alphaMap[wy * wmSize + wx];
      if (alpha < 0.01) continue;

      const denominator = 1 - alpha;
      if (denominator < 0.01) continue;

      const idx = ((y0 + wy) * width + (x0 + wx)) * 4;

      for (let c = 0; c < 3; c++) {
        const composed = pixels[idx + c];
        const original = (composed - 255 * alpha) / denominator;
        pixels[idx + c] = Math.max(0, Math.min(255, Math.round(original)));
      }

      modified = true;
    }
  }

  return modified;
}

// ---------------------------------------------------------------------------
// Detect JPEG by magic bytes
// ---------------------------------------------------------------------------

function isJPEG(buffer: Buffer): boolean {
  return buffer[0] === 0xff && buffer[1] === 0xd8;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Remove Gemini watermark from an image buffer using pure JavaScript.
 *
 * @param buffer - Raw image file bytes (PNG or JPEG)
 * @returns Object with the processed buffer and a flag indicating JPEG format
 */
export function removeWatermarkPureJS(buffer: Buffer): {
  buffer: Buffer;
  isJPEG: boolean;
} {
  const jpegInput = isJPEG(buffer);

  let width: number;
  let height: number;
  let rgba: Buffer;

  if (jpegInput) {
    const decoded = jpeg.decode(buffer, { maxMemoryUsageInMB: 1024 });
    width = decoded.width;
    height = decoded.height;
    rgba = Buffer.from(decoded.data);
  } else {
    const png = PNG.sync.read(buffer);
    width = png.width;
    height = png.height;
    rgba = png.data;
  }

  removeWatermarkFromRGBA(rgba, width, height);

  if (jpegInput) {
    const encoded = jpeg.encode(
      { width, height, data: rgba as Buffer },
      92,
    );
    return { buffer: Buffer.from(encoded.data), isJPEG: true };
  } else {
    const outPng = new PNG({ width, height });
    rgba.copy(outPng.data);
    const encoded = PNG.sync.write(outPng);
    return { buffer: encoded, isJPEG: false };
  }
}
