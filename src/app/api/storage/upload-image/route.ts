import { md5 } from '@/shared/lib/hash';
import { respData, respErr } from '@/shared/lib/resp';
import { getStorageService } from '@/shared/services/storage';

// Hard cap to keep storage and downstream multimodal generation costs in
// check. ~10MB is comfortable for a hi-res reference photo (most phone
// shots are 2-6MB) while still leaving headroom for admin-uploaded assets
// like logos and full-resolution illustrations.
const MAX_FILE_BYTES = 10 * 1024 * 1024;
// Personal-element reference photos must be in a format Runware's
// referenceImages field can fetch directly. SVG is also supported for
// admin-managed static artwork such as wedding frames and shields.
const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/svg+xml',
]);

const extFromMime = (mimeType: string) => {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
    'image/heic': 'heic',
    'image/heif': 'heif',
  };
  return map[mimeType] || '';
};

const mimeFromFilename = (filename: string) => {
  const extension = filename.toLowerCase().split('.').pop() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  };
  return map[extension] ?? '';
};

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return respErr('No files provided');
    }

    const storageService = await getStorageService();
    const uploadResults = [];

    for (const file of files) {
      // Some browsers report PNG files as application/octet-stream (or leave
      // the MIME type blank). Prefer the trusted image extension in that
      // case so a valid PNG is not rejected by the server-side check.
      const reportedMime = file.type.trim().toLowerCase();
      const inferredMime = mimeFromFilename(file.name);
      const mimeType = ALLOWED_MIMES.has(reportedMime)
        ? reportedMime
        : inferredMime;

      // Validate file type
      if (!mimeType || !mimeType.startsWith('image/')) {
        return respErr(`File ${file.name} is not an image`);
      }
      if (!ALLOWED_MIMES.has(mimeType)) {
        return respErr(
          `File ${file.name} has unsupported type ${reportedMime || inferredMime}. Allowed: ${Array.from(ALLOWED_MIMES).join(', ')}`
        );
      }
      if (file.size > MAX_FILE_BYTES) {
        return respErr(
          `File ${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB, max is ${MAX_FILE_BYTES / 1024 / 1024}MB`
        );
      }

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const body = new Uint8Array(arrayBuffer);

      const digest = md5(body);
      const ext = extFromMime(file.type) || file.name.split('.').pop() || 'bin';
      const key = `${digest}.${ext}`;

      // If the same image already exists, reuse its URL to save storage space.
      // (Still depends on provider supporting signed HEAD + public url generation.)
      const exists = await storageService.exists({ key });
      if (exists) {
        const publicUrl = storageService.getPublicUrl({ key });
        if (publicUrl) {
          uploadResults.push({
            url: publicUrl,
            key,
            filename: file.name,
            deduped: true,
          });
          continue;
        }
      }

      // Upload to storage
      const result = await storageService.uploadFile({
        body,
        key: key,
        contentType: mimeType,
        disposition: 'inline',
      });

      if (!result.success) {
        console.error('[API] Upload failed:', result.error);
        return respErr(result.error || 'Upload failed');
      }

      uploadResults.push({
        url: result.url,
        key: result.key,
        filename: file.name,
        deduped: false,
      });
    }

    return respData({
      urls: uploadResults.map((r) => r.url),
      results: uploadResults,
    });
  } catch (e) {
    console.error('upload image failed:', e);
    return respErr('upload image failed');
  }
}
