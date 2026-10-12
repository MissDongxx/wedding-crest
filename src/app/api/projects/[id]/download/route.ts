import JSZip from 'jszip';

import { respErr } from '@/shared/lib/resp';
import { getAllConfigs } from '@/shared/models/config';
import { getUserInfo } from '@/shared/models/user';
import {
  canAccessWeddingProject,
  getWeddingProject,
  hasPaidWeddingOrder,
  type WeddingGeneration,
} from '@/shared/models/wedding';
import { getWeddingStyle, getWeddingTypography } from '@/shared/wedding/config';
import { formatWeddingDate } from '@/shared/wedding/display-text';

function fileName(...parts: string[]) {
  return parts
    .join('-')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function imageExtension(buffer: Buffer, contentType: string | null) {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'png';
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'jpg';
  if (contentType?.includes('webp')) return 'webp';
  return 'png';
}

async function fetchAiArtwork(url: string) {
  let response: Response | undefined;
  // Only stored artwork under our configured public R2 domain can use signed
  // reads. Credentials never leave the server; ownership/payment checks above
  // still run before this helper is called.
  const configs = await getAllConfigs();
  if (
    configs.r2_domain &&
    configs.r2_access_key &&
    configs.r2_secret_key &&
    configs.r2_bucket_name
  ) {
    const publicBase = new URL(configs.r2_domain);
    const source = new URL(url);
    const prefix = publicBase.pathname.replace(/\/$/, '') + '/';
    if (
      source.origin === publicBase.origin &&
      source.pathname.startsWith(prefix)
    ) {
      const key = source.pathname.slice(prefix.length);
      const endpoint =
        configs.r2_endpoint ||
        `https://${configs.r2_account_id}.r2.cloudflarestorage.com`;
      if (key && new URL(endpoint).protocol === 'https:') {
        try {
          const { AwsClient } = await import('aws4fetch');
          const client = new AwsClient({
            accessKeyId: configs.r2_access_key,
            secretAccessKey: configs.r2_secret_key,
            region: 'auto',
            service: 's3',
          });
          const stored = await client.fetch(
            new Request(
              `${endpoint.replace(/\/$/, '')}/${encodeURIComponent(configs.r2_bucket_name)}/${key}`,
              { signal: AbortSignal.timeout(15000) }
            )
          );
          if (stored.ok) response = stored;
        } catch {
          // Public fetch remains a fallback when the storage endpoint is down.
        }
      }
    }
  }
  for (let attempt = 0; !response?.ok && attempt < 3; attempt++) {
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (response.ok || response.status < 500 || attempt === 2) break;
    } catch {
      if (attempt === 2)
        throw new Error(
          `Artwork download temporarily unavailable from ${new URL(url).host}. Please retry.`
        );
    }
    await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
  }
  if (!response)
    throw new Error('Artwork download temporarily unavailable. Please retry.');
  if (!response.ok) {
    // The previous error was just "could not fetch AI artwork (404)" with
    // no URL hint, so a stale provider URL or a misconfigured storage
    // bucket looked identical in the toast. Include the host so "who's
    // serving this" is obvious in the toast and server log.
    const host = (() => {
      try {
        return new URL(url).host;
      } catch {
        return 'unknown-host';
      }
    })();
    throw new Error(
      `could not fetch AI artwork from ${host} (HTTP ${response.status})`
    );
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    buffer,
    extension: imageExtension(buffer, response.headers.get('content-type')),
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserInfo(true);
    const guestId = request.headers.get('x-wedding-guest-id') || undefined;
    const project = await getWeddingProject(id);
    if (
      !project ||
      !(await canAccessWeddingProject({ id, userId: user?.id, guestId }))
    )
      return respErr('project not found', 404);
    if (!(await hasPaidWeddingOrder(user?.id, id, guestId)))
      return respErr('paid Wedding Image Pack required', 402);

    const downloadable = project.generations.filter(
      (generation: WeddingGeneration) =>
        ['selected', 'complete'].includes(generation.status) &&
        Boolean(generation.sourceImageUrl)
    );
    const primary =
      downloadable.find(
        (generation: WeddingGeneration) => generation.status === 'selected'
      ) ?? downloadable[0];
    if (!primary?.sourceImageUrl) return respErr('completed crest not found');

    const style = getWeddingStyle(project.input.style);
    const typography = getWeddingTypography(project.input.typography);
    const zip = new JSZip();
    const folderName = fileName(
      project.partner1,
      project.partner2,
      'Wedding-Crest'
    );
    const folder = zip.folder(folderName)!;

    const primaryArtwork = await fetchAiArtwork(primary.sourceImageUrl);
    folder.file(
      `01-primary/primary-ai-crest.${primaryArtwork.extension}`,
      primaryArtwork.buffer
    );

    const alternates = downloadable.filter(
      (generation: WeddingGeneration) => generation.id !== primary.id
    );
    for (let index = 0; index < alternates.length; index += 1) {
      const generation = alternates[index];
      if (!generation.sourceImageUrl) continue;
      const artwork = await fetchAiArtwork(generation.sourceImageUrl);
      folder.file(
        `02-ai-variations/crest-variation-${index + 1}.${artwork.extension}`,
        artwork.buffer
      );
    }

    const guide = [
      `${project.partner1} & ${project.partner2} - Wedding Crest Guide`,
      '='.repeat(56),
      '',
      `Wedding date: ${formatWeddingDate(project.weddingDate) || 'not set'}`,
      `Style: ${style.name} (${style.tagline})`,
      `Composition: ${project.layout}`,
      '',
      'Color palette',
      '-------------',
      ...project.input.palette.map((color, index) => `${index + 1}. ${color}`),
      '',
      'Typography direction',
      '--------------------',
      `Pairing: ${typography.name}`,
      '',
      'Files',
      '-----',
      `01-primary/primary-ai-crest.${primaryArtwork.extension}  Selected original AI-generated crest`,
      alternates.length
        ? `02-ai-variations/                     ${alternates.length} completed AI-generated variation(s)`
        : '02-ai-variations/                     No additional completed variations',
      '',
      'Usage tips',
      '----------',
      '- These files preserve the original AI-generated image artwork.',
      '- Keep clear space around the crest of at least half its height.',
      '- Use your palette colors for invitations and signage.',
      '- For print, place the original image at its native size or smaller.',
    ].join('\n');
    folder.file('03-guide/wedding-crest-guide.txt', guide);

    const archive = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
    });
    return new Response(Buffer.from(archive), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${folderName}.zip"`,
      },
    });
  } catch (error) {
    // The client previously masked the real failure behind a generic
    // "image pack could not be prepared" toast. Log the full error so the
    // cause is visible in the server log (a stale provider URL, a missing
    // storage bucket, a quota gate, etc.) and surface the message in the
    // envelope so the toast can show it verbatim.
    console.error('[wedding] download failed', error);
    return respErr(
      error instanceof Error ? error.message : 'download failed',
      502
    );
  }
}
