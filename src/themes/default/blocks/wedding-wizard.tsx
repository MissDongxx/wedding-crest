'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Progress } from '@/shared/components/ui/progress';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import { resolveWeddingDisplayTexts } from '@/shared/wedding/display-text';
import {
  WEDDING_MAX_FLOWERS,
  WEDDING_MAX_PALETTE_COLORS,
  WEDDING_MAX_PERSONAL_ELEMENTS,
  weddingFlowerOptions,
  weddingPalettes,
  weddingPersonalElementOptions,
  WeddingProjectInput,
  weddingStyles,
} from '@/shared/wedding/types';

const WIZARD_STEPS = [
  { key: 'names', label: 'Names' },
  { key: 'style', label: 'Style' },
  { key: 'border', label: 'Border' },
  { key: 'palette', label: 'Colors' },
  { key: 'details', label: 'Details' },
  { key: 'personal', label: 'Personal' },
  { key: 'review', label: 'Review' },
] as const;

const WIZARD_STORAGE_KEY = 'wedding_wizard_state_v1';

const MATCH_EXAMPLE_DEFAULT = {
  border: false,
  palette: false,
  flowers: false,
  elements: false,
};

type MatchExampleFlags = typeof MATCH_EXAMPLE_DEFAULT;

/** Client-side projection of `/api/wedding/examples` rows. */
type StyleExample = {
  id: string;
  name: string;
  style: string;
  imageUrl: string;
  altText?: string | null;
};

/** Photos of the selected style kept in the first-slot preview panel. */
const MAX_STYLE_EXAMPLES = 8;

/**
 * Shape of the wizard state we round-trip through localStorage. Bump
 * `WIZARD_STORAGE_KEY` to a new version (v2, ...) whenever the schema
 * changes in a way that would make older payloads break parsing — the
 * read helper just discards unknown keys, but renamed/removed fields
 * would otherwise leak through as undefined.
 */
interface PersistedWizardState {
  step: number;
  partner1: string;
  partner2: string;
  weddingDate: string;
  nameDisplay: WeddingProjectInput['nameDisplay'];
  style: string;
  typography: string;
  frameId: string | null;
  palette: string[];
  customHex: string;
  location: string;
  venue: string;
  flowers: string[];
  customFlower: string;
  personalElements: string[];
  customElement: string;
  personalImages: string[];
  complexity: WeddingProjectInput['complexity'];
  matchExample: MatchExampleFlags;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function isMatchExample(value: unknown): value is MatchExampleFlags {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.border === 'boolean' &&
    typeof candidate.palette === 'boolean' &&
    typeof candidate.flowers === 'boolean' &&
    typeof candidate.elements === 'boolean'
  );
}

function isWeddingComplexity(
  value: unknown
): value is WeddingProjectInput['complexity'] {
  return value === 'minimal' || value === 'medium' || value === 'rich';
}

function isWeddingNameDisplay(
  value: unknown
): value is WeddingProjectInput['nameDisplay'] {
  return (
    value === 'initials_amp' ||
    value === 'initials_joined' ||
    value === 'initials_spaced' ||
    value === 'initials_only' ||
    value === 'full_names' ||
    value === 'surname'
  );
}

/**
 * Reads the persisted wizard state from localStorage. Returns an empty
 * object on SSR, on parse errors, or when no prior state exists. The
 * The state is restored in an effect after hydration so the server and
 * client render the same initial tree.
 */
function readPersistedWizardState(): Partial<PersistedWizardState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(WIZARD_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Partial<PersistedWizardState>;
  } catch {
    // Corrupt JSON, private-browsing quota errors, etc. — start fresh.
    return {};
  }
}

function clearPersistedWizardState() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(WIZARD_STORAGE_KEY);
  } catch {
    // ignore
  }
}

const CUSTOM_HEX_RE = /^#[0-9a-fA-F]{6}$/;

type ApiEnvelope<T> = {
  code?: number;
  message?: string;
  data?: T;
  error?: string;
};

/**
 * Six-step wedding crest wizard with an instant typography preview
 * (ornament layer only; AI illustration is added after generation).
 */
