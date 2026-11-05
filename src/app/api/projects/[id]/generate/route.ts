import { z } from 'zod';

import { AIMediaType, AITaskStatus, type AIProvider } from '@/extensions/ai';
import {
  generateWeddingImage,
  OPENAI_IMAGE_MODEL,
  OpenAIImageProvider,
} from '@/extensions/ai/openai-image';
import { getUuid } from '@/shared/lib/hash';
import { respData, respErr } from '@/shared/lib/resp';
import { normalizeCheckerboardTransparency } from '@/shared/lib/pure-image';
import { createAITask } from '@/shared/models/ai_task';
import {
  canAccessWeddingProject,
  getActiveWeddingPromptTemplate,
  getWeddingGeneration,
  getWeddingGenerationAllowance,
  getWeddingProject,
  reserveWeddingGenerationBatch,
  settleFailedWeddingReservation,
  updateWeddingGeneration,
  updateWeddingProject,
  upsertWeddingPromptTemplate,
} from '@/shared/models/wedding';
import {
  getWeddingActor,
  getWeddingProjectOwner,
} from '@/shared/models/wedding-actor';
import { getAIService } from '@/shared/services/ai';
import { getStorageService } from '@/shared/services/storage';
import {
  WEDDING_MAX_CANDIDATES,
  WEDDING_PACK_PRODUCT_ID,
} from '@/shared/wedding/config';
import {
  compileAssistantEditPrompt,
  editPlanSchema,
} from '@/shared/wedding/edit-plan';
import { getWeddingInitialGenerationIds } from '@/shared/wedding/generation-request';
import {
  compileWeddingDesignEditPrompt,
  compileWeddingPrompt,
  compileWeddingTextEditPrompt,
  getWeddingReferenceImages,
  getWeddingVersions,
} from '@/shared/wedding/prompt-compiler';
import type { WeddingProjectInput } from '@/shared/wedding/types';

const editKindSchema = z.enum([
  'assistant',
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
      replaceLetteringStyle: z.boolean().optional().default(false),
      plan: editPlanSchema.optional(),
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
  assistant: () => '',
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
 * model (e.g. `runware_model` in the admin config) → hardcoded fallback.
 * We deliberately do NOT hardcode a Runware AIR id that would override a
 * freshly-saved provider model - a stale hardcoded default would produce
 * invalid-model 400s. The fallback only applies when the admin setting is
 * empty.
 *
 * That fallback is `google:nano-banana@2-lite` on Runware: the studio runs ONE
 * model across both the text-to-image and the reference-image (multimodal)
 * path, so an empty admin setting must not silently drop back to a text-only
 * AIR id like flux-schnell and break the reference-image branch. Verified
 * against Runware on 2026-09-18: nano-banana accepts width/height as long as
 * no `inputs.referenceImages` are sent.
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
    (providerName === 'runware' ? 'google:nano-banana@2-lite' : 'flux-schnell')
  );
}

