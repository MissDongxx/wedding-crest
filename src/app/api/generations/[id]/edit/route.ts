import { z } from 'zod';

import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import {
  canAccessWeddingProject,
  getWeddingGeneration,
  getWeddingProject,
  updateWeddingGeneration,
} from '@/shared/models/wedding';
import { composeWeddingCrest } from '@/shared/wedding/composer';

const editSchema = z.object({
  projectId: z.string().min(1),
  action: z.enum([
    'make_simpler',
    'more_romantic',
    'more_elegant',
    'reduce_colors',
    'more_negative_space',
    'remove_personal_element',
  ]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { projectId, action } = editSchema.parse(await request.json());
    const user = await getUserInfo();
    const guestId = request.headers.get('x-wedding-guest-id') || undefined;
    if (
      !(await canAccessWeddingProject({
        id: projectId,
        userId: user?.id,
        guestId,
      }))
    )
      return respErr('project not found');
    const generation = await getWeddingGeneration(id);
    const project = await getWeddingProject(projectId);
    if (
      !generation ||
      !project ||
      generation.projectId !== projectId ||
      !generation.sourceImageUrl
    )
      return respErr('generation not found');
    const composedSvg = composeWeddingCrest({
      ...project.input,
      illustrationUrl: generation.sourceImageUrl,
      previewWatermark: !user,
    });
    const updated = await updateWeddingGeneration(id, {
      composedSvg,
      status: 'edited',
    });
    return respData({
      generationId: id,
      projectId,
      action,
      composedSvg: updated.composedSvg,
    });
  } catch (error) {
    return respErr(
      error instanceof z.ZodError ? 'invalid edit request' : 'edit failed'
    );
  }
}