export function WeddingWizard() {
  const t = useTranslations('pages.create');
  const searchParams = useSearchParams();
  // When the result page sends the user back to the create flow to make
  // tweaks, it links to /create?edit=<projectId>. The wizard then runs
  // in "edit mode": prefill from the project, persist the final values
  // via PATCH instead of POST, and end in /design/<id> (regenerate).
  const editId = searchParams.get('edit') ?? null;
  const isEditMode = editId !== null;

  // Keep the server render deterministic. localStorage is restored in an
  // effect below; reading it during render would make the first client tree
  // differ from the server tree and trigger a hydration mismatch.
  const persisted = useMemo<Partial<PersistedWizardState>>(() => ({}), []);
  const [isHydrated, setIsHydrated] = useState(false);
  // True once the edit-mode prefill from GET /api/projects/<id> has
  // landed. Submission stays disabled until then so we never post back
  // an empty form to the server.
  const [isEditPrefilled, setIsEditPrefilled] = useState(!isEditMode);

  // step 1: names
  const [partner1, setPartner1] = useState(
    typeof persisted.partner1 === 'string' ? persisted.partner1 : ''
  );
  const [partner2, setPartner2] = useState(
    typeof persisted.partner2 === 'string' ? persisted.partner2 : ''
  );
  const [weddingDate, setWeddingDate] = useState(
    typeof persisted.weddingDate === 'string' ? persisted.weddingDate : ''
  );
  const [nameDisplay, setNameDisplay] = useState<
    WeddingProjectInput['nameDisplay']
  >(
    isWeddingNameDisplay(persisted.nameDisplay)
      ? persisted.nameDisplay
      : 'initials_amp'
  );

  // step 2: style
  const [style, setStyle] = useState(
    typeof persisted.style === 'string' &&
      weddingStyles.some((s) => s.id === persisted.style)
      ? persisted.style
      : 'botanical_watercolor'
  );
  const [typography, setTypography] = useState(
    typeof persisted.typography === 'string'
      ? persisted.typography
      : 'editorial_rose'
  );

  // step 3: border (admin-managed frame library)
  // null = no border; otherwise the wedding_frame.id the user picked.
  const [frameId, setFrameId] = useState<string | null>(
    typeof persisted.frameId === 'string' ? persisted.frameId : null
  );
  const [frames, setFrames] = useState<
    Array<{
      id: string;
      name: string;
      style: string | null;
      url: string;
      thumbnailUrl: string | null;
    }>
  >([]);
  const [framesLoading, setFramesLoading] = useState(false);

  // step 4: palette. Default empty = "free choice" - the prompt compiler
  // interprets an empty palette as "use a refined full-color palette typical
  // of the style". When the user picks a concrete palette, it overrides;
  // when an example is attached, "Same as example" flips matchExample.palette
  // and the empty array still means "follow the reference".
  const [palette, setPalette] = useState<string[]>(
    isStringArray(persisted.palette) ? persisted.palette : []
  );
  const [customHex, setCustomHex] = useState(
    typeof persisted.customHex === 'string' ? persisted.customHex : ''
  );

  // step 5: details
  const [location, setLocation] = useState(
    typeof persisted.location === 'string' ? persisted.location : ''
  );
  const [venue, setVenue] = useState(
    typeof persisted.venue === 'string' ? persisted.venue : ''
  );
  const [flowers, setFlowers] = useState<string[]>(
    isStringArray(persisted.flowers) ? persisted.flowers : []
  );
  const [customFlower, setCustomFlower] = useState(
    typeof persisted.customFlower === 'string' ? persisted.customFlower : ''
  );

  // step 6: personal elements
  const [personalElements, setPersonalElements] = useState<string[]>(
    isStringArray(persisted.personalElements) ? persisted.personalElements : []
  );
  const [customElement, setCustomElement] = useState(
    typeof persisted.customElement === 'string' ? persisted.customElement : ''
  );
  // Reference photos uploaded by the user. Stored as storage URLs;
  // sent as `personalImages` in the project payload, which the generate
  // route forwards to Runware as `inputs.referenceImages` (auto-switches
  // the model to google:nano-banana@2-lite when present).
  const [personalImages, setPersonalImages] = useState<string[]>(
    isStringArray(persisted.personalImages) ? persisted.personalImages : []
  );
  const [uploadingImages, setUploadingImages] = useState(false);
  const MAX_PERSONAL_IMAGES = 2;

  // step 7: review
  const [complexity, setComplexity] = useState<
    WeddingProjectInput['complexity']
  >(
    isWeddingComplexity(persisted.complexity) ? persisted.complexity : 'medium'
  );

  const [step, setStep] = useState(
    typeof persisted.step === 'number' &&
      persisted.step >= 0 &&
      persisted.step < WIZARD_STEPS.length
      ? persisted.step
      : 0
  );
  const [submitting, setSubmitting] = useState(false);

  // Reference image the user arrived with (?exampleId= deep link). Drives
  // the live preview panel: show this photo as the AI style reference, or
  // hide the preview entirely when no example was attached (e.g. links
  // from the home hero).
  const [exampleImage, setExampleImage] = useState<{
    url: string;
    alt: string;
  } | null>(null);
  const [examplePending, setExamplePending] = useState(false);
  // Set to the example's style id once the exampleId fetch resolves
  // successfully. Step 2 uses it to hide the style picker (the example
  // already implies the style), and the rest of the wizard reads it to
  // show "from your example" hints.
  const [fromExampleStyle, setFromExampleStyle] = useState<string | null>(null);
  // Per-property "match the example image" flags. Default OFF for every
  // user; flipped to all-true when an example is attached so the wizard
  // starts in "make me the same thing" mode and the user can override
  // individual properties. The flags travel to the API as `matchExample`
  // and the prompt compiler swaps the corresponding lines for "match the
  // reference example image" wording.
  const [matchExample, setMatchExample] = useState<MatchExampleFlags>(
    isMatchExample(persisted.matchExample)
      ? { ...persisted.matchExample, elements: false }
      : MATCH_EXAMPLE_DEFAULT
  );

  // Real product photos of the *currently selected* style. Used for two
  // things on the style step: the "Or start from an example" thumbnail row,
  // and the representative photo the live preview panel shows while the user
  // picks a style from scratch. `startExamplesStyle` records which style the
  // payload belongs to, so a style switch falls back to the loading state
  // instead of showing the previous style's photos.
  const [startExamples, setStartExamples] = useState<StyleExample[]>([]);
  const [startExamplesStyle, setStartExamplesStyle] = useState<string | null>(
    null
  );
  const [startExamplesLoading, setStartExamplesLoading] = useState(false);

  // Ids of the styles that actually have published example photos. `null`
  // means "unknown" — while the lookup is in flight, or if it failed — and
  // in that state every style stays listed, so a flaky response can never
  // leave the picker empty.
  const [exampleStyleIds, setExampleStyleIds] = useState<string[] | null>(null);
  const router = useRouter();

  // One cheap pass over the catalogue to learn which styles have photos.
  // Runs once on mount (not gated on the step) so the answer is ready by
  // the time the user reaches the style step and the grid never has to
  // reshuffle in front of them.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const resp = await fetch('/api/wedding/examples');
          const json: ApiEnvelope<{ items: StyleExample[] }> =
            await resp.json();
          if (!cancelled && json?.code === 0) {
            const ids = Array.from(
              new Set(
                (json.data?.items ?? [])
                  .filter((item): item is StyleExample =>
                    Boolean(item?.imageUrl)
                  )
                  .map((item) => item.style)
              )
            );
            // An empty catalogue means we learned nothing usable — treat it
            // as unknown rather than hiding every style.
            if (ids.length > 0) {
              setExampleStyleIds(ids);
              return;
            }
          }
        } catch {
          // fall through to the retry
        }
        if (cancelled) return;
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
      if (!cancelled) setExampleStyleIds(null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Restore the saved draft only after hydration. This keeps SSR markup
  // stable while retaining the draft across refreshes. The persistence
  // effect below is gated by isHydrated so the default state never
  // overwrites the saved draft during the same mount. Edit mode skips
  // this: the project prefill effect below hydrates state from the
  // server, and we don't want a stale draft to clobber it.
  useEffect(() => {
    if (isEditMode) {
      setIsHydrated(true);
      return;
    }
    const saved = readPersistedWizardState();

    if (typeof saved.partner1 === 'string') setPartner1(saved.partner1);
    if (typeof saved.partner2 === 'string') setPartner2(saved.partner2);
    if (typeof saved.weddingDate === 'string')
      setWeddingDate(saved.weddingDate);
    if (isWeddingNameDisplay(saved.nameDisplay))
      setNameDisplay(saved.nameDisplay);
    if (
      typeof saved.style === 'string' &&
      weddingStyles.some((candidate) => candidate.id === saved.style)
    ) {
      setStyle(saved.style);
    }
    if (typeof saved.typography === 'string') setTypography(saved.typography);
    if (typeof saved.frameId === 'string' || saved.frameId === null) {
      setFrameId(saved.frameId);
    }
    if (isStringArray(saved.palette) && saved.palette.length > 0) {
      setPalette(saved.palette);
    }
    if (typeof saved.customHex === 'string') setCustomHex(saved.customHex);
    if (typeof saved.location === 'string') setLocation(saved.location);
    if (typeof saved.venue === 'string') setVenue(saved.venue);
    if (isStringArray(saved.flowers)) setFlowers(saved.flowers);
    if (typeof saved.customFlower === 'string')
      setCustomFlower(saved.customFlower);
    if (isStringArray(saved.personalElements)) {
      setPersonalElements(saved.personalElements);
    }
    if (typeof saved.customElement === 'string')
      setCustomElement(saved.customElement);
    if (isStringArray(saved.personalImages))
      setPersonalImages(saved.personalImages);
    if (isWeddingComplexity(saved.complexity)) setComplexity(saved.complexity);
    if (
      typeof saved.step === 'number' &&
      saved.step >= 0 &&
      saved.step < WIZARD_STEPS.length
    ) {
      setStep(saved.step);
    }
    if (isMatchExample(saved.matchExample)) {
      setMatchExample({ ...saved.matchExample, elements: false });
    }

    setIsHydrated(true);
  }, [isEditMode]);

  // Edit-mode prefill: when the result page links back to /create?edit=<id>
  // we fetch the project, hydrate every wizard field from its current
  // state, and land the user on the review step so they can pick what
  // to change. We do NOT touch localStorage in edit mode (the persist
  // effect below is gated on isEditMode), so a stale draft from a prior
  // fresh-wizard session doesn't pollute the edit.
  useEffect(() => {
    if (!isEditMode || !editId) return;
    let cancelled = false;
    (async () => {
      try {
        const guestId =
          typeof window !== 'undefined'
            ? localStorage.getItem('wedding_guest_id')
            : null;
        const response = await fetch(`/api/projects/${editId}`, {
          headers: guestId ? { 'x-wedding-guest-id': guestId } : {},
          cache: 'no-store',
        });
        if (!response.ok) {
          toast.error(t('edit_load_error'));
          return;
        }
        const envelope = await response.json().catch(() => ({}));
        const project = envelope?.data?.project;
        if (cancelled || !project) {
          toast.error(t('edit_load_error'));
          return;
        }
        const input = project.input ?? {};
        if (typeof project.partner1 === 'string') setPartner1(project.partner1);
        if (typeof project.partner2 === 'string') setPartner2(project.partner2);
        if (typeof project.weddingDate === 'string' && project.weddingDate) {
          setWeddingDate(project.weddingDate);
        }
        if (isWeddingNameDisplay(input.nameDisplay))
          setNameDisplay(input.nameDisplay);
        if (
          typeof project.style === 'string' &&
          weddingStyles.some((candidate) => candidate.id === project.style)
        ) {
          setStyle(project.style);
        }
        if (typeof project.typography === 'string') {
          setTypography(project.typography);
        }
        if (input.frameId === null || typeof input.frameId === 'string') {
          setFrameId(input.frameId ?? null);
        }
        if (Array.isArray(input.palette) && input.palette.length > 0) {
          setPalette(input.palette);
        }
        if (typeof input.location === 'string') setLocation(input.location);
        if (typeof input.venue === 'string') setVenue(input.venue);
        if (Array.isArray(input.flowers)) setFlowers(input.flowers);
        if (Array.isArray(input.personalElements)) {
          setPersonalElements(input.personalElements);
        }
        if (Array.isArray(input.personalImages)) {
          setPersonalImages(input.personalImages);
        }
        if (isWeddingComplexity(input.complexity))
          setComplexity(input.complexity);
        // Land the user on the review step so they see the summary of
        // the existing design and only navigate back to change a field.
        const reviewStep = WIZARD_STEPS.length - 1;
        setStep(reviewStep);
        setIsEditPrefilled(true);
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : t('edit_load_error')
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId, isEditMode, t]);

  // Persist the form state to localStorage on every change. Writing on
  // every state mutation is fine here — the payload is small (a few
  // strings/arrays), and localStorage.setItem is synchronous and fast
  // for this size. We intentionally do NOT persist transient values:
  // - exampleImage / fromExampleStyle are re-derived from the URL on
  //   every mount by the example effect, so persisting them would just
  //   get overwritten on the next render.
  // - submitting / examplePending / uploadingImages are flags that would
  //   look stuck if a refresh happens mid-flight.
  // - frames are refetched from the API based on `style`.
  // Edit mode is excluded: the project is the source of truth and any
  // local draft from a prior fresh-wizard session would otherwise leak
  // back into it on the next visit.
  useEffect(() => {
    if (isEditMode) return;
    if (!isHydrated || typeof window === 'undefined') return;
    try {
      const payload: PersistedWizardState = {
        step,
        partner1,
        partner2,
        weddingDate,
        nameDisplay,
        style,
        typography,
        frameId,
        palette,
        customHex,
        location,
        venue,
        flowers,
        customFlower,
        personalElements,
        customElement,
        personalImages,
        complexity,
        matchExample,
      };
      window.localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Quota exceeded or storage disabled — non-fatal, the wizard
      // still works in memory.
    }
  }, [
    isEditMode,
    step,
    partner1,
    partner2,
    weddingDate,
    nameDisplay,
    style,
    typography,
    frameId,
    palette,
    customHex,
    location,
    venue,
    flowers,
    customFlower,
    personalElements,
    customElement,
    personalImages,
    complexity,
    matchExample,
    isHydrated,
  ]);

  // preselect style from ?style= deep link (used by style cards + SEO pages)
  useEffect(() => {
    const requested = searchParams.get('style');
    if (requested && weddingStyles.some((s) => s.id === requested)) {
      setStyle(requested);
    }
  }, [searchParams]);

  // Prefill from ?exampleId= deep link (used by Find Your Style example
  // thumbnails). The link usually carries ?style= too, so we only set the
  // style from the example when no style param is present, avoiding a race
  // with the effect above.
  //
  // Persistence interaction: the example-derived matchExample defaults
  // (all-false when no example, all-true when an example is attached) only
  // apply on the very first visit. Once the user has any persisted state,
  // we leave matchExample alone so a refresh preserves the toggles they
  // already set. The exampleImage / fromExampleStyle are still re-derived
  // from the URL every time, so the live preview always reflects the
  // current link.
  useEffect(() => {
    const exampleId = searchParams.get('exampleId');
    // Cheap probe: did the user already have wizard state saved? The
    // `persisted` memo above already ran on mount; instead of re-reading
    // localStorage, we just keep a boolean around by checking for any
    // non-default signal. The empty-{} case means "no prior state".
    const hasPersistedState =
      typeof window !== 'undefined' &&
      (() => {
        try {
          return window.localStorage.getItem(WIZARD_STORAGE_KEY) !== null;
        } catch {
          return false;
        }
      })();
    const applyMatchExampleDefaults = (next: MatchExampleFlags) => {
      if (hasPersistedState) return;
      setMatchExample(next);
    };

    if (!exampleId) {
      // No example in the URL — the preview panel should not show any
      // image. (User came from the home hero or directly from /create.)
      setExampleImage(null);
      setExamplePending(false);
      setFromExampleStyle(null);
      applyMatchExampleDefaults(MATCH_EXAMPLE_DEFAULT);
      return;
    }
    let cancelled = false;
    setExamplePending(true);
    (async () => {
      try {
        // One retry: the example query intermittently fails on flaky DB
        // links. Without it a deep link would silently lose the attached
        // example (and its style) even though the URL still points at it.
        let example:
          | {
              id: string;
              name: string;
              style: string;
              imageUrl: string;
              altText?: string | null;
            }
          | undefined;
        for (let attempt = 0; attempt < 2 && !cancelled; attempt++) {
          try {
            const resp = await fetch(
              `/api/wedding/examples?id=${encodeURIComponent(exampleId)}`
            );
            const json: ApiEnvelope<{
              items: Array<{
                id: string;
                name: string;
                style: string;
                imageUrl: string;
                altText?: string | null;
              }>;
            }> = await resp.json();
            example = json?.data?.items?.[0];
            if (example) break;
          } catch {
            // fall through to the retry
          }
          if (attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 400));
          }
        }
        if (cancelled) return;
        if (!example) {
          setExampleImage(null);
          setFromExampleStyle(null);
          applyMatchExampleDefaults(MATCH_EXAMPLE_DEFAULT);
          return;
        }

        // Names are intentionally NOT prefilled — the user types their
        // own. We only carry over the example's style so the wizard
        // skips the style picker on step 2.

        // Style: only when the URL didn't pin one already.
        const styleChanged =
          !searchParams.get('style') &&
          weddingStyles.some((s) => s.id === example.style);
        if (styleChanged) {
          setStyle(example.style);
        }

        // Remember the example's style so step 2 can hide the style
        // picker (even when the URL already pinned it).
        setFromExampleStyle(
          weddingStyles.some((s) => s.id === example.style)
            ? example.style
            : null
        );

        // Default all four "match the example" toggles to ON — the user
        // arrived with an example, so the "make me the same one" path is
        // the most useful default. They can override any property by
        // picking a concrete value (which flips its flag back to false).
        applyMatchExampleDefaults({
          border: true,
          palette: true,
          flowers: true,
          elements: false,
        });

        // Surface the source image in the live preview panel.
        setExampleImage({
          url: example.imageUrl,
          alt: example.altText ?? example.name,
        });
      } catch {
        if (!cancelled) {
          setExampleImage(null);
          setFromExampleStyle(null);
          applyMatchExampleDefaults(MATCH_EXAMPLE_DEFAULT);
        }
      } finally {
        if (!cancelled) setExamplePending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  // Keep typography valid for the selected style. The user no longer
  // chooses a pairing from the UI - we just keep the field pointed at a
  // pairing the style actually supports, so any place that reads
  // `project.input.typography` (preview, edit regenerate, no-example
  // prompt path) still gets a sensible default.
  useEffect(() => {
    const valid = weddingStyles.find((s) => s.id === style)?.typography ?? [];
    if (!valid.includes(typography)) {
      setTypography(valid[0] ?? 'editorial_rose');
    }
  }, [style, typography]);

  // Fetch frames matching the current style when the user reaches the
  // border step (or changes style). The list is short and public, so we
  // refetch instead of hydrating the full set up front.
  useEffect(() => {
    let cancelled = false;
    const fetchFrames = async () => {
      setFramesLoading(true);
      try {
        const url = `/api/wedding/frames?style=${encodeURIComponent(style)}`;
        const resp = await fetch(url);
        const json: ApiEnvelope<{
          items: Array<{
            id: string;
            name: string;
            style: string | null;
            url: string;
            thumbnailUrl: string | null;
          }>;
        }> = await resp.json();
        if (!cancelled && json?.data?.items) {
          setFrames(json.data.items);
        }
      } catch {
        if (!cancelled) setFrames([]);
      } finally {
        if (!cancelled) setFramesLoading(false);
      }
    };
    fetchFrames();
    return () => {
      cancelled = true;
    };
  }, [style]);

  // Drop a frame selection that isn't offered for the current style (e.g.
  // the user picked a frame, then went back and switched styles). Without
  // this, the previous frame stays "selected" while the new style's frame
  // list doesn't include it - the preview would render nothing but the
  // summary step still shows the old frame name.
  //
  // We also need to be careful not to drop a restored frameId from
  // localStorage while the frames are still loading: if we ran on every
  // frames=[] render we'd wipe the user's selection on the very first
  // render after a refresh. The `framesLoading` guard short-circuits
  // until the fetch has resolved.
  useEffect(() => {
    if (framesLoading) return;
    setFrameId((current) =>
      current && frames.some((frame) => frame.id === current) ? current : null
    );
  }, [frames, framesLoading]);

  // Load the example photos for the selected style once the user is past the
  // names step, and reuse them for both the "Or start from an example" row
  // and the live preview's representative photo. Refetched only when the
  // selected style changes, so the row and the preview always describe the
  // style the user is currently looking at.
  //
  // This deliberately runs even while ?exampleId= is attached: the style step
  // keeps its thumbnail row visible so an attached example can be swapped for
  // a different one without leaving the wizard.
  useEffect(() => {
    if (step === 0) return;
    if (startExamplesStyle === style) return;
    let cancelled = false;
    setStartExamplesLoading(true);
    (async () => {
      // One retry: the examples query intermittently fails on flaky DB
      // links (the route then answers with an error envelope), and an
      // empty list would wrongly read as "this style has no examples".
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const resp = await fetch(
              `/api/wedding/examples?style=${encodeURIComponent(style)}`
            );
            const json: ApiEnvelope<{ items: StyleExample[] }> =
              await resp.json();
            const items = (json?.data?.items ?? []).filter(
              (item): item is StyleExample => Boolean(item?.imageUrl)
            );
            if (!cancelled && json?.code === 0) {
              setStartExamples(items.slice(0, MAX_STYLE_EXAMPLES));
              setStartExamplesStyle(style);
              return;
            }
          } catch {
            // fall through to the retry
          }
          if (cancelled) return;
          if (attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 400));
          }
        }
        if (!cancelled) {
          setStartExamples([]);
          setStartExamplesStyle(style);
        }
      } finally {
        if (!cancelled) setStartExamplesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, style, startExamplesStyle]);

  const canContinue = useCallback(() => {
    if (step === 0) {
      return (
        partner1.trim().length > 0 &&
        partner2.trim().length > 0 &&
        partner1.trim().length <= 40 &&
        partner2.trim().length <= 40
      );
    }
    if (step === 3) {
      // Empty palette is a valid choice under the reference-first contract:
      // it means "follow the example" when an example is attached, or
      // "free choice" when there isn't one. Only the upper bound matters.
      return palette.length <= WEDDING_MAX_PALETTE_COLORS;
    }
    return true;
  }, [step, partner1, partner2, palette.length]);

  const toggleFlower = (flower: string) => {
    setFlowers((current) => {
      if (current.includes(flower)) {
        return current.filter((f) => f !== flower);
      }
      if (current.length >= WEDDING_MAX_FLOWERS) {
        toast.info(
          t('max_items', {
            count: WEDDING_MAX_FLOWERS,
            items: t('max_items_flowers'),
          })
        );
        return current;
      }
      return [...current, flower];
    });
  };

  const toggleElement = (element: string) => {
    setPersonalElements((current) => {
      if (current.includes(element)) {
        return current.filter((e) => e !== element);
      }
      if (current.length >= WEDDING_MAX_PERSONAL_ELEMENTS) {
        toast.info(
          t('max_items', {
            count: WEDDING_MAX_PERSONAL_ELEMENTS,
            items: t('max_items_personal'),
          })
        );
        return current;
      }
      return [...current, element];
    });
    // Picking a concrete personal element is a deliberate override of
    // "match the example's elements" mode.
    setMatchExample((current) =>
      current.elements ? { ...current, elements: false } : current
    );
  };

  const selectFrame = (id: string) => {
    setFrameId(id);
    setMatchExample((current) => ({
      ...current,
      border: false,
    }));
  };

  const togglePaletteColor = (color: string) => {
    setPalette((current) => {
      if (current.includes(color)) {
        // keep at least one color
        if (current.length <= 1) return current;
        return current.filter((c) => c !== color);
      }
      if (current.length >= WEDDING_MAX_PALETTE_COLORS) {
        toast.info(
          t('max_items', {
            count: WEDDING_MAX_PALETTE_COLORS,
            items: t('max_items_colors'),
          })
        );
        return current;
      }
      return [...current, color];
    });
  };

  const addCustomHex = () => {
    const hex = customHex.trim().toLowerCase();
    if (!CUSTOM_HEX_RE.test(hex)) {
      toast.error(t('invalid_hex'));
      return;
    }
    if (!palette.includes(hex)) {
      setPalette((current) =>
        current.length >= WEDDING_MAX_PALETTE_COLORS
          ? current
          : [...current, hex]
      );
      // Adding a custom color is a deliberate color pick — drop out of
      // "match the example's palette" mode.
      setMatchExample((current) =>
        current.palette ? { ...current, palette: false } : current
      );
    }
    setCustomHex('');
  };

  const addCustomFlower = () => {
    const value = customFlower.trim();
    if (
      value &&
      !flowers.includes(value) &&
      flowers.length < WEDDING_MAX_FLOWERS
    ) {
      setFlowers((current) => [...current, value]);
      setMatchExample((current) =>
        current.flowers ? { ...current, flowers: false } : current
      );
    }
    setCustomFlower('');
  };

  const addCustomElement = () => {
    const value = customElement.trim();
    if (!value) return;
    if (personalElements.includes(value)) {
      setCustomElement('');
      return;
    }
    if (personalElements.length >= WEDDING_MAX_PERSONAL_ELEMENTS) {
      toast.info(
        t('max_items', {
          count: WEDDING_MAX_PERSONAL_ELEMENTS,
          items: t('max_items_personal'),
        })
      );
      return;
    }

    setPersonalElements((current) => [...current, value]);
    setMatchExample((current) =>
      current.elements ? { ...current, elements: false } : current
    );
    setCustomElement('');
  };

  // Reset the wizard to its initial state and forget any persisted draft.
  // Used by the "Start over" button in the header so users can wipe their
  // in-progress form without opening devtools. The reset keeps the URL
  // intact (?exampleId=, ?style=) — those are read by the example /
  // style effects on the next render and will re-apply their defaults.
  const resetWizard = () => {
    setStep(0);
    setPartner1('');
    setPartner2('');
    setWeddingDate('');
    setNameDisplay('initials_amp');
    setStyle('botanical_watercolor');
    setTypography('editorial_rose');
    setFrameId(null);
    setPalette([]);
    setCustomHex('');
    setLocation('');
    setVenue('');
    setFlowers([]);
    setCustomFlower('');
    setPersonalElements([]);
    setCustomElement('');
    setPersonalImages([]);
    setComplexity('medium');
    setMatchExample(MATCH_EXAMPLE_DEFAULT);
    clearPersistedWizardState();
  };

  // Pick a style on the style step. The picker stays visible even when the
  // user arrived with an example photo, so this also has to handle the case
  // where the new style contradicts the attached example: the example (and
  // its example-derived "match the example" flags, which the summary step
  // would otherwise still report as "same as example") is dropped, and the
  // URL is rewritten without ?exampleId= so a refresh doesn't resurrect it.
  const selectStyle = (nextStyle: string) => {
    if (nextStyle === style) return;
    setStyle(nextStyle);

    const hasAttachedExample =
      Boolean(searchParams.get('exampleId')) ||
      exampleImage !== null ||
      fromExampleStyle !== null;

    // Sync the URL whenever it already pins a style or example: the ?style=
    // effect re-reads the param on every searchParams change (and on every
    // refresh), so a stale value would put the old style back. A visitor who
    // arrived without params keeps a param-free URL — the localStorage draft
    // already covers refreshes there.
    const urlStyle = searchParams.get('style');
    const needsUrlSync =
      hasAttachedExample || (urlStyle !== null && urlStyle !== nextStyle);
    if (!needsUrlSync) return;

    setExampleImage(null);
    setExamplePending(false);
    setFromExampleStyle(null);
    setMatchExample(MATCH_EXAMPLE_DEFAULT);

    const params = new URLSearchParams(searchParams.toString());
    params.delete('exampleId');
    params.set('style', nextStyle);
    router.replace(`${window.location.pathname}?${params.toString()}`, {
      scroll: false,
    });
  };

  // Upload reference photos to the shared storage service. The returned
  // public URL is what Runware will fetch later as a reference image, so
  // it MUST be a stable public URL (the upload route already returns
  // one). The same file uploaded twice dedupes server-side via md5.
  const handlePersonalImageFiles = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ''; // allow re-selecting the same file
    if (files.length === 0) return;
    const remaining = MAX_PERSONAL_IMAGES - personalImages.length;
    if (remaining <= 0) {
      toast.info(t('personal_image_max_reached'));
      return;
    }
    const toUpload = files.slice(0, remaining);
    setUploadingImages(true);
    try {
      const formData = new FormData();
      toUpload.forEach((file) => formData.append('files', file));
      const response = await fetch('/api/storage/upload-image', {
        method: 'POST',
        body: formData,
      });
      const text = await response.text();
      const body = text ? JSON.parse(text) : {};
      const payload = body?.data ?? body;
      if (!response.ok || (body?.code !== undefined && body.code !== 0)) {
        toast.error(
          body?.message || body?.error || t('personal_image_upload_error')
        );
        return;
      }
      const urls: string[] = payload?.urls ?? [];
      if (urls.length === 0) {
        toast.error(body?.message || t('personal_image_upload_error'));
        return;
      }
      setPersonalImages((current) =>
        [...current, ...urls].slice(0, MAX_PERSONAL_IMAGES)
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('personal_image_upload_error')
      );
    } finally {
      setUploadingImages(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    // eslint-disable-next-line no-console
    console.log('[wedding-wizard] submit start (v2 hardened)');
    try {
      // guest token: created server-side on first project, remembered after
      let guestId =
        typeof window !== 'undefined'
          ? localStorage.getItem('wedding_guest_id')
          : null;

      // Edit mode: send a PATCH so the existing project (and its
      // generation history) is updated in place. Create mode still
      // POSTs a brand-new project as before.
      const payload = {
        partner1: partner1.trim(),
        partner2: partner2.trim(),
        weddingDate: weddingDate || null,
        style,
        typography,
        palette,
        location: location.trim() || null,
        venue: venue.trim() || null,
        flowers,
        personalElements,
        personalImages,
        frameId,
        complexity,
        nameDisplay,
        showDate: Boolean(weddingDate),
        // "Same as example" wiring. The exampleId is read from the URL
        // (we kept it as a search param so deep links survive a refresh)
        // and the matchExample flags carry the four "match the example
        // image" toggles the user set on the wizard's property pickers.
        // The server resolves the id, fetches the active example, and
        // validates the image URL before persisting it. exampleStyle
        // records the example's own style id so the prompt compiler can
        // detect whether the user kept the example's style or switched
        // to a different one (different style -> explicit override line).
        exampleId: searchParams.get('exampleId') || undefined,
        exampleStyle: fromExampleStyle,
        matchExample,
      };

      const requestUrl =
        isEditMode && editId ? `/api/projects/${editId}` : '/api/projects';
      const requestMethod = isEditMode ? 'PATCH' : 'POST';
      const response = await fetch(requestUrl, {
        method: requestMethod,
        headers: {
          'Content-Type': 'application/json',
          ...(guestId ? { 'x-wedding-guest-id': guestId } : {}),
        },
        body: JSON.stringify(payload),
      });

      // Read raw text first so a non-JSON (e.g. 500 HTML) response still
      // surfaces a useful error instead of a generic "Something went wrong".
      const rawText = await response.text();
      let envelope: ApiEnvelope<{
        project?: { id: string };
        guestId?: string;
      }> = {};
      if (rawText) {
        try {
          envelope = JSON.parse(rawText);
        } catch {
          envelope = {
            error: `${response.status} ${response.statusText || ''}`.trim(),
          };
        }
      }
      const data = envelope.data ?? {};
      const apiError = envelope.error || envelope.message;
      if (
        !response.ok ||
        (envelope.code !== undefined && envelope.code !== 0)
      ) {
        const statusLine =
          `${response.status} ${response.statusText || ''}`.trim();
        const detailed = apiError
          ? `${statusLine}: ${apiError}`
          : statusLine || t('submit_error');
        toast.error(detailed, { duration: 8000 });
        // eslint-disable-next-line no-console
        console.error('[wedding-wizard] save failed', {
          status: response.status,
          method: requestMethod,
          body: rawText,
        });
        return;
      }
      // The PATCH response wraps the updated project under
      // `data.project`; the POST response also does. Normalize the
      // project id either way.
      const projectId = data.project?.id ?? (isEditMode ? editId : null);
      if (!projectId) {
        toast.error(t('submit_error'));
        return;
      }

      if (data.guestId && !guestId) {
        localStorage.setItem('wedding_guest_id', data.guestId);
      }

      const generateResponse = await fetch(
        `/api/projects/${projectId}/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(guestId || data.guestId
              ? { 'x-wedding-guest-id': guestId || data.guestId }
              : {}),
          },
        }
      );
      const generateRaw = await generateResponse.text();
      let generateEnvelope: ApiEnvelope<{
        candidates?: string[];
        generatedProjectId?: string | null;
      }> = {};
      if (generateRaw) {
        try {
          generateEnvelope = JSON.parse(generateRaw);
        } catch {
          generateEnvelope = {
            error:
              `${generateResponse.status} ${generateResponse.statusText || ''}`.trim(),
          };
        }
      }
      if (
        !generateResponse.ok ||
        (generateEnvelope.code !== undefined && generateEnvelope.code !== 0)
      ) {
        const generateError =
          generateEnvelope.error || generateEnvelope.message;
        // The API uses the codebase's respErr convention: most user-actionable
        // errors come back as HTTP 200 with `code: -1` carrying a clear
        // message (e.g. "no AI image provider configured yet..."). 4xx
        // status is reserved for HTTP-level outcomes the client should
        // branch on (402 quota, 404 not found, etc.). In both shapes the
        // server's message is safe and useful to surface.
        const isUserFacing =
          (generateResponse.status >= 400 && generateResponse.status < 500) ||
          generateEnvelope.code === -1;
        const detailed = isUserFacing
          ? generateError || t('submit_error')
          : generateError
            ? t('submit_error')
            : `${generateResponse.status} ${generateResponse.statusText || ''}`.trim() ||
              t('submit_error');
        const generatedProjectId = generateEnvelope.data?.generatedProjectId;
        if (generatedProjectId) {
          toast.custom(
            (toastId) => (
              <div
                role="alert"
                className="bg-background text-foreground flex max-w-md items-start gap-3 rounded-lg border p-4 text-sm shadow-lg"
              >
                <p className="flex-1 leading-5">
                  {detailed}{' '}
                  <Link
                    href={`/design/${generatedProjectId}`}
                    className="text-primary font-medium underline underline-offset-2"
                    onClick={() => toast.dismiss(toastId)}
                  >
                    {t('one_generated_project')}
                  </Link>
                </p>
                <button
                  type="button"
                  aria-label={t('dismiss')}
                  className="text-muted-foreground hover:text-foreground -mt-1 -mr-1 px-1 text-lg leading-none"
                  onClick={() => toast.dismiss(toastId)}
                >
                  ×
                </button>
              </div>
            ),
            { duration: Infinity }
          );
        } else {
          toast.error(detailed, { duration: 8000 });
        }
        if (!isUserFacing) {
          // System errors (5xx, network failures). Log the full response
          // so a misconfigured provider / model name is visible in dev
          // tools. We pass a single string rather than an object because
          // Next.js's console-error reporter collapses multi-property
          // objects (especially ones whose props are string-shaped) to
          // `{}` in the browser console, which hides the actual error.
          // eslint-disable-next-line no-console
          console.error(
            `[wedding-wizard] generate failed status=${generateResponse.status} ${generateResponse.statusText || ''} url=${generateResponse.url} ok=${generateResponse.ok} body=${generateRaw || '(empty)'}`
          );
        }
        return;
      }

      window.location.href = `/design/${projectId}`;
      // Clear the in-progress draft so the next visit to /create starts
      // fresh. We do this after the redirect is queued so the
      // localStorage write doesn't race the navigation. Edit mode
      // doesn't write a draft in the first place (the persistence
      // effect is gated), so this is a no-op there.
      clearPersistedWizardState();
    } catch (error) {
      // Network failure, AbortError, JSON parse, etc.
      const message =
        error instanceof Error && error.message
          ? error.message
          : t('submit_error');
      toast.error(message);
      // eslint-disable-next-line no-console
      console.error('[wedding-wizard] submit failed', error);
    } finally {
      setSubmitting(false);
    }
  };

  const styleConfig = weddingStyles.find((s) => s.id === style);

  // Only offer styles that have real example photos behind them — a style
  // with nothing to show would only produce a dead-end preview. The
  // currently selected style is always kept in the list even without
  // photos (?style= deep link, restored draft, edit mode) so the user can
  // still see what is selected and switch away from it deliberately.
  const selectableStyles = exampleStyleIds
    ? weddingStyles.filter(
        (styleOption) =>
          styleOption.id === style || exampleStyleIds.includes(styleOption.id)
      )
    : weddingStyles;

  // Photos of the selected style. Only trusted once the payload has caught up
  // with `style`, so switching style can't flash the previous style's photos.
  const styleExamples = startExamplesStyle === style ? startExamples : [];
  const stylePreviewExample = styleExamples[0] ?? null;

  // The style picker is never hidden: an attached example implies a style,
  // but the user can still switch — see `selectStyle`.
  //
  // The preview panel shows the attached example photo when there is one and
  // a representative photo of the selected style otherwise, so the right
  // column always mirrors what's picked on the style step. It appears from
  // the style step onwards; on the names step only a deep-linked example
  // (the photo the user clicked in) justifies showing it.
  const previewImage: { url: string; alt: string } | null = exampleImage
    ? exampleImage
    : stylePreviewExample
      ? {
          url: stylePreviewExample.imageUrl,
          alt: stylePreviewExample.altText ?? stylePreviewExample.name,
        }
      : null;
  const showPreviewPanel =
    previewImage !== null || examplePending || startExamplesLoading || step > 0;

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-16">
        <ScrollAnimation>
          <div className="mx-auto mb-3 max-w-2xl text-center">
            <h1 className="font-serif text-3xl font-medium text-balance md:text-4xl">
              {isEditMode ? t('edit_title') : t('title')}
            </h1>
            <p className="text-muted-foreground mt-3 text-balance">
              {isEditMode ? t('edit_description') : t('description')}
            </p>
            {isEditMode && editId && (
              <p className="text-muted-foreground mt-3 text-xs">
                <Link
                  href={`/design/${editId}`}
                  className="hover:text-foreground underline underline-offset-4"
                >
                  {t('edit_back_to_crest')}
                </Link>
              </p>
            )}
            <p className="text-muted-foreground mt-2 text-xs">
              <span className="text-foreground font-medium">*</span>{' '}
              {t('required')} · {t('optional')}
            </p>
          </div>
        </ScrollAnimation>

        {/* Manual reset. Wipes the in-memory form state AND the
            localStorage draft so a refresh after this lands on a blank
            wizard instead of the just-cleared form. We only render the
            button when there's actually something to reset — otherwise
            it'd be visual noise on the very first visit. The form is
            considered "started" as soon as any of these is non-default;
            we keep the predicate simple so the cost is one short-circuit
            per render. */}
        {(partner1 ||
          partner2 ||
          weddingDate ||
          location ||
          venue ||
          flowers.length > 0 ||
          personalElements.length > 0 ||
          personalImages.length > 0 ||
          customHex ||
          customFlower ||
          customElement ||
          frameId !== null ||
          step > 0 ||
          matchExample.border ||
          matchExample.palette ||
          matchExample.flowers ||
          matchExample.elements) && (
          <div className="mb-6 flex justify-center">
            <button
              type="button"
              onClick={resetWizard}
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 transition-colors hover:underline"
            >
              {t('start_over')}
            </button>
          </div>
        )}

        {/* step indicator */}
        <div className="mb-10">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {WIZARD_STEPS.map((wizardStep, idx) => (
              <button
                key={wizardStep.key}
                type="button"
                onClick={() => idx <= step && setStep(idx)}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors',
                  idx === step
                    ? 'border-primary bg-primary text-primary-foreground'
                    : idx < step
                      ? 'border-primary/40 text-foreground cursor-pointer'
                      : 'text-muted-foreground cursor-default'
                )}
              >
                <span
                  className={cn(
                    'flex size-5 items-center justify-center rounded-full text-[10px]',
                    idx === step
                      ? 'bg-primary-foreground/20'
                      : idx < step
                        ? 'bg-primary/15'
                        : 'bg-muted'
                  )}
                >
                  {idx + 1}
                </span>
                {t(`steps.${wizardStep.key}`)}
              </button>
            ))}
          </div>
          <Progress
            value={((step + 1) / WIZARD_STEPS.length) * 100}
            className="mx-auto mt-4 h-1 max-w-md"
          />
        </div>

        <div
          className={cn(
            'grid gap-8',
            showPreviewPanel && 'lg:grid-cols-[1fr_400px]'
          )}
        >
          {/* controls */}
          <div className="order-2 min-w-0 lg:order-1">
            {step === 0 && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="partner1">
                      {t('partner1')} <span aria-hidden>*</span>
                    </Label>
                    <Input
                      id="partner1"
                      value={partner1}
                      maxLength={40}
                      placeholder={t('partner1_placeholder')}
                      onChange={(e) => setPartner1(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="partner2">
                      {t('partner2')} <span aria-hidden>*</span>
                    </Label>
                    <Input
                      id="partner2"
                      value={partner2}
                      maxLength={40}
                      placeholder={t('partner2_placeholder')}
                      onChange={(e) => setPartner2(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weddingDate">
                    {t('wedding_date')}{' '}
                    <span className="text-muted-foreground text-xs">
                      ({t('optional')})
                    </span>
                  </Label>
                  <Input
                    id="weddingDate"
                    type="date"
                    value={weddingDate}
                    onChange={(e) => setWeddingDate(e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <Label>
                    {t('name_display')}{' '}
                    <span className="text-muted-foreground text-xs">
                      ({t('optional')})
                    </span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {(
                      [
                        ['initials_amp', 'E & J'],
                        ['initials_joined', 'EJ'],
                        ['initials_spaced', 'E · J'],
                        ['full_names', 'Emma & James'],
                        ['surname', 'The Millers'],
                        ['initials_only', 'E J'],
                      ] as Array<[string, string]>
                    ).map(([value, preview]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setNameDisplay(
                            value as WeddingProjectInput['nameDisplay']
                          )
                        }
                        className={cn(
                          'rounded-lg border px-3 py-2 text-sm transition-colors',
                          nameDisplay === value
                            ? 'border-primary bg-accent'
                            : 'hover:border-primary/40'
                        )}
                      >
                        {preview}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-8">
                <div className="space-y-5">
                  <div className="space-y-3">
                    <Label>
                      {t('choose_style')} <span aria-hidden>*</span>
                    </Label>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {selectableStyles.map((styleOption) => (
                        <button
                          key={styleOption.id}
                          type="button"
                          onClick={() => selectStyle(styleOption.id)}
                          aria-pressed={style === styleOption.id}
                          className={cn(
                            'rounded-xl border p-3 text-left transition-colors',
                            style === styleOption.id
                              ? 'border-primary bg-accent'
                              : 'hover:border-primary/40'
                          )}
                        >
                          <div
                            className="mb-2 h-2 w-8 rounded-full"
                            style={{ background: styleOption.previewColor }}
                          />
                          <p className="text-sm font-medium">
                            {styleOption.name}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {styleOption.tagline}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick-start from a real example: admin-uploaded crests
                      for the *currently selected* style. Tapping a thumbnail
                      rewrites the URL with ?exampleId= and ?style= so the
                      example effect refills the wizard with the photo and
                      palette. The row stays visible while an example is
                      attached — that is what lets the user swap to another
                      one — and the attached one is marked as selected. */}
                  {styleExamples.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
                          {t('start_from_example')}
                        </p>
                        <Link
                          href="/examples"
                          className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
                        >
                          {t('see_more_examples')}
                        </Link>
                      </div>
                      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
                        {styleExamples.map((example) => {
                          const names = example.name
                            .split('&')
                            .map((n) => n.trim());
                          const [p1, p2] =
                            names.length === 2
                              ? [names[0], names[1]]
                              : [example.name, ''];
                          const isSelected =
                            searchParams.get('exampleId') === example.id;
                          return (
                            <button
                              key={example.id}
                              type="button"
                              onClick={() => {
                                // Carry the user's current style choice
                                // through the deep link so the example's
                                // style doesn't override it.
                                const params = new URLSearchParams(
                                  searchParams.toString()
                                );
                                params.set('style', style);
                                params.set('exampleId', example.id);
                                router.push(
                                  `${window.location.pathname}?${params.toString()}`,
                                  { scroll: false }
                                );
                              }}
                              aria-pressed={isSelected}
                              className={cn(
                                'border-border/60 hover:border-primary/40 group w-28 shrink-0 snap-start overflow-hidden rounded-xl border text-left transition-colors sm:w-32',
                                isSelected &&
                                  'border-primary ring-primary/30 ring-2'
                              )}
                              title={example.altText ?? example.name}
                              aria-label={example.altText ?? example.name}
                            >
                              <div className="bg-wedding-ivory relative aspect-square w-full">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={example.imageUrl}
                                  alt={example.altText ?? example.name}
                                  className="size-full object-cover"
                                  loading="lazy"
                                />
                                {isSelected && (
                                  <span
                                    aria-hidden
                                    className="bg-primary text-primary-foreground absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full"
                                  >
                                    <svg
                                      viewBox="0 0 12 12"
                                      className="size-3"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="1.8"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M2.5 6.2 4.8 8.5 9.5 3.5" />
                                    </svg>
                                  </span>
                                )}
                              </div>
                              <div className="bg-background/90 px-2 py-1.5 text-xs">
                                <p className="truncate font-medium">
                                  {p2 ? `${p1} & ${p2}` : p1}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {t('start_from_example_hint')}
                      </p>
                    </div>
                  ) : startExamplesLoading ? (
                    <div className="text-muted-foreground text-xs">
                      {t('start_from_example_loading')}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <p className="text-muted-foreground text-sm">
                    {t('lettering_follows_example_hint')}
                  </p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-base">
                    {t('border')}{' '}
                    <span className="text-muted-foreground text-xs">
                      ({t('optional')})
                    </span>
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    {t('border_hint')}
                  </p>
                </div>

                {framesLoading ? (
                  <div className="text-muted-foreground py-6 text-center text-sm">
                    {t('border_loading')}
                  </div>
                ) : frames.length === 0 ? (
                  <div className="text-muted-foreground py-6 text-center text-sm">
                    {t('border_empty')}
                  </div>
                ) : (
                  // Horizontal scroll row. The shadcn embla carousel we used
                  // previously positioned prev/next buttons absolutely on the
                  // page edge which clipped off-screen on mobile, and its
                  // `object-cover` thumbnails were cropping the top/bottom of
                  // square frame ornaments. A plain overflow-x-auto row with
                  // `object-contain` solves both: no page overflow, and the
                  // whole border is visible.
                  <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
                    {/* "Same as example" lives at the front of the row so it
                        reads as the default choice. The example's border is
                        baked into its reference image, so selecting this
                        option tells the generate route to skip the
                        selected frame and let the AI draw the border. */}
                    {exampleImage ? (
                      <button
                        key="__same_as_example__"
                        type="button"
                        onClick={() => {
                          setFrameId(null);
                          setMatchExample((current) => ({
                            ...current,
                            border: true,
                          }));
                        }}
                        aria-pressed={matchExample.border}
                        data-selected={matchExample.border}
                        className={cn(
                          'w-36 shrink-0 snap-start overflow-hidden rounded-xl border-2 text-left transition-colors sm:w-44',
                          matchExample.border
                            ? 'border-primary bg-accent ring-primary/30 shadow-sm ring-2'
                            : 'hover:border-primary/40 border-transparent'
                        )}
                      >
                        <div className="bg-muted/40 relative aspect-square w-full p-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={exampleImage.url}
                            alt={exampleImage.alt}
                            className="size-full object-cover"
                          />
                          <span className="bg-background/80 absolute right-1 bottom-1 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase shadow">
                            {t('same_as_example')}
                          </span>
                          {matchExample.border ? (
                            <span
                              aria-hidden
                              className="bg-primary text-primary-foreground absolute top-2 right-2 flex size-5 items-center justify-center rounded-full text-xs font-bold shadow"
                            >
                              ✓
                            </span>
                          ) : null}
                        </div>
                        <div className="bg-background/90 truncate px-2 py-1 text-xs">
                          {t('same_as_example')}
                        </div>
                      </button>
                    ) : null}
                    {frames.map((frame) => (
                      <button
                        key={frame.id}
                        type="button"
                        onClick={() => selectFrame(frame.id)}
                        aria-pressed={
                          !matchExample.border && frameId === frame.id
                        }
                        data-selected={
                          !matchExample.border && frameId === frame.id
                        }
                        className={cn(
                          'w-36 shrink-0 snap-start overflow-hidden rounded-xl border-2 text-left transition-colors sm:w-44',
                          !matchExample.border && frameId === frame.id
                            ? 'border-primary bg-accent ring-primary/30 shadow-sm ring-2'
                            : 'hover:border-primary/40 border-transparent'
                        )}
                      >
                        <div className="bg-wedding-ivory relative aspect-square w-full p-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={frame.thumbnailUrl ?? frame.url}
                            alt={frame.name}
                            className="size-full object-contain"
                            loading="lazy"
                          />
                          {!matchExample.border && frameId === frame.id ? (
                            <span
                              aria-hidden
                              className="bg-primary text-primary-foreground absolute top-2 right-2 flex size-5 items-center justify-center rounded-full text-xs font-bold shadow"
                            >
                              ✓
                            </span>
                          ) : null}
                        </div>
                        <div className="bg-background/90 flex items-center justify-between gap-2 truncate px-2 py-1 text-xs">
                          {frame.name}
                          {!matchExample.border && frameId === frame.id ? (
                            <span className="text-primary shrink-0 font-semibold">
                              ✓
                            </span>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-8">
                <div className="space-y-3">
                  <Label>
                    {t('choose_palette')} <span aria-hidden>*</span>{' '}
                    <span className="text-muted-foreground text-xs">
                      ({palette.length}/{WEDDING_MAX_PALETTE_COLORS})
                    </span>
                  </Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* "Same as example" first. Selecting it tells the AI to
                        match the example's palette directly; the existing
                        palette remains as a fallback prompt value. */}
                    {exampleImage ? (
                      <button
                        key="__same_as_example__"
                        type="button"
                        onClick={() => {
                          setMatchExample((current) => ({
                            ...current,
                            palette: true,
                          }));
                        }}
                        className={cn(
                          'rounded-xl border p-3 text-left transition-colors',
                          matchExample.palette
                            ? 'border-primary bg-accent'
                            : 'hover:border-primary/40'
                        )}
                      >
                        <div className="mb-2 flex gap-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={exampleImage.url}
                            alt={exampleImage.alt}
                            className="h-5 w-5 rounded-full border border-black/10 object-cover"
                          />
                          <span
                            aria-hidden
                            className="bg-muted h-5 w-5 rounded-full border border-black/10"
                          />
                          <span
                            aria-hidden
                            className="bg-muted h-5 w-5 rounded-full border border-black/10"
                          />
                          <span
                            aria-hidden
                            className="bg-muted h-5 w-5 rounded-full border border-black/10"
                          />
                        </div>
                        <p className="text-sm font-medium">
                          {t('same_as_example')}
                        </p>
                      </button>
                    ) : null}
                    {weddingPalettes.map((paletteOption) => (
                      <button
                        key={paletteOption.id}
                        type="button"
                        onClick={() => {
                          setPalette(paletteOption.colors);
                          setMatchExample((current) => ({
                            ...current,
                            palette: false,
                          }));
                        }}
                        className={cn(
                          'rounded-xl border p-3 text-left transition-colors',
                          !matchExample.palette &&
                            palette.join(',') === paletteOption.colors.join(',')
                            ? 'border-primary bg-accent'
                            : 'hover:border-primary/40'
                        )}
                      >
                        <div className="mb-2 flex gap-1">
                          {paletteOption.colors.map((color) => (
                            <span
                              key={color}
                              className="h-5 w-5 rounded-full border border-black/10"
                              style={{ background: color }}
                            />
                          ))}
                        </div>
                        <p className="text-sm font-medium">
                          {paletteOption.name}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>
                    {t('custom_colors')}{' '}
                    <span className="text-muted-foreground text-xs">
                      ({t('optional')})
                    </span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {palette.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => togglePaletteColor(color)}
                        className="group flex items-center gap-2 rounded-full border py-1 pr-3 pl-1"
                        title={t('remove_color')}
                      >
                        <span
                          className="h-6 w-6 rounded-full border border-black/10"
                          style={{ background: color }}
                        />
                        <span className="text-xs">{color}</span>
                        <span className="text-muted-foreground group-hover:text-destructive text-xs">
                          ×
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={customHex}
                      placeholder="#A3AA91"
                      onChange={(e) => setCustomHex(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addCustomHex()}
                      className="max-w-40"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addCustomHex}
                    >
                      {t('add')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label>
                    {t('flowers')}{' '}
                    <span className="text-muted-foreground text-xs">
                      ({t('optional')})
                    </span>{' '}
                    <span className="text-muted-foreground text-xs">
                      ({flowers.length}/{WEDDING_MAX_FLOWERS})
                    </span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {exampleImage ? (
                      <button
                        key="__same_as_example__"
                        type="button"
                        onClick={() => {
                          setMatchExample((current) => ({
                            ...current,
                            flowers: true,
                          }));
                        }}
                        className={cn(
                          'rounded-full border px-4 py-2 text-sm transition-colors',
                          matchExample.flowers
                            ? 'border-primary bg-accent'
                            : 'hover:border-primary/40'
                        )}
                      >
                        {t('same_as_example')}
                      </button>
                    ) : null}
                    {weddingFlowerOptions.map((flower) => (
                      <button
                        key={flower}
                        type="button"
                        onClick={() => {
                          toggleFlower(flower);
                          setMatchExample((current) =>
                            current.flowers
                              ? { ...current, flowers: false }
                              : current
                          );
                        }}
                        className={cn(
                          'rounded-full border px-4 py-2 text-sm transition-colors',
                          !matchExample.flowers && flowers.includes(flower)
                            ? 'border-primary bg-accent'
                            : 'hover:border-primary/40'
                        )}
                      >
                        {flower}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={customFlower}
                      placeholder={t('custom_flower_placeholder')}
                      onChange={(e) => setCustomFlower(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addCustomFlower()}
                      className="max-w-60"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addCustomFlower}
                    >
                      {t('add')}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="location">
                      {t('location')}{' '}
                      <span className="text-muted-foreground text-xs">
                        ({t('optional')})
                      </span>
                    </Label>
                    <Input
                      id="location"
                      value={location}
                      maxLength={80}
                      placeholder={t('location_placeholder')}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="venue">
                      {t('venue')}{' '}
                      <span className="text-muted-foreground text-xs">
                        ({t('optional')})
                      </span>
                    </Label>
                    <Input
                      id="venue"
                      value={venue}
                      maxLength={80}
                      placeholder={t('venue_placeholder')}
                      onChange={(e) => setVenue(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label>
                    {t('personal_elements')}{' '}
                    <span className="text-muted-foreground text-xs">
                      ({t('optional')})
                    </span>{' '}
                    <span className="text-muted-foreground text-xs">
                      ({personalElements.length}/{WEDDING_MAX_PERSONAL_ELEMENTS}
                      )
                    </span>
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    {t('personal_elements_hint')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {weddingPersonalElementOptions.map((element) => (
                      <button
                        key={element}
                        type="button"
                        onClick={() => toggleElement(element)}
                        className={cn(
                          'rounded-full border px-4 py-2 text-sm transition-colors',
                          !matchExample.elements &&
                            personalElements.includes(element)
                            ? 'border-primary bg-accent'
                            : 'hover:border-primary/40'
                        )}
                      >
                        {element}
                      </button>
                    ))}
                    {personalElements
                      .filter(
                        (element) =>
                          !weddingPersonalElementOptions.includes(element)
                      )
                      .map((element) => (
                        <button
                          key={element}
                          type="button"
                          onClick={() => toggleElement(element)}
                          className="border-primary bg-accent rounded-full border px-4 py-2 text-sm transition-colors"
                        >
                          {element} ×
                        </button>
                      ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={customElement}
                      placeholder={t('custom_element_placeholder')}
                      onChange={(e) => setCustomElement(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addCustomElement()}
                      className="max-w-60"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addCustomElement}
                    >
                      {t('add')}
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>
                    {t('personal_image_upload_label')}{' '}
                    <span className="text-muted-foreground text-xs">
                      ({t('optional')})
                    </span>{' '}
                    <span className="text-muted-foreground text-xs">
                      ({personalImages.length}/{MAX_PERSONAL_IMAGES})
                    </span>
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    {t('personal_image_upload_hint')}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {personalImages.map((url, index) => (
                      <div
                        key={url}
                        className="border-border/60 bg-muted/30 relative size-24 overflow-hidden rounded-lg border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={t('personal_image_upload_label')}
                          className="size-full object-cover"
                        />
                        <button
                          type="button"
                          aria-label={t('remove')}
                          onClick={() =>
                            setPersonalImages((current) =>
                              current.filter((_, i) => i !== index)
                            )
                          }
                          className="bg-background/80 absolute top-1 right-1 rounded-full px-2 py-0.5 text-xs shadow"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {personalImages.length < MAX_PERSONAL_IMAGES && (
                      <label
                        className={cn(
                          'border-border/60 hover:border-primary/40',
                          'flex size-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed text-sm transition-colors',
                          uploadingImages && 'pointer-events-none opacity-60'
                        )}
                      >
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          multiple
                          className="hidden"
                          onChange={handlePersonalImageFiles}
                        />
                        {uploadingImages
                          ? t('personal_image_uploading')
                          : t('personal_image_add')}
                      </label>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>
                    {t('complexity')}{' '}
                    <span className="text-muted-foreground text-xs">
                      ({t('optional')})
                    </span>
                  </Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(
                      [
                        ['minimal', t('complexity_minimal')],
                        ['medium', t('complexity_medium')],
                        ['rich', t('complexity_rich')],
                      ] as Array<[string, string]>
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setComplexity(
                            value as WeddingProjectInput['complexity']
                          )
                        }
                        className={cn(
                          'rounded-xl border p-3 text-sm transition-colors',
                          complexity === value
                            ? 'border-primary bg-accent'
                            : 'hover:border-primary/40'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-6">
                <div className="rounded-2xl border p-5">
                  <h3 className="font-serif text-lg">{t('summary')}</h3>
                  <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{t('partner1')}</dt>
                      <dd>{partner1}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{t('partner2')}</dt>
                      <dd>{partner2}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">
                        {t('wedding_date')}
                      </dt>
                      <dd>{weddingDate || '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">
                        {t('choose_style')}
                      </dt>
                      <dd>{styleConfig?.name}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{t('border')}</dt>
                      <dd>
                        {matchExample.border
                          ? t('same_as_example')
                          : (frames.find((frame) => frame.id === frameId)
                              ?.name ?? t('border_none'))}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">
                        {t('choose_palette')}
                      </dt>
                      <dd className="flex gap-1">
                        {matchExample.palette ? (
                          <span className="text-sm">
                            {t('same_as_example')}
                          </span>
                        ) : (
                          palette.map((color) => (
                            <span
                              key={color}
                              className="h-4 w-4 rounded-full border border-black/10"
                              style={{ background: color }}
                            />
                          ))
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{t('location')}</dt>
                      <dd>{location || '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{t('flowers')}</dt>
                      <dd>
                        {matchExample.flowers
                          ? t('same_as_example')
                          : flowers.join(', ') || '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">
                        {t('personal_elements')}
                      </dt>
                      <dd>
                        {matchExample.elements
                          ? t('same_as_example')
                          : personalElements.join(', ') || '—'}
                      </dd>
                    </div>
                  </dl>
                </div>
                <p className="text-muted-foreground text-sm">
                  {t('generate_hint')}
                </p>
                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  disabled={submitting || !isEditPrefilled}
                  onClick={submit}
                >
                  {submitting
                    ? t('submitting')
                    : isEditMode
                      ? t('edit_generate')
                      : t('generate')}
                </Button>
              </div>
            )}

            {/* nav */}
            <div className="mt-10 flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
              >
                {t('back')}
              </Button>
              {step < WIZARD_STEPS.length - 1 ? (
                <Button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canContinue()}
                >
                  {t('continue')}
                </Button>
              ) : null}
            </div>
          </div>

          {/* live preview — shows the example photo the user clicked in, or,
              when they start from scratch, a representative photo of the
              selected style, so the right column always mirrors the current
              pick and follows along when the style is switched. */}
          {showPreviewPanel ? (
            <div className="order-1 min-w-0 lg:order-2">
              <div className="bg-wedding-ivory sticky top-24 rounded-2xl border p-6">
                <p className="text-muted-foreground mb-4 text-center text-xs tracking-[0.2em] uppercase">
                  {t('live_preview')}
                </p>
                {previewImage ? (
                  <div className="mx-auto w-full max-w-xs space-y-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewImage.url}
                      alt={previewImage.alt}
                      className="w-full rounded-xl"
                    />
                    <p className="text-center text-xs">
                      <span className="text-muted-foreground">
                        {exampleImage
                          ? t('preview_source_example')
                          : t('preview_source_style')}
                      </span>{' '}
                      <span className="font-medium">
                        {exampleImage ? previewImage.alt : styleConfig?.name}
                      </span>
                    </p>
                    <p className="text-muted-foreground text-center text-xs">
                      {t('preview_note')}
                    </p>
                  </div>
                ) : examplePending || startExamplesLoading ? (
                  <div
                    aria-hidden
                    className="bg-muted/40 mx-auto aspect-square w-full max-w-xs animate-pulse rounded-xl"
                  />
                ) : (
                  // A style with no example photo uploaded yet: show its
                  // palette swatch rather than an empty panel.
                  <div className="mx-auto w-full max-w-xs space-y-3">
                    <div
                      aria-hidden
                      className="border-border/60 flex aspect-square w-full items-center justify-center rounded-xl border"
                      style={{
                        background: `${styleConfig?.previewColor ?? '#A3AA91'}1A`,
                      }}
                    >
                      <span
                        className="size-16 rounded-full"
                        style={{
                          background: styleConfig?.previewColor ?? '#A3AA91',
                        }}
                      />
                    </div>
                    <p className="text-center text-xs">
                      <span className="text-muted-foreground">
                        {t('preview_source_style')}
                      </span>{' '}
                      <span className="font-medium">{styleConfig?.name}</span>
                    </p>
                    <p className="text-muted-foreground text-center text-xs">
                      {t('preview_no_photo')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
