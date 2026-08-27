'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import { layoutsForStyle } from '@/shared/wedding/config';
import {
  WEDDING_MAX_FLOWERS,
  WEDDING_MAX_PALETTE_COLORS,
  WEDDING_MAX_PERSONAL_ELEMENTS,
  weddingFlowerOptions,
  WeddingNameDisplay,
  weddingPalettes,
  weddingPersonalElementOptions,
  weddingStyles,
  weddingTypography,
} from '@/shared/wedding/types';

interface GenerationData {
  id: string;
  selected?: boolean;
  status: 'generating' | 'completed' | 'failed' | 'refining';
  candidateIndex: number | null;
  createdAt: string | null;
  sourceImageUrl: string | null;
  prompt: string | null;
  reviewScore: number | null;
  reviewNotes: string | null;
}

interface ProjectData {
  id: string;
  status: 'draft' | 'generating' | 'complete' | 'failed';
  partner1: string;
  partner2: string;
  weddingDate: string | null;
  style: string;
  layout: string;
  typography: string;
  palette: string[];
  location: string | null;
  venue: string | null;
  flowers: string[];
  personalElements: string[];
  nameDisplay: WeddingNameDisplay;
  showDate: boolean;
  complexity: 'minimal' | 'medium' | 'rich';
  frameId?: string | null;
  frameUrl?: string | null;
}

interface JobResponse {
  jobId: string;
  status: 'draft' | 'generating' | 'complete' | 'failed';
  project: ProjectData;
  generations: GenerationData[];
  paid: boolean;
  signedIn: boolean;
  allowance: {
    allowed: boolean;
    reason?: string;
    maxBatches?: number;
  };
}

interface ApiEnvelope<T> {
  code?: number;
  message?: string;
  data?: T;
  error?: string;
}

const STAGE_STATUS_COPY: Record<string, string> = {
  queued: 'Queued — getting ready',
  preparing: 'Preparing your brief',
  illustrating: 'Illustrating your crest',
  reviewing: 'Reviewing for quality',
  composing: 'Composing typography',
  finalizing: 'Finalizing files',
};

function stageLabel(stage: string | null | undefined) {
  if (!stage) return 'Queued';
  return STAGE_STATUS_COPY[stage] ?? stage;
}

/**
 * Return only the generations belonging to the most recent batch.
 *
 * Each call to /api/projects/[id]/generate appends WEDDING_MAX_CANDIDATES
 * new rows without removing the previous batch, and the rows are stored
 * ordered by (candidateIndex, createdAt) so the LAST row per candidate
 * index is always the newest one. After a regenerate the project
 * therefore holds two interleaved batches: the client only ever wants to
 * show the latest one, both for the master crest and for the alternates
 * grid.
 */
function latestBatchOf(generations: GenerationData[]): GenerationData[] {
  if (generations.length === 0) return [];
  const byIndex = new Map<number, GenerationData>();
  for (const generation of generations) {
    if (generation.candidateIndex == null) continue;
    byIndex.set(generation.candidateIndex, generation);
  }
  return [...byIndex.values()].sort(
    (a, b) => (a.candidateIndex ?? 0) - (b.candidateIndex ?? 0)
  );
}

