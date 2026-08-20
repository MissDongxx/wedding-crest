'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Progress } from '@/shared/components/ui/progress';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import {
  composeWeddingCrest,
  resolveWeddingDisplayTexts,
} from '@/shared/wedding/composer';
import { getWeddingTypography, layoutsForStyle } from '@/shared/wedding/config';
import {
  WEDDING_MAX_FLOWERS,
  WEDDING_MAX_PALETTE_COLORS,
  WEDDING_MAX_PERSONAL_ELEMENTS,
  weddingFlowerOptions,
  WeddingFontSpec,
  weddingPalettes,
  weddingPersonalElementOptions,
  WeddingProjectInput,
  weddingStyles,
  weddingTypography,
} from '@/shared/wedding/types';

const WIZARD_STEPS = [
  { key: 'names', label: 'Names' },
  { key: 'style', label: 'Style' },
  { key: 'palette', label: 'Colors' },
  { key: 'details', label: 'Details' },
  { key: 'personal', label: 'Personal' },
  { key: 'review', label: 'Review' },
] as const;

/**
 * Typography pairing suggested for each name display mode. Pairings the
 * current style doesn't allow are skipped at runtime (see the effect that
 * consumes this map), so adding a new entry is safe even if the pairing
 * isn't universal.
 */
const recommendedTypographyFor: Record<
  WeddingProjectInput['nameDisplay'],
  string
> = {
  initials_amp: 'editorial_rose',
  initials_joined: 'modern_serif',
  initials_spaced: 'editorial_italic',
  full_names: 'modern_serif',
  surname: 'classic_caps',
};

const CUSTOM_HEX_RE = /^#[0-9a-fA-F]{6}$/;

function initialsFromNames(partner1: string, partner2: string): string[] {
  return [partner1.charAt(0).toUpperCase(), partner2.charAt(0).toUpperCase()];
}

/**
 * Inline CSS for a font spec, used by the typography specimen cards. SVG
 * letter-spacing is expressed in user units against the composer's base font
 * size, so it is converted to em to keep the specimen proportional at card
 * scale. Mirrors the fontStack fallbacks in the composer.
 */
function fontSpecStyle(
  spec: WeddingFontSpec,
  baseFontSize: number
): CSSProperties {
  const isSans = /sans|manrope|dm/i.test(spec.family);
  return {
    fontFamily: `'${spec.family}', ${isSans ? 'system-ui, sans-serif' : 'Georgia, serif'}`,
    fontWeight: spec.weight ?? 400,
    fontStyle: spec.italic ? 'italic' : 'normal',
    letterSpacing: spec.letterSpacing
      ? `${(spec.letterSpacing / baseFontSize).toFixed(4)}em`
      : undefined,
    textTransform: spec.uppercase ? 'uppercase' : undefined,
  };
}

/**
 * Six-step wedding crest wizard with an instant typography preview
 * (ornament layer only; AI illustration is added after generation).
 */
