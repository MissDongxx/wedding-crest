/**
 * Generate synthetic Gemini watermark alpha maps and logo files.
 *
 * Uses pure JavaScript (no native dependencies) to create:
 *   - public/alpha-maps/gemini-48.bin (Float32Array)
 *   - public/alpha-maps/gemini-96.bin (Float32Array)
 *   - public/watermark-logos/gemini-48.png
 *   - public/watermark-logos/gemini-96.png
 *
 * The Gemini watermark is a semi-transparent 4-pointed star (✦).
 *
 * Usage: npx tsx scripts/generate-alpha-maps.ts
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Compute distance from point (px, py) to the 4-pointed star shape.
 * Returns 0 if inside, positive if outside.
 * The star is defined by polar equation with 4 points.
 */
function starSDF(
  px: number,
  py: number,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  points: number
): number {
  const dx = px - cx;
  const dy = py - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  // Compute the star radius at this angle
  const sector = (2 * Math.PI) / points;
  const halfSector = sector / 2;

  // Normalize angle to [0, sector)
  let a = ((angle % sector) + sector) % sector;
  if (a > halfSector) a = sector - a;

  // Linear interpolation between inner and outer radius
  const t = a / halfSector; // 0 at peak, 1 at valley
  const starR = outerR * (1 - t) + innerR * t;

  return dist - starR;
}

/**
 * Generate a minimal valid PNG from RGBA pixel data.
 * This creates a valid PNG without any external libraries.
 */
function createPNG(width: number, height: number, rgba: Uint8Array): Buffer {
  // PNG generation using zlib
  const zlib = require('zlib');

  // Build raw pixel data with filter bytes (filter = 0, None)
  const rawData = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    rawData[y * (width * 4 + 1)] = 0; // filter byte: None
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * (width * 4 + 1) + 1 + x * 4;
      rawData[dstIdx] = rgba[srcIdx];       // R
      rawData[dstIdx + 1] = rgba[srcIdx + 1]; // G
      rawData[dstIdx + 2] = rgba[srcIdx + 2]; // B
      rawData[dstIdx + 3] = rgba[srcIdx + 3]; // A
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // CRC32 lookup table
  const crcTable: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }

  function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function createChunk(type: string, data: Buffer): Buffer {
    const typeBuffer = Buffer.from(type, 'ascii');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crcInput = Buffer.concat([typeBuffer, data]);
    const crcValue = Buffer.alloc(4);
    crcValue.writeUInt32BE(crc32(crcInput));
    return Buffer.concat([length, typeBuffer, data, crcValue]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', compressed),
    createChunk('IEND', Buffer.alloc(0)),
  ]);
}

function generate(size: number) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.42;
  const innerR = size * 0.10;
  const points = 4;
  const edgeSoftness = 2.0; // pixels of anti-aliasing

  const alphaMap = new Float32Array(size * size);
  const rgba = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;

      // Compute signed distance from star shape
      const d = starSDF(x + 0.5, y + 0.5, cx, cy, outerR, innerR, points);

      // Smooth alpha: fully opaque inside, smooth falloff at edges
      let alpha: number;
      if (d < -edgeSoftness) {
        alpha = 0.35; // Core opacity matching Gemini watermark
      } else if (d < edgeSoftness) {
        // Smooth edge transition
        const t = (d + edgeSoftness) / (2 * edgeSoftness);
        alpha = 0.35 * (1 - t * t * (3 - 2 * t)); // smoothstep
      } else {
        alpha = 0;
      }

      alphaMap[i] = alpha;

      // Logo pixels: white with computed alpha
      const idx = i * 4;
      rgba[idx] = 255;     // R
      rgba[idx + 1] = 255; // G
      rgba[idx + 2] = 255; // B
      rgba[idx + 3] = Math.round(alpha * 255); // A
    }
  }

  // Save alpha map binary
  const alphaDir = join(process.cwd(), 'public', 'alpha-maps');
  mkdirSync(alphaDir, { recursive: true });
  writeFileSync(
    join(alphaDir, `gemini-${size}.bin`),
    Buffer.from(alphaMap.buffer)
  );

  // Save logo PNG
  const logoDir = join(process.cwd(), 'public', 'watermark-logos');
  mkdirSync(logoDir, { recursive: true });
  const pngBuffer = createPNG(size, size, rgba);
  writeFileSync(join(logoDir, `gemini-${size}.png`), pngBuffer);

  console.log(
    `✓ Generated gemini-${size}: alpha-map (${alphaMap.length * 4} bytes) + logo PNG (${pngBuffer.length} bytes)`
  );
}

// Generate both sizes
console.log('Generating Gemini watermark alpha maps...\n');
generate(48);
generate(96);
console.log(
  '\n✓ Done! Files saved to public/alpha-maps/ and public/watermark-logos/'
);