export function WeddingResult({ projectId }: { projectId: string }) {
  const t = useTranslations('pages.design');
  const router = useRouter();

  const [data, setData] = useState<JobResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [showAllowanceHint, setShowAllowanceHint] = useState(true);
  // Bumping this resets the edit panel to match the freshly-persisted
  // project (e.g. after a successful apply).
  const [draftResetKey, setDraftResetKey] = useState(0);
  const [progressStage, setProgressStage] = useState('queued');
  const [progressPercent, setProgressPercent] = useState(5);
  // Distinguishes the in-flight fetchJob so the loading banner can pulse
  // during a long GET (the /api/jobs route can take 10-30s while it
  // downloads and stores 4 images in parallel - the user otherwise sees
  // a frozen stage label and assumes the page is stuck).
  const [polling, setPolling] = useState(false);
  // Bumped by regenerate / applyPanelChanges after a successful generate
  // POST. The poll loop stops permanently when status first hits
  // 'complete' (to save quota), so a re-trigger of generation needs the
  // epoch to restart the effect - otherwise the new batch is never
  // processed and the page is stuck on the "Hang tight" banner with no
  // EditPanel, no alternates and no selection update.
  const [pollEpoch, setPollEpoch] = useState(0);

  const guestId =
    typeof window !== 'undefined'
      ? localStorage.getItem('wedding_guest_id')
      : null;

  const fetchJob = useCallback(async () => {
    setPolling(true);
    try {
      const response = await fetch(`/api/jobs/${projectId}`, {
        headers: guestId ? { 'x-wedding-guest-id': guestId } : {},
        cache: 'no-store',
      });
      const envelope = (await response
        .json()
        .catch(() => ({}))) as ApiEnvelope<JobResponse>;
      if (
        !response.ok ||
        (envelope.code !== undefined && envelope.code !== 0)
      ) {
        setError(envelope.error || envelope.message || t('load_error'));
        return null;
      }
      const body = envelope.data ?? (envelope as unknown as JobResponse);
      const rawProject = body.project as ProjectData & {
        input?: Partial<ProjectData>;
      };
      const normalizedBody: JobResponse = rawProject.input
        ? {
            ...body,
            project: { ...rawProject, ...rawProject.input },
          }
        : body;
      setError(null);
      setData(normalizedBody);
      // Only honor a persisted "selected" within the latest batch. After
      // a regenerate the project keeps the old batch's selected row, and
      // a plain findIndex would jump the user back to a stale image.
      const latest = latestBatchOf(normalizedBody.generations);
      const persistedSelection = latest.findIndex(
        (generation) => generation.selected
      );
      setSelectedIndex(persistedSelection >= 0 ? persistedSelection : 0);
      return normalizedBody;
    } catch {
      setError(t('load_error'));
      return null;
    } finally {
      setPolling(false);
    }
  }, [projectId, guestId, t]);

  useEffect(() => {
    let cancelled = false;
    let poll = 0;
    const stages = [
      'queued',
      'preparing',
      'illustrating',
      'reviewing',
      'composing',
      'finalizing',
    ];

    const tick = async () => {
      if (cancelled) return;
      const next = await fetchJob();
      if (!next) {
        poll = window.setTimeout(tick, 4000);
        return;
      }
      if (next.status === 'complete' || next.status === 'failed') {
        setProgressStage('finalizing');
        setProgressPercent(100);
        return;
      }
      poll = window.setTimeout(tick, 2500);
      // advance faux progress
      setProgressStage((current) => {
        const idx = stages.indexOf(current);
        const nextIdx = Math.min(idx + 1, stages.length - 1);
        return stages[nextIdx];
      });
      setProgressPercent((p) => Math.min(p + 6, 92));
    };
    tick();
    return () => {
      cancelled = true;
      if (poll) clearTimeout(poll);
    };
  }, [fetchJob, pollEpoch]);

  const project = data?.project;
  const generations = useMemo(
    () => latestBatchOf(data?.generations ?? []),
    [data?.generations]
  );
  const selectedGeneration = generations[selectedIndex];

  const selectGeneration = useCallback(
    async (index: number) => {
      const generation = generations[index];
      if (!project || !generation) return;
      const previousIndex = selectedIndex;
      setSelectedIndex(index);
      setPreviewIndex(index);
      try {
        const response = await fetch(`/api/projects/${project.id}/select`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(guestId ? { 'x-wedding-guest-id': guestId } : {}),
          },
          body: JSON.stringify({ generationId: generation.id }),
        });
        const envelope = (await response
          .json()
          .catch(() => ({}))) as ApiEnvelope<unknown>;
        if (
          !response.ok ||
          (envelope.code !== undefined && envelope.code !== 0)
        ) {
          setSelectedIndex(previousIndex);
          toast.error(envelope.message || t('select_error'));
        }
      } catch {
        setSelectedIndex(previousIndex);
        toast.error(t('select_error'));
      }
    },
    [generations, project, selectedIndex, guestId, t]
  );

  const downloadIdentityPack = useCallback(async () => {
    if (!project || downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/download`);
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || contentType.includes('application/json')) {
        // Read the raw text first so a non-JSON (proxy, HTML error page)
        // or an envelope without `message` still surfaces a useful toast
        // instead of the generic "image pack could not be prepared".
        const raw = await response.text().catch(() => '');
        let envelope: ApiEnvelope<unknown> = {};
        try {
          envelope = raw ? (JSON.parse(raw) as ApiEnvelope<unknown>) : {};
        } catch {
          envelope = {};
        }
        const detail =
          envelope.message || envelope.error || raw.trim() || t('download_error');
        const statusLine = `${response.status} ${response.statusText || ''}`.trim();
        toast.error(statusLine ? `${statusLine}: ${detail}` : detail);
        // eslint-disable-next-line no-console
        console.error(
          `[wedding-result] download failed status=${response.status} body=${raw || '(empty)'}`
        );
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const fileNameMatch = disposition.match(/filename="([^"]+)"/i);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileNameMatch?.[1] || 'wedding-image-pack.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[wedding-result] download failed', error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t('download_error')
      );
    } finally {
      setDownloading(false);
    }
  }, [project, downloading, t]);

  const regenerate = useCallback(async () => {
    if (!project) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(guestId ? { 'x-wedding-guest-id': guestId } : {}),
        },
      });
      const raw = await response.text();
      let body: ApiEnvelope<unknown> = {};
      try {
        body = raw ? (JSON.parse(raw) as ApiEnvelope<unknown>) : {};
      } catch {
        // Non-JSON body (HTML 500 from Next, an empty body, a proxy
        // page). Surface what we can: status + the first ~200 chars of
        // raw text so a misconfigured model name or a Runware-side
        // 5xx isn't masked by the generic "Generation request failed".
        const status = response.status || 0;
        const sample = raw ? raw.slice(0, 200) : '(empty body)';
        throw new Error(
          `Generation request failed (${status || 'no response'}): ${sample}`
        );
      }
      if (!response.ok) {
        if (body?.error === 'quota_exceeded') {
          toast.error(t('quota_exceeded'));
        } else {
          const detail =
            body?.message || body?.error || t('update_error');
          const statusLine =
            `${response.status} ${response.statusText || ''}`.trim();
          toast.error(statusLine ? `${statusLine}: ${detail}` : detail);
        }
        return;
      }
      setSelectedIndex(0);
      setProgressStage('queued');
      setProgressPercent(5);
      // Bump the poll epoch so the polling effect restarts. Without
      // this, a previous 'complete' status would have killed the loop
      // and the new batch would never be polled - the page would freeze
      // on the "Hang tight" banner with no alternates, no EditPanel.
      setPollEpoch((epoch) => epoch + 1);
      await fetchJob();
    } catch (error) {
      console.error('[wedding-result] regenerate failed', error);
      toast.error(error instanceof Error ? error.message : t('update_error'));
    } finally {
      setBusy(false);
    }
  }, [project, guestId, t, fetchJob]);

  const applyPanelChanges = useCallback(
    async (params: {
      fieldPatch: Partial<ProjectData>;
      regenKind: 'artwork' | 'quick_edit' | 'lettering' | null;
      quickEdit:
        | 'reduce_colors'
        | 'make_simpler'
        | 'remove_personal_element'
        | null;
    }) => {
      if (!project) return;
      setBusy(true);
      try {
        // 1. Persist any project field changes first.
        if (Object.keys(params.fieldPatch).length > 0) {
          const response = await fetch(`/api/projects/${project.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...(guestId ? { 'x-wedding-guest-id': guestId } : {}),
            },
            body: JSON.stringify(params.fieldPatch),
          });
          const envelope = (await response
            .json()
            .catch(() => ({}))) as ApiEnvelope<{ project?: ProjectData }>;
          if (
            !response.ok ||
            (envelope.code !== undefined && envelope.code !== 0)
          ) {
            toast.error(
              envelope.error || envelope.message || t('update_error')
            );
            return;
          }
          const updatedProject =
            envelope.data?.project ??
            (envelope as { project?: ProjectData }).project;
          if (updatedProject) {
            setData((prev) =>
              prev ? { ...prev, project: updatedProject } : prev
            );
          }
        }

        // 2. Every visible crest edit is rendered by the AI. Lettering edits
        //    preserve the illustration; design edits re-render the full image.
        if (params.regenKind && selectedGeneration) {
          const editBody: {
            sourceGenerationId: string;
            kind:
              | 'reduce_colors'
              | 'make_simpler'
              | 'remove_personal_element'
              | 'design'
              | 'lettering';
          } =
            params.regenKind === 'artwork' && params.quickEdit
              ? {
                  sourceGenerationId: selectedGeneration.id,
                  kind: params.quickEdit,
                }
              : params.regenKind === 'lettering'
                ? {
                    sourceGenerationId: selectedGeneration.id,
                    kind: 'lettering',
                  }
                : {
                    sourceGenerationId: selectedGeneration.id,
                    kind: 'design',
                  };

          const response = await fetch(`/api/projects/${project.id}/generate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(guestId ? { 'x-wedding-guest-id': guestId } : {}),
            },
            body: JSON.stringify({ edit: editBody }),
          });
          const envelope = (await response
            .json()
            .catch(() => ({}))) as ApiEnvelope<unknown> & { error?: string };
          if (
            !response.ok ||
            (envelope.code !== undefined && envelope.code !== 0)
          ) {
            if (envelope.error === 'quota_exceeded') {
              toast.error(t('quota_exceeded'));
            } else {
              toast.error(
                envelope.error || envelope.message || t('update_error')
              );
            }
            return;
          }
          setSelectedIndex(0);
          setProgressStage('queued');
          setProgressPercent(5);
          // Same reason as in regenerate(): the polling loop was probably
          // idle (the project was 'complete'), so we need to restart it
          // to pick up the new edit generation.
          setPollEpoch((epoch) => epoch + 1);
        }

        // 3. Always reset the panel draft after a successful apply.
        setDraftResetKey((k) => k + 1);
        await fetchJob();
        toast.success(t('updated'));
      } finally {
        setBusy(false);
      }
    },
    [project, guestId, t, fetchJob, selectedGeneration]
  );

  const checkout = useCallback(async () => {
    if (!project) return;
    if (!data?.signedIn) {
      // guest flow: must sign in (or create a free account) before payment
      const next = `/design/${project.id}?paid=1`;
      router.push(`/sign-in?callbackUrl=${encodeURIComponent(next)}`);
      return;
    }
    setPaying(true);
    try {
      const response = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(guestId ? { 'x-wedding-guest-id': guestId } : {}),
        },
        body: JSON.stringify({
          product_id: 'wedding_identity_pack',
          metadata: { project_id: project.id },
        }),
      });
      const envelope = (await response
        .json()
        .catch(() => ({}))) as ApiEnvelope<{
        checkoutUrl?: string;
        url?: string;
      }> & {
        checkoutUrl?: string;
        url?: string;
      };
      if (
        !response.ok ||
        (envelope.code !== undefined && envelope.code !== 0)
      ) {
        toast.error(envelope.error || envelope.message || t('pay_error'));
        return;
      }
      const checkoutInfo = envelope.data ?? envelope;
      const checkoutUrl = checkoutInfo.checkoutUrl || checkoutInfo.url;
      if (!checkoutUrl) {
        toast.error(t('pay_error'));
        return;
      }
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('[wedding-result] checkout failed', error);
      toast.error(error instanceof Error ? error.message : t('pay_error'));
    } finally {
      setPaying(false);
    }
  }, [project, guestId, t, data?.signedIn, router]);

  if (error && !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-serif text-2xl">{t('error_title')}</h1>
        <p className="text-muted-foreground mt-3">{error}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => fetchJob()}>{t('retry')}</Button>
          <Button variant="outline" onClick={() => router.push('/create')}>
            {t('start_over')}
          </Button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <div className="bg-wedding-ivory mx-auto h-64 w-64 animate-pulse rounded-2xl" />
        <p className="text-muted-foreground mt-6">{t('loading')}</p>
      </div>
    );
  }

  const isComplete = data?.status === 'complete';
  const isFailed = data?.status === 'failed';
  const paid = data?.paid ?? false;

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        {/* progress / status banner */}
        {!isComplete && !isFailed && (
          <div
            className={cn(
              'bg-muted/40 mb-8 rounded-2xl p-6 text-center transition-colors',
              polling && 'ring-primary/30 ring-2'
            )}
            // The /api/jobs route can take 10-30s while it downloads and
            // stores 4 images in parallel. A pulse on the banner tells the
            // user the page is still working while the GET is in flight,
            // instead of looking frozen on a static stage label.
            aria-busy={polling}
          >
            <p className="font-serif text-xl">
              {polling ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="bg-primary inline-block h-2 w-2 animate-pulse rounded-full"
                    aria-hidden
                  />
                  {stageLabel(progressStage)}
                </span>
              ) : (
                stageLabel(progressStage)
              )}
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              {t('generating_hint', { stage: stageLabel(progressStage) })}
            </p>
            <div className="bg-background mt-4 h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {isFailed && (
          <div className="border-destructive/40 bg-destructive/5 mb-8 rounded-2xl border p-6 text-center">
            <p className="text-destructive font-serif text-xl">
              {t('failed_title')}
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              {t('failed_hint')}
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={regenerate}
              disabled={busy}
            >
              {t('try_again')}
            </Button>
          </div>
        )}

        {isComplete && (
          <ScrollAnimation>
            <div className="mb-6 text-center">
              <h1 className="font-serif text-3xl text-balance md:text-4xl">
                {t('title', {
                  partner1: project.partner1,
                  partner2: project.partner2,
                })}
              </h1>
              <p className="text-muted-foreground mt-2 text-balance">
                {t('subtitle')}
              </p>
            </div>
          </ScrollAnimation>
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          {/* master crest + candidates */}
          <div className="space-y-8">
            <div className="bg-wedding-ivory rounded-2xl border p-6">
              <p className="text-muted-foreground mb-3 text-xs tracking-[0.2em] uppercase">
                {t('master_crest')}
              </p>
              <AiCrestImage
                generation={selectedGeneration}
                paid={paid}
                alt={`${project.partner1} and ${project.partner2} wedding crest`}
                className="mx-auto w-full max-w-md"
              />
              {!paid && isComplete && (
                <p className="text-muted-foreground mt-4 text-center text-xs">
                  {t('preview_watermark')}
                </p>
              )}
            </div>

            {isComplete && generations.length > 1 && (
              <div>
                <p className="text-muted-foreground mb-3 text-xs tracking-[0.2em] uppercase">
                  {t('alternates')}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {generations.map((gen, idx) => (
                    <button
                      key={gen.id}
                      type="button"
                      onClick={() => selectGeneration(idx)}
                      className={cn(
                        'bg-wedding-ivory rounded-2xl border p-3 transition-colors',
                        selectedIndex === idx
                          ? 'border-primary ring-primary/30 ring-2'
                          : 'hover:border-primary/40'
                      )}
                    >
                      <CrestMini
                        generation={gen}
                        paid={paid}
                        alt={`${project.partner1} and ${project.partner2} wedding crest option ${idx + 1}`}
                      />
                      <p className="text-muted-foreground mt-2 text-center text-xs">
                        {t('candidate_label', { index: idx + 1 })}
                        {gen.reviewScore != null
                          ? ` · ${Math.round(gen.reviewScore * 10) / 10}`
                          : ''}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Dialog
              open={previewIndex !== null}
              onOpenChange={(open) => {
                if (!open) setPreviewIndex(null);
              }}
            >
              <DialogContent className="max-w-3xl">
                {previewIndex !== null && generations[previewIndex] && (
                  <>
                    <DialogTitle>
                      {t('candidate_label', { index: previewIndex + 1 })}
                    </DialogTitle>
                    <div className="bg-wedding-ivory rounded-2xl border p-4 sm:p-8">
                      <CrestMini
                        generation={generations[previewIndex]}
                        paid={paid}
                        alt={`${project.partner1} and ${project.partner2} wedding crest option ${previewIndex + 1}`}
                        className="mx-auto w-full max-w-2xl"
                      />
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>

          {/* unlock panel */}
          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div id="wedding-pricing" className="rounded-2xl border p-6">
              <p className="font-serif text-xl">{t('unlock_title')}</p>
              <p className="text-muted-foreground mt-2 text-sm">
                {t('unlock_description')}
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>· {t('unlock_feature_1')}</li>
                <li>· {t('unlock_feature_2')}</li>
                <li>· {t('unlock_feature_3')}</li>
                <li>· {t('unlock_feature_4')}</li>
              </ul>
              <p className="mt-4 font-serif text-2xl">$19</p>
              <p className="text-muted-foreground text-xs">
                {t('unlock_unit')}
              </p>
              {!paid ? (
                <>
                  {!data?.signedIn && (
                    <p className="text-muted-foreground mt-3 text-xs">
                      {t('unlock_signin_hint')}
                    </p>
                  )}
                  <Button
                    className="mt-4 w-full"
                    size="lg"
                    onClick={checkout}
                    disabled={paying || !isComplete}
                  >
                    {paying ? t('unlock_processing') : t('unlock_cta')}
                  </Button>
                  {data?.allowance &&
                    !data.allowance.allowed &&
                    showAllowanceHint && (
                      <div className="bg-muted/40 text-muted-foreground relative mt-3 rounded-lg p-3 pr-9 text-xs">
                        <button
                          type="button"
                          className="hover:bg-background/80 absolute top-2 right-2 rounded p-1 transition-colors"
                          onClick={() => setShowAllowanceHint(false)}
                          aria-label={t('dismiss_allowance_hint')}
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </button>
                        <p>{data.allowance.reason || t('allowance_hint')}</p>
                        <a
                          className="text-primary mt-2 inline-block font-medium underline underline-offset-2"
                          href="#wedding-pricing"
                        >
                          {t('allowance_link')}
                        </a>
                      </div>
                    )}
                </>
              ) : (
                <Button
                  className="mt-4 w-full"
                  size="lg"
                  onClick={downloadIdentityPack}
                  disabled={downloading}
                >
                  {downloading ? t('download_preparing') : t('download_zip')}
                </Button>
              )}
            </div>

            {/* edit panel follows the pricing module */}
            {isComplete && (
              <EditPanel
                project={project}
                busy={busy}
                hasSelectedGeneration={!!selectedGeneration}
                draftResetKey={draftResetKey}
                onApply={applyPanelChanges}
                t={{
                  quick_edits: t('quick_edits'),
                  quick_edits_hint: t('quick_edits_hint'),
                  reduce_colors: t('reduce_colors'),
                  make_simpler: t('make_simpler'),
                  remove_personal_element: t('remove_personal_element'),
                  edit_title: t('edit_title'),
                  edit_hint: t('edit_hint'),
                  edit_select_category: t('edit_select_category'),
                  edit_category_lettering: t('edit_category_lettering'),
                  edit_category_colors: t('edit_category_colors'),
                  edit_category_flowers: t('edit_category_flowers'),
                  edit_category_elements: t('edit_category_elements'),
                  edit_category_frame: t('edit_category_frame'),
                  edit_partner1: t('edit_partner1'),
                  edit_partner2: t('edit_partner2'),
                  edit_date: t('edit_date'),
                  edit_palette_label: t('edit_palette_label'),
                  edit_custom_color: t('edit_custom_color'),
                  edit_invalid_hex: t('edit_invalid_hex'),
                  edit_add: t('edit_add'),
                  edit_flowers_label: t('edit_flowers_label'),
                  edit_elements_label: t('edit_elements_label'),
                  edit_frame_none: t('edit_frame_none'),
                  edit_frame_loading: t('edit_frame_loading'),
                  edit_frame_empty: t('edit_frame_empty'),
                  edit_pending: (count) => t('edit_pending', { count }),
                  edit_apply: t('edit_apply'),
                  edit_apply_lettering_hint: t('edit_apply_lettering_hint'),
                  edit_apply_regenerate_hint: t('edit_apply_regenerate_hint'),
                  edit_apply_quick_edit_hint: t('edit_apply_quick_edit_hint'),
                  edit_names_required: t('edit_names_required'),
                  edit_limit: (count) => t('edit_limit', { count }),
                  typography_pairing: t('typography_pairing'),
                  layout_label: t('layout_label'),
                  name_display_label: t('name_display_label'),
                  show_date_label: t('show_date_label'),
                  show_date_on: t('show_date_on'),
                  show_date_off: t('show_date_off'),
                }}
              />
            )}

            <div className="rounded-2xl border p-6">
              <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
                {t('regenerate_title')}
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                {t('regenerate_hint')}
              </p>
              <Button
                className="mt-3 w-full"
                variant="outline"
                onClick={regenerate}
                disabled={busy || !isComplete}
                aria-busy={busy}
              >
                {busy ? t('generating_hint') : t('regenerate_cta')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CrestMini({
  generation,
  paid,
  alt,
  className,
}: {
  generation: GenerationData;
  paid: boolean;
  alt: string;
  className?: string;
}) {
  return (
    <AiCrestImage
      generation={generation}
      paid={paid}
      alt={alt}
      className={className}
    />
  );
}

function AiCrestImage({
  generation,
  paid,
  alt,
  className,
}: {
  generation: GenerationData | undefined;
  paid: boolean;
  alt: string;
  className?: string;
}) {
  if (!generation?.sourceImageUrl) {
    return (
      <div
        className={cn('bg-muted/40 aspect-square animate-pulse', className)}
      />
    );
  }
  return (
    <div className={cn('relative aspect-square overflow-hidden', className)}>
      {/* The provider/storage URL is dynamic, so a native image avoids a
          domain allow-list and preserves the original AI pixels. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={generation.sourceImageUrl}
        alt={alt}
        className="h-full w-full object-contain"
      />
      {!paid && (
        <div
          className="pointer-events-none absolute inset-0 grid grid-cols-2 place-items-center overflow-hidden opacity-20"
          aria-hidden="true"
        >
          {Array.from({ length: 8 }, (_, index) => (
            <span
              key={index}
              className="-rotate-[24deg] text-[10px] font-semibold tracking-[0.28em] text-black sm:text-xs"
            >
              PREVIEW
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* EditPanel: Quick edits + Edit your design (left/right tabs)                 */
/* -------------------------------------------------------------------------- */

type EditCategory = 'lettering' | 'colors' | 'flowers' | 'elements' | 'frame';

type QuickEditKind =
  | 'reduce_colors'
  | 'make_simpler'
  | 'remove_personal_element';

interface FrameItem {
  id: string;
  name: string;
  style: string;
  url: string;
  thumbnailUrl: string;
  altText?: string;
}

interface EditDraft {
  // Lettering
  partner1: string;
  partner2: string;
  weddingDate: string;
  typography: string;
  layout: string;
  nameDisplay: WeddingNameDisplay;
  showDate: boolean;
  // Colors
  palette: string[];
  // Flowers & personal elements
  flowers: string[];
  personalElements: string[];
  // Frame
  frameId: string | null;
  // Quick edit (queued, applied with the next Apply)
  quickEdit: QuickEditKind | null;
}

interface EditPanelTexts {
  quick_edits: string;
  quick_edits_hint: string;
  reduce_colors: string;
  make_simpler: string;
  remove_personal_element: string;
  edit_title: string;
  edit_hint: string;
  edit_select_category: string;
  edit_category_lettering: string;
  edit_category_colors: string;
  edit_category_flowers: string;
  edit_category_elements: string;
  edit_category_frame: string;
  edit_partner1: string;
  edit_partner2: string;
  edit_date: string;
  edit_palette_label: string;
  edit_custom_color: string;
  edit_invalid_hex: string;
  edit_add: string;
  edit_flowers_label: string;
  edit_elements_label: string;
  edit_frame_none: string;
  edit_frame_loading: string;
  edit_frame_empty: string;
  edit_pending: (count: number) => string;
  edit_apply: string;
  edit_apply_lettering_hint: string;
  edit_apply_regenerate_hint: string;
  edit_apply_quick_edit_hint: string;
  edit_names_required: string;
  edit_limit: (count: number) => string;
  typography_pairing: string;
  layout_label: string;
  name_display_label: string;
  show_date_label: string;
  show_date_on: string;
  show_date_off: string;
}

function EditPanel({
  project,
  busy,
  hasSelectedGeneration,
  draftResetKey,
  onApply,
  t,
}: {
  project: ProjectData;
  busy: boolean;
  hasSelectedGeneration: boolean;
  draftResetKey: number;
  onApply: (params: {
    fieldPatch: Partial<ProjectData>;
    regenKind: 'artwork' | 'quick_edit' | 'lettering' | null;
    quickEdit: QuickEditKind | null;
  }) => Promise<void>;
  t: EditPanelTexts;
}) {
  const [activeTab, setActiveTab] = useState<'quick' | 'edit'>('quick');
  const [category, setCategory] = useState<EditCategory | null>(null);
  const [customColor, setCustomColor] = useState('');
  const [colorError, setColorError] = useState<string | null>(null);
  const [frames, setFrames] = useState<FrameItem[] | null>(null);
  const [framesLoading, setFramesLoading] = useState(false);

  // Initialise the draft from the current project on first mount.
  const initialDraft: EditDraft = {
    partner1: project.partner1,
    partner2: project.partner2,
    weddingDate: project.weddingDate ?? '',
    typography: project.typography,
    layout: project.layout,
    nameDisplay: project.nameDisplay,
    showDate: project.showDate,
    palette: project.palette,
    flowers: project.flowers,
    personalElements: project.personalElements,
    frameId: project.frameId ?? null,
    quickEdit: null,
  };
  const [draft, setDraft] = useState<EditDraft>(initialDraft);

  // Resync the draft whenever the parent signals a fresh apply (or when
  // the project data changes after a fetch).
  useEffect(() => {
    setDraft(initialDraft);
    setCategory(null);
    setCustomColor('');
    setColorError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftResetKey, project.id]);

  // Lazy-load the frame library for the project's current style.
  useEffect(() => {
    let cancelled = false;
    async function loadFrames() {
      setFramesLoading(true);
      try {
        const response = await fetch(
          `/api/wedding/frames?style=${encodeURIComponent(project.style)}`
        );
        const body = (await response.json().catch(() => ({}))) as {
          items?: FrameItem[];
        };
        if (cancelled) return;
        setFrames(body.items ?? []);
      } catch {
        if (!cancelled) setFrames([]);
      } finally {
        if (!cancelled) setFramesLoading(false);
      }
    }
    if (project.style) loadFrames();
    return () => {
      cancelled = true;
    };
  }, [project.style]);

  // Compute the diff between the current draft and the persisted project.
  const changes = useMemo(() => {
    const fieldPatch: Partial<ProjectData> = {};
    if (draft.partner1 !== project.partner1)
      fieldPatch.partner1 = draft.partner1;
    if (draft.partner2 !== project.partner2)
      fieldPatch.partner2 = draft.partner2;
    if ((draft.weddingDate || null) !== (project.weddingDate ?? null)) {
      fieldPatch.weddingDate = draft.weddingDate || null;
    }
    if (draft.typography !== project.typography) {
      fieldPatch.typography = draft.typography;
    }
    if (draft.layout !== project.layout) fieldPatch.layout = draft.layout;
    if (draft.nameDisplay !== project.nameDisplay) {
      fieldPatch.nameDisplay = draft.nameDisplay;
    }
    if (draft.showDate !== project.showDate) {
      fieldPatch.showDate = draft.showDate;
    }
    if (
      draft.palette.length !== project.palette.length ||
      draft.palette.some((c, i) => c !== project.palette[i])
    ) {
      fieldPatch.palette = draft.palette;
    }
    if (
      draft.flowers.length !== project.flowers.length ||
      draft.flowers.some((f, i) => f !== project.flowers[i])
    ) {
      fieldPatch.flowers = draft.flowers;
    }
    if (
      draft.personalElements.length !== project.personalElements.length ||
      draft.personalElements.some((e, i) => e !== project.personalElements[i])
    ) {
      fieldPatch.personalElements = draft.personalElements;
    }
    if ((draft.frameId ?? null) !== (project.frameId ?? null)) {
      fieldPatch.frameId = draft.frameId ?? null;
    }
    return fieldPatch;
  }, [draft, project]);

  const fieldChangeCount = Object.keys(changes).length;
  const hasQuickEdit = draft.quickEdit !== null;
  const hasChanges = fieldChangeCount > 0 || hasQuickEdit;

  // Every visible change goes back through image generation: lettering edits
  // preserve the artwork, while palette/motif/frame/layout edits redesign it.
  const letteringOnly =
    !hasQuickEdit &&
    Object.keys(changes).every((k) =>
      [
        'partner1',
        'partner2',
        'weddingDate',
        'typography',
        'layout',
        'nameDisplay',
        'showDate',
      ].includes(k)
    );

  const regenKind: 'artwork' | 'lettering' | null = hasQuickEdit
    ? 'artwork'
    : fieldChangeCount === 0
      ? null
      : letteringOnly
        ? 'lettering'
        : 'artwork';

  // Palette add/remove helpers.
  const addColor = (color: string) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(color) && !/^#[0-9a-fA-F]{3}$/.test(color)) {
      setColorError(t.edit_invalid_hex);
      return;
    }
    setColorError(null);
    setCustomColor('');
    setDraft((d) =>
      d.palette.length < WEDDING_MAX_PALETTE_COLORS &&
      !d.palette.includes(color)
        ? { ...d, palette: [...d.palette, color] }
        : d
    );
  };

  const removeColor = (color: string) => {
    setDraft((d) => ({ ...d, palette: d.palette.filter((c) => c !== color) }));
  };

  // Flowers/elements add/remove helpers.
  const toggleFlower = (id: string) => {
    setDraft((d) => {
      if (d.flowers.includes(id)) {
        return { ...d, flowers: d.flowers.filter((f) => f !== id) };
      }
      if (d.flowers.length >= WEDDING_MAX_FLOWERS) return d;
      return { ...d, flowers: [...d.flowers, id] };
    });
  };

  const toggleElement = (id: string) => {
    setDraft((d) => {
      if (d.personalElements.includes(id)) {
        return {
          ...d,
          personalElements: d.personalElements.filter((e) => e !== id),
        };
      }
      if (d.personalElements.length >= WEDDING_MAX_PERSONAL_ELEMENTS) return d;
      return { ...d, personalElements: [...d.personalElements, id] };
    });
  };

  const setQuickEdit = (kind: QuickEditKind) => {
    setDraft((d) => ({ ...d, quickEdit: d.quickEdit === kind ? null : kind }));
  };

  const handleApply = async () => {
    if (!hasChanges) return;
    if (!draft.partner1.trim() || !draft.partner2.trim()) {
      toast.error(t.edit_names_required);
      return;
    }
    await onApply({
      fieldPatch: changes,
      regenKind,
      quickEdit: draft.quickEdit,
    });
  };

  const applyHint = hasQuickEdit
    ? t.edit_apply_quick_edit_hint
    : regenKind === 'lettering'
      ? t.edit_apply_lettering_hint
      : t.edit_apply_regenerate_hint;

  const categoryLabel = (c: EditCategory) => {
    switch (c) {
      case 'lettering':
        return t.edit_category_lettering;
      case 'colors':
        return t.edit_category_colors;
      case 'flowers':
        return t.edit_category_flowers;
      case 'elements':
        return t.edit_category_elements;
      case 'frame':
        return t.edit_category_frame;
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border p-5">
      <div className="grid gap-4 md:grid-cols-[180px_1fr]">
        {/* Left: tab buttons */}
        <div
          className="flex flex-row gap-2 md:flex-col"
          role="tablist"
          aria-label="Edit tabs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'quick'}
            onClick={() => setActiveTab('quick')}
            className={cn(
              'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
              activeTab === 'quick'
                ? 'border-primary bg-accent text-accent-foreground'
                : 'border-input hover:border-primary/40'
            )}
          >
            {t.quick_edits}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'edit'}
            onClick={() => setActiveTab('edit')}
            className={cn(
              'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
              activeTab === 'edit'
                ? 'border-primary bg-accent text-accent-foreground'
                : 'border-input hover:border-primary/40'
            )}
          >
            {t.edit_title}
          </button>
        </div>

        {/* Right: active tab content */}
        <div className="space-y-4">
          {activeTab === 'quick' ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                {t.quick_edits_hint}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={
                    draft.quickEdit === 'reduce_colors' ? 'default' : 'outline'
                  }
                  size="sm"
                  disabled={!hasSelectedGeneration}
                  onClick={() => setQuickEdit('reduce_colors')}
                >
                  {t.reduce_colors}
                </Button>
                <Button
                  variant={
                    draft.quickEdit === 'remove_personal_element'
                      ? 'default'
                      : 'outline'
                  }
                  size="sm"
                  disabled={!hasSelectedGeneration}
                  onClick={() => setQuickEdit('remove_personal_element')}
                >
                  {t.remove_personal_element}
                </Button>
                <Button
                  variant={
                    draft.quickEdit === 'make_simpler' ? 'default' : 'outline'
                  }
                  size="sm"
                  disabled={!hasSelectedGeneration}
                  onClick={() => setQuickEdit('make_simpler')}
                >
                  {t.make_simpler}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">{t.edit_hint}</p>

              {/* Category selector */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {t.edit_select_category}
                </Label>
                <select
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                  value={category ?? ''}
                  onChange={(e) =>
                    setCategory(
                      e.target.value === ''
                        ? null
                        : (e.target.value as EditCategory)
                    )
                  }
                >
                  <option value="">{t.edit_select_category}</option>
                  <option value="lettering">{t.edit_category_lettering}</option>
                  <option value="colors">{t.edit_category_colors}</option>
                  <option value="flowers">{t.edit_category_flowers}</option>
                  <option value="elements">{t.edit_category_elements}</option>
                  <option value="frame">{t.edit_category_frame}</option>
                </select>
              </div>

              {/* Category fields */}
              {category === 'lettering' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {t.edit_partner1}
                    </Label>
                    <Input
                      value={draft.partner1}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, partner1: e.target.value }))
                      }
                      maxLength={48}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {t.edit_partner2}
                    </Label>
                    <Input
                      value={draft.partner2}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, partner2: e.target.value }))
                      }
                      maxLength={48}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t.edit_date}</Label>
                    <Input
                      type="date"
                      value={draft.weddingDate}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, weddingDate: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {t.show_date_label}
                    </Label>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({ ...d, showDate: !d.showDate }))
                      }
                      className={cn(
                        'border-input flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm',
                        draft.showDate
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-background'
                      )}
                    >
                      <span>
                        {draft.showDate ? t.show_date_on : t.show_date_off}
                      </span>
                      <span className="text-muted-foreground">
                        {draft.showDate ? '✓' : '○'}
                      </span>
                    </button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {t.typography_pairing}
                    </Label>
                    <select
                      className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                      value={draft.typography}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, typography: e.target.value }))
                      }
                    >
                      {(
                        weddingStyles.find((s) => s.id === project.style)
                          ?.typography ?? []
                      ).map((pairingId) => {
                        const pairing = weddingTypography.find(
                          (p) => p.id === pairingId
                        );
                        if (!pairing) return null;
                        return (
                          <option key={pairing.id} value={pairing.id}>
                            {pairing.name}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {t.layout_label}
                    </Label>
                    <select
                      className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                      value={draft.layout}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, layout: e.target.value }))
                      }
                    >
                      {layoutsForStyle(project.style).map((layoutOption) => (
                        <option key={layoutOption.id} value={layoutOption.id}>
                          {layoutOption.composition}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-sm font-medium">
                      {t.name_display_label}
                    </Label>
                    <select
                      className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                      value={draft.nameDisplay}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          nameDisplay: e.target.value as WeddingNameDisplay,
                        }))
                      }
                    >
                      <option value="initials_amp">E & J</option>
                      <option value="initials_joined">EJ</option>
                      <option value="initials_spaced">E · J</option>
                      <option value="initials_only">E J</option>
                      <option value="full_names">Emma & James</option>
                      <option value="surname">The Millers</option>
                    </select>
                  </div>
                </div>
              )}

              {category === 'colors' && (
                <div className="space-y-3">
                  <p className="text-muted-foreground text-xs">
                    {t.edit_palette_label} ·{' '}
                    {t.edit_limit(WEDDING_MAX_PALETTE_COLORS)} ·{' '}
                    {draft.palette.length}/{WEDDING_MAX_PALETTE_COLORS}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {draft.palette.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => removeColor(color)}
                        className="border-input flex items-center gap-2 rounded-full border px-2 py-1 text-xs"
                        title={color}
                      >
                        <span
                          className="inline-block size-4 rounded-full border"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-mono uppercase">{color}</span>
                        <span className="text-muted-foreground">×</span>
                      </button>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {weddingPalettes.map((palette) => (
                      <div key={palette.id} className="space-y-2">
                        <p className="text-muted-foreground text-xs">
                          {palette.name}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {palette.colors.map((color) => {
                            const selected = draft.palette.includes(color);
                            const atLimit =
                              draft.palette.length >=
                              WEDDING_MAX_PALETTE_COLORS;
                            const disabled = !selected && atLimit;
                            return (
                              <button
                                key={color}
                                type="button"
                                disabled={disabled}
                                onClick={() =>
                                  selected
                                    ? removeColor(color)
                                    : addColor(color)
                                }
                                title={
                                  disabled
                                    ? t.edit_limit(WEDDING_MAX_PALETTE_COLORS)
                                    : color
                                }
                                className={cn(
                                  'flex items-center gap-2 rounded-full border px-2 py-1 text-xs transition-colors',
                                  selected
                                    ? 'border-primary bg-accent'
                                    : disabled
                                      ? 'border-input cursor-not-allowed opacity-50'
                                      : 'border-input hover:border-primary/40'
                                )}
                              >
                                <span
                                  className="inline-block size-4 rounded-full border"
                                  style={{ backgroundColor: color }}
                                />
                                <span className="font-mono uppercase">
                                  {color}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {t.edit_custom_color}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={customColor}
                        onChange={(e) => {
                          setCustomColor(e.target.value);
                          setColorError(null);
                        }}
                        placeholder="#a4b6a0"
                        className="font-mono"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => addColor(customColor)}
                        disabled={
                          draft.palette.length >= WEDDING_MAX_PALETTE_COLORS
                        }
                      >
                        {t.edit_add}
                      </Button>
                    </div>
                    {colorError && (
                      <p className="text-destructive text-xs">{colorError}</p>
                    )}
                  </div>
                </div>
              )}

              {category === 'flowers' && (
                <div className="space-y-3">
                  <p className="text-muted-foreground text-xs">
                    {t.edit_flowers_label} · {t.edit_limit(WEDDING_MAX_FLOWERS)}{' '}
                    · {draft.flowers.length}/{WEDDING_MAX_FLOWERS}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {weddingFlowerOptions.map((flower) => {
                      const selected = draft.flowers.includes(flower);
                      const atLimit =
                        draft.flowers.length >= WEDDING_MAX_FLOWERS;
                      const disabled = !selected && atLimit;
                      return (
                        <button
                          key={flower}
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleFlower(flower)}
                          title={
                            disabled
                              ? t.edit_limit(WEDDING_MAX_FLOWERS)
                              : flower
                          }
                          className={cn(
                            'rounded-full border px-3 py-1 text-xs transition-colors',
                            selected
                              ? 'border-primary bg-accent text-accent-foreground'
                              : disabled
                                ? 'border-input cursor-not-allowed opacity-50'
                                : 'border-input hover:border-primary/40'
                          )}
                        >
                          {flower}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {category === 'elements' && (
                <div className="space-y-3">
                  <p className="text-muted-foreground text-xs">
                    {t.edit_elements_label} ·{' '}
                    {t.edit_limit(WEDDING_MAX_PERSONAL_ELEMENTS)} ·{' '}
                    {draft.personalElements.length}/
                    {WEDDING_MAX_PERSONAL_ELEMENTS}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {weddingPersonalElementOptions.map((element) => {
                      const selected = draft.personalElements.includes(element);
                      const atLimit =
                        draft.personalElements.length >=
                        WEDDING_MAX_PERSONAL_ELEMENTS;
                      const disabled = !selected && atLimit;
                      return (
                        <button
                          key={element}
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleElement(element)}
                          title={
                            disabled
                              ? t.edit_limit(WEDDING_MAX_PERSONAL_ELEMENTS)
                              : element
                          }
                          className={cn(
                            'rounded-full border px-3 py-1 text-xs transition-colors',
                            selected
                              ? 'border-primary bg-accent text-accent-foreground'
                              : disabled
                                ? 'border-input cursor-not-allowed opacity-50'
                                : 'border-input hover:border-primary/40'
                          )}
                        >
                          {element}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {category === 'frame' && (
                <div className="space-y-3">
                  <p className="text-muted-foreground text-xs">
                    {t.edit_category_frame}
                  </p>
                  {framesLoading && (
                    <p className="text-muted-foreground text-xs">
                      {t.edit_frame_loading}
                    </p>
                  )}
                  {!framesLoading && frames && frames.length === 0 && (
                    <p className="text-muted-foreground text-xs">
                      {t.edit_frame_empty}
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    <button
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, frameId: null }))}
                      className={cn(
                        'rounded-lg border p-2 text-xs',
                        draft.frameId === null
                          ? 'border-primary bg-accent'
                          : 'border-input hover:border-primary/40'
                      )}
                    >
                      {t.edit_frame_none}
                    </button>
                    {(frames ?? []).map((frame) => {
                      const previewSrc = frame.thumbnailUrl ?? frame.url;
                      return (
                        <button
                          key={frame.id}
                          type="button"
                          onClick={() =>
                            setDraft((d) => ({ ...d, frameId: frame.id }))
                          }
                          className={cn(
                            'rounded-lg border p-2 text-xs',
                            draft.frameId === frame.id
                              ? 'border-primary bg-accent'
                              : 'border-input hover:border-primary/40'
                          )}
                          title={frame.altText ?? frame.name}
                        >
                          {previewSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={previewSrc}
                              alt={frame.altText ?? frame.name}
                              className="aspect-square w-full rounded object-cover"
                            />
                          ) : (
                            <div className="bg-muted flex aspect-square w-full items-center justify-center rounded text-[10px]">
                              {frame.name}
                            </div>
                          )}
                          <span className="mt-1 block truncate">
                            {frame.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {category && (
                <p className="text-muted-foreground text-xs">
                  {categoryLabel(category)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer: pending count + apply button (shared by both tabs) */}
      <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-muted-foreground text-xs">
          {hasChanges
            ? t.edit_pending(fieldChangeCount + (hasQuickEdit ? 1 : 0))
            : ''}
          {hasChanges ? ' · ' : ''}
          {applyHint}
        </div>
        <Button
          type="button"
          onClick={handleApply}
          disabled={
            busy || !hasChanges || (!hasSelectedGeneration && hasQuickEdit)
          }
        >
          {t.edit_apply}
        </Button>
      </div>
    </div>
  );
}
