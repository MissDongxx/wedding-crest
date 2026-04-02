/**
 * Alpha Map loader with in-memory caching.
 * Loads pre-computed alpha maps from /public/alpha-maps/
 * and watermark logo pixels from /public/watermark-logos/
 *
 * All data stays client-side — no server upload.
 */

const ALPHA_MAP_CACHE: Record<number, Float32Array> = {};
const LOGO_CACHE: Record<number, Uint8ClampedArray> = {};

/**
 * Load a pre-computed alpha map for the Gemini watermark.
 * Alpha maps are Float32Array binaries where each value [0..1]
 * represents the opacity of the watermark at that pixel.
 */
export async function getAlphaMap(size: number): Promise<Float32Array> {
  if (ALPHA_MAP_CACHE[size]) return ALPHA_MAP_CACHE[size];

  const response = await fetch(`/alpha-maps/gemini-${size}.bin`);
  if (!response.ok) {
    throw new Error(`Alpha map not found: gemini-${size}.bin (status ${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  const alphaMap = new Float32Array(buffer);
  ALPHA_MAP_CACHE[size] = alphaMap;
  return alphaMap;
}

/**
 * Load watermark logo pixel data (RGBA).
 * Uses OffscreenCanvas to decode the PNG logo in the browser.
 */
export async function getLogoPixels(size: number): Promise<Uint8ClampedArray> {
  if (LOGO_CACHE[size]) return LOGO_CACHE[size];

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = `/watermark-logos/gemini-${size}.png`;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load watermark logo: gemini-${size}.png`));
  });

  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, size, size).data;
  LOGO_CACHE[size] = pixels;
  return pixels;
}