function isSvgReferenceImage(url: string) {
  if (/^data:image\/svg\+xml(?:;|,)/i.test(url)) return true;

  try {
    return /\.svgz?$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function assertRasterReferenceImages(urls: string[]) {
  const svgReference = urls.find(isSvgReferenceImage);
  if (!svgReference) return;

  throw new Error(
    'SVG reference images are not supported for crest generation. Upload the frame as PNG, JPEG, or WebP.'
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Pre-declared so the catch below can read a model label even when an
  // earlier step throws before the multimodal switch has been computed.
  let effectiveModel = 'google:nano-banana@2-lite';
  let projectId: string | undefined;
  let projectMarkedGenerating = false;
  let reservationIds: string[] = [];
  let providerAttempted = false;
  const submittedCandidateIds: string[] = [];
  try {
    const { id } = await params;
    projectId = id;
    const actor = await getWeddingActor();
    const user = actor.user; // Real session only: guests never create ai_task user rows.
    const guestId = request.headers.get('x-wedding-guest-id') || undefined;
    const project = await getWeddingProject(id);
    if (!project) return respErr('project not found', 404);
    const ownerId = getWeddingProjectOwner(actor, project);
    if (!(await canAccessWeddingProject({ id, userId: ownerId, guestId })))
      return respErr('project not found', 404);

    const body = inputSchema.parse(await request.json().catch(() => ({})));
    const initialRequestKey = !body.edit
      ? request.headers.get('x-wedding-generation-id')
      : null;
    if (initialRequestKey && !/^[0-9a-f-]{36}$/i.test(initialRequestKey))
      return respErr('invalid generation request id', 400);
    const initialCandidateIds = initialRequestKey
      ? await getWeddingInitialGenerationIds(
          id,
          initialRequestKey,
          WEDDING_MAX_CANDIDATES
        )
      : undefined;
    if (initialCandidateIds) {
      const existing = await Promise.all(
        initialCandidateIds.map(getWeddingGeneration)
      );
      if (existing.every(Boolean))
        return respData({
          jobId: id,
          projectId: id,
          candidates: initialCandidateIds,
          status: existing.every((row) => row?.status === 'failed')
            ? 'failed'
            : 'generating',
          productForUnlock: WEDDING_PACK_PRODUCT_ID,
          resumed: true,
        });
    }

    const allowance = await getWeddingGenerationAllowance(ownerId, id);
    if (
      !allowance.allowed &&
      !(initialCandidateIds && allowance.reasonCode === 'daily_limit')
    )
      return respErr(
        allowance.reason ?? 'generation unavailable',
        allowance.reasonCode === 'daily_limit' ? 429 : 402,
        { reasonCode: allowance.reasonCode }
      );

    // Read freshly-saved Admin settings for this submission.
    const { getAllConfigs, invalidateConfigsCache } = await import(
      '@/shared/models/config'
    );
    invalidateConfigsCache();
    const configs = await getAllConfigs();
    const aiService = await getAIService(configs);
    const runware = aiService.getProvider('runware');
    const openaiApiKey = configs.openai_api_key?.trim();
    const openai =
      openaiApiKey && configs.openai_image_enabled !== 'false'
        ? new OpenAIImageProvider(
            {
              apiKey: openaiApiKey,
              model: configs.openai_image_model?.trim() || OPENAI_IMAGE_MODEL,
              quality: configs.openai_image_quality,
            },
            async (image) => {
              const storage = await getStorageService(configs);
              const stored = await storage.uploadFile({
                body: normalizeCheckerboardTransparency(image).buffer,
                key: `wedding-crests/common/${getUuid()}.png`,
                contentType: 'image/png',
                disposition: 'inline',
              });
              if (!stored.success || !stored.url) {
                throw new Error('Could not store the OpenAI image');
              }
              return stored.url;
            }
          )
        : undefined;
    const provider = body.provider
      ? body.provider === 'openai'
        ? openai
        : aiService.getProvider(body.provider)
      : openai ?? runware ?? aiService.getDefaultProvider();
    if (!provider) {
      return respErr(
        'Image provider is not configured. Check OpenAI and Runware under Admin → Settings → AI.'
      );
    }
    if (provider.name === 'openai' && !(await getStorageService(configs)).getProviderNames().length) {
      return respErr('OpenAI image generation requires R2 or S3 storage.');
    }

    // Resolve the edit (small modification) flow vs. the full generation
    // flow. Edit prompts are transient and intentionally not persisted to
    // the per-style template registry.
    let prompt: string;
    let referenceImages: string[] = [];
    let sourceInput: WeddingProjectInput | null = null;
    const projectUpdate: Record<string, unknown> = {};
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

      if (body.edit.kind === 'assistant') {
        if (!body.edit.plan)
          return respErr('confirmed edit plan required', 400);
        prompt = compileAssistantEditPrompt(body.edit.plan);
      } else if (body.edit.kind === 'lettering') {
        prompt = compileWeddingTextEditPrompt(sourceInput, {
          replaceLetteringStyle: body.edit.replaceLetteringStyle,
        });
      } else if (body.edit.kind === 'design') {
        prompt = compileWeddingDesignEditPrompt(sourceInput, {
          replaceLetteringStyle: body.edit.replaceLetteringStyle,
        });
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

    // Initial generation can also carry reference photos; image edits
    // always include the source crest as the first reference.
    const allReferenceImages = getWeddingReferenceImages(
      sourceInput ?? project.input,
      body.edit
        ? { kind: body.edit.kind, sourceImageUrl: referenceImages[0] }
        : undefined
    );
    assertRasterReferenceImages(allReferenceImages);
    const modelFor = (target: AIProvider, requested?: string) => {
      if (target.name === 'openai') {
        return requested || target.configs.model || OPENAI_IMAGE_MODEL;
      }
      if (!requested && allReferenceImages.length > 0) {
        return (
          process.env.WEDDING_AI_MULTIMODAL_MODEL ||
          (target.name === 'runware' ? target.configs.model : undefined) ||
          'google:nano-banana@2-lite'
        );
      }
      return pickModel(target.name, requested, target.configs.model);
    };
    effectiveModel = modelFor(provider, body.model);

    const versions = getWeddingVersions();
    reservationIds =
      !body.edit && initialCandidateIds
        ? initialCandidateIds
        : Array.from({ length: WEDDING_MAX_CANDIDATES }, () => getUuid());
    const reservation = await reserveWeddingGenerationBatch({
      projectId: id,
      userId: ownerId,
      guestId,
      candidates: reservationIds.map((candidateId, candidateIndex) => ({
        id: candidateId,
        projectId: id,
        candidateIndex,
        provider: provider.name,
        model: effectiveModel,
        prompt,
        promptVersion: versions.promptVersion,
        styleVersion: versions.styleVersion,
        layoutVersion: versions.layoutVersion,
        status: 'reserved',
        cost: 0,
      })),
    });
    if (!reservation.allowed) {
      reservationIds = [];
      return respErr(
        reservation.reason ?? 'generation limit reached',
        reservation.reasonCode === 'daily_limit' ? 429 : 402,
        { reasonCode: reservation.reasonCode }
      );
    }
    if ('existing' in reservation && reservation.existing) {
      return respData({
        jobId: id,
        projectId: id,
        candidates: reservationIds,
        status: 'generating',
        productForUnlock: WEDDING_PACK_PRODUCT_ID,
        resumed: true,
      });
    }
    projectMarkedGenerating = true;
    if (Object.keys(projectUpdate).length > 0) {
      await updateWeddingProject(id, projectUpdate as any);
    }

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
      const attempt = (target: AIProvider, model: string) => ({
        provider: target,
        params: {
          mediaType: AIMediaType.IMAGE,
          model,
          prompt,
          async: true,
          options: {
            candidateIndex,
            // Runware's multimodal model expects references OR dimensions.
            ...(target.name === 'openai' || !allReferenceImages.length
              ? { width: outputWidth, height: outputHeight }
              : {}),
            ...(allReferenceImages.length
              ? {
                  referenceImages:
                    target.name === 'openai'
                      ? allReferenceImages.map((url) =>
                          url.startsWith('/') && !url.startsWith('//')
                            ? new URL(url, configs.app_url).href
                            : url
                        )
                      : allReferenceImages,
                }
              : {}),
          },
        },
      });

      // Record the attempt before crossing the provider boundary: a timeout
      // can still have incurred provider cost, so retries must not erase it.
      await updateWeddingGeneration(reservationIds[candidateIndex], {
        status: 'generating',
        cost: -1,
      });
      providerAttempted = true;
      const submitted = await generateWeddingImage(
        attempt(provider, effectiveModel),
        provider.name === 'openai' && runware
          ? attempt(runware, modelFor(runware))
          : undefined
      );
      const { result } = submitted;
      const submittedProvider = submitted.provider.name;
      effectiveModel = submitted.params.model!;
      if (!result?.taskId)
        throw new Error(
          `AI provider did not return a task id for candidate ${candidateIndex + 1}`
        );

      // Persist the provider receipt before optional ai_task bookkeeping.
      // A bookkeeping failure must not erase an already submitted task.
      await updateWeddingGeneration(reservationIds[candidateIndex], {
        provider: submittedProvider,
        model: effectiveModel,
        providerTaskId: result.taskId,
        sourceImageUrl: result.taskInfo?.images?.[0]?.imageUrl ?? null,
      });
      submittedCandidateIds.push(reservationIds[candidateIndex]);

      // ai_task rows require a FK'd user; guests are tracked in
      // wedding_generation only.
      const aiTask = user
        ? await createAITask({
            id: getUuid(),
            userId: user.id,
            mediaType: AIMediaType.IMAGE,
            provider: submittedProvider,
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
        await updateWeddingGeneration(reservationIds[candidateIndex], {
          aiTaskId: aiTask?.id ?? null,
          candidateIndex,
          provider: submittedProvider,
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
    if (projectId && projectMarkedGenerating) {
      try {
        await settleFailedWeddingReservation(reservationIds, providerAttempted);
      } catch (statusError) {
        console.error(
          '[wedding] failed to roll project status back after generation error',
          statusError
        );
      }
    }
    if (projectId && projectMarkedGenerating) {
      const hasSubmittedCandidates = submittedCandidateIds.length > 0;
      try {
        await updateWeddingProject(
          projectId,
          hasSubmittedCandidates ? 'generating' : 'failed'
        );
      } catch (statusError) {
        console.error(
          '[wedding] failed to reconcile project generation status',
          statusError
        );
      }
      // A submitted receipt is already durable and polling can finish it.
      // Do not turn optional bookkeeping or a later candidate failure into
      // an error that makes the frontend abandon the accepted provider task.
      if (hasSubmittedCandidates) {
        return respData({
          jobId: projectId,
          projectId,
          candidates: submittedCandidateIds,
          status: 'generating',
          productForUnlock: WEDDING_PACK_PRODUCT_ID,
        });
      }
    }
    const modelLabel = ` model: ${effectiveModel}`;
    const base =
      error instanceof Error && error.message
        ? error.message
        : 'generation failed';
    return respErr(base.includes('model:') ? base : `${base}${modelLabel}`);
  }
}
