/**
 * Pure JavaScript watermark removal — no Canvas API needed.
 * Works in Cloudflare Workers and other non-browser environments.
 *
 * Uses pngjs / jpeg-js for image decode/encode and the same
 * reverse-alpha-blending algorithm as the client-side remover.
 *
 * Alpha maps are pre-computed and embedded to avoid filesystem reads.
 *
 * IMPORTANT: pngjs's sync-inflate uses `Inflate.call(this, opts)` which
 * breaks in Cloudflare Workers where zlib classes are ES6 classes.
 * We handle this by catching the error at decode time and falling back
 * to a manual zlib.inflateSync-based PNG decode.
 */
import zlib from 'zlib';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

import { getEmbeddedAlphaMap } from './alpha-maps';

// ---------------------------------------------------------------------------
// Fallback PNG read using zlib.inflateSync directly
// ---------------------------------------------------------------------------
// When pngjs's PNG.sync.read fails due to the Cloudflare Workers zlib class
// issue, we fall back to this manual implementation.

function pngReadFallback(buffer: Buffer): {
  width: number;
  height: number;
  data: Buffer;
} {
  // Minimal PNG parser — handles standard non-interlaced RGBA/RGB/grayscale PNGs
  const signature = buffer.slice(0, 8);
  if (
    signature[0] !== 0x89 ||
    signature[1] !== 0x50 ||
    signature[2] !== 0x4e ||
    signature[3] !== 0x47
  ) {
    throw new Error('Not a valid PNG file');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.slice(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length; // 4 (length) + 4 (type) + length + 4 (crc)
  }

  if (width === 0 || height === 0) {
    throw new Error('Invalid PNG: missing IHDR');
  }

  // Decompress IDAT data
  const compressed = Buffer.concat(idatChunks);
  const raw = zlib.inflateSync(compressed);

  // Determine bytes per pixel based on color type
  let bpp: number;
  switch (colorType) {
    case 0:
      bpp = 1;
      break; // Grayscale
    case 2:
      bpp = 3;
      break; // RGB
    case 4:
      bpp = 2;
      break; // Grayscale + Alpha
    case 6:
      bpp = 4;
      break; // RGBA
    default:
      throw new Error(`Unsupported PNG color type: ${colorType}`);
  }
  if (bitDepth !== 8) {
    throw new Error(
      `Unsupported PNG bit depth: ${bitDepth}, only 8-bit is supported`
    );
  }

  const stride = width * bpp + 1; // +1 for filter byte
  const rgba = Buffer.alloc(width * height * 4);

  // Decode each scanline (undo filtering)
  for (let y = 0; y < height; y++) {
    const filterType = raw[y * stride];
    const scanline = raw.slice(y * stride + 1, (y + 1) * stride);
    const prevLine =
      y > 0
        ? raw.slice((y - 1) * stride + 1, y * stride)
        : Buffer.alloc(width * bpp);

    // Apply PNG filter
    for (let x = 0; x < width * bpp; x++) {
      const a = x >= bpp ? scanline[x - bpp] : 0;
      const b = prevLine[x];
      const c = x >= bpp ? prevLine[x - bpp] : 0;

      switch (filterType) {
        case 0:
          break; // None
        case 1:
          scanline[x] = (scanline[x] + a) & 0xff;
          break; // Sub
        case 2:
          scanline[x] = (scanline[x] + b) & 0xff;
          break; // Up
        case 3:
          scanline[x] = (scanline[x] + ((a + b) >> 1)) & 0xff;
          break; // Average
        case 4: {
          // Paeth
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          scanline[x] =
            (scanline[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) &
            0xff;
          break;
        }
      }
    }

    // Convert to RGBA
    for (let x = 0; x < width; x++) {
      const dstIdx = (y * width + x) * 4;
      switch (colorType) {
        case 0: // Grayscale
          rgba[dstIdx] = rgba[dstIdx + 1] = rgba[dstIdx + 2] = scanline[x];
          rgba[dstIdx + 3] = 255;
          break;
        case 2: // RGB
          rgba[dstIdx] = scanline[x * 3];
          rgba[dstIdx + 1] = scanline[x * 3 + 1];
          rgba[dstIdx + 2] = scanline[x * 3 + 2];
          rgba[dstIdx + 3] = 255;
          break;
        case 4: // Grayscale + Alpha
          rgba[dstIdx] = rgba[dstIdx + 1] = rgba[dstIdx + 2] = scanline[x * 2];
          rgba[dstIdx + 3] = scanline[x * 2 + 1];
          break;
        case 6: // RGBA
          rgba[dstIdx] = scanline[x * 4];
          rgba[dstIdx + 1] = scanline[x * 4 + 1];
          rgba[dstIdx + 2] = scanline[x * 4 + 2];
          rgba[dstIdx + 3] = scanline[x * 4 + 3];
          break;
      }
    }
  }

  return { width, height, data: rgba };
}

/**
 * Safely read a PNG buffer, falling back to manual decode if pngjs fails
 * (Cloudflare Workers zlib class issue).
 */
function safePngRead(buffer: Buffer): {
  width: number;
  height: number;
  data: Buffer;
} {
  try {
    return PNG.sync.read(buffer);
  } catch (err: any) {
    if (
      err?.message?.includes('cannot be invoked without') ||
      err?.message?.includes('is not a constructor') ||
      err?.message?.includes('zlib binding closed')
    ) {
      console.warn(
        '[pure-image] pngjs sync-inflate failed, using fallback decoder:',
        err.message
      );
      return pngReadFallback(buffer);
    }
    throw err;
  }
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
  height: number
): boolean {
  const { size: wmSize, margin } = getWatermarkParams(width, height);
  const alphaMap = getEmbeddedAlphaMap(wmSize);

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

type Rgb = [number, number, number];

function readRgb(data: Uint8Array, index: number): Rgb {
  return [data[index], data[index + 1], data[index + 2]];
}

function isNeutral(color: Rgb) {
  return Math.max(...color) - Math.min(...color) <= 28;
}

function luminance(color: Rgb) {
  return color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  values.sort((left, right) => left - right);
  return values[Math.floor(values.length / 2)];
}

/** Detect an opaque checkerboard painted into an AI image. */
function hasGeneratedCheckerboard(
  data: Uint8Array,
  width: number,
  height: number
) {
  const sampleStep = Math.max(2, Math.floor(Math.min(width, height) / 180));

  for (let xCells = 12; xCells <= 96; xCells += 1) {
    const tile = width / xCells;
    if (tile < 6 || tile > 128) continue;
    const yCells = Math.max(2, Math.round(height / tile));
    const groups: [number[], number[]] = [[], []];

    for (let cy = 0; cy < yCells; cy += 1) {
      for (let cx = 0; cx < xCells; cx += 1) {
        const x = Math.min(width - 1, Math.floor((cx + 0.5) * tile));
        const y = Math.min(height - 1, Math.floor((cy + 0.5) * tile));
        const inCorner =
          (x < width * 0.2 || x >= width * 0.8) &&
          (y < height * 0.2 || y >= height * 0.8);
        if (!inCorner) continue;
        const color = readRgb(data, (y * width + x) * 4);
        if (isNeutral(color)) groups[(cx + cy) % 2].push(luminance(color));
      }
    }

    if (groups[0].length < 12 || groups[1].length < 12) continue;
    const centers = [median(groups[0]), median(groups[1])];
    if (Math.abs(centers[0] - centers[1]) < 28) continue;

    let matching = 0;
    let considered = 0;
    for (let y = 0; y < height; y += sampleStep) {
      for (let x = 0; x < width; x += sampleStep) {
        const inCorner =
          (x < width * 0.2 || x >= width * 0.8) &&
          (y < height * 0.2 || y >= height * 0.8);
        if (!inCorner) continue;
        const color = readRgb(data, (y * width + x) * 4);
        if (!isNeutral(color)) continue;
        const value = luminance(color);
        const distances = centers.map((center) => Math.abs(value - center));
        if (Math.min(...distances) > 30) continue;
        const actual = distances[0] <= distances[1] ? 0 : 1;
        const expected = (Math.floor(x / tile) + Math.floor(y / tile)) % 2;
        considered += 1;
        if (actual === expected) matching += 1;
      }
    }

    if (considered >= 180 && matching / considered >= 0.9) return true;
  }

  return false;
}

export interface WhiteBackgroundNormalization {
  buffer: Buffer;
  changed: boolean;
  checkerboardDetected: boolean;
}

/**
 * Flatten genuine PNG alpha onto white and identify fake painted
 * checkerboards. Painted checkerboards are reported rather than destructively
 * color-keyed because their gray pixels are indistinguishable from gray
 * lettering, pets and line art.
 */
export function normalizeImageBackgroundToWhite(
  buffer: Buffer
): WhiteBackgroundNormalization {
  if (
    buffer.length < 8 ||
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4e ||
    buffer[3] !== 0x47
  ) {
    return { buffer, changed: false, checkerboardDetected: false };
  }

  let decoded: { width: number; height: number; data: Buffer };
  try {
    decoded = safePngRead(buffer);
  } catch {
    return { buffer, changed: false, checkerboardDetected: false };
  }

  const { width, height, data } = decoded;
  const pixelCount = width * height;
  let hasAlpha = false;
  for (let offset = 3; offset < data.length; offset += 4) {
    if (data[offset] < 255) {
      hasAlpha = true;
      break;
    }
  }

  const checkerboardDetected =
    !hasAlpha && hasGeneratedCheckerboard(data, width, height);
  if (!hasAlpha) {
    return { buffer, changed: false, checkerboardDetected };
  }

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4;
    const alpha = data[offset + 3] / 255;
    data[offset] = Math.round(data[offset] * alpha + 255 * (1 - alpha));
    data[offset + 1] = Math.round(data[offset + 1] * alpha + 255 * (1 - alpha));
    data[offset + 2] = Math.round(data[offset + 2] * alpha + 255 * (1 - alpha));
    data[offset + 3] = 255;
  }

  const output = new PNG({ width, height });
  data.copy(output.data);
  return {
    buffer: PNG.sync.write(output),
    changed: true,
    checkerboardDetected: false,
  };
}

// Keep the previous export name available for any hot-reloaded route module
// that still references it while Turbopack refreshes the dependency graph.
export const normalizeCheckerboardTransparency =
  normalizeImageBackgroundToWhite;

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
    const png = safePngRead(buffer);
    width = png.width;
    height = png.height;
    rgba = png.data;
  }

  removeWatermarkFromRGBA(rgba, width, height);

  if (jpegInput) {
    const encoded = jpeg.encode({ width, height, data: rgba as Buffer }, 92);
    return { buffer: Buffer.from(encoded.data), isJPEG: true };
  } else {
    const outPng = new PNG({ width, height });
    rgba.copy(outPng.data);
    const encoded = PNG.sync.write(outPng);
    return { buffer: encoded, isJPEG: false };
  }
}
