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
  findWeddingProjectWithGeneration,
  getActiveWeddingPromptTemplate,
  getWeddingGeneration,
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
  compileWeddingDesignEditPrompt,
  compileWeddingPrompt,
  compileWeddingTextEditPrompt,
  getWeddingVersions,
} from '@/shared/wedding/prompt-compiler';
import type { WeddingProjectInput } from '@/shared/wedding/types';

const editKindSchema = z.enum([
  'design',
  'lettering',
  'reduce_colors',
  'make_simpler',
  'remove_personal_element',
]);

const inputSchema = z.object({
  provider: z.string().trim().optional(),
  model: z.string().trim().min(1).optional(),
  /**
   * Small-modification flow: keep the existing illustration and re-render
   * one aspect of it (the lettering, a smaller palette, a simpler
   * composition, or fewer personal elements). The source image is passed
   * to a multimodal model as a reference.
   */
  edit: z
    .object({
      sourceGenerationId: z.string().trim().min(1),
      kind: editKindSchema,
    })
    .optional(),
});

/**
 * Per-edit-kind instructions. Wrapped with the standard "keep everything
 * else identical" framing in buildQuickEditPrompt below.
 */
const QUICK_EDIT_INSTRUCTIONS: Record<
  z.infer<typeof editKindSchema>,
  (input: { personalElements: string[]; complexity: string }) => string
> = {
  design: () => '',
  lettering: () => '',
  reduce_colors: () =>
    'Reduce the color palette of the illustration to its two most dominant tones - quiet everything else down to a calmer two-color scheme. Keep the same composition, motifs, border and lettering exactly as in the reference image.',
  make_simpler: () =>
    'Simplify the illustration - fewer ornamental elements, more negative space, cleaner lines. Keep the same composition, framing, motifs and lettering as in the reference image, just rendered in a more pared-back version.',
  remove_personal_element: ({ personalElements }) => {
    const last = personalElements[personalElements.length - 1];
    const subject = last
      ? `the ${last}`
      : 'one of the most prominent personal motifs';
    return `Remove ${subject} from the illustration. Keep the rest of the composition, framing, border, palette, other motifs and lettering exactly as in the reference image.`;
  },
};

function buildQuickEditPrompt(
  kind: z.infer<typeof editKindSchema>,
  input: { personalElements: string[]; complexity: string }
) {
  const instruction = QUICK_EDIT_INSTRUCTIONS[kind](input);
  return [
    'Edit the wedding crest shown in the reference image.',
    'Keep the entire illustration - composition, framing, border, ornaments, palette, motifs, and ALL lettering - exactly as it appears in the reference image, except for the change below.',
    'Keep the background solid pure white (#FFFFFF) exactly as in the reference image - no transparency, alpha channel, checkerboard, grid, paper texture, backdrop, fill color, shadows or gradients.',
    `Change: ${instruction}`,
    'Do not change anything else in the design.',
  ].join('\n');
}

