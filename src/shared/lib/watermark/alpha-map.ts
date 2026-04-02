/**
 * Alpha Map loader with in-memory caching.
 * Loads pre-captured watermark images (on black background) and computes
 * the exact alpha map from them using the formula:
 *
 *   alpha = max(R, G, B) / 255
 *
 * This gives us the precise per-pixel opacity of the actual Gemini watermark,
 * rather than a synthetic approximation.
 *
 * All data stays client-side — no server upload.
 */

const ALPHA_MAP_CACHE: Record<number, Float32Array> = {};

/**
 * Load and compute the alpha map from a pre-captured watermark image.
 * The bg capture is a PNG of the Gemini watermark on a pure black background.
 * On black: watermarked = alpha * 255 + (1 - alpha) * 0 = alpha * 255
 * So alpha = max(R, G, B) / 255
 */
export async function getAlphaMap(size: number): Promise<Float32Array> {
  if (ALPHA_MAP_CACHE[size]) return ALPHA_MAP_CACHE[size];

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = `/watermark-assets/bg_${size}.png`;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () =>
      reject(
        new Error(`Failed to load watermark capture: bg_${size}.png`)
      );
  });

  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, size, size).data;

  // Compute alpha map from the bg capture
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
