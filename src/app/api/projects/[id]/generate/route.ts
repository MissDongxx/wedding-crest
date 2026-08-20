import { z } from 'zod';

import { AIMediaType, AITaskStatus } from '@/extensions/ai';
import { getUuid } from '@/shared/lib/hash';
import { respData, respErr } from '@/shared/lib/resp';
import { createAITask } from '@/shared/models/ai_task';
import { getUserInfo } from '@/shared/models/user';
import {
  canAccessWeddingProject,
  claimWeddingProject,
  countProjectsWithGenerations,
  countWeddingGenerationBatches,
  createWeddingGeneration,
  getActiveWeddingPromptTemplate,
  getWeddingProject,
  hasPaidWeddingOrder,
  updateWeddingProject,
  upsertWeddingPromptTemplate,
} from '@/shared/models/wedding';
import { getAIService } from '@/shared/services/ai';
import {
  decideGenerationAllowance,
  WEDDING_MAX_CANDIDATES,
  WEDDING_PACK_PRODUCT_ID,
} from '@/shared/wedding/config';
import {
  compileWeddingPrompt,
  getWeddingVersions,
} from '@/shared/wedding/prompt-compiler';

const inputSchema = z.object({
  provider: z.string().trim().optional(),
  model: z.string().trim().min(1).optional(),
});

/**
 * Resolve the model for this generation.
 *
 * Priority: request body override → env override → provider's own configured
 * model (e.g. `runware_model` in the admin config). We deliberately do NOT
 * hardcode a Runware AIR id here, because the admin settings are the
 * authoritative source of truth — a stale hardcoded default would override a
 * freshly-saved provider model and produce invalid-model 400s.
 */
function pickModel(
  providerName: string,
  requested: string | undefined,
  providerDefault: string | undefined
) {
  return (
    requested ||
    process.env.WEDDING_AI_MODEL ||
    providerDefault ||
    (providerName === 'runware' ? 'runware:Flux-Schnell@1' : 'flux-schnell')
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Guests may run their first generation before any account exists.
    const user = await getUserInfo();
    const guestId = request.headers.get('x-wedding-guest-id') || undefined;
    const project = await getWeddingProject(id);
    if (
      !project ||
      !(await canAccessWeddingProject({ id, userId: user?.id, guestId }))
    )
      return respErr('project not found');

    if (user && !project.userId) await claimWeddingProject(id, user.id);

    // Hard generation quota (spec: cost protection).
    const [batches, paid, projectsWithGenerations] = await Promise.all([
      countWeddingGenerationBatches(id, WEDDING_MAX_CANDIDATES),
      user ? hasPaidWeddingOrder(user.id, id) : Promise.resolve(false),
      countProjectsWithGenerations(
        user ? { userId: user.id } : { guestId: guestId ?? '__none__' }
      ),
    ]);
    const allowance = decideGenerationAllowance({
      batches,
      paid,
      isGuest: !user,
      projectsWithGenerations,
    });
    if (!allowance.allowed)
      return respErr(allowance.reason ?? 'generation limit reached');

    const body = inputSchema.parse(await request.json().catch(() => ({})));
    // Bypass the 1-minute in-memory cache so a freshly-saved admin key
    // is picked up immediately on the next Generate click.
    const { invalidateConfigsCache } = await import(
      '@/shared/models/config'
    );
    invalidateConfigsCache();
    const aiService = await getAIService();
    const provider = body.provider
      ? aiService.getProvider(body.provider)
      : aiService.getDefaultProvider();
    if (!provider) {
      const configured = aiService.getProviderNames();
      return respErr(
        configured.length === 0
          ? 'no AI image provider configured yet. Ask the studio admin to set a Runware API key in admin → settings.'
          : `requested provider "${body.provider}" is not configured (available: ${configured.join(', ')})`
      );
    }

    const model = pickModel(
      provider.name,
      body.model,
      (provider as { configs?: { model?: string } }).configs?.model
    );

    const versions = getWeddingVersions();
    const prompt = compileWeddingPrompt({
      ...project.input,
      styleVersion: versions.styleVersion,
      promptVersion: versions.promptVersion,
    });

    // Versioned prompt template persistence (spec: prompt versioning).
    const activeTemplate = await getActiveWeddingPromptTemplate(project.style);
    if (!activeTemplate || activeTemplate.template !== prompt) {
      await upsertWeddingPromptTemplate({
        id: getUuid(),
        name: `${project.style}-${versions.promptVersion}`,
        version: versions.promptVersion,
        style: project.style,
        template: prompt,
        active: true,
      });
    }

    await updateWeddingProject(id, 'generating');

    const created = [];
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

      // ai_task rows require a FK'd user; guests are tracked in
      // wedding_generation only.
      const aiTask = user
        ? await createAITask({
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
            costCredits: 0,
            scene: 'text-to-image',
          })
        : null;
      created.push(
        await createWeddingGeneration({
          id: getUuid(),
          projectId: id,
          aiTaskId: aiTask?.id ?? null,
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
          cost: 0,
        })
      );
    }

    return respData({
      jobId: id,
      projectId: id,
      candidates: created.map((candidate) => candidate.id),
      status: 'generating',
      productForUnlock: WEDDING_PACK_PRODUCT_ID,
    });
  } catch (error) {
    return respErr(
      error instanceof Error ? error.message : 'generation failed'
    );
  }
}
