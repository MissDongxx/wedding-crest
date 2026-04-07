/**
 * Client-side metadata analysis for images.
 *
 * Parses binary headers to detect Exif, C2PA, IPTC, and XMP metadata.
 * All processing is local — no server upload needed.
 *
 * Note: The Canvas API already strips all metadata when rendering to a
 * new canvas and calling convertToBlob(). This module is for detecting
 * what metadata exists in the original file so we can inform the user.
 */

import type { MetadataInfo } from './types';

/**
 * Analyze an image file's metadata by reading its binary headers.
 * Works with JPEG, PNG, and WebP formats.
 */
export async function analyzeMetadata(file: File): Promise<MetadataInfo> {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  const result: MetadataInfo = {
    hasExif: false,
    hasC2PA: false,
    hasIPTC: false,
    hasXMP: false,
    details: [],
  };

  const type = detectFileType(bytes);

  if (type === 'jpeg') {
    analyzeJPEG(view, bytes, result);
  } else if (type === 'png') {
    analyzePNG(view, bytes, result);
  } else if (type === 'webp') {
    analyzeWebP(view, bytes, result);
  }

  return result;
}

function detectFileType(bytes: Uint8Array): 'jpeg' | 'png' | 'webp' | 'unknown' {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png';
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }
  return 'unknown';
}

/**
 * JPEG parsing: scan APP1 (Exif/XMP), APP13 (IPTC) markers.
 */
function analyzeJPEG(
  view: DataView,
  bytes: Uint8Array,
  result: MetadataInfo
): void {
  let offset = 2; // Skip SOI marker

  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 0xff) break;

    const marker = bytes[offset + 1];

    // SOS or EOI — stop scanning
    if (marker === 0xda || marker === 0xd9) break;

    // Standalone markers (no length)
    if (marker >= 0xd0 && marker <= 0xd7) {
      offset += 2;
      continue;
    }

    if (offset + 4 > bytes.length) break;
    const length = view.getUint16(offset + 2, false);

    if (marker === 0xe1) {
      // APP1 — could be Exif or XMP
      const segmentData = bytes.slice(offset + 4, offset + 2 + length);

      // Check for Exif header: "Exif\x00\x00"
      if (
        segmentData.length > 6 &&
        segmentData[0] === 0x45 &&
        segmentData[1] === 0x78 &&
        segmentData[2] === 0x69 &&
        segmentData[3] === 0x66 &&
        segmentData[4] === 0x00
      ) {
        result.hasExif = true;
        result.details.push('Exif data found (camera/GPS info)');

        // Check for C2PA in Exif/XMP
        const text = new TextDecoder('utf-8', { fatal: false }).decode(
          segmentData
        );
        if (
          text.includes('c2pa') ||
          text.includes('C2PA') ||
          text.includes('JUMBF')
        ) {
          result.hasC2PA = true;
          result.details.push('C2PA manifest found');
        }
      }

      // Check for XMP: starts with "<?xpacket" or "<x:xmpmeta"
      const xmpText = new TextDecoder('utf-8', { fatal: false }).decode(
        segmentData
      );
      if (xmpText.includes('x:xmpmeta') || xmpText.includes('<?xpacket')) {
        result.hasXMP = true;
        if (!result.details.some((d) => d.includes('XMP'))) {
          result.details.push('XMP metadata found');
        }

        // Check XMP for C2PA
        if (
          xmpText.includes('c2pa') ||
          xmpText.includes('C2PA') ||
          xmpText.includes('JUMBF') ||
          xmpText.includes('contentauth')
        ) {
          if (!result.hasC2PA) {
            result.hasC2PA = true;
            result.details.push('C2PA manifest found in XMP');
          }
        }
      }
    }

    if (marker === 0xed) {
      // APP13 — IPTC/NAA
      const segmentData = bytes.slice(offset + 4, offset + 2 + length);
      const text = new TextDecoder('utf-8', { fatal: false }).decode(
        segmentData
      );
      if (text.includes('Photoshop') || text.includes('8BIM')) {
        result.hasIPTC = true;
        result.details.push('IPTC data found (captions/credits)');
      }
    }

    offset += 2 + length;
  }
}

/**
 * PNG parsing: scan tEXt/iTXt chunks for XMP/C2PA.
 */
function analyzePNG(
  view: DataView,
  bytes: Uint8Array,
  result: MetadataInfo
): void {
  let offset = 8; // Skip PNG signature

  while (offset < bytes.length - 8) {
    const chunkLength = view.getUint32(offset, false);
    const chunkType = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );

    const chunkData = bytes.slice(offset + 8, offset + 8 + chunkLength);

    if (chunkType === 'tEXt' || chunkType === 'iTXt' || chunkType === 'zTXt') {
      const text = new TextDecoder('utf-8', { fatal: false }).decode(chunkData);

      if (text.includes('XML:com.adobe.xmp') || text.includes('x:xmpmeta')) {
        result.hasXMP = true;
        result.details.push('XMP metadata found in PNG');
      }

      if (
        text.includes('c2pa') ||
        text.includes('C2PA') ||
        text.includes('JUMBF') ||
        text.includes('contentauth')
      ) {
        result.hasC2PA = true;
        result.details.push('C2PA manifest found in PNG');
      }

      // PNG tEXt can also contain Exif-like metadata
      if (
        text.startsWith('Raw profile type exif') ||
        text.startsWith('Raw profile type APP1')
      ) {
        result.hasExif = true;
        result.details.push('Exif data found in PNG');
      }
    }

    // Move to next chunk
    offset += 12 + chunkLength; // 4 (length) + 4 (type) + data + 4 (CRC)
  }
}

/**
 * WebP parsing: check for XMP and EXIF chunks.
 */
function analyzeWebP(
  view: DataView,
  bytes: Uint8Array,
  result: MetadataInfo
): void {
  let offset = 12; // Skip RIFF header + WEBP

  while (offset < bytes.length - 8) {
    const chunkType = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );
    const chunkLength =
      view.getUint32(offset + 4, true); // WebP is little-endian
    const chunkData = bytes.slice(offset + 8, offset + 8 + chunkLength);

    if (chunkType === 'XMP ') {
      result.hasXMP = true;
      result.details.push('XMP metadata found in WebP');

      const text = new TextDecoder('utf-8', { fatal: false }).decode(chunkData);
      if (
        text.includes('c2pa') ||
        text.includes('C2PA') ||
        text.includes('JUMBF') ||
        text.includes('contentauth')
      ) {
        result.hasC2PA = true;
        result.details.push('C2PA manifest found in WebP');
      }
    }

    if (chunkType === 'EXIF') {
      result.hasExif = true;
      result.details.push('Exif data found in WebP');
    }

    // WebP chunks are padded to even size
    const paddedLength = chunkLength % 2 === 0 ? chunkLength : chunkLength + 1;
    offset += 8 + paddedLength;
  }
}