export function WeddingWizard() {
  const t = useTranslations('pages.create');
  const searchParams = useSearchParams();

  // step 1: names
  const [partner1, setPartner1] = useState('');
  const [partner2, setPartner2] = useState('');
  const [weddingDate, setWeddingDate] = useState('');
  const [nameDisplay, setNameDisplay] =
    useState<WeddingProjectInput['nameDisplay']>('initials_amp');

  // step 2: style
  const [style, setStyle] = useState('botanical_watercolor');
  const [composition, setComposition] = useState('');
  const [typography, setTypography] = useState('editorial_rose');

  // step 3: palette
  const [palette, setPalette] = useState<string[]>(weddingPalettes[0].colors);
  const [customHex, setCustomHex] = useState('');

  // step 4: details
  const [location, setLocation] = useState('');
  const [venue, setVenue] = useState('');
  const [flowers, setFlowers] = useState<string[]>([]);
  const [customFlower, setCustomFlower] = useState('');

  // step 5: personal elements
  const [personalElements, setPersonalElements] = useState<string[]>([]);
  const [customElement, setCustomElement] = useState('');

  // step 6: review
  const [complexity, setComplexity] =
    useState<WeddingProjectInput['complexity']>('medium');

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // preselect style from ?style= deep link (used by style cards + SEO pages)
  useEffect(() => {
    const requested = searchParams.get('style');
    if (requested && weddingStyles.some((s) => s.id === requested)) {
      setStyle(requested);
      const first = layoutsForStyle(requested)[0];
      if (first) {
        setComposition(first.composition);
      }
    }
  }, [searchParams]);

  // keep composition valid for the selected style
  const styleLayouts = useMemo(() => layoutsForStyle(style), [style]);
  useEffect(() => {
    if (
      !composition ||
      !styleLayouts.some((l) => l.composition === composition)
    ) {
      setComposition(styleLayouts[0]?.composition ?? '');
    }
  }, [styleLayouts, composition]);

  // keep typography valid for the selected style
  useEffect(() => {
    const valid = weddingStyles.find((s) => s.id === style)?.typography ?? [];
    if (!valid.includes(typography)) {
      setTypography(valid[0] ?? 'editorial_rose');
    }
  }, [style, typography]);

  // When the name display mode changes, suggest a typography pairing that
  // matches the new text length and formality. Shorter / decorative text
  // gets an elegant pairing; longer or more formal text gets a readable or
  // classical pairing. No-op if the recommendation isn't in the current
  // style's allowed list (the previous useEffect will then fall back to
  // the style's first pairing).
  useEffect(() => {
    const valid = weddingStyles.find((s) => s.id === style)?.typography ?? [];
    const recommended = recommendedTypographyFor[nameDisplay];
    if (recommended && valid.includes(recommended)) {
      setTypography(recommended);
    }
  }, [nameDisplay, style]);

  const previewInput = useMemo(
    () => ({
      partner1: partner1 || 'Emma',
      partner2: partner2 || 'James',
      initials: initialsFromNames(partner1 || 'Emma', partner2 || 'James'),
      weddingDate: weddingDate || null,
      style,
      layout:
        styleLayouts.find((l) => l.composition === composition)?.id ??
        styleLayouts[0]?.id ??
        'BOTANICAL_OVAL_01',
      typography,
      palette,
      location: null,
      venue: null,
      flowers,
      personalElements,
      complexity,
      nameDisplay,
      showDate: Boolean(weddingDate),
    }),
    [
      partner1,
      partner2,
      weddingDate,
      style,
      styleLayouts,
      composition,
      typography,
      palette,
      flowers,
      personalElements,
      complexity,
      nameDisplay,
    ]
  );

  const previewSvg = useMemo(
    () => composeWeddingCrest(previewInput),
    [previewInput]
  );

  // Same texts the live preview renders, reused by the typography specimen
  // cards so each pairing shows the couple's real names and date.
  const previewTexts = useMemo(
    () => resolveWeddingDisplayTexts(previewInput),
    [previewInput]
  );

  const canContinue = useCallback(() => {
    if (step === 0) {
      return (
        partner1.trim().length > 0 &&
        partner2.trim().length > 0 &&
        partner1.trim().length <= 40 &&
        partner2.trim().length <= 40
      );
    }
    if (step === 2) {
      return (
        palette.length >= 1 && palette.length <= WEDDING_MAX_PALETTE_COLORS
      );
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
    }
    setCustomFlower('');
  };

  const addCustomElement = () => {
    const value = customElement.trim();
    if (
      value &&
      !personalElements.includes(value) &&
      personalElements.length < WEDDING_MAX_PERSONAL_ELEMENTS
    ) {
      setPersonalElements((current) => [...current, value]);
    }
    setCustomElement('');
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

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(guestId ? { 'x-wedding-guest-id': guestId } : {}),
        },
        body: JSON.stringify({
          partner1: partner1.trim(),
          partner2: partner2.trim(),
          weddingDate: weddingDate || null,
          style,
          composition,
          typography,
          palette,
          location: location.trim() || null,
          venue: venue.trim() || null,
          flowers,
          personalElements,
          complexity,
          nameDisplay,
          showDate: Boolean(weddingDate),
        }),
      });

      // Read raw text first so a non-JSON (e.g. 500 HTML) response still
      // surfaces a useful error instead of a generic "Something went wrong".
      const rawText = await response.text();
      let data: { error?: string; project?: { id: string }; guestId?: string } =
        {};
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = {
            error: `${response.status} ${response.statusText || ''}`.trim(),
          };
        }
      }
      if (!response.ok) {
        const statusLine = `${response.status} ${response.statusText || ''}`.trim();
        const detailed = data?.error
          ? `${statusLine}: ${data.error}`
          : statusLine || t('submit_error');
        toast.error(detailed, { duration: 8000 });
        // eslint-disable-next-line no-console
        console.error('[wedding-wizard] create failed', {
          status: response.status,
          body: rawText,
        });
        return;
      }
      if (!data.project?.id) {
        toast.error(t('submit_error'));
        return;
      }

      if (data.guestId && !guestId) {
        localStorage.setItem('wedding_guest_id', data.guestId);
      }

      const generateResponse = await fetch(
        `/api/projects/${data.project.id}/generate`,
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
      let generateData: { error?: string } = {};
      if (generateRaw) {
        try {
          generateData = JSON.parse(generateRaw);
        } catch {
          generateData = {
            error: `${generateResponse.status} ${generateResponse.statusText || ''}`.trim(),
          };
        }
      }
      if (!generateResponse.ok) {
        // Show the actual server error (or HTTP status if no body) so the
        // user can tell us WHY generation failed instead of seeing a generic
        // "Something went wrong" toast.
        const statusLine = `${generateResponse.status} ${generateResponse.statusText || ''}`.trim();
        const detailed = generateData?.error
          ? `${statusLine}: ${generateData.error}`
          : statusLine || t('submit_error');
        toast.error(detailed, { duration: 8000 });
        // eslint-disable-next-line no-console
        console.error('[wedding-wizard] generate failed', {
          status: generateResponse.status,
          body: generateRaw,
        });
        return;
      }

      window.location.href = `/design/${data.project.id}`;
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
  const typographyConfig = getWeddingTypography(typography);
  // Tints the ornament dot on every typography specimen so the typography
  // cards visually echo the style chosen earlier in the same step.
  const styleAccent = styleConfig?.previewColor ?? 'currentColor';

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-16">
        <ScrollAnimation>
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <h1 className="font-serif text-3xl font-medium text-balance md:text-4xl">
              {t('title')}
            </h1>
            <p className="text-muted-foreground mt-3 text-balance">
              {t('description')}
            </p>
          </div>
        </ScrollAnimation>

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

        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          {/* controls */}
          <div className="order-2 lg:order-1">
            {step === 0 && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="partner1">{t('partner1')}</Label>
                    <Input
                      id="partner1"
                      value={partner1}
                      maxLength={40}
                      placeholder={t('partner1_placeholder')}
                      onChange={(e) => setPartner1(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="partner2">{t('partner2')}</Label>
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
                  <Label htmlFor="weddingDate">{t('wedding_date')}</Label>
                  <Input
                    id="weddingDate"
                    type="date"
                    value={weddingDate}
                    onChange={(e) => setWeddingDate(e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <Label>{t('name_display')}</Label>
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
                <div className="space-y-3">
                  <Label>{t('choose_style')}</Label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {weddingStyles.map((styleOption) => (
                      <button
                        key={styleOption.id}
                        type="button"
                        onClick={() => setStyle(styleOption.id)}
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

                <div className="space-y-3">
                  <Label>{t('choose_composition')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {styleLayouts.map((layoutOption) => (
                      <button
                        key={layoutOption.id}
                        type="button"
                        onClick={() => setComposition(layoutOption.composition)}
                        className={cn(
                          'rounded-full border px-4 py-2 text-sm transition-colors',
                          composition === layoutOption.composition
                            ? 'border-primary bg-accent'
                            : 'hover:border-primary/40'
                        )}
                      >
                        {layoutOption.composition}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>{t('choose_typography')}</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      weddingStyles.find((s) => s.id === style)?.typography ??
                      []
                    ).map((pairingId) => {
                      const pairing = weddingTypography.find(
                        (p) => p.id === pairingId
                      );
                      if (!pairing) return null;
                      const isSelected = typography === pairing.id;
                      return (
                        <button
                          key={pairing.id}
                          type="button"
                          onClick={() => setTypography(pairing.id)}
                          className={cn(
                            'rounded-xl border p-3 text-left transition-colors',
                            isSelected
                              ? 'border-primary bg-accent'
                              : 'hover:border-primary/40'
                          )}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-sm font-medium">{pairing.name}</p>
                            {isSelected ? (
                              <span className="text-muted-foreground text-[10px] tracking-[0.2em] uppercase">
                                {t('live_preview')}
                              </span>
                            ) : null}
                          </div>
                          {/* Mini stationery specimen so step 2 actually shows
                              the typefaces the user is choosing between. The
                              cream paper + hairline border + center dot echo
                              wedding invitations, and the dot picks up the
                              chosen style's previewColor so each card feels
                              tied to the style. */}
                          <div className="mt-2 overflow-hidden rounded-md border border-current/15 bg-wedding-ivory px-3 py-2.5 text-center">
                            <p
                              className="truncate text-[22px] leading-none"
                              style={fontSpecStyle(pairing.initialsFont, 118)}
                            >
                              {previewTexts.headline}
                            </p>
                            <div
                              aria-hidden
                              className="text-foreground/40 mx-auto my-1.5 flex items-center justify-center gap-1.5"
                            >
                              <span className="h-px w-7 bg-current opacity-60" />
                              <span style={{ color: styleAccent }}>·</span>
                              <span className="h-px w-7 bg-current opacity-60" />
                            </div>
                            {/*
                              Intentionally no names line: in initials mode the
                              headline already conveys the couple, and in
                              full_names/surname mode the names line is empty.
                              The names font is still previewed in the live
                              preview on the right.
                            */}
                            {previewTexts.date ? (
                              <p
                                className="text-foreground/60 truncate text-[10px]"
                                style={fontSpecStyle(pairing.dateFont, 21)}
                              >
                                {previewTexts.date}
                              </p>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground mt-2 text-xs">
                            {pairing.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8">
                <div className="space-y-3">
                  <Label>
                    {t('choose_palette')}{' '}
                    <span className="text-muted-foreground text-xs">
                      ({palette.length}/{WEDDING_MAX_PALETTE_COLORS})
                    </span>
                  </Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {weddingPalettes.map((paletteOption) => (
                      <button
                        key={paletteOption.id}
                        type="button"
                        onClick={() => setPalette(paletteOption.colors)}
                        className={cn(
                          'rounded-xl border p-3 text-left transition-colors',
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
                  <Label>{t('custom_colors')}</Label>
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

            {step === 3 && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="location">{t('location')}</Label>
                    <Input
                      id="location"
                      value={location}
                      maxLength={80}
                      placeholder={t('location_placeholder')}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="venue">{t('venue')}</Label>
                    <Input
                      id="venue"
                      value={venue}
                      maxLength={80}
                      placeholder={t('venue_placeholder')}
                      onChange={(e) => setVenue(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>
                    {t('flowers')}{' '}
                    <span className="text-muted-foreground text-xs">
                      ({flowers.length}/{WEDDING_MAX_FLOWERS})
                    </span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {weddingFlowerOptions.map((flower) => (
                      <button
                        key={flower}
                        type="button"
                        onClick={() => toggleFlower(flower)}
                        className={cn(
                          'rounded-full border px-4 py-2 text-sm transition-colors',
                          flowers.includes(flower)
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
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label>
                    {t('personal_elements')}{' '}
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
                          personalElements.includes(element)
                            ? 'border-primary bg-accent'
                            : 'hover:border-primary/40'
                        )}
                      >
                        {element}
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
                  <Label>{t('complexity')}</Label>
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

            {step === 5 && (
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
                      <dt className="text-muted-foreground">
                        {t('choose_composition')}
                      </dt>
                      <dd>{composition}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">
                        {t('choose_typography')}
                      </dt>
                      <dd>{typographyConfig?.name}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">
                        {t('choose_palette')}
                      </dt>
                      <dd className="flex gap-1">
                        {palette.map((color) => (
                          <span
                            key={color}
                            className="h-4 w-4 rounded-full border border-black/10"
                            style={{ background: color }}
                          />
                        ))}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{t('location')}</dt>
                      <dd>{location || '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{t('flowers')}</dt>
                      <dd>{flowers.join(', ') || '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">
                        {t('personal_elements')}
                      </dt>
                      <dd>{personalElements.join(', ') || '—'}</dd>
                    </div>
                  </dl>
                </div>
                <p className="text-muted-foreground text-sm">
                  {t('generate_hint')}
                </p>
                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  disabled={submitting}
                  onClick={submit}
                >
                  {submitting ? t('submitting') : t('generate')}
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

          {/* live preview */}
          <div className="order-1 lg:order-2">
            <div className="bg-wedding-ivory sticky top-24 rounded-2xl border p-6">
              <p className="text-muted-foreground mb-4 text-center text-xs tracking-[0.2em] uppercase">
                {t('live_preview')}
              </p>
              <div
                className="mx-auto w-full max-w-xs"
                role="img"
                aria-label={t('live_preview')}
                dangerouslySetInnerHTML={{ __html: previewSvg }}
              />
              <p className="text-muted-foreground mt-4 text-center text-xs">
                {t('preview_note')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
