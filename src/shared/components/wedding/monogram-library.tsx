'use client';

import { useEffect, useId, useState, type CSSProperties } from 'react';
import NextImage from 'next/image';
import { ArrowLeft, ArrowUpRight, Download, RotateCcw } from 'lucide-react';

import {
  isMonogramTarget,
  openMonogramTarget,
  readAppliedMonogram,
  type MonogramTarget,
} from '@/shared/wedding/monogram-application';
import {
  libraryEditorHref,
  libraryFaceNames,
  libraryFontOptions,
  libraryGalleryThumbnail,
  libraryGroups,
  libraryInitial,
  libraryLayoutOptions,
  libraryThumbnail,
  loadLibraryArtwork,
  loadLibraryGlyphs,
  monogramLibrary,
  needsLibraryGlyphs,
  recolorLibraryTrace,
  renderLibraryLetterLayer,
  renderLibraryLetters,
  renderLibrarySvg,
  restoredLetteringBases,
  transparentLibraryTrace,
  usesCustomLettering,
  type LibraryArtwork,
  type LibraryGlyphs,
  type LibraryGroup,
  type LibraryItem,
  type LibraryLetterOptions,
} from '@/shared/wedding/monogram-library';
import { monogramImageUrl } from '@/shared/wedding/monogram-maker';

import styles from './monogram-library.module.css';

const english = {
  library: 'Styles',
  styleHint: 'Choose a style to create your own monogram.',
  back: 'All styles',
  colors: 'Colors',
  export: 'Export',
  previous: 'Previous',
  next: 'Next',
  group: 'Style group',
  font: 'Font',
  layout: 'Layout',
  savedStyle: 'Style default',
  letter: 'Letter color',
  paper: 'Background color',
  resetColors: 'Reset colors',
  layoutNames: [
    'Side by side',
    'Overlapping',
    'Stacked',
    'Diagonal',
    'Ampersand',
    'With dot',
    'Focal initial',
  ],
  preview: 'Monogram preview',
  fields: ['First initial', 'Second initial'],
  original: 'Traced initials',
  uncertain: 'Original letter reading unconfirmed',
  restore: 'Restore traced initials',
  ornament: 'Ornament color',
  restoreOrnament: 'Reset ornament color',
  alternate: 'Replacement type',
  unverified: 'Original typeface unverified',
  matched: 'Custom lettering matched to the trace',
  loadingError: 'Artwork didn’t load.',
  retry: 'Retry',
  fileFormat: 'File format',
  imageSize: 'Image size',
  download: 'Download',
  exporting: 'Preparing…',
  transparent: 'Transparent background',
  tableNumbers: 'Apply to table numbers',
  welcomeSign: 'Apply to welcome sign',
  tools: 'Use this monogram',
  applyError: 'The editor didn’t open. Try again.',
  exportError: 'Download didn’t finish. Try again.',
};
const chinese: typeof english = {
  library: '样式',
  styleHint: '点击样式，制作自己的同款 Monogram。',
  back: '所有样式',
  colors: '颜色',
  export: '导出',
  previous: '上一步',
  next: '下一步',
  group: '样式分类',
  font: '字体',
  layout: '排版',
  savedStyle: '样式默认',
  letter: '字母颜色',
  paper: '背景颜色',
  resetColors: '重置颜色',
  layoutNames: [
    '左右并排',
    '交叠',
    '上下堆叠',
    '对角排列',
    '与号连接',
    '圆点分隔',
    '主副字母',
  ],
  preview: '字母花押预览',
  fields: ['首字母', '第二字母'],
  original: '原字母描摹',
  uncertain: '原字母辨读待确认',
  restore: '还原描摹',
  ornament: '花纹颜色',
  restoreOrnament: '还原花纹颜色',
  alternate: '换字候选',
  unverified: '原字体未核实',
  matched: '按描摹定制的同风格字形',
  loadingError: '样稿加载失败。',
  retry: '重试',
  fileFormat: '文件格式',
  imageSize: '图片尺寸',
  download: '下载',
  exporting: '正在生成…',
  transparent: '透明背景',
  tableNumbers: '应用到桌号卡',
  welcomeSign: '应用到迎宾牌',
  tools: '应用当前字母花押',
  applyError: '编辑器未打开，请重试。',
  exportError: '下载未完成，请重试。',
};
const groups: Record<LibraryGroup, [string, string]> = {
  botanical: ['Botanical', '花植'],
  shields: ['Shields', '盾徽'],
  cameos: ['Ovals', '椭圆'],
  wreaths: ['Wreaths', '花环'],
  cartouches: ['Ornate', '雕花边框'],
  minimal: ['Minimal', '简约'],
  flourished: ['Flourished', '卷饰'],
  engraved: ['Engraved', '雕刻'],
};
const initialFields = (item: LibraryItem) =>
  Array.from({ length: item.rule[0].length }, (_, i) => item.letters[i] ?? '');

