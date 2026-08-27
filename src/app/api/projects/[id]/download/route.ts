import JSZip from 'jszip';

import { respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import {
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
  const response = await fetch(url);
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
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserInfo();
    if (!user) return respErr('sign in is required before download');
    const project = await getWeddingProject(id);
    if (!project || project.userId !== user.id)
      return respErr('project not found');
    if (!(await hasPaidWeddingOrder(user.id, id)))
      return respErr('paid Wedding Image Pack required');

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
      error instanceof Error ? error.message : 'download failed'
    );
  }
}
