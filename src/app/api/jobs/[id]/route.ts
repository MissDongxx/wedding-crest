import { normalizeCheckerboardTransparency as normalizeImageBackgroundToWhite } from '@/shared/lib/pure-image';
import { respData, respErr } from '@/shared/lib/resp';
import {
  canAccessWeddingProject,
  getWeddingGenerationAllowance,
  getWeddingProject,
  hasPaidWeddingOrder,
  saveWeddingAssets,
  updateWeddingGeneration,
  updateWeddingProject,
  type NewWeddingAsset,
  type WeddingGeneration,
} from '@/shared/models/wedding';
import {
  getWeddingActor,
  getWeddingProjectOwner,
} from '@/shared/models/wedding-actor';
import { getWeddingReceiptState } from '@/shared/models/wedding-checkout';
import { getAIService } from '@/shared/services/ai';
import { getStorageService } from '@/shared/services/storage';

function extractImageUrl(result: any) {
  return (
    result?.taskInfo?.images?.[0]?.imageUrl ||
    result?.taskResult?.images?.[0]?.imageUrl ||
    result?.taskResult?.output?.[0] ||
    result?.taskResult?.output ||
    result?.taskResult?.data?.[0]?.imageURL ||
    undefined
  );
}

async function storeGeneratedImage(imageUrl: string, key: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`image download failed with status ${response.status}`);
  }
  const input = Buffer.from(await response.arrayBuffer());
  const normalized = normalizeImageBackgroundToWhite(input);
  const storage = await getStorageService();
  return storage.uploadFile({
    body: normalized.buffer,
    key,
    contentType: 'image/png',
    disposition: 'inline',
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await getWeddingProject(id);
    if (!project) return respErr('job not found', 404);
    const actor = await getWeddingActor();
    const user = actor.user;
    const guestId = request.headers.get('x-wedding-guest-id') || undefined;
    const ownerId = getWeddingProjectOwner(actor, project);
    if (!(await canAccessWeddingProject({ id, userId: ownerId, guestId })))
      return respErr('job not found', 404);

    const paid = await hasPaidWeddingOrder(ownerId, id, guestId);
    const receipt = ownerId
      ? await getWeddingReceiptState(ownerId)
      : { receiptEmailMissing: false, hasReceiptEmail: false };

    const aiService = await getAIService();
    const assets: NewWeddingAsset[] = [];

    // Process pending generations in parallel. The previous sequential
    // loop made one GET take 4x as long while the client sat on a frozen
    // progress bar - the Runware query, image download and storage upload
    // for each candidate are independent of each other.
    const pending = project.generations.filter(
      (generation) =>
        !['complete', 'selected', 'failed'].includes(generation.status)
    );
    await Promise.all(
      pending.map(async (generation) => {
        const provider = aiService.getProvider(generation.provider);
        let imageUrl = generation.sourceImageUrl ?? undefined;
        let providerResult: any;
        if (!imageUrl && provider?.query && generation.providerTaskId) {
          try {
            providerResult = await provider.query({
              taskId: generation.providerTaskId,
              mediaType: 'image',
              model: generation.model,
            });
          } catch {
            // Transient provider error: keep polling on the next request.
            return;
          }
          imageUrl = extractImageUrl(providerResult);
          if (
            providerResult?.taskStatus === 'failed' ||
            providerResult?.taskStatus === 'canceled'
          ) {
            await updateWeddingGeneration(generation.id, {
              status: 'failed',
              cost: 0,
            });
            return;
          }
        }
        if (!imageUrl) return;

        let storedImageUrl = imageUrl;
        // OpenAI returns image bytes; the submit route already normalized
        // and stored them before persisting this URL.
        if (generation.provider !== 'openai') {
          try {
            const stored = await storeGeneratedImage(
              imageUrl,
              `wedding-crests/common/${generation.id}.png`
            );
            storedImageUrl = stored.url || imageUrl;
          } catch {
            // Provider URLs remain usable when optional storage or image
            // normalization is not configured.
          }
        }

        // Provider completion is not a visual review. Leave quality unknown
        // until an actual image evaluator supplies evidence-backed results.
        await updateWeddingGeneration(generation.id, {
          status: 'complete',
          sourceImageUrl: storedImageUrl,
          finalImageUrl: storedImageUrl,
          qaScore: null,
        });
        assets.push({
          id: `${generation.id}-source`,
          projectId: id,
          type: 'source_image',
          url: storedImageUrl,
          width: 1024,
          height: 1024,
        });
      })
    );

    if (assets.length > 0) {
      await saveWeddingAssets(id, assets);
    }

    const refreshed = await getWeddingProject(id);
    const hasPending = refreshed?.generations.some(
      (generation: WeddingGeneration) =>
        !['complete', 'selected', 'failed'].includes(generation.status)
    );
    if (refreshed && !hasPending)
      await updateWeddingProject(
        id,
        refreshed.generations.some(
          (generation: WeddingGeneration) =>
            generation.status === 'complete' || generation.status === 'selected'
        )
          ? 'complete'
          : 'failed'
      );
    const finalProject = await getWeddingProject(id);
    const generations = (finalProject?.generations ?? []).map((generation) => ({
      id: generation.id,
      selected: generation.status === 'selected',
      status: (generation.status === 'selected'
        ? 'completed'
        : generation.status) as
        | 'generating'
        | 'completed'
        | 'failed'
        | 'refining',
      candidateIndex: generation.candidateIndex ?? null,
      // The client uses createdAt to tell generation batches apart: after a
      // regenerate the project holds the old batch plus the new one, and
      // only the newest row per candidateIndex belongs to the batch the
      // user is currently looking at.
      createdAt: generation.createdAt
        ? new Date(generation.createdAt).toISOString()
        : null,
      sourceImageUrl: generation.sourceImageUrl ?? null,
      prompt: generation.prompt ?? null,
      // Historical scores were synthetic constants, not image assessments.
      // Do not surface them as quality evidence or rewrite historical data.
      reviewScore: null,
      reviewStatus: 'unreviewed' as const,
      reviewNotes: null,
    }));
    const allowance = await getWeddingGenerationAllowance(ownerId, id);
    return respData({
      jobId: id,
      status: finalProject?.status ?? 'failed',
      project: finalProject,
      generations,
      paid,
      ...receipt,
      signedIn: Boolean(user),
      allowance,
    });
  } catch (error) {
    return respErr(
      error instanceof Error ? error.message : 'job lookup failed'
    );
  }
}
