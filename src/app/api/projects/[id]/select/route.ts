import { z } from 'zod';

import { respData, respErr } from '@/shared/lib/resp';
import {
  canAccessWeddingProject,
  getWeddingProject,
  updateWeddingGeneration,
  updateWeddingProject,
  type WeddingGeneration,
} from '@/shared/models/wedding';
import {
  getWeddingActor,
  getWeddingProjectOwner,
} from '@/shared/models/wedding-actor';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { generationId } = z
      .object({ generationId: z.string().min(1) })
      .parse(await request.json());
    const actor = await getWeddingActor();
    const guestId = request.headers.get('x-wedding-guest-id') || undefined;
    const project = await getWeddingProject(id);
    if (!project) return respErr('project not found', 404);
    const ownerId = getWeddingProjectOwner(actor, project);
    if (!(await canAccessWeddingProject({ id, userId: ownerId, guestId })))
      return respErr('project not found', 404);
    const selected = project.generations.find(
      (generation: WeddingGeneration) => generation.id === generationId
    );
    if (!selected) return respErr('generation not found');
    await Promise.all(
      project.generations
        .filter(
          (generation: WeddingGeneration) =>
            generation.id !== generationId && generation.status === 'selected'
        )
        .map((generation: WeddingGeneration) =>
          updateWeddingGeneration(generation.id, { status: 'complete' })
        )
    );
    await updateWeddingProject(id, 'complete');
    await updateWeddingGeneration(generationId, { status: 'selected' });
    return respData({
      projectId: id,
      generationId,
    });
  } catch (error) {
    return respErr(
      error instanceof z.ZodError
        ? 'invalid generation selection'
        : 'Selection is temporarily unavailable. Please retry.',
      error instanceof z.ZodError ? 400 : 503
    );
  }
}
