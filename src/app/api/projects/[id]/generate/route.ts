import { z } from 'zod';

import { AIMediaType, AITaskStatus } from '@/extensions/ai';
import { getUuid } from '@/shared/lib/hash';
import { respData, respErr } from '@/shared/lib/resp';
import { createAITask } from '@/shared/models/ai_task';
import { getRemainingCredits } from '@/shared/models/credit';
import { getUserInfo } from '@/shared/models/user';
import {
  canAccessWeddingProject,
  claimWeddingProject,
  createWeddingGeneration,
  getWeddingProject,
  updateWeddingProject,
} from '@/shared/models/wedding';
import { getAIService } from '@/shared/services/ai';
import { WEDDING_MAX_CANDIDATES } from '@/shared/wedding/config';
import {
  compileWeddingPrompt,
  getWeddingVersions,
} from '@/shared/wedding/prompt-compiler';

const inputSchema = z.object({
  provider: z.string().trim().optional(),
  model: z.string().trim().min(1).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserInfo();
    if (!user) return respErr('sign in is required before generation');
    const guestId = request.headers.get('x-wedding-guest-id') || undefined;
    const project = await getWeddingProject(id);
    if (
      !project ||
      !(await canAccessWeddingProject({ id, userId: user.id, guestId }))
    )
      return respErr('project not found');

    if (!project.userId) await claimWeddingProject(id, user.id);
    const body = inputSchema.parse(await request.json().catch(() => ({})));
    const aiService = await getAIService();
    const provider = body.provider
      ? aiService.getProvider(body.provider)
      : aiService.getDefaultProvider();
    if (!provider) return respErr('no AI provider configured');

    const model = body.model || process.env.WEDDING_AI_MODEL || 'flux-schnell';
    const remainingCredits = await getRemainingCredits(user.id);
    if (remainingCredits < WEDDING_MAX_CANDIDATES * 2)
      return respErr('insufficient credits for three candidates');

    const versions = getWeddingVersions();
    const prompt = compileWeddingPrompt({
      ...project.input,
      styleVersion: versions.styleVersion,
      promptVersion: versions.promptVersion,
    });
    const created = [];
    await updateWeddingProject(id, 'generating');

    for (
      let candidateIndex = 0;
      candidateIndex < WEDDING_MAX_CANDIDATES;
      candidateIndex += 1
    ) {
      const result = await provider.generate({
        params: {
          mediaType: AIMediaType.IMAGE,
          model,
          prompt,
          async: true,
          options: { width: 1024, height: 1024, candidateIndex },
        },
      });
      if (!result?.taskId)
        throw new Error(
          `AI provider did not return a task id for candidate ${candidateIndex + 1}`
        );

      const aiTask = await createAITask({
        id: getUuid(),
        userId: user.id,
        mediaType: AIMediaType.IMAGE,
        provider: provider.name,
        model,
        prompt,
        options: JSON.stringify({ projectId: id, candidateIndex }),
        status: result.taskStatus || AITaskStatus.PENDING,
        taskId: result.taskId,
        taskInfo: result.taskInfo ? JSON.stringify(result.taskInfo) : null,
        taskResult: result.taskResult
          ? JSON.stringify(result.taskResult)
          : null,
        costCredits: 2,
        scene: 'text-to-image',
      });
      created.push(
        await createWeddingGeneration({
          id: getUuid(),
          projectId: id,
          aiTaskId: aiTask.id,
          candidateIndex,
          provider: provider.name,
          model,
          promptVersion: versions.promptVersion,
          styleVersion: versions.styleVersion,
          layoutVersion: versions.layoutVersion,
          prompt,
          status: 'generating',
          providerTaskId: result.taskId,
          sourceImageUrl: result.taskInfo?.images?.[0]?.imageUrl ?? null,
          cost: 2,
        })
      );
    }

    return respData({
      jobId: id,
      projectId: id,
      candidates: created.map((candidate) => candidate.id),
      status: 'generating',
    });
  } catch (error) {
    return respErr(
      error instanceof Error ? error.message : 'generation failed'
    );
  }
}