/**
 * Resolve the model for this generation.
 *
 * Priority: request body override → env override → provider's own configured
 * model (e.g. `runware_model` in the admin config). We deliberately do NOT
 * hardcode a Runware AIR id here, because the admin settings are the
 * authoritative source of truth - a stale hardcoded default would override a
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
  // Pre-declared so the catch below can read a model label even when an
  // earlier step throws before the multimodal switch has been computed.
  let effectiveModel = 'runware:Flux-Schnell@1';
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
      // 402 Payment Required: the user's free quota (or paid regeneration
      // quota) is exhausted. Returning a real 4xx lets the wizard branch
      // on status and avoid logging a console.error for what is a normal
      // product state ("you've used your free generation, buy the pack").
      return respErr(
        allowance.reason ?? 'generation limit reached',
        402,
        batches === 0 && projectsWithGenerations >= 1 && user
          ? {
              generatedProjectId: await findWeddingProjectWithGeneration({
                userId: user.id,
              }),
            }
          : undefined
      );

    const body = inputSchema.parse(await request.json().catch(() => ({})));
    // Bypass the 1-minute in-memory cache so a freshly-saved admin key
    // is picked up immediately on the next Generate click.
    const { invalidateConfigsCache } = await import('@/shared/models/config');
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

    // Resolve the edit (small modification) flow vs. the full generation
    // flow. Edit prompts are transient and intentionally not persisted to
    // the per-style template registry.
    let prompt: string;
    let referenceImages: string[] = [];
    let sourceInput: WeddingProjectInput | null = null;
    if (body.edit) {
      const source = await getWeddingGeneration(body.edit.sourceGenerationId);
      if (!source || source.projectId !== id) {
        return respErr('source generation not found');
      }
      if (!source.sourceImageUrl) {
        return respErr('source generation has no image yet');
      }
      referenceImages = [source.sourceImageUrl];

      // Apply quick-edit setting mutations BEFORE compiling the prompt.
      // The persisted project state stays in sync with what the prompt
      // asked the model to do.
      const projectUpdate: Record<string, unknown> = {};
      sourceInput = { ...project.input };
      if (body.edit.kind === 'reduce_colors') {
        const nextPalette = sourceInput.palette.slice(0, 2);
        projectUpdate.palette = JSON.stringify(nextPalette);
        sourceInput.palette = nextPalette;
      } else if (body.edit.kind === 'make_simpler') {
        projectUpdate.complexity = 'minimal';
        sourceInput.complexity = 'minimal';
      } else if (body.edit.kind === 'remove_personal_element') {
        const nextElements = sourceInput.personalElements.slice(0, -1);
        projectUpdate.personalElements = JSON.stringify(nextElements);
        sourceInput.personalElements = nextElements;
      }
      if (Object.keys(projectUpdate).length > 0) {
        await updateWeddingProject(id, projectUpdate as any);
      }

      if (body.edit.kind === 'lettering') {
        prompt = compileWeddingTextEditPrompt(sourceInput);
      } else if (body.edit.kind === 'design') {
        prompt = compileWeddingDesignEditPrompt(sourceInput);
      } else {
        prompt = buildQuickEditPrompt(body.edit.kind, {
          personalElements: sourceInput.personalElements,
          complexity: sourceInput.complexity,
        });
      }
    } else {
      const versions = getWeddingVersions();
      prompt = compileWeddingPrompt({
        ...project.input,
        styleVersion: versions.styleVersion,
        promptVersion: versions.promptVersion,
      });

      // Versioned prompt template persistence (spec: prompt versioning).
      const activeTemplate = await getActiveWeddingPromptTemplate(
        project.style
      );
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
    }

    // When the user attached reference photos (personal elements) we need a
    // multimodal model - flux-schnell is text-only. Auto-switch to a
    // reference-image-capable model (default google:nano-banana@2-lite on
    // Runware, which accepts `inputs.referenceImages`). The id is
    // overridable via WEDDING_AI_MULTIMODAL_MODEL because Runware AIR ids
    // have changed across nano-banana revisions and not every account has
    // every version enabled.
    //
    // Admin-set model / WEDDING_AI_MODEL / explicit body.model can still
    // override this by passing body.model themselves.
    //
    // Edit generations always carry a reference image (the current crest),
    // so the multimodal switch is also what makes the small-modification
    // flow work. Example reference images are skipped during edits - the
    // goal is to keep the existing design, not match a different example.
    const personalImages =
      sourceInput?.personalImages ?? project.input.personalImages ?? [];
    const exampleImage = project.input.exampleImage ?? null;
    const frameImage = project.input.frameUrl ?? null;
    const personalReferenceImages = [
      ...(body.edit ? [] : exampleImage ? [exampleImage] : []),
      ...(body.edit ? [] : frameImage ? [frameImage] : []),
      ...personalImages,
    ];
    const allReferenceImages = [...referenceImages, ...personalReferenceImages];
    const multimodalModel =
      process.env.WEDDING_AI_MULTIMODAL_MODEL || 'google:nano-banana@2-lite';
    effectiveModel = body.model
      ? model
      : allReferenceImages.length > 0
        ? multimodalModel
        : model;

    await updateWeddingProject(id, 'generating');

    // Output dimensions. Default 1024 keeps the request within every
    // Runware model's hard size cap. Bump to 2048 only when the operator
    // explicitly sets WEDDING_AI_WIDTH / WEDDING_AI_HEIGHT - some
    // Runware AIR ids cap at 1024 or 1536 and 2048 will produce a 5xx
    // that's hard to interpret from the client side. The multimodal
    // (nano-banana) path below deliberately omits width/height, so the
    // actual output size there is set by the multimodal model itself.
    const outputWidth = Number(process.env.WEDDING_AI_WIDTH) || 1024;
    const outputHeight = Number(process.env.WEDDING_AI_HEIGHT) || 1024;

    const created = [];
    for (
      let candidateIndex = 0;
      candidateIndex < WEDDING_MAX_CANDIDATES;
      candidateIndex += 1
    ) {
      // Build per-candidate options. Runware's nano-banana forbids passing
      // width/height alongside inputs.referenceImages ("either provide
      // referenceImages or specify width/height", not both), so the shape
      // of this object depends on whether the project carries reference
      // photos.
      const baseOptions: Record<string, unknown> = { candidateIndex };
      if (allReferenceImages.length === 0) {
        baseOptions.width = outputWidth;
        baseOptions.height = outputHeight;
      } else {
        baseOptions.referenceImages = allReferenceImages;
      }

      const result = await provider.generate({
        params: {
          mediaType: AIMediaType.IMAGE,
          model: effectiveModel,
          prompt,
          async: true,
          options: baseOptions,
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
            model: effectiveModel,
            prompt,
            options: JSON.stringify({
              projectId: id,
              candidateIndex,
              edit: body.edit ?? null,
            }),
            status: result.taskStatus || AITaskStatus.PENDING,
            taskId: result.taskId,
            taskInfo: result.taskInfo ? JSON.stringify(result.taskInfo) : null,
            taskResult: result.taskResult
              ? JSON.stringify(result.taskResult)
              : null,
            costCredits: 0,
            scene:
              allReferenceImages.length > 0
                ? 'image-to-image'
                : 'text-to-image',
          })
        : null;
      created.push(
        await createWeddingGeneration({
          id: getUuid(),
          projectId: id,
          aiTaskId: aiTask?.id ?? null,
          candidateIndex,
          provider: provider.name,
          model: effectiveModel,
          promptVersion: getWeddingVersions().promptVersion,
          styleVersion: getWeddingVersions().styleVersion,
          layoutVersion: getWeddingVersions().layoutVersion,
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
    // Surface the model id in the error so an unsupported/invalid Runware
    // AIR id is immediately recognizable in dev tools and the wizard toast
    // (e.g. "request failed with status: 400 ... model: google:nano-banana@2-lite").
    // `effectiveModel` is pre-declared at the top of POST with a safe
    // default so this catch can read it even when an earlier step threw.
    // Log the full error too so an upstream 5xx (e.g. a Runware-side
    // size-limit error returning an HTML body) shows up in the server
    // log instead of being silently masked by respErr.
    console.error('[wedding] generate failed', error);
    const modelLabel = ` model: ${effectiveModel}`;
    const base =
      error instanceof Error && error.message
        ? error.message
        : 'generation failed';
    return respErr(
      base.includes('model:') ? base : `${base}${modelLabel}`
    );
  }
}
