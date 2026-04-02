/**
 * Core watermark removal using reverse alpha blending.
 *
 * Algorithm: original = (composed - watermark × α) / (1 − α)
 *
 * This mathematically recovers the original pixel values from the
 * watermarked image, given the known watermark alpha map and logo pixels.
 *
 * All processing happens client-side via Canvas API.
 * No image data is uploaded to any server.
 */
import { getAlphaMap, getLogoPixels } from './alpha-map';
import type { WatermarkParams } from './types';

/**
 * Auto-detect watermark size based on image dimensions.
 * Gemini uses 48×48 for images ≤1024px, 96×96 for larger.
 */
function getWatermarkParams(width: number, height: number): WatermarkParams {
  return width > 1024 && height > 1024
    ? { size: 96, margin: 32 }
    : { size: 48, margin: 32 };
}

/**
 * Remove Gemini watermark from an OffscreenCanvas.
 *
 * @param canvas - OffscreenCanvas containing the watermarked image
 * @returns true if watermark pixels were modified, false if nothing was changed
 */
export async function removeWatermark(
  canvas: OffscreenCanvas
): Promise<boolean> {
  const { width, height } = canvas;
  const { size: wmSize, margin } = getWatermarkParams(width, height);

  // Load alpha map and logo pixels in parallel
  const [alphaMap, logoPixels] = await Promise.all([
    getAlphaMap(wmSize),
    getLogoPixels(wmSize),
  ]);

  const ctx = canvas.getContext('2d')!;

  // Watermark position (bottom-right corner)
  const x0 = width - margin - wmSize;
  const y0 = height - margin - wmSize;

  // Bounds check
  if (x0 < 0 || y0 < 0) return false;

  const imageData = ctx.getImageData(x0, y0, wmSize, wmSize);
  const data = imageData.data;
  let modified = false;

  for (let i = 0; i < wmSize * wmSize; i++) {
    const alpha = alphaMap[i];
    if (alpha < 0.01) continue; // Skip near-transparent pixels

    const denominator = 1 - alpha;
    if (denominator < 0.01) continue; // Avoid division by near-zero

    const idx = i * 4;

    // Reverse alpha blending for R, G, B channels
    // Formula: original = (composed - watermark × α) / (1 − α)
    for (let c = 0; c < 3; c++) {
      const composed = data[idx + c];
      const wmPixel = logoPixels[idx + c];
      const original = (composed - wmPixel * alpha) / denominator;
      data[idx + c] = Math.max(0, Math.min(255, Math.round(original)));
    }
    // Alpha channel (idx + 3) stays unchanged

    modified = true;
  }

  if (modified) {
    ctx.putImageData(imageData, x0, y0);
  }

  return modified;
}
