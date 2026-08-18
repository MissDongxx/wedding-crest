import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';
import { respData, respErr } from '@/shared/lib/resp';

const HEAD_READ_SIZE = 65536; // 64KB from head
const TAIL_READ_SIZE = 65536; // 64KB from tail (for WebP/PNG)

export async function POST(request: Request) {
  // Rate limit: max 1 request per 2 seconds
  const rateLimitResponse = enforceMinIntervalRateLimit(request, {
    intervalMs: 2000,
    keyPrefix: 'watermark-detect-meta',
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return respErr('No file provided');
    }

    // Read head for metadata analysis
    const headBuffer = await file.slice(0, HEAD_READ_SIZE).arrayBuffer();
    const bytes = new Uint8Array(headBuffer);
    const view = new DataView(headBuffer);

    const result = {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      hasExif: false,
      hasC2PA: false,
      hasIPTC: false,
      hasXMP: false,
      details: [] as string[],
    };

    const type = detectFileType(bytes);

    if (type === 'jpeg') {
      analyzeJPEG(view, bytes, result);
    } else if (type === 'png') {
      analyzePNG(view, bytes, result);
    } else if (type === 'webp') {
      analyzeWebP(view, bytes, result);
      // WebP XMP/EXIF chunks are often near the end of the file.
      // Read tail if file is larger than what we already read.
      if (file.size > HEAD_READ_SIZE) {
        const tailBuffer = await file
          .slice(file.size - TAIL_READ_SIZE)
          .arrayBuffer();
        const tailBytes = new Uint8Array(tailBuffer);
        const tailView = new DataView(tailBuffer);
        analyzeWebP(tailView, tailBytes, result);
      }
    }

    return respData(result);
  } catch (error) {
    console.error('Metadata detection error:', error);
    return respErr('Metadata detection failed');
  }
}

function detectFileType(
  bytes: Uint8Array
): 'jpeg' | 'png' | 'webp' | 'unknown' {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'jpeg';
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return 'png';
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  )
    return 'webp';
  return 'unknown';
}

function analyzeJPEG(
  view: DataView,
  bytes: Uint8Array,
  result: {
    hasExif: boolean;
    hasC2PA: boolean;
    hasIPTC: boolean;
    hasXMP: boolean;
    details: string[];
  }
): void {
  let offset = 2;
  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker >= 0xd0 && marker <= 0xd7) {
      offset += 2;
      continue;
    }
    if (offset + 4 > bytes.length) break;
    const length = view.getUint16(offset + 2, false);

    // Boundary check: ensure we don't read past buffer
    if (offset + 2 + length > bytes.length) break;

    if (marker === 0xe1) {
      const segmentData = bytes.slice(offset + 4, offset + 2 + length);
      if (
        segmentData.length > 6 &&
        segmentData[0] === 0x45 &&
        segmentData[1] === 0x78 &&
        segmentData[2] === 0x69 &&
        segmentData[3] === 0x66
      ) {
        result.hasExif = true;
        result.details.push('Exif data found');
      }
      const text = new TextDecoder('utf-8', { fatal: false }).decode(
        segmentData
      );
      if (text.includes('x:xmpmeta') || text.includes('<?xpacket')) {
        result.hasXMP = true;
        result.details.push('XMP metadata found');
      }
      if (
        text.includes('c2pa') ||
        text.includes('C2PA') ||
        text.includes('JUMBF')
      ) {
        result.hasC2PA = true;
        result.details.push('C2PA manifest found');
      }
    }
    if (marker === 0xed) {
      const segmentData = bytes.slice(offset + 4, offset + 2 + length);
      const text = new TextDecoder('utf-8', { fatal: false }).decode(
        segmentData
      );
      if (text.includes('Photoshop') || text.includes('8BIM')) {
        result.hasIPTC = true;
        result.details.push('IPTC data found');
      }
    }
    offset += 2 + length;
  }
}

function analyzePNG(
  view: DataView,
  bytes: Uint8Array,
  result: {
    hasExif: boolean;
    hasC2PA: boolean;
    hasIPTC: boolean;
    hasXMP: boolean;
    details: string[];
  }
): void {
  let offset = 8;
  while (offset < bytes.length - 8) {
    const chunkLength = view.getUint32(offset, false);
    const chunkType = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );

    // Boundary check: ensure the full chunk fits in our buffer
    if (offset + 12 + chunkLength > bytes.length) break;

    const chunkData = bytes.slice(offset + 8, offset + 8 + chunkLength);
    if (chunkType === 'tEXt' || chunkType === 'iTXt' || chunkType === 'zTXt') {
      const text = new TextDecoder('utf-8', { fatal: false }).decode(chunkData);
      if (text.includes('x:xmpmeta') || text.includes('XML:com.adobe.xmp')) {
        result.hasXMP = true;
        result.details.push('XMP metadata found');
      }
      if (
        text.includes('c2pa') ||
        text.includes('C2PA') ||
        text.includes('JUMBF')
      ) {
        result.hasC2PA = true;
        result.details.push('C2PA manifest found');
      }
      if (
        text.startsWith('Raw profile type exif') ||
        text.startsWith('Raw profile type APP1')
      ) {
        result.hasExif = true;
        result.details.push('Exif data found');
      }
    }
    offset += 12 + chunkLength;
  }
}

function analyzeWebP(
  view: DataView,
  bytes: Uint8Array,
  result: {
    hasExif: boolean;
    hasC2PA: boolean;
    hasIPTC: boolean;
    hasXMP: boolean;
    details: string[];
  }
): void {
  // When reading from the tail, skip the RIFF header check
  const offsetStart =
    bytes.length > 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
      ? 12
      : 0;

  let offset = offsetStart;
  while (offset < bytes.length - 8) {
    const chunkType = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );
    const chunkLength = view.getUint32(offset + 4, true);

    // Boundary check
    if (offset + 8 + chunkLength > bytes.length) break;

    const chunkData = bytes.slice(offset + 8, offset + 8 + chunkLength);

    if (chunkType === 'XMP ') {
      result.hasXMP = true;
      if (!result.details.includes('XMP metadata found')) {
        result.details.push('XMP metadata found');
      }
      const text = new TextDecoder('utf-8', { fatal: false }).decode(chunkData);
      if (
        text.includes('c2pa') ||
        text.includes('C2PA') ||
        text.includes('JUMBF')
      ) {
        result.hasC2PA = true;
        if (!result.details.includes('C2PA manifest found')) {
          result.details.push('C2PA manifest found');
        }
      }
    }
    if (chunkType === 'EXIF') {
      result.hasExif = true;
      if (!result.details.includes('Exif data found')) {
        result.details.push('Exif data found');
      }
    }

    const paddedLength = chunkLength % 2 === 0 ? chunkLength : chunkLength + 1;
    offset += 8 + paddedLength;
  }
}
