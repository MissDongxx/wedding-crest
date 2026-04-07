/**
 * Client-side watermark detection engine.
 *
 * Compares image pixels against known watermark alpha maps to determine
 * if a visible Gemini watermark is present. Also provides a function to
 * run full metadata analysis on a file.
 */

import { getAlphaMap } from './alpha-map';
import type { DetectionResult, WatermarkType, DetectionConfidence } from './types';

/** Watermark candidate sizes with their default margins (right-bottom corner) */
const SIZE_CANDIDATES = [
  { size: 128, margin: 80 },
  { size: 96,  margin: 64 },
  { size: 72,  margin: 48 },
  { size: 48,  margin: 32 },
  { size: 32,  margin: 16 },
];

/** Pixel offsets to scan around the nominal position (handles slight misalignment) */
const POSITION_OFFSETS = [0, -8, -16];

/**
 * Detect if an image contains a Gemini watermark.
 *
 * Extracts the bottom-right corner region and compares it against
 * the known alpha map pattern. Tests multiple sizes and slight position
 * offsets to handle scaling and minor cropping.
 *
 * @param canvas - OffscreenCanvas with the loaded image
 * @returns DetectionResult with confidence and location
 */
export async function detectWatermark(
  canvas: OffscreenCanvas
): Promise<DetectionResult> {
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d')!;

  const candidates: Array<{
    size: number;
    margin: number;
    confidence: number;
    offsetX: number;
    offsetY: number;
  }> = [];

  for (const { size, margin } of SIZE_CANDIDATES) {
    // Only test sizes that have a corresponding alpha map asset
    const alphaMap = await tryGetAlphaMap(size);
    if (!alphaMap) continue;

    for (const dx of POSITION_OFFSETS) {
      for (const dy of POSITION_OFFSETS) {
        const x0 = width - margin - size + dx;
        const y0 = height - margin - size + dy;

        // Bounds check
        if (x0 < 0 || y0 < 0) continue;
        if (x0 + size > width || y0 + size > height) continue;

        const regionData = ctx.getImageData(x0, y0, size, size);
        // Sample surrounding background for adaptive comparison
        const bgBrightness = sampleBackgroundBrightness(ctx, x0, y0, size, width, height);
        const confidence = matchAlphaPattern(regionData, alphaMap, size, bgBrightness);

        candidates.push({ size, margin, confidence, offsetX: dx, offsetY: dy });
      }
    }
  }

  // Pick the best match
  const best = candidates.reduce(
    (prev, curr) => (curr.confidence > prev.confidence ? curr : prev),
    { size: 0, margin: 0, confidence: 0, offsetX: 0, offsetY: 0 }
  );

  const detected = best.confidence > 0.3;
  const confidenceLevel = getConfidenceLevel(best.confidence);

  return {
    detected,
    confidence: best.confidence,
    confidenceLevel,
    watermarkType: detected ? 'gemini' : 'none',
    location: detected
      ? {
          x: width - best.margin - best.size + best.offsetX,
          y: height - best.margin - best.size + best.offsetY,
          size: best.size,
        }
      : null,
    details: buildDetails(best, width, height),
  };
}

/**
 * Try to load alpha map, return null if the asset doesn't exist.
 */
async function tryGetAlphaMap(size: number): Promise<Float32Array | null> {
  try {
    return await getAlphaMap(size);
  } catch {
    return null;
  }
}

/**
 * Sample average brightness from the region surrounding the watermark area.
 * Uses pixels just outside the watermark rectangle to estimate background brightness.
 */
function sampleBackgroundBrightness(
  ctx: OffscreenCanvasRenderingContext2D,
  x0: number,
  y0: number,
  size: number,
  canvasWidth: number,
  canvasHeight: number
): number {
  // Sample a ring of pixels around the watermark region
  const band = 4; // pixels wide sample band
  let totalBrightness = 0;
  let count = 0;

  // Sample from the region above the watermark area
  const sampleY = Math.max(0, y0 - band);
  const sampleH = Math.min(band, y0);
  if (sampleH > 0) {
    const data = ctx.getImageData(x0, sampleY, size, sampleH);
    for (let i = 0; i < data.data.length; i += 4) {
      totalBrightness += (data.data[i] + data.data[i + 1] + data.data[i + 2]) / 3;
      count++;
    }
  }

  // Sample from the region to the left of the watermark area
  const sampleX = Math.max(0, x0 - band);
  const sampleW = Math.min(band, x0);
  if (sampleW > 0) {
    const data = ctx.getImageData(sampleX, y0, sampleW, size);
    for (let i = 0; i < data.data.length; i += 4) {
      totalBrightness += (data.data[i] + data.data[i + 1] + data.data[i + 2]) / 3;
      count++;
    }
  }

  return count > 0 ? totalBrightness / count : 128;
}

/**
 * Compare a region of pixels against the known alpha map.
 *
 * Strategy: For each pixel where the alpha map has significant opacity,
 * check if the pixel is brighter than the surrounding background, proportional
 * to the expected watermark alpha contribution.
 */
function matchAlphaPattern(
  regionData: ImageData,
  alphaMap: Float32Array,
  size: number,
  bgBrightness: number
): number {
  const pixels = regionData.data;
  let matchScore = 0;
  let testCount = 0;

  for (let i = 0; i < size * size; i++) {
    const expectedAlpha = alphaMap[i];
    // Only test pixels where the watermark has meaningful opacity
    if (expectedAlpha < 0.05) continue;

    const idx = i * 4;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    const brightness = (r + g + b) / 3;

    // The Gemini watermark is white/semi-transparent.
    // Watermarked pixel brightness ≈ bgBrightness * (1 - alpha) + 255 * alpha
    // Expected elevation above background: alpha * (255 - bgBrightness)
    // We require at least 40% of the expected elevation as a minimum threshold
    const expectedElevation = expectedAlpha * (255 - bgBrightness) * 0.4;
    const minBrightness = bgBrightness + expectedElevation;

    if (
      brightness >= minBrightness &&
      brightness <= 255
    ) {
      matchScore++;
    }

    testCount++;
  }

  return testCount > 0 ? matchScore / testCount : 0;
}

function getConfidenceLevel(confidence: number): DetectionConfidence {
  if (confidence > 0.7) return 'detected';
  if (confidence > 0.3) return 'possible';
  return 'not_detected';
}

function buildDetails(
  best: { size: number; margin: number; confidence: number; offsetX: number; offsetY: number },
  width: number,
  height: number
): string {
  if (best.confidence < 0.3) {
    return 'No watermark detected. The image does not appear to contain a known AI watermark pattern.';
  }

  const size = best.size;
  const percentage = Math.round(best.confidence * 100);
  const level = best.confidence > 0.7 ? 'High' : 'Moderate';
  const offsetInfo = (best.offsetX !== 0 || best.offsetY !== 0)
    ? ` (offset: ${best.offsetX},${best.offsetY})`
    : '';

  return (
    `${level} confidence (${percentage}%) match for Gemini watermark pattern ` +
    `(${size}x${size}px at bottom-right corner, margin: ${best.margin}px${offsetInfo}). ` +
    `Image dimensions: ${width}x${height}px.`
  );
}
