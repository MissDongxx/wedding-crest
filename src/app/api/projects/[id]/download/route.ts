import JSZip from 'jszip';

import { respErr } from '@/shared/lib/resp';
import { getOrders, OrderStatus } from '@/shared/models/order';
import { getUserInfo } from '@/shared/models/user';
import {
  getWeddingProject,
  type WeddingGeneration,
} from '@/shared/models/wedding';
import { canDownloadHighResolution } from '@/shared/wedding/config';

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
    const orders = await getOrders({
      userId: user.id,
      status: OrderStatus.PAID,
      limit: 100,
    });
    const paid = orders.some((order) => order.projectId === id);
    if (!canDownloadHighResolution(paid ? OrderStatus.PAID : undefined))
      return respErr('paid Wedding Identity Pack required');

    const primary =
      project.generations.find(
        (generation: WeddingGeneration) => generation.status === 'selected'
      ) ??
      project.generations.find(
        (generation: WeddingGeneration) => generation.status === 'complete'
      );
    if (!primary?.composedSvg) return respErr('completed crest not found');
    const zip = new JSZip();
    const folder = zip.folder(
      `${project.partner1}-${project.partner2}-Wedding-Crest`
    )!;
    folder.file('01-primary/primary-crest.svg', primary.composedSvg);
    folder.file('02-monogram/monogram.svg', primary.composedSvg);
    folder.file('03-simplified/simplified-mark.svg', primary.composedSvg);
    folder.file('04-black-white/crest.svg', primary.composedSvg);
    folder.file(
      '05-guide/README.txt',
      `Wedding Crest Studio\n\nNames: ${project.partner1} & ${project.partner2}\nStyle: ${project.style}\nPalette: ${project.palette}\n`
    );
    const archive = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
    });
    return new Response(Buffer.from(archive), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${project.partner1}-${project.partner2}-wedding-crest.zip"`,
      },
    });
  } catch (error) {
    return respErr(error instanceof Error ? error.message : 'download failed');
  }
}