type Format = 'svg' | 'png' | 'jpg';
const rasterSizes = [1024, 2400, 3600] as const;
type RasterSize = (typeof rasterSizes)[number];
const mimeTypes = { png: 'image/png', jpg: 'image/jpeg' } as const;

function exportDimensions(crop: LibraryArtwork['crop'], size: RasterSize) {
  const [, , w, h] = crop;
  const factor = size / Math.max(w, h);
  return [Math.round(w * factor), Math.round(h * factor)] as const;
}
const steps = ['font', 'layout', 'colors', 'export'] as const;
type Step = (typeof steps)[number];

// For placement on stationery, discard the canvas margin, not the visible mark.
function trimPlacementCanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D
) {
  const { width, height } = canvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] < 16) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return canvas;
  const pad = Math.ceil(Math.max(right - left, bottom - top) * 0.035);
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad);
  bottom = Math.min(height - 1, bottom + pad);
  const output = document.createElement('canvas');
  output.width = right - left + 1;
  output.height = bottom - top + 1;
  const draw = output.getContext('2d');
  if (!draw) return canvas;
  draw.drawImage(
    canvas,
    left,
    top,
    output.width,
    output.height,
    0,
    0,
    output.width,
    output.height
  );
  return output;
}

async function createDownload(
  svg: string,
  data: LibraryArtwork,
  format: Format,
  size: RasterSize,
  tint?: string,
  transparent = false,
  trimForPlacement = false
) {
  const vector = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  if (format === 'svg') return vector;
  const url = URL.createObjectURL(vector);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const [, , w, h] = data.crop;
    const [width, height] = exportDimensions(data.crop, size);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image export unavailable');
    const bitmap = data.bitmapOrnament;
    if (!transparent && (bitmap || format === 'jpg')) {
      context.fillStyle = data.paper;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (bitmap) {
      const [left, top] = data.crop;
      const ornament = new Image();
      ornament.src = bitmap.src;
      await ornament.decode();
      let layer: HTMLCanvasElement | HTMLImageElement = ornament;
      if (tint) {
        const mask = document.createElement('canvas');
        mask.width = ornament.naturalWidth;
        mask.height = ornament.naturalHeight;
        const brush = mask.getContext('2d');
        if (!brush) throw new Error('Ornament export unavailable');
        brush.drawImage(ornament, 0, 0);
        brush.globalCompositeOperation = 'source-in';
        brush.fillStyle = tint;
        brush.fillRect(0, 0, mask.width, mask.height);
        layer = mask;
      }
      context.imageSmoothingQuality = 'high';
      context.drawImage(
        layer,
        ((bitmap.x - left) * canvas.width) / w,
        ((bitmap.y - top) * canvas.height) / h,
        (bitmap.width * canvas.width) / w,
        (bitmap.height * canvas.height) / h
      );
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const output = trimForPlacement
      ? trimPlacementCanvas(canvas, context)
      : canvas;
    const mime = mimeTypes[format];
    return await new Promise<Blob>((resolve, reject) => {
      output.toBlob(
        (blob) =>
          blob?.type === mime
            ? resolve(blob)
            : reject(new Error('Image export failed')),
        mime,
        format === 'jpg' ? 0.92 : undefined
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function MonogramLibrary({ locale }: { locale: string }) {
  const isChinese = locale === 'zh';
  const copy = isChinese ? chinese : english;
  const id = useId();
  const [item, setItem] = useState(monogramLibrary[0]);
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState<Step>('font');
  const [railGroup, setRailGroup] = useState<LibraryGroup>(
    monogramLibrary[0].group
  );
  const [lettersTouched, setLettersTouched] = useState(false);
  const [appearance, setAppearance] = useState<LibraryLetterOptions>({});
  const [paint, setPaint] = useState<{
    ink?: string;
    paper?: string;
    ornament?: string;
  }>({});
  const [letters, setLetters] = useState(() =>
    initialFields(monogramLibrary[0])
  );
  const [asset, setAsset] = useState<{ id: string; value: LibraryArtwork }>();
  const [loadError, setLoadError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [glyphs, setGlyphs] = useState<LibraryGlyphs>();
  const [busy, setBusy] = useState<Format>();
  const [exportFormat, setExportFormat] = useState<Format>('png');
  const [exportSize, setExportSize] = useState<RasterSize>(2400);
  const [exportError, setExportError] = useState(false);
  const [transparent, setTransparent] = useState(false);
  const [applying, setApplying] = useState<MonogramTarget>();
  const [applyError, setApplyError] = useState(false);
  const [origin, setOrigin] = useState<MonogramTarget>();
  const shownLetters = Array.from(
    { length: item.rule[0].length },
    (_, i) => letters[i] ?? ''
  );
  const canChooseLayout = item.rule[0].length > 1;
  const effective = canChooseLayout
    ? appearance
    : { ...appearance, layout: undefined };
  const changed =
    !!(effective.font || effective.layout) ||
    shownLetters.some((letter, i) => letter !== (item.letters[i] ?? ''));
  const hasLetters = shownLetters.some(Boolean);
  const stepIndex = steps.indexOf(step);
  const data = asset?.id === item.id ? asset.value : undefined;
  const customLettering =
    usesCustomLettering(item) || !!data?.restoredLettering;
  const baseLettering = restoredLetteringBases(item, data);
  const editingLetters = changed && hasLetters;
  const wantsGlyphs =
    editing && editingLetters && needsLibraryGlyphs(item, data, effective);
  const needSamples = editing && (step === 'font' || step === 'layout');
  const ornamentColor = paint.ornament ?? data?.ornamentInk;
  const ink = paint.ink ?? data?.ink;
  const paper = paint.paper ?? data?.paper;
  const styled = data
    ? { ...data, ink: ink ?? data.ink, paper: paper ?? data.paper }
    : undefined;
  const bitmap = data?.bitmapOrnament;
  const allowsSvg = !!data && !bitmap;
  const selectedFormat =
    exportFormat === 'svg' && !allowsSvg ? 'png' : exportFormat;
  const tint =
    bitmap && ornamentColor !== data?.ornamentInk ? ornamentColor : undefined;

  useEffect(() => {
    function sync() {
      const route = new URLSearchParams(window.location.search);
      const style =
        route.get('edit') === 'table-number'
          ? undefined
          : monogramLibrary.find((entry) => entry.id === route.get('style'));
      setEditing(!!style);
      const source = route.get('from');
      setOrigin(isMonogramTarget(source) ? source : undefined);
      if (style) {
        const saved = isMonogramTarget(source)
          ? readAppliedMonogram(source)?.editor
          : undefined;
        const draft = saved?.style === style.id ? saved : undefined;
        setItem(style);
        setRailGroup(style.group);
        setStep('font');
        setLettersTouched(!!draft);
        setLetters(draft?.letters.map(libraryInitial) ?? initialFields(style));
        setPaint(draft?.paint ?? {});
        setAppearance({
          font: libraryFontOptions.find(([font]) => font === draft?.font)?.[0],
          layout: libraryLayoutOptions.find(
            (layout) => layout === draft?.layout
          ),
        });
      }
    }
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  useEffect(() => {
    if (!editing) return;
    let active = true;
    loadLibraryArtwork(item.id)
      .then(async (value) => {
        if (value.bitmapOrnament && active) {
          const image = new Image();
          image.src = value.bitmapOrnament.src;
          await image.decode();
        }
        return value;
      })
      .then(
        (value) => {
          if (active) setAsset({ id: item.id, value });
        },
        () => {
          if (active) setLoadError(item.id);
        }
      );
    return () => {
      active = false;
    };
  }, [editing, item.id, retry]);

  useEffect(() => {
    if ((!wantsGlyphs && !needSamples) || glyphs) return;
    let active = true;
    loadLibraryGlyphs().then(
      (value) => {
        if (active) setGlyphs(value);
      },
      () => {
        if (active) setLoadError('glyphs');
      }
    );
    return () => {
      active = false;
    };
  }, [wantsGlyphs, needSamples, glyphs, retry]);

  const failed =
    loadError === item.id ||
    ((wantsGlyphs || needSamples) && loadError === 'glyphs');
  const mark =
    data && styled && (!wantsGlyphs || glyphs)
      ? !changed
        ? recolorLibraryTrace(data, styled.ink, styled.paper)
        : renderLibraryLetters(item, styled, shownLetters, glyphs, effective)
      : undefined;
  const svg =
    styled && mark !== undefined
      ? bitmap
        ? renderLibraryLetterLayer(styled, mark)
        : renderLibrarySvg(styled, mark, ornamentColor)
      : undefined;
  const showTransparency =
    step === 'export' && selectedFormat === 'png' && transparent;
  function transparentArtwork() {
    if (!data || !styled || mark === undefined) return undefined;
    const letters = changed ? mark : transparentLibraryTrace(data, styled.ink);
    return bitmap
      ? renderLibraryLetterLayer(styled, letters)
      : renderLibrarySvg(styled, letters, ornamentColor, true);
  }
  const previewSvg = showTransparency ? transparentArtwork() : svg;
  const image = previewSvg
    ? monogramImageUrl(previewSvg)
    : libraryThumbnail(item.id);
  const description = `${item.name} — ${changed && svg ? shownLetters.join('') || copy.preview : copy.original}`;
  function jumpToStep() {
    requestAnimationFrame(() => {
      const step = document.getElementById('monogram-maker');
      step?.scrollIntoView({ block: 'start' });
      step?.focus({ preventScroll: true });
    });
  }

  function choose(style: LibraryItem, duringEdit = false) {
    if (duringEdit && item.id === style.id) return;
    setItem(style);
    setRailGroup(style.group);
    if (!duringEdit) {
      setStep('font');
      setAppearance({});
      setPaint({});
      setLettersTouched(false);
    }
    if (!duringEdit || !lettersTouched) setLetters(initialFields(style));
    setExportError(false);
    setApplyError(false);
    setLoadError(undefined);
    setRetry((value) => value + 1);
    setEditing(true);
    const link = new URL(
      libraryEditorHref(style.id, window.location.pathname),
      window.location.href
    );
    if (origin) link.searchParams.set('from', origin);
    window.history.pushState(null, '', link);
    if (!duringEdit) jumpToStep();
  }

  function changeStep(next: Step) {
    setStep(next);
    requestAnimationFrame(() => {
      if (window.matchMedia('(max-width: 760px)').matches) {
        document
          .getElementById(`${id}-step-nav`)
          ?.scrollIntoView({ block: 'start' });
      }
      document
        .getElementById(`${id}-step-title`)
        ?.focus({ preventScroll: true });
    });
  }

  function sample(options: LibraryLetterOptions) {
    if (!data || !glyphs) return undefined;
    const demo: LibraryArtwork = {
      ...data,
      width: 112,
      height: 56,
      box: [4, 3, 108, 53],
      crop: [0, 0, 112, 56],
      fixed: '',
      ink: '#563f30',
    };
    const sampleLetters = canChooseLayout ? ['A', 'W'] : ['A'];
    return monogramImageUrl(
      renderLibraryLetterLayer(
        demo,
        renderLibraryLetters(item, demo, sampleLetters, glyphs, options)
      )
    );
  }

  function showStyles() {
    const url = new URL(window.location.href);
    url.searchParams.delete('style');
    url.searchParams.delete('from');
    setOrigin(undefined);
    window.history.pushState(null, '', url);
    setEditing(false);
    jumpToStep();
  }

  function restore() {
    setLetters(initialFields(item));
    setLettersTouched(false);
    setAppearance({});
    setExportError(false);
  }

  async function download() {
    const format = selectedFormat;
    const size = exportSize;
    const clear = format === 'png' && transparent;
    const artwork = clear ? transparentArtwork() : svg;
    if (!artwork || !styled || busy || applying || (bitmap && format === 'svg'))
      return;
    setBusy(format);
    setExportError(false);
    try {
      const file = await createDownload(
        artwork,
        styled,
        format,
        size,
        tint,
        clear
      );
      const anchor = document.createElement('a');
      const url = URL.createObjectURL(file);
      anchor.href = url;
      const resolution = format === 'svg' ? '' : `-${size}px`;
      anchor.download = `monogram-${item.id}-${(shownLetters.join('') || 'blank').toLowerCase()}${resolution}${clear ? '-transparent' : ''}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportError(true);
    } finally {
      setBusy(undefined);
    }
  }

  async function applyMonogram(target: MonogramTarget) {
    const artwork = transparentArtwork();
    if (!artwork || !styled || busy || applying || !hasLetters) return;
    setApplying(target);
    setApplyError(false);
    setExportError(false);
    try {
      // Stamp-sized artwork keeps the two session drafts comfortably below quota.
      const blob = await createDownload(
        artwork,
        styled,
        'png',
        1024,
        tint,
        true,
        true
      );
      const png = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      });
      openMonogramTarget(target, {
        png,
        editor: { style: item.id, letters: shownLetters, ...effective, paint },
      });
    } catch {
      setApplyError(true);
      setApplying(undefined);
    }
  }

  if (!editing) {
    return (
      <section
        id="monogram-maker"
        tabIndex={-1}
        className={styles.gallery}
        aria-labelledby="monogram-style-title"
        data-monogram-gallery
      >
        <div className={styles.galleryHeading}>
          <h2 id="monogram-style-title" className="font-serif text-3xl">
            {copy.library}
          </h2>
          <p>{copy.styleHint}</p>
        </div>
        <div className="space-y-7 sm:space-y-14">
          {libraryGroups.map((group) => (
            <section
              key={group}
              className="border-border/40 rounded-2xl border p-3 sm:rounded-3xl sm:p-8"
              aria-labelledby={`monogram-group-${group}`}
            >
              <h3
                id={`monogram-group-${group}`}
                className="mb-3 font-serif text-xl sm:mb-6 sm:text-2xl md:text-3xl"
              >
                {groups[group][isChinese ? 1 : 0]}
              </h3>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {monogramLibrary
                  .filter((entry) => entry.group === group)
                  .map((entry) => (
                    <a
                      key={entry.id}
                      href={libraryEditorHref(entry.id, '')}
                      data-template={entry.id}
                      onClick={(event) => {
                        if (
                          event.button !== 0 ||
                          event.metaKey ||
                          event.ctrlKey ||
                          event.shiftKey ||
                          event.altKey
                        )
                          return;
                        event.preventDefault();
                        choose(entry);
                      }}
                      className="group bg-card block overflow-hidden rounded-2xl border shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
                    >
                      <div className="bg-wedding-ivory relative aspect-square overflow-hidden">
                        <NextImage
                          src={libraryGalleryThumbnail(entry.id)}
                          alt=""
                          fill
                          sizes="(min-width: 1180px) 250px, (min-width: 1024px) 23vw, (min-width: 640px) 30vw, 45vw"
                          className="object-contain"
                        />
                      </div>
                      <p className="p-3 font-serif text-sm">{entry.name}</p>
                    </a>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      id="monogram-maker"
      tabIndex={-1}
      className={`not-prose ${styles.studio}`}
      aria-labelledby="monogram-editor-title"
      data-monogram-library
      data-style={item.id}
    >
      <div className={styles.editorHeader}>
        <button type="button" className={styles.back} onClick={showStyles}>
          <ArrowLeft size={16} aria-hidden="true" />
          {copy.back}
        </button>
        <h2 id="monogram-editor-title">{item.name}</h2>
      </div>
      <div className={styles.styleRail}>
        <div
          className={styles.styleRailNav}
          role="group"
          aria-label={copy.group}
        >
          {libraryGroups.map((group) => (
            <button
              key={group}
              type="button"
              aria-pressed={railGroup === group}
              onClick={() => setRailGroup(group)}
            >
              {groups[group][isChinese ? 1 : 0]}
            </button>
          ))}
        </div>
        <div
          className={styles.styleStrip}
          key={railGroup}
          aria-label={copy.library}
        >
          {monogramLibrary
            .filter((style) => style.group === railGroup)
            .map((style) => (
              <button
                key={style.id}
                type="button"
                data-switch-style={style.id}
                aria-pressed={item.id === style.id}
                onClick={() => choose(style, true)}
              >
                <NextImage
                  src={libraryGalleryThumbnail(style.id)}
                  width={60}
                  height={60}
                  alt=""
                />
                <span>{style.name}</span>
              </button>
            ))}
        </div>
      </div>
      <div className={styles.workspace}>
        <nav
          id={`${id}-step-nav`}
          aria-label={isChinese ? '编辑步骤' : 'Editing steps'}
          className={styles.steps}
        >
          {steps.map((key, index) => (
            <button
              type="button"
              key={key}
              onClick={() => changeStep(key)}
              aria-current={step === key ? 'step' : undefined}
            >
              <span aria-hidden="true">{index + 1}</span>
              {copy[key]}
            </button>
          ))}
        </nav>
        <div className={styles.toolbar}>
          <h3 id={`${id}-step-title`} className="sr-only" tabIndex={-1}>
            {copy[step]}
          </h3>

          {step === 'font' && (
            <>
              <div className={styles.fields}>
                {shownLetters.map((letter, index) => (
                  <label key={index} htmlFor={`${id}-${index}`}>
                    {copy.fields[index]}
                    <input
                      id={`${id}-${index}`}
                      value={letter}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      onFocus={(event) => event.target.select()}
                      onChange={(event) => {
                        const value = libraryInitial(event.currentTarget.value);
                        setLettersTouched(true);
                        setLetters((existing) => {
                          const next = [...existing];
                          next[index] = value;
                          return next;
                        });
                        setExportError(false);
                      }}
                    />
                  </label>
                ))}
              </div>
              <div
                className={`${styles.choiceGrid} ${styles.fontGrid}`}
                role="group"
                aria-label={copy.font}
              >
                <button
                  type="button"
                  aria-pressed={!appearance.font}
                  onClick={() =>
                    setAppearance((prior) => ({ ...prior, font: undefined }))
                  }
                >
                  <NextImage
                    src={libraryGalleryThumbnail(item.id)}
                    width={60}
                    height={60}
                    alt=""
                  />
                  <span>{copy.savedStyle}</span>
                </button>
                {libraryFontOptions.map(([key, name]) => {
                  const src = sample({
                    font: key,
                    layout: canChooseLayout ? 'side' : undefined,
                  });
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={appearance.font === key}
                      onClick={() =>
                        setAppearance((prior) => ({ ...prior, font: key }))
                      }
                    >
                      {src && (
                        <NextImage
                          src={src}
                          width={80}
                          height={56}
                          unoptimized
                          alt=""
                        />
                      )}
                      <span>{name}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className={styles.restore}
                onClick={restore}
                disabled={!changed}
              >
                <RotateCcw size={14} aria-hidden="true" />
                {copy.restore}
              </button>
            </>
          )}

          {step === 'layout' && (
            <div
              className={styles.choiceGrid}
              role="group"
              aria-label={copy.layout}
            >
              <button
                type="button"
                aria-pressed={!effective.layout}
                onClick={() =>
                  setAppearance((prior) => ({ ...prior, layout: undefined }))
                }
              >
                <NextImage
                  src={libraryGalleryThumbnail(item.id)}
                  width={60}
                  height={60}
                  alt=""
                />
                <span>{copy.savedStyle}</span>
              </button>
              {canChooseLayout &&
                libraryLayoutOptions.map((key, index) => {
                  const src = sample({ font: appearance.font, layout: key });
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={effective.layout === key}
                      onClick={() =>
                        setAppearance((prior) => ({ ...prior, layout: key }))
                      }
                    >
                      {src && (
                        <NextImage
                          src={src}
                          width={80}
                          height={56}
                          unoptimized
                          alt=""
                        />
                      )}
                      <span>{copy.layoutNames[index]}</span>
                    </button>
                  );
                })}
            </div>
          )}

          {step === 'colors' && (
            <>
              <div className={styles.palette}>
                {(
                  [
                    ['ornament', copy.ornament, ornamentColor],
                    ['ink', copy.letter, ink],
                    ['paper', copy.paper, paper],
                  ] as const
                ).map(([key, label, value]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="color"
                      value={value ?? '#000000'}
                      disabled={!data}
                      onChange={(event) => {
                        const color = event.currentTarget.value;
                        setPaint((prior) => ({ ...prior, [key]: color }));
                      }}
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                className={styles.restore}
                onClick={() => setPaint({})}
                disabled={!Object.keys(paint).length}
              >
                {copy.resetColors}
              </button>
            </>
          )}
          {step === 'export' && (
            <div className={styles.exportOptions}>
              <div className={styles.exportField}>
                <label htmlFor={`${id}-export-format`}>{copy.fileFormat}</label>
                <select
                  id={`${id}-export-format`}
                  disabled={!!busy}
                  value={selectedFormat}
                  onChange={(event) => {
                    const format = event.currentTarget.value as Format;
                    setExportFormat(format);
                    setExportError(false);
                  }}
                >
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
                  {allowsSvg && <option value="svg">SVG</option>}
                </select>
              </div>
              {selectedFormat !== 'svg' && (
                <div className={styles.exportField}>
                  <label htmlFor={`${id}-export-size`}>{copy.imageSize}</label>
                  <select
                    id={`${id}-export-size`}
                    disabled={!data || !!busy}
                    value={exportSize}
                    onChange={(event) => {
                      const size = Number(event.currentTarget.value);
                      const selection = rasterSizes.find(
                        (value) => value === size
                      );
                      if (selection) setExportSize(selection);
                      setExportError(false);
                    }}
                  >
                    {rasterSizes.map((size) => (
                      <option key={size} value={size}>
                        {data
                          ? `${exportDimensions(data.crop, size).join(' × ')} px`
                          : `${size} px`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {selectedFormat === 'png' && (
                <label className={styles.transparentOption}>
                  <input
                    type="checkbox"
                    checked={transparent}
                    disabled={!!busy || !!applying}
                    onChange={(event) => {
                      setTransparent(event.currentTarget.checked);
                      setExportError(false);
                    }}
                  />
                  {copy.transparent}
                </label>
              )}
              <button
                className={styles.exportButton}
                type="button"
                onClick={() => void download()}
                disabled={!svg || !!busy || !!applying || !hasLetters}
              >
                <Download size={15} aria-hidden="true" />
                {busy
                  ? copy.exporting
                  : `${copy.download} ${selectedFormat.toUpperCase()}`}
              </button>
              <div
                className={styles.applyTools}
                role="group"
                aria-label={copy.tools}
              >
                {(
                  [
                    ['table-number', copy.tableNumbers],
                    ['welcome-sign', copy.welcomeSign],
                  ] as const
                ).map(([target, label]) => (
                  <button
                    key={target}
                    type="button"
                    aria-busy={applying === target}
                    disabled={!svg || !!busy || !!applying || !hasLetters}
                    onClick={() => void applyMonogram(target)}
                  >
                    {label} <ArrowUpRight size={14} aria-hidden="true" />
                  </button>
                ))}
              </div>
              {applyError && (
                <p role="alert" className={styles.error}>
                  {copy.applyError}
                </p>
              )}
            </div>
          )}
          <div className={styles.stepActions}>
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => changeStep(steps[stepIndex - 1])}
              >
                {copy.previous}
              </button>
            )}
            {stepIndex < steps.length - 1 && (
              <button
                type="button"
                data-step-next
                onClick={() => changeStep(steps[stepIndex + 1])}
              >
                {copy.next}
              </button>
            )}
          </div>
        </div>
        <div
          className={styles.stage}
          aria-busy={!svg && !failed}
          data-mode={changed ? 'edited' : 'traced'}
          style={{ '--art-ratio': item.ratio } as CSSProperties}
        >
          {bitmap && data && svg ? (
            <div
              className={`${styles.preview} ${styles.bitmapPreview} ${showTransparency ? styles.checkerboard : ''}`}
              role="img"
              aria-label={description}
              style={{
                backgroundColor: showTransparency ? undefined : paper,
                aspectRatio: item.ratio,
              }}
            >
              <div
                data-ornament="bitmap"
                className={styles.bitmapOrnament}
                style={{
                  left: `${((bitmap.x - data.crop[0]) / data.crop[2]) * 100}%`,
                  top: `${((bitmap.y - data.crop[1]) / data.crop[3]) * 100}%`,
                  width: `${(bitmap.width / data.crop[2]) * 100}%`,
                  height: `${(bitmap.height / data.crop[3]) * 100}%`,
                  ...(tint
                    ? {
                        backgroundColor: tint,
                        maskImage: `url("${bitmap.src}")`,
                      }
                    : {}),
                }}
                aria-hidden="true"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {!tint && <img src={bitmap.src} alt="" />}
              </div>
              {/* Only the independent editable letter layer uses SVG. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt=""
                data-letter-layer
                className={styles.bitmapLetters}
              />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              width={Math.round(item.ratio * 480)}
              height={480}
              alt={description}
              className={`${styles.preview} ${showTransparency ? styles.checkerboard : ''}`}
            />
          )}
        </div>
        <div className={styles.footer}>
          <p className={styles.status} role="status">
            {failed ? (
              <>
                {copy.loadingError}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setLoadError(undefined);
                    setRetry((v) => v + 1);
                  }}
                >
                  {copy.retry}
                </button>
              </>
            ) : editingLetters && !appearance.font ? (
              <>
                {customLettering
                  ? copy.matched + (baseLettering ? ` · ${baseLettering}` : '')
                  : `${copy.alternate}: ${libraryFaceNames(item)}`}{' '}
                <small>{copy.unverified}</small>
              </>
            ) : !changed ? (
              <>
                {copy.original}
                {item.reading.endsWith('?') && <small>{copy.uncertain}</small>}
              </>
            ) : null}
          </p>
          {exportError && (
            <p className={styles.error} role="alert">
              {copy.exportError}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
