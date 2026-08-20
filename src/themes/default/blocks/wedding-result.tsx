'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import {
  composeWeddingCrest,
  composeWeddingMockup,
} from '@/shared/wedding/composer';
import { getWeddingTypography, layoutsForStyle } from '@/shared/wedding/config';
import {
  WeddingNameDisplay,
  weddingPalettes,
  weddingStyles,
  weddingTypography,
} from '@/shared/wedding/types';

interface GenerationData {
  id: string;
  status: 'generating' | 'completed' | 'failed' | 'refining';
  candidateIndex: number | null;
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

export function WeddingResult({ projectId }: { projectId: string }) {
  const t = useTranslations('pages.design');
  const router = useRouter();

  const [data, setData] = useState<JobResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showTypography, setShowTypography] = useState(true);
  const [paying, setPaying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [progressStage, setProgressStage] = useState('queued');
  const [progressPercent, setProgressPercent] = useState(5);

  const guestId =
    typeof window !== 'undefined'
      ? localStorage.getItem('wedding_guest_id')
      : null;

  const fetchJob = useCallback(async () => {
    try {
      const response = await fetch(`/api/jobs/${projectId}`, {
        headers: guestId ? { 'x-wedding-guest-id': guestId } : {},
        cache: 'no-store',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body?.error || t('load_error'));
        return null;
      }
      const body = (await response.json()) as JobResponse;
      setError(null);
      setData(body);
      return body;
    } catch {
      setError(t('load_error'));
      return null;
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
  }, [fetchJob]);

  const project = data?.project;
  const generations = data?.generations ?? [];
  const selectedGeneration = generations[selectedIndex];

  const liveCrestSvg = useMemo(() => {
    if (!project) return '';
    const init1 = project.partner1.charAt(0).toUpperCase();
    const init2 = project.partner2.charAt(0).toUpperCase();
    return composeWeddingCrest({
      partner1: project.partner1,
      partner2: project.partner2,
      initials: [init1, init2],
      weddingDate: project.weddingDate,
      style: project.style,
      layout: project.layout,
      typography: project.typography,
      palette: project.palette,
      location: project.location,
      venue: project.venue,
      flowers: project.flowers,
      personalElements: project.personalElements,
      complexity: project.complexity,
      nameDisplay: project.nameDisplay,
      showDate: project.showDate,
      illustrationUrl: showTypography
        ? (selectedGeneration?.sourceImageUrl ?? undefined)
        : undefined,
      previewWatermark: !(data?.paid ?? false),
    });
  }, [project, selectedGeneration, showTypography, data?.paid]);

  const updateProject = useCallback(
    async (patch: Partial<ProjectData>) => {
      if (!project) return;
      setBusy(true);
      try {
        const response = await fetch(`/api/projects/${project.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(guestId ? { 'x-wedding-guest-id': guestId } : {}),
          },
          body: JSON.stringify(patch),
        });
        const body = await response.json();
        if (!response.ok) {
          toast.error(body?.error || t('update_error'));
          return;
        }
        setData((prev) =>
          prev
            ? { ...prev, project: { ...prev.project, ...body.project } }
            : prev
        );
        toast.success(t('updated'));
      } finally {
        setBusy(false);
      }
    },
    [project, guestId, t]
  );

  const applyQuickEdit = useCallback(
    async (
      generationId: string,
      action:
        | 'reduce_colors'
        | 'remove_personal_element'
        | 'make_simpler'
        | 'regenerate'
    ) => {
      if (!project) return;
      setBusy(true);
      try {
        const response = await fetch(`/api/generations/${generationId}/edit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(guestId ? { 'x-wedding-guest-id': guestId } : {}),
          },
          body: JSON.stringify({ action }),
        });
        const body = await response.json();
        if (!response.ok) {
          toast.error(body?.error || t('update_error'));
          return;
        }
        await fetchJob();
        toast.success(t('updated'));
      } finally {
        setBusy(false);
      }
    },
    [project, guestId, t, fetchJob]
  );

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
      const body = await response.json();
      if (!response.ok) {
        if (body?.error === 'quota_exceeded') {
          toast.error(t('quota_exceeded'));
        } else {
          toast.error(body?.error || t('update_error'));
        }
        return;
      }
      setSelectedIndex(0);
      setProgressStage('queued');
      setProgressPercent(5);
      await fetchJob();
    } finally {
      setBusy(false);
    }
  }, [project, guestId, t, fetchJob]);

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
      const body = await response.json();
      if (!response.ok) {
        toast.error(body?.error || t('pay_error'));
        return;
      }
      if (body.checkoutUrl || body.url) {
        window.location.href = body.checkoutUrl || body.url;
      }
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
          <div className="bg-muted/40 mb-8 rounded-2xl p-6 text-center">
            <p className="font-serif text-xl">{stageLabel(progressStage)}</p>
            <p className="text-muted-foreground mt-2 text-sm">
              {t('generating_hint')}
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
              <div
                className="mx-auto w-full max-w-md"
                role="img"
                aria-label="Wedding crest"
                dangerouslySetInnerHTML={{ __html: liveCrestSvg }}
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
                      onClick={() => setSelectedIndex(idx)}
                      className={cn(
                        'bg-wedding-ivory rounded-2xl border p-3 transition-colors',
                        selectedIndex === idx
                          ? 'border-primary ring-primary/30 ring-2'
                          : 'hover:border-primary/40'
                      )}
                    >
                      <CrestMini
                        project={project}
                        generation={gen}
                        paid={paid}
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

            {/* typography controls */}
            {isComplete && (
              <div className="space-y-4 rounded-2xl border p-5">
                <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
                  {t('typography_controls')}
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t('typography_pairing')}
                    </label>
                    <select
                      className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                      value={project.typography}
                      onChange={(e) =>
                        updateProject({ typography: e.target.value })
                      }
                      disabled={busy}
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
                    <label className="text-sm font-medium">
                      {t('layout_label')}
                    </label>
                    <select
                      className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                      value={project.layout}
                      onChange={(e) =>
                        updateProject({ layout: e.target.value })
                      }
                      disabled={busy}
                    >
                      {layoutsForStyle(project.style).map((layoutOption) => (
                        <option key={layoutOption.id} value={layoutOption.id}>
                          {layoutOption.composition}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t('name_display_label')}
                    </label>
                    <select
                      className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                      value={project.nameDisplay}
                      onChange={(e) =>
                        updateProject({
                          nameDisplay: e.target.value as WeddingNameDisplay,
                        })
                      }
                      disabled={busy}
                    >
                      <option value="initials_amp">E & J</option>
                      <option value="initials_joined">EJ</option>
                      <option value="initials_spaced">E · J</option>
                      <option value="initials_only">E J</option>
                      <option value="full_names">Emma & James</option>
                      <option value="surname">The Millers</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t('show_date_label')}
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        updateProject({ showDate: !project.showDate })
                      }
                      className={cn(
                        'border-input flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm',
                        project.showDate
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-background'
                      )}
                      disabled={busy}
                    >
                      <span>
                        {project.showDate
                          ? t('show_date_on')
                          : t('show_date_off')}
                      </span>
                      <span className="text-muted-foreground">
                        {project.showDate ? '✓' : '○'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-muted-foreground mb-2 text-xs tracking-[0.2em] uppercase">
                    {t('quick_edits')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        busy ||
                        !selectedGeneration ||
                        project.palette.length <= 1
                      }
                      onClick={() =>
                        selectedGeneration &&
                        applyQuickEdit(selectedGeneration.id, 'reduce_colors')
                      }
                    >
                      {t('reduce_colors')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        busy ||
                        !selectedGeneration ||
                        project.personalElements.length === 0
                      }
                      onClick={() =>
                        selectedGeneration &&
                        applyQuickEdit(
                          selectedGeneration.id,
                          'remove_personal_element'
                        )
                      }
                    >
                      {t('remove_personal_element')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || !selectedGeneration}
                      onClick={() =>
                        selectedGeneration &&
                        applyQuickEdit(selectedGeneration.id, 'make_simpler')
                      }
                    >
                      {t('make_simpler')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* mockups */}
            {isComplete && (
              <div className="space-y-3 rounded-2xl border p-5">
                <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
                  {t('mockups')}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(
                    [
                      'invitation',
                      'save_the_date',
                      'menu',
                      'welcome_sign',
                    ] as const
                  ).map((mockup) => (
                    <div
                      key={mockup}
                      className="bg-muted/30 overflow-hidden rounded-xl border p-2"
                    >
                      <CrestMockup
                        project={project}
                        generation={selectedGeneration}
                        paid={paid}
                        type={mockup}
                      />
                      <p className="text-muted-foreground mt-2 text-center text-xs">
                        {t(`mockup_${mockup}`)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* unlock panel */}
          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border p-6">
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
                  {data?.allowance && !data.allowance.allowed && (
                    <p className="text-muted-foreground mt-2 text-xs">
                      {t('allowance_hint')}
                    </p>
                  )}
                </>
              ) : (
                <a
                  className="mt-4 block w-full"
                  href={`/api/projects/${project.id}/download`}
                >
                  <Button className="w-full" size="lg">
                    {t('download_zip')}
                  </Button>
                </a>
              )}
            </div>

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
              >
                {t('regenerate_cta')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CrestMini({
  project,
  generation,
  paid,
}: {
  project: ProjectData;
  generation: GenerationData;
  paid: boolean;
}) {
  const svg = composeWeddingCrest({
    partner1: project.partner1,
    partner2: project.partner2,
    initials: [
      project.partner1.charAt(0).toUpperCase(),
      project.partner2.charAt(0).toUpperCase(),
    ],
    weddingDate: project.weddingDate,
    style: project.style,
    layout: project.layout,
    typography: project.typography,
    palette: project.palette,
    location: project.location,
    venue: project.venue,
    flowers: project.flowers,
    personalElements: project.personalElements,
    complexity: project.complexity,
    nameDisplay: project.nameDisplay,
    showDate: project.showDate,
    illustrationUrl: generation.sourceImageUrl ?? undefined,
    previewWatermark: !paid,
  });
  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}

function CrestMockup({
  project,
  generation,
  paid,
  type,
}: {
  project: ProjectData;
  generation: GenerationData | undefined;
  paid: boolean;
  type: 'invitation' | 'save_the_date' | 'menu' | 'welcome_sign';
}) {
  const request = {
    partner1: project.partner1,
    partner2: project.partner2,
    initials: [
      project.partner1.charAt(0).toUpperCase(),
      project.partner2.charAt(0).toUpperCase(),
    ],
    weddingDate: project.weddingDate,
    style: project.style,
    layout: project.layout,
    typography: project.typography,
    palette: project.palette,
    location: project.location,
    venue: project.venue,
    flowers: project.flowers,
    personalElements: project.personalElements,
    complexity: project.complexity,
    nameDisplay: project.nameDisplay,
    showDate: project.showDate,
    illustrationUrl: generation?.sourceImageUrl ?? undefined,
    previewWatermark: !paid,
  };
  const svg = composeWeddingMockup(request, type);
  return (
    <div
      role="img"
      aria-label={type}
      className="aspect-[4/5] w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
