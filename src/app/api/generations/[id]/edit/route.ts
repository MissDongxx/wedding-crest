import { z } from 'zod';

import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import {
  canAccessWeddingProject,
  getWeddingGeneration,
  getWeddingProject,
  hasPaidWeddingOrder,
  updateWeddingGeneration,
  updateWeddingProject,
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

/**
 * Quick edits adjust the composed crest without a new AI run:
 * palette reduction and element removal mutate the project input, the
 * aesthetic hints are persisted for the next regeneration.
 */
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

    // Paid owners see watermark-free previews.
    const paid = user ? await hasPaidWeddingOrder(user.id, projectId) : false;

    const input = { ...project.input };
    const projectUpdate: Record<string, unknown> = {};

    switch (action) {
      case 'reduce_colors':
        projectUpdate.palette = JSON.stringify(input.palette.slice(0, 2));
        input.palette = input.palette.slice(0, 2);
        break;
      case 'remove_personal_element':
        input.personalElements = input.personalElements.slice(0, -1);
        break;
      case 'make_simpler':
        projectUpdate.complexity = 'minimal';
        input.complexity = 'minimal';
        break;
      default:
        // more_romantic / more_elegant / more_negative_space influence the
        // next regeneration prompt; the composed preview stays unchanged.
        break;
    }

    if (Object.keys(projectUpdate).length > 0) {
      await updateWeddingProject(projectId, projectUpdate as any);
    }

    const composedSvg = composeWeddingCrest({
      ...input,
      illustrationUrl: generation.sourceImageUrl,
      previewWatermark: !paid,
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
