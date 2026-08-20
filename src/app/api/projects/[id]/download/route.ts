import JSZip from 'jszip';

import { respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import {
  getWeddingProject,
  hasPaidWeddingOrder,
  type WeddingGeneration,
} from '@/shared/models/wedding';
import {
  composeWeddingBlackWhite,
  composeWeddingCrest,
  composeWeddingMockups,
  composeWeddingMonogram,
  composeWeddingSimplifiedMark,
  formatWeddingDate,
} from '@/shared/wedding/composer';
import { getWeddingStyle, getWeddingTypography } from '@/shared/wedding/config';

function scaleSvg(svg: string, size: number): string {
  return svg.replace(
    /width="\d+" height="\d+"/,
    `width="${size}" height="${size}"`
  );
}

function fileName(...parts: string[]) {
  return parts
    .join('-')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
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
      return respErr('paid Wedding Identity Pack required');

    const primary =
      project.generations.find(
        (generation: WeddingGeneration) => generation.status === 'selected'
      ) ??
      project.generations.find(
        (generation: WeddingGeneration) => generation.status === 'complete'
      );
    if (!primary?.sourceImageUrl) return respErr('completed crest not found');

    // Recompose everything without the preview watermark for the paid owner.
    const input = { ...project.input, illustrationUrl: primary.sourceImageUrl };
    const style = getWeddingStyle(project.input.style);
    const typography = getWeddingTypography(project.input.typography);
    const mockups = composeWeddingMockups(input);

    const zip = new JSZip();
    const folderName = fileName(
      project.partner1,
      project.partner2,
      'Wedding-Crest'
    );
    const folder = zip.folder(folderName)!;

    folder.file('01-primary/primary-crest.svg', composeWeddingCrest(input));
    folder.file(
      '01-primary/primary-crest-print-3000.svg',
      scaleSvg(composeWeddingCrest(input), 3000)
    );
    folder.file(
      '02-monogram/monogram.svg',
      composeWeddingMonogram(project.input)
    );
    folder.file(
      '03-simplified/simplified-mark.svg',
      composeWeddingSimplifiedMark(project.input)
    );
    folder.file(
      '04-black-white/crest-black.svg',
      composeWeddingBlackWhite(input)
    );
    mockups.forEach((mockup) => {
      folder.file(`06-mockups/${fileName(mockup.id)}.svg`, mockup.svg);
    });

    // Attach the raw illustration when it can be fetched.
    try {
      const response = await fetch(primary.sourceImageUrl);
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        folder.file('01-primary/illustration.png', buffer);
      }
    } catch {
      // Provider URL may have expired; composed SVGs remain self-contained.
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
      'Typography',
      '----------',
      `Pairing: ${typography.name}`,
      `Initials font: ${typography.initialsFont.family}`,
      `Names font: ${typography.namesFont.family}`,
      `Date font: ${typography.dateFont.family}`,
      '',
      'Files',
      '-----',
      '01-primary/primary-crest.svg          Master crest (web)',
      '01-primary/primary-crest-print-3000.svg  Master crest (print)',
      '01-primary/illustration.png           Raw AI illustration layer',
      '02-monogram/monogram.svg              Initials monogram',
      '03-simplified/simplified-mark.svg     Single-initial mark',
      '04-black-white/crest-black.svg        Black & white version',
      '06-mockups/                           Stationery mockups',
      '',
      'Usage tips',
      '----------',
      '- Keep clear space around the crest of at least half its height.',
      '- Use your palette colors for invitations and signage.',
      '- The black & white version is ready for wax seals and embossing.',
      '- SVG files scale losslessly; print at 300 DPI or higher.',
    ].join('\n');
    folder.file('05-guide/wedding-crest-guide.txt', guide);

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
    return respErr(error instanceof Error ? error.message : 'download failed');
  }
}
