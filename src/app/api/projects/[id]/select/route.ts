import { z } from 'zod';

import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import {
  canAccessWeddingProject,
  getWeddingProject,
  updateWeddingGeneration,
  updateWeddingProject,
  type WeddingGeneration,
} from '@/shared/models/wedding';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { generationId } = z
      .object({ generationId: z.string().min(1) })
      .parse(await request.json());
    const user = await getUserInfo();
    const guestId = request.headers.get('x-wedding-guest-id') || undefined;
    if (!(await canAccessWeddingProject({ id, userId: user?.id, guestId })))
      return respErr('project not found');
    const project = await getWeddingProject(id);
    const selected = project?.generations.find(
      (generation: WeddingGeneration) => generation.id === generationId
    );
    if (!selected) return respErr('generation not found');
    await updateWeddingProject(id, 'selected');
    await updateWeddingGeneration(generationId, { status: 'selected' });
    return respData({
      projectId: id,
      generationId,
      composedSvg: selected.composedSvg,
    });
  } catch (error) {
    return respErr(
      error instanceof z.ZodError
        ? 'invalid generation selection'
        : 'select generation failed'
    );
  }
}
