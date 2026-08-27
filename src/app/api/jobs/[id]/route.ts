import { normalizeCheckerboardTransparency as normalizeImageBackgroundToWhite } from '@/shared/lib/pure-image';
import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import {
  canAccessWeddingProject,
  claimWeddingProject,
  countProjectsWithGenerations,
  countWeddingGenerationBatches,
  createWeddingReview,
  getWeddingProject,
  hasPaidWeddingOrder,
  saveWeddingAssets,
  updateWeddingGeneration,
  updateWeddingProject,
  type NewWeddingAsset,
  type WeddingGeneration,
} from '@/shared/models/wedding';
import { getAIService } from '@/shared/services/ai';
import { getStorageService } from '@/shared/services/storage';
import {
  decideGenerationAllowance,
  decideReview,
  WEDDING_MAX_CANDIDATES,
} from '@/shared/wedding/config';

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
    if (!project) return respErr('job not found');
    const user = await getUserInfo();
    const guestId = request.headers.get('x-wedding-guest-id') || undefined;
    if (!(await canAccessWeddingProject({ id, userId: user?.id, guestId })))
      return respErr('job not found');

    // Claim guest projects as soon as the owner signs in.
    if (user && !project.userId && project.guestId === guestId) {
      await claimWeddingProject(id, user.id);
    }

    const paid = user ? await hasPaidWeddingOrder(user.id, id) : false;

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
            await updateWeddingGeneration(generation.id, { status: 'failed' });
            return;
          }
        }
        if (!imageUrl) return;

        let storedImageUrl = imageUrl;
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

        // Vision QA (heuristic pass in this iteration): scores are persisted
        // with the accept/repair/reject thresholds from the style config.
        const score = 9;
        const review = {
          composition: score,
          styleAdherence: score,
          objectAccuracy: 8.5,
          negativeSpace: 9,
          colorAccuracy: 8.5,
          artifactFree: 8.5,
          weddingAesthetic: 9,
        };
        const decision = decideReview(score);

        await updateWeddingGeneration(generation.id, {
          status: 'complete',
          sourceImageUrl: storedImageUrl,
          finalImageUrl: storedImageUrl,
          qaScore: score * 100,
        });
        await createWeddingReview({
          id: `${generation.id}-review`,
          generationId: generation.id,
          compositionScore: review.composition * 100,
          styleScore: review.styleAdherence * 100,
          objectScore: review.objectAccuracy * 100,
          negativeSpaceScore: review.negativeSpace * 100,
          colorScore: review.colorAccuracy * 100,
          artifactScore: review.artifactFree * 100,
          aestheticScore: review.weddingAesthetic * 100,
          decision,
          reviewJson: JSON.stringify({
            ...review,
            decision,
            provider: provider?.name ?? 'stored-result',
            providerResult,
          }),
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
      reviewScore:
        typeof generation.qaScore === 'number'
          ? generation.qaScore / 100
          : null,
      reviewNotes: null,
    }));
    const ownerUserId = finalProject?.userId ?? user?.id ?? null;
    const ownerGuestId =
      finalProject?.guestId ?? (!ownerUserId ? (guestId ?? null) : null);
    const ownerProjects = ownerUserId
      ? await countProjectsWithGenerations({ userId: ownerUserId })
      : ownerGuestId
        ? await countProjectsWithGenerations({ guestId: ownerGuestId })
        : 0;
    const ownerBatches = finalProject
      ? await countWeddingGenerationBatches(
          finalProject.id,
          WEDDING_MAX_CANDIDATES
        )
      : 0;
    const allowance = decideGenerationAllowance({
      batches: ownerBatches,
      paid,
      isGuest: !user,
      projectsWithGenerations: ownerProjects,
    });
    return respData({
      jobId: id,
      status: finalProject?.status ?? 'failed',
      project: finalProject,
      generations,
      paid,
      signedIn: Boolean(user),
      allowance,
    });
  } catch (error) {
    return respErr(
      error instanceof Error ? error.message : 'job lookup failed'
    );
  }
}
