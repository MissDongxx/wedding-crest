'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';

import type enSeo from '@/config/locale/messages/en/pages/seo.json';
import { Button } from '@/shared/components/ui/button';
import {
  defaultMonogram,
  loadMonogramAtlas,
  monogramElements,
  monogramFonts,
  monogramImageUrl,
  monogramLayoutChoices,
  monogramPngSize,
  normalizeInitials,
  renderMonogramElementSvg,
  renderMonogramSvg,
  type MonogramAtlas,
  type MonogramElement,
  type MonogramLayoutChoice,
  type MonogramOptions,
} from '@/shared/wedding/monogram-maker';

type Copy = (typeof enSeo)['monogram']['guide']['maker'];
type Format = 'svg' | 'png' | 'pngSmall';
const backgrounds = ['transparent', 'paper', 'custom'] as const;
type Background = (typeof backgrounds)[number];
const checker =
  'bg-[#fff] [background-image:conic-gradient(#e5e1da_25%,transparent_0_50%,#e5e1da_0_75%,transparent_0)] [background-size:16px_16px]';

const labelClass = 'mb-1.5 block text-sm font-medium';
const selectClass =
  'bg-background border-input focus-visible:ring-ring rounded-md border px-3 py-2 focus-visible:ring-2';
const initialClass =
  'bg-background border-input focus-visible:ring-ring h-11 w-full min-w-0 rounded-md border px-2 text-center font-serif text-xl focus-visible:ring-2';
const layoutIds = Object.keys(monogramLayoutChoices) as MonogramLayoutChoice[];
const steps = ['font', 'layout', 'elements', 'color', 'export'] as const;
type Step = (typeof steps)[number];
const layerInk = {
  frame: 'frameInk',
  wreath: 'wreathInk',
  embellishment: 'embellishmentInk',
} as const;
const palettes = [
  { key: 'ink_wine', ink: '#733f49', paper: '#f4ecdf' },
  { key: 'ink_moss', ink: '#34443b', paper: '#ebeee0' },
  { key: 'ink_blue', ink: '#314761', paper: '#e6edf1' },
  { key: 'ink_charcoal', ink: '#262722', paper: '#f2ede3' },
  { key: 'ink_ivory', ink: '#f8ecd5', paper: '#252e2a' },
] as const;
const initialLetters = { first: 'A', second: 'L', surname: '' };
type InitialField = keyof typeof initialLetters;

function Choice({
  group,
  value,
  label,
  checked,
  onSelect,
  children,
}: {
  group: string;
  value: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
}) {
  return (
    <label className="block min-w-0 cursor-pointer has-[:disabled]:cursor-wait">
      <input
        type="radio"
        name={group}
        value={value}
        className="peer sr-only"
        checked={checked}
        onChange={onSelect}
      />
      <span
        className={`border-border hover:border-foreground/45 peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:ring-ring flex min-h-10 flex-col items-center justify-center gap-1 rounded-md border p-1.5 text-center text-xs leading-snug peer-focus-visible:ring-2 ${children ? 'h-full' : ''}`}
      >
        {children}
        <span className="text-balance">{label}</span>
      </span>
    </label>
  );
}

async function rasterize(svg: string, size: number) {
  const url = URL.createObjectURL(
    new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  );
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.drawImage(img, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error('PNG encoding failed')),
        'image/png'
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // A delayed revoke leaves time for Safari to start reading the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function Artwork({
  svg,
  label,
  className,
}: {
  svg: string;
  label: string;
  className: string;
}) {
  // The image is generated locally from paths; the Next image optimizer is not needed.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={monogramImageUrl(svg)}
      alt={label}
      width={360}
      height={360}
      className={className}
    />
  );
}

export function MonogramMaker({ copy }: { copy: Copy }) {
  const id = useId();
  const section = useRef<HTMLElement>(null);
  const [letters, setLetters] = useState(initialLetters);
  const [layoutChoice, setLayoutChoice] =
    useState<MonogramLayoutChoice>('paired');
  const [step, setStep] = useState<Step>('font');
  const stepIndex = steps.indexOf(step);
  const stepPanel = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);
  const [palette, setPalette] = useState<(typeof palettes)[number]>(
    palettes[0]
  );
  const [background, setBackground] = useState<Background>('transparent');
  const [customBackground, setCustomBackground] = useState<string>(
    palettes[0].paper
  );
  const [options, setOptions] = useState<MonogramOptions>({
    ...defaultMonogram,
    ...monogramLayoutChoices.paired,
    ink: palettes[0].ink,
  });
  const [atlas, setAtlas] = useState<MonogramAtlas>();
  const [load, setLoad] = useState<'idle' | 'pending' | 'ready' | 'failed'>(
    'idle'
  );
  const [busy, setBusy] = useState<Format>();
  const [exportError, setExportError] = useState(false);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    setInteractive(true);
    const element = section.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') {
      setLoad((current) => (current === 'idle' ? 'pending' : current));
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setLoad((current) => (current === 'idle' ? 'pending' : current));
        observer.disconnect();
      },
      { rootMargin: '240px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (load !== 'pending') return;
    let active = true;
    loadMonogramAtlas().then(
      (next) => {
        if (!active) return;
        setAtlas(next);
        setLoad('ready');
      },
      () => {
        if (active) setLoad('failed');
      }
    );
    return () => {
      active = false;
    };
  }, [load]);

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    const panel = stepPanel.current;
    panel?.focus({ preventScroll: true });
    if (panel && panel.getBoundingClientRect().top < 220) {
      panel.scrollIntoView({ block: 'start' });
    }
  }, [step]);

  function update<T extends keyof MonogramOptions>(
    key: T,
    value: MonogramOptions[T]
  ) {
    setOptions((current) => ({ ...current, [key]: value }));
    setExportError(false);
  }

  const initials = letters.first + letters.surname + letters.second;
  const exportBackground =
    background === 'paper'
      ? palette.paper
      : background === 'custom'
        ? customBackground
        : undefined;
  const svg = renderMonogramSvg(
    {
      ...options,
      initials,
      background: step === 'export' ? exportBackground : undefined,
    },
    atlas
  );
  function setLetter(field: InitialField, value: string) {
    setLetters((current) => ({
      ...current,
      [field]: normalizeInitials(value).slice(-1),
    }));
    setExportError(false);
  }
  function pickLayout(value: MonogramLayoutChoice) {
    setLayoutChoice(value);
    setOptions((current) => ({ ...current, ...monogramLayoutChoices[value] }));
    setExportError(false);
  }
  function goTo(value: Step) {
    if (step === value) return;
    moveFocus.current = true;
    setStep(value);
  }
  function reset() {
    setLetters(initialLetters);
    setLayoutChoice('paired');
    setStep('font');
    setPalette(palettes[0]);
    setBackground('transparent');
    setCustomBackground(palettes[0].paper);
    setOptions({
      ...defaultMonogram,
      ...monogramLayoutChoices.paired,
      ink: palettes[0].ink,
    });
    setExportError(false);
  }
  function beginLoading() {
    setLoad((current) => (current === 'idle' ? 'pending' : current));
  }

  async function download(format: Format) {
    if (!svg || busy) return;
    setBusy(format);
    setExportError(false);
    try {
      const blob =
        format === 'svg'
          ? new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
          : await rasterize(
              svg,
              format === 'pngSmall' ? 1024 : monogramPngSize
            );
      const suffix =
        format === 'pngSmall'
          ? '-1024.png'
          : format === 'png'
            ? '-2400.png'
            : '.svg';
      saveFile(blob, `monogram-${initials.toLowerCase()}${suffix}`);
    } catch {
      setExportError(true);
    } finally {
      setBusy(undefined);
    }
  }

  function elementChoices<K extends MonogramElement>(
    kind: K,
    labels: Record<MonogramOptions[K], string>
  ) {
    return (
      <fieldset disabled={!interactive} className="grid grid-cols-4 gap-2">
        <legend className={labelClass}>{copy.layer_labels[kind]}</legend>
        {(monogramElements[kind] as readonly MonogramOptions[K][]).map(
          (value) => (
            <Choice
              key={value}
              group={`${id}-${kind}`}
              value={value}
              label={labels[value]}
              checked={options[kind] === value}
              onSelect={() => update(kind, value)}
            >
              <span
                className={`relative grid w-full place-items-center rounded-md bg-[#f4ecdf] text-[#34443b] ${kind === 'wreath' ? 'h-16' : 'h-11'}`}
              >
                {value === 'none' ? (
                  <span aria-hidden="true" className="h-px w-3 bg-current" />
                ) : (
                  <Artwork
                    svg={renderMonogramElementSvg(kind, value)}
                    label=""
                    className={`absolute inset-0 size-full object-contain ${kind === 'embellishment' && value !== 'rules' ? 'scale-[1.75]' : ''}`}
                  />
                )}
              </span>
            </Choice>
          )
        )}
      </fieldset>
    );
  }

  function colorControl(
    key: 'ink' | (typeof layerInk)[MonogramElement],
    label: string
  ) {
    return (
      <label
        key={key}
        className="flex items-center justify-between gap-1.5 text-sm font-medium"
      >
        {label}
        <input
          type="color"
          className="border-border h-10 w-10 shrink-0 cursor-pointer rounded-md border p-1"
          value={options[key] ?? options.ink}
          onInput={(event) => update(key, event.currentTarget.value)}
          onChange={(event) => update(key, event.currentTarget.value)}
        />
      </label>
    );
  }

  return (
    <section
      ref={section}
      aria-labelledby="monogram-maker"
      onFocus={beginLoading}
    >
      <h2 id="monogram-maker" className="scroll-mt-24 font-serif text-3xl">
        {copy.title}
      </h2>
      <div className="relative left-1/2 mt-5 grid w-[min(calc(100vw-2rem),68rem)] -translate-x-1/2 items-start gap-4 min-[900px]:grid-cols-[1.14fr_1fr] min-[900px]:grid-rows-[auto_1fr] sm:gap-5">
        <div className="border-border bg-card rounded-2xl border p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-serif text-2xl">{copy.your_initials}</h3>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!interactive}
              onClick={reset}
            >
              {copy.reset}
            </Button>
          </div>
          <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_auto] items-end gap-2.5">
            {(['first', 'second', 'surname'] as const).map((field) => (
              <div key={field} className="min-w-0">
                <label htmlFor={`${id}-${field}`} className={labelClass}>
                  {field === 'first'
                    ? copy.first_initial
                    : field === 'second'
                      ? copy.second_initial
                      : copy.surname_initial}
                </label>
                <input
                  id={`${id}-${field}`}
                  className={initialClass}
                  disabled={!interactive}
                  value={letters[field]}
                  onChange={(event) =>
                    setLetter(field, event.currentTarget.value)
                  }
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  aria-describedby={`${id}-initials-help`}
                />
              </div>
            ))}
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-11"
              disabled={!interactive || !letters.first || !letters.second}
              aria-label={copy.swap}
              title={copy.swap}
              onClick={() =>
                setLetters((current) => ({
                  ...current,
                  first: current.second,
                  second: current.first,
                }))
              }
            >
              <ArrowLeftRight aria-hidden="true" />
            </Button>
          </div>
          <p
            id={`${id}-initials-help`}
            className="text-muted-foreground mt-2 text-xs"
          >
            {copy.latin_initials}
          </p>
        </div>

        <div className="z-10 min-[900px]:top-24 min-[900px]:col-start-2 min-[900px]:row-span-2 min-[900px]:row-start-1 [@media(min-height:650px)]:sticky [@media(min-height:650px)]:top-16">
          <h3 className="sr-only">{copy.your_monogram}</h3>
          <div
            id="monogram-maker-preview"
            className={`relative grid h-[min(38vw,11rem)] w-full scroll-mt-24 place-items-center overflow-hidden rounded-xl min-[900px]:aspect-square min-[900px]:h-auto ${step === 'export' && !exportBackground && svg ? checker : ''}`}
            style={{
              backgroundColor:
                step === 'export' && svg ? exportBackground : palette.paper,
              color: palette.ink,
            }}
            aria-busy={load === 'pending' && !!initials && !svg}
          >
            {svg ? (
              <Artwork
                svg={svg}
                label={`${copy.preview}: ${initials}`}
                className="absolute inset-0 size-full object-contain"
              />
            ) : (
              <div className="px-4 text-center text-sm" role="status">
                <p>
                  {!initials
                    ? copy.empty
                    : load === 'failed'
                      ? copy.font_error
                      : copy.loading}
                </p>
                {load === 'failed' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => setLoad('pending')}
                  >
                    {copy.retry}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          id="monogram-maker-designs"
          className="border-border bg-card scroll-mt-60 rounded-2xl border p-4 min-[900px]:col-start-1 min-[900px]:row-start-2 min-[900px]:scroll-mt-24 sm:p-6"
        >
          <nav aria-label={copy.edit}>
            <ol className="grid grid-cols-5 gap-1.5">
              {steps.map((item, index) => (
                <li key={item} className="min-w-0">
                  <button
                    type="button"
                    aria-current={step === item ? 'step' : undefined}
                    aria-controls={`${id}-step`}
                    disabled={!interactive}
                    className="text-foreground hover:bg-muted focus-visible:ring-ring aria-[current=step]:border-primary aria-[current=step]:bg-primary/10 flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-md border border-transparent p-0.5 text-center text-[.69rem] leading-tight font-medium focus-visible:ring-2 sm:text-xs"
                    onClick={() => goTo(item)}
                  >
                    <span
                      aria-hidden="true"
                      className="text-muted-foreground text-[.65rem] tabular-nums"
                    >
                      {index + 1}
                    </span>
                    {copy.steps[item]}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <div
            ref={stepPanel}
            id={`${id}-step`}
            tabIndex={-1}
            role="region"
            aria-label={copy.steps[step]}
            className="border-border mt-3 scroll-mt-64 border-t pt-4 focus:outline-none min-[900px]:scroll-mt-24"
          >
            {step === 'font' && (
              <fieldset
                disabled={!interactive}
                className="grid grid-cols-3 gap-2"
              >
                <legend className="sr-only">{copy.font}</legend>
                {monogramFonts.map(([font, name]) => {
                  const sample =
                    renderMonogramSvg(
                      {
                        ...defaultMonogram,
                        font,
                        initials: initials || 'AL',
                        ink: options.ink,
                      },
                      atlas
                    ) ||
                    renderMonogramSvg({
                      ...defaultMonogram,
                      font,
                      ink: options.ink,
                    });
                  return (
                    <Choice
                      key={font}
                      group={`${id}-font`}
                      value={font}
                      checked={options.font === font}
                      onSelect={() => update('font', font)}
                      label={name}
                    >
                      <span
                        className="relative block h-16 w-full overflow-hidden rounded-md"
                        style={{ backgroundColor: palette.paper }}
                      >
                        <Artwork
                          label=""
                          svg={sample}
                          className="absolute inset-0 size-full scale-125 object-contain"
                        />
                      </span>
                    </Choice>
                  );
                })}
              </fieldset>
            )}

            {step === 'layout' && (
              <fieldset disabled={!interactive} className="space-y-4">
                <legend className="sr-only">{copy.layout}</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {layoutIds.map((name) => {
                    const sampleOptions = {
                      ...defaultMonogram,
                      ...monogramLayoutChoices[name],
                      font: options.font,
                      ink: options.ink,
                    };
                    const sample =
                      renderMonogramSvg(
                        {
                          ...sampleOptions,
                          initials: initials.length >= 2 ? initials : 'AL',
                        },
                        atlas
                      ) || renderMonogramSvg(sampleOptions);
                    return (
                      <Choice
                        key={name}
                        group={`${id}-layout`}
                        value={name}
                        checked={layoutChoice === name}
                        onSelect={() => pickLayout(name)}
                        label={copy.layouts[name]}
                      >
                        <span
                          className="relative block h-16 w-full overflow-hidden rounded-md"
                          style={{ backgroundColor: palette.paper }}
                        >
                          <Artwork
                            svg={sample}
                            label=""
                            className="absolute inset-0 size-full scale-110 object-contain"
                          />
                        </span>
                      </Choice>
                    );
                  })}
                </div>
                {initials.length > 1 && (
                  <label className="grid gap-1.5 text-sm font-medium">
                    {options.layout === 'overlap'
                      ? copy.overlap_amount
                      : copy.spacing}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      className="accent-primary h-8 w-full"
                      value={options.spacing}
                      onChange={(event) =>
                        update('spacing', event.currentTarget.valueAsNumber)
                      }
                    />
                  </label>
                )}
                {initials.length > 1 && options.layout === 'overlap' && (
                  <label className="grid gap-1.5 text-sm font-medium">
                    {copy.front}
                    <select
                      className={selectClass}
                      value={options.front}
                      onChange={(event) =>
                        update(
                          'front',
                          event.currentTarget.value === 'first'
                            ? 'first'
                            : 'last'
                        )
                      }
                    >
                      <option value="first">{copy.first}</option>
                      <option value="last">{copy.last}</option>
                    </select>
                  </label>
                )}
                {initials.length === 2 && options.layout === 'paired' && (
                  <label className="grid gap-1.5 text-sm font-medium">
                    {copy.separator}
                    <select
                      className={selectClass}
                      value={options.separator}
                      onChange={(event) =>
                        update(
                          'separator',
                          event.currentTarget
                            .value as MonogramOptions['separator']
                        )
                      }
                    >
                      <option value="ampersand">&amp;</option>
                      <option value="dot">·</option>
                      <option value="none">{copy.no_separator}</option>
                    </select>
                  </label>
                )}
              </fieldset>
            )}

            {step === 'elements' && (
              <div className="space-y-5">
                {elementChoices('frame', copy.elements.frame)}
                {elementChoices('wreath', copy.elements.wreath)}
                {elementChoices('embellishment', copy.elements.embellishment)}
              </div>
            )}

            {step === 'color' && (
              <fieldset disabled={!interactive} className="space-y-4">
                <legend className="sr-only">{copy.color}</legend>
                <div className="flex flex-wrap gap-2">
                  {palettes.map((item) => (
                    <label className="cursor-pointer" key={item.key}>
                      <input
                        type="radio"
                        name={`${id}-palette`}
                        className="peer sr-only"
                        aria-label={copy[item.key]}
                        checked={
                          palette.key === item.key &&
                          options.ink === item.ink &&
                          !options.frameInk &&
                          !options.wreathInk &&
                          !options.embellishmentInk
                        }
                        onChange={() => {
                          setPalette(item);
                          setOptions((current) => ({
                            ...current,
                            ink: item.ink,
                            frameInk: undefined,
                            wreathInk: undefined,
                            embellishmentInk: undefined,
                          }));
                        }}
                      />
                      <span
                        title={copy[item.key]}
                        className="border-border peer-checked:ring-primary peer-focus-visible:ring-ring grid size-11 place-items-center rounded-full border ring-offset-2 peer-checked:ring-2 peer-focus-visible:ring-2"
                        style={{ backgroundColor: item.paper, color: item.ink }}
                      >
                        <span
                          aria-hidden="true"
                          className="size-4 rounded-full bg-current"
                        />
                      </span>
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {colorControl('ink', copy.layer_labels.letters)}
                  {(['frame', 'wreath', 'embellishment'] as const).map(
                    (kind) =>
                      options[kind] !== 'none'
                        ? colorControl(layerInk[kind], copy.layer_labels[kind])
                        : null
                  )}
                </div>
              </fieldset>
            )}

            {step === 'export' && (
              <>
                <fieldset disabled={!interactive || !!busy} className="mb-4">
                  <legend className={labelClass}>
                    {copy.export_background}
                  </legend>
                  <div className="grid grid-cols-3 gap-2">
                    {backgrounds.map((value) => (
                      <Choice
                        key={value}
                        group={`${id}-background`}
                        value={value}
                        checked={background === value}
                        label={copy.backgrounds[value]}
                        onSelect={() => {
                          setBackground(value);
                          setExportError(false);
                        }}
                      >
                        <span
                          aria-hidden="true"
                          className={`border-border h-7 w-full rounded border ${value === 'transparent' ? checker : ''}`}
                          style={{
                            backgroundColor:
                              value === 'paper'
                                ? palette.paper
                                : value === 'custom'
                                  ? customBackground
                                  : undefined,
                          }}
                        />
                      </Choice>
                    ))}
                  </div>
                  {background === 'custom' && (
                    <label className="mt-3 flex items-center justify-between gap-3 text-sm font-medium">
                      {copy.background_color}
                      <input
                        type="color"
                        value={customBackground}
                        className="border-border h-10 w-10 cursor-pointer rounded-md border p-1"
                        onInput={(event) =>
                          setCustomBackground(event.currentTarget.value)
                        }
                        onChange={(event) =>
                          setCustomBackground(event.currentTarget.value)
                        }
                      />
                    </label>
                  )}
                </fieldset>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['svg', copy.download_svg],
                      ['pngSmall', copy.png_small],
                      ['png', copy.png_large],
                    ] as const
                  ).map(([format, label], index) => (
                    <Button
                      key={format}
                      type="button"
                      variant={index === 0 ? 'default' : 'outline'}
                      className="min-h-10 px-1.5 text-center leading-tight whitespace-normal"
                      disabled={!interactive || !svg || !!busy}
                      onClick={() => void download(format)}
                    >
                      {busy === format ? copy.preparing : label}
                    </Button>
                  ))}
                </div>
                <p className="text-muted-foreground mt-3 text-xs">
                  {copy.export_note}
                </p>
                {exportError && (
                  <p className="text-destructive mt-2 text-sm" role="alert">
                    {copy.export_error}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="border-border mt-5 flex items-center justify-between gap-3 border-t pt-4">
            {stepIndex > 0 && (
              <Button
                type="button"
                variant="outline"
                disabled={!interactive}
                onClick={() => goTo(steps[stepIndex - 1])}
              >
                {copy.back}
              </Button>
            )}
            {stepIndex < steps.length - 1 && (
              <Button
                type="button"
                className="ml-auto"
                disabled={!interactive}
                onClick={() => goTo(steps[stepIndex + 1])}
              >
                {copy.next}
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
