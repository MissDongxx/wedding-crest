import bodoniOutline from './monogram-bodoni-outline.json';
import records from './monogram-library-data.json';
import { loadMonogramAtlas } from './monogram-maker';
import {
  renderMeadowLetters,
  renderStyledCapital,
} from './monogram-meadow-letters';
import { renderRestoredLetters } from './monogram-restored-letters';

const fontIds = {
  b: 'bodoni',
  c: 'cormorant',
  g: 'greatVibes',
  p: 'pinyon',
  z: 'cinzel',
  f: 'frauncesItalic',
  m: 'meaCulpa',
  l: 'fleurDeLeah',
  a: 'allura',
  x: 'alexBrush',
} as const;
const fontNames: Record<keyof typeof fontIds, string> = {
  b: 'Bodoni Moda',
  c: 'Cormorant Garamond',
  g: 'Great Vibes',
  p: 'Pinyon Script',
  z: 'Cinzel',
  f: 'Fraunces Italic',
  m: 'Mea Culpa',
  l: 'Fleur De Leah',
  a: 'Allura',
  x: 'Alex Brush',
};
export type LibraryFace = keyof typeof fontIds;
type Face = LibraryFace;
export const libraryFontOptions = Object.entries(fontNames) as [
  LibraryFace,
  string,
][];
export const libraryLayoutOptions = [
  'side',
  'overlap',
  'stacked',
  'diagonal',
  'ampersand',
  'dot',
  'accent',
] as const;
export type LibraryLayoutChoice = (typeof libraryLayoutOptions)[number];
export type LibraryLetterOptions = {
  font?: LibraryFace;
  layout?: LibraryLayoutChoice;
};
type Bounds = [number, number, number, number];
type Glyph = [...Bounds, string];
type FaceKey = (typeof fontIds)[Face];
export type LibraryGlyphs = Record<FaceKey, Record<string, Glyph>>;
type Layout =
  | 'arc'
  | 'ring'
  | 'weave'
  | 'layer'
  | 'vertical'
  | 'vflow'
  | 'outline'
  | 'etched'
  | 'shared'
  | 'single'
  | 'loop';
type Rule = [
  string,
  Layout,
  Bounds,
  Bounds | null,
  number,
  number | null,
  boolean,
];
export const libraryGroups = [
  'botanical',
  'shields',
  'cameos',
  'wreaths',
  'cartouches',
  'minimal',
  'flourished',
  'engraved',
] as const;
export type LibraryGroup = (typeof libraryGroups)[number];
export type LibraryItem = {
  id: string;
  name: string;
  group: LibraryGroup;
  sheet: string;
  slot: number;
  reading: string;
  letters: string[];
  rule: Rule;
  ratio: number;
};
export type LibraryArtwork = {
  width: number;
  height: number;
  box: Bounds;
  crop: Bounds;
  ink: string;
  paper: string;
  ornamentInk: string;
  restoredLettering?: boolean;
  bitmapOrnament?: {
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  ornament: { d: string; opacity: number; strokeWidth?: number }[];
  fixed: string;
  trace: string;
};
export const monogramLibrary = records as LibraryItem[];
const root = '/images/wedding/monogram-library';
export const libraryThumbnail = (id: string) => `${root}/${id}.webp`;
export const libraryGalleryThumbnail = (id: string) => `${root}/${id}.hd.webp`;
export const libraryInitial = (value: string) =>
  value.normalize('NFKC').match(/[a-z]/gi)?.at(-1)?.toUpperCase() ?? '';
export const libraryFaceNames = (item: LibraryItem) =>
  [
    ...new Set(Array.from(item.rule[0], (face) => fontNames[face as Face])),
  ].join(' + ');

const artwork = new Map<string, Promise<LibraryArtwork>>();
let candidateGlyphs: Promise<LibraryGlyphs> | undefined;

async function readAsset<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok || !response.body)
    throw new Error('Monogram artwork unavailable');
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).json() as Promise<T>;
}

export function loadLibraryArtwork(id: string) {
  if (!monogramLibrary.some((item) => item.id === id)) {
    return Promise.reject(new Error('Unknown monogram'));
  }
  let data = artwork.get(id);
  if (!data) {
    data = readAsset<LibraryArtwork>(`${root}/${id}.gz`).catch((error) => {
      artwork.delete(id);
      throw error;
    });
    artwork.set(id, data);
  }
  return data;
}

export function loadLibraryGlyphs() {
  return (candidateGlyphs ??= Promise.all([
    readAsset<LibraryGlyphs>(`${root}/glyphs.gz`),
    loadMonogramAtlas(),
  ])
    .then(([legacy, atlas]) => ({ ...legacy, ...atlas }) as LibraryGlyphs)
    .catch((error) => {
      candidateGlyphs = undefined;
      throw error;
    }));
}

export const usesCustomLettering = (item: LibraryItem) =>
  /^01-0[1-4]$/.test(item.id);
export const libraryEditorHref = (
  id: string,
  pathname = '/wedding-monogram-maker'
) => `${pathname}?style=${encodeURIComponent(id)}#monogram-maker`;

export function recolorLibraryTrace(
  data: LibraryArtwork,
  ink: string,
  paper: string
) {
  if (ink === data.ink && paper === data.paper) return data.trace;
  return data.trace.replace(
    /(fill|stroke)="(#[a-f0-9]{6})"/gi,
    (match, attribute, hex) => {
      const value = hex.toLowerCase();
      const next =
        value === data.ink.toLowerCase()
          ? ink
          : value === data.paper.toLowerCase()
            ? paper
            : null;
      return next ? `${attribute}="${next}"` : match;
    }
  );
}

const needsOriginalStencil = (item: LibraryItem) =>
  ['outline', 'etched', 'shared', 'single'].includes(item.rule[1]);
const scriptFace = (face: string) => face === 'p' || face === 'g';
export const needsLibraryGlyphs = (
  item: LibraryItem,
  data?: LibraryArtwork,
  options: LibraryLetterOptions = {}
) => {
  if (options.font) return options.font !== 'b';
  if (!options.layout && usesCustomLettering(item)) return item.id === '01-02';
  if (
    (!data?.restoredLettering && !usesCustomLettering(item)) ||
    needsOriginalStencil(item)
  )
    return true;
  return [...item.rule[0]].some(scriptFace);
};

export function restoredLetteringBases(
  item: LibraryItem,
  data?: LibraryArtwork
) {
  if (item.id === '01-02') return 'Pinyon Script';
  if (!data?.restoredLettering) return '';
  const faces = [...item.rule[0]].filter(
    (face) => needsOriginalStencil(item) || scriptFace(face)
  );
  return [...new Set(faces.map((face) => fontNames[face as Face]))].join(' + ');
}

const positions: Record<LibraryLayoutChoice, [Layout, Bounds, Bounds]> = {
  side: ['vertical', [0.25, 0.5, 0.71, 0.44], [0.75, 0.5, 0.71, 0.44]],
  overlap: ['weave', [0.43, 0.44, 0.79, 0.65], [0.6, 0.58, 0.79, 0.65]],
  stacked: ['vertical', [0.5, 0.25, 0.43, 0.68], [0.5, 0.75, 0.43, 0.68]],
  diagonal: ['vflow', [0.29, 0.32, 0.6, 0.52], [0.7, 0.68, 0.6, 0.52]],
  ampersand: ['vertical', [0.22, 0.5, 0.66, 0.37], [0.78, 0.5, 0.66, 0.37]],
  dot: ['vertical', [0.24, 0.5, 0.6, 0.39], [0.76, 0.5, 0.6, 0.39]],
  accent: ['vflow', [0.39, 0.49, 0.87, 0.62], [0.76, 0.67, 0.4, 0.35]],
};

export function renderLibraryLetters(
  item: LibraryItem,
  data: LibraryArtwork,
  letters: readonly string[],
  glyphs?: LibraryGlyphs,
  options: LibraryLetterOptions = {}
) {
  const [
    nativeFaces,
    nativeLayout,
    nativeA,
    nativeB,
    crossing,
    explicitGap,
    invert,
  ] = item.rule;
  const [layout, aPos, bPos] = options.layout
    ? positions[options.layout]
    : [nativeLayout, nativeA, nativeB];
  const treatment = options.font ? undefined : nativeLayout;
  const faces = options.font
    ? options.font.repeat(nativeFaces.length)
    : nativeFaces;
  const first = libraryInitial(letters[0] ?? '');
  const second = faces.length === 2 ? libraryInitial(letters[1] ?? '') : '';
  const overrides = options.font || options.layout;
  if (!overrides && item.id === '01-01')
    return renderMeadowLetters(first, second, data.ink);
  if (!overrides && usesCustomLettering(item))
    return renderRestoredLetters(item.id, first, second, data, glyphs);
  if (!glyphs && needsLibraryGlyphs(item, data, options)) return '';
  const [x, y, u, v] = data.box;
  const w = u - x;
  const h = v - y;
  const id = 'm' + item.id;
  const ink = data.ink;
  const firstSheet = item.sheet === '01';
  const gap = explicitGap ?? Math.max(1, h * 0.01) * 1.8;
  const pen = firstSheet ? 0.63 : Math.max(1, h * 0.01) * 0.67;
  const solo: Bounds = [0.5, 0.5, 0.86, 0.84];
  const shared =
    layout === 'shared' &&
    [first, second].every((letter) => /^[BDEFPR]$/.test(letter));
  const stem = x + w * (firstSheet ? 0.19 : 0.3);

  let hatching = '';
  function shape(face: Face, letter: string, pos: Bounds, index: number) {
    if (!letter) return () => '';
    const [dx, dy, dh, dw] = pos;
    if (
      !options.font &&
      (data.restoredLettering || usesCustomLettering(item)) &&
      !needsOriginalStencil(item) &&
      !scriptFace(face)
    ) {
      const height = h * dh;
      const top = y + h * dy - height / 2;
      const center = x + w * dx;
      const weight = face === 'b' ? 1.9 : face === 'z' ? 1.56 : 1.27;
      return (matte = false) =>
        renderStyledCapital(letter, center, matte ? '#000' : ink, {
          top,
          scale: height / 28,
          maxWidth: w * dw,
          weight: matte ? weight + gap / (height / 28) : weight,
        }).svg;
    }
    const exactBodoni = options.font === 'b';
    const glyph = exactBodoni
      ? (bodoniOutline as unknown as Record<string, Glyph>)[letter]
      : glyphs?.[fontIds[face]][letter];
    if (!glyph) return () => '';
    const [gx, gy, gw, gh, d] = glyph;
    const scale = Math.min((h * dh) / gh, (w * dw) / gw);
    const px = shared
      ? stem + (firstSheet && index === 1 ? w * 0.11 : 0) + (gw * scale) / 2
      : x + w * dx;
    const py = y + h * dy;
    const etched =
      treatment === 'single' || (treatment === 'etched' && index === 0);
    const outlined =
      etched || treatment === 'outline' || treatment === 'etched';
    if (etched)
      hatching = `<defs><pattern id="${id}hatch" width="${5 / scale}" height="${3.5 / scale}" patternUnits="userSpaceOnUse"><path d="M0 ${1.2 / scale}h${5 / scale}" stroke="${ink}" stroke-width="${0.78 / scale}"/></pattern></defs>`;
    return (matte = false) => {
      const fill = matte
        ? '#000'
        : etched
          ? `url(#${id}hatch)`
          : outlined
            ? 'none'
            : ink;
      const stroke = matte ? '#000' : outlined || exactBodoni ? ink : 'none';
      const sw = (matte ? gap : exactBodoni ? 0.16 : pen) / scale;
      return `<path d="${d}" transform="translate(${px} ${py}) scale(${scale}) translate(${-gx - gw / 2} ${-gy - gh / 2})" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" fill-rule="evenodd"/>`;
    };
  }

  const a = shape(
    faces[0] as Face,
    first,
    shared && firstSheet
      ? [0.43, 0.455, 0.9, 0.63]
      : second || (!options.layout && layout === 'vertical')
        ? aPos
        : solo,
    0
  );
  const b = shape(
    (faces[1] ?? faces[0]) as Face,
    second,
    shared && firstSheet
      ? [0.43, 0.595, 0.84, 0.85]
      : (first || (!options.layout && layout === 'vertical')) && bPos
        ? bPos
        : solo,
    1
  );
  if (!first || !second || layout === 'vertical') {
    const separator =
      first && second && options.layout === 'ampersand'
        ? `<text x="${x + w / 2}" y="${y + h * 0.54}" text-anchor="middle" fill="${ink}" font-family="Georgia, serif" font-size="${h * 0.25}">&amp;</text>`
        : first && second && options.layout === 'dot'
          ? `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${Math.max(0.65, h * 0.025)}" fill="${ink}"/>`
          : '';
    return hatching + a() + b() + separator;
  }

  const mask = (tag: string, black: string) =>
    `<mask id="${id + tag}" maskUnits="userSpaceOnUse" x="0" y="0" width="${data.width}" height="${data.height}"><rect width="${data.width}" height="${data.height}" fill="white"/>${black}</mask>`;
  const clip = (tag: string, sx: number, sy: number, sw: number, sh: number) =>
    `<clipPath id="${id + tag}"><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}"/></clipPath>`;
  const masked = (tag: string, mark: string) =>
    `<g mask="url(#${id + tag})">${mark}</g>`;
  const clipped = (tag: string, mark: string) =>
    `<g clip-path="url(#${id + tag})">${mark}</g>`;
  if (shared) {
    const trim = x + w * (firstSheet ? 0.34 : 0.45);
    return (
      `<defs>${clip('stem', trim, 0, data.width - trim, data.height)}${mask('a', a(true))}</defs>` +
      clipped('stem', masked('a', b())) +
      a()
    );
  }
  const aFront = masked('a', b()) + a();
  const bFront = masked('b', a()) + b();
  if (layout === 'layer' || layout === 'vflow') {
    return `<defs>${mask('b', b(true))}</defs>` + bFront;
  }
  const band = y + h * crossing;
  const detail =
    layout === 'ring'
      ? `<path d="M ${x + w * 0.71} ${y + h * 0.19} A ${w * 0.43} ${h * 0.44} 0 1 0 ${x + w * 0.78} ${y + h * 0.75}" fill="none" stroke="${ink}" stroke-width=".74"/>`
      : layout === 'arc'
        ? `<path d="M ${x + w * 0.12} ${y + h * 0.83} Q ${x + w * 0.53} ${y + h * 0.47} ${x + w * 0.89} ${y + h * 0.62}" fill="none" stroke="${ink}" stroke-width=".56"/>`
        : '';
  return (
    hatching +
    `<defs>${mask('a', a(true))}${mask('b', b(true))}${clip('top', 0, 0, data.width, band)}${clip('bottom', 0, band, data.width, data.height - band)}</defs>` +
    detail +
    clipped('top', invert ? bFront : aFront) +
    clipped('bottom', invert ? aFront : bFront)
  );
}

export function renderLibraryLetterLayer(data: LibraryArtwork, mark: string) {
  const [, , w, h] = data.crop;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${data.crop.join(' ')}" width="${w}" height="${h}">${data.fixed}${mark}</svg>`;
}

export function renderLibrarySvg(
  data: LibraryArtwork,
  mark = data.trace,
  color = data.ornamentInk,
  transparent = false
) {
  const [, , w, h] = data.crop;
  const ink = /^#[0-9a-f]{6}$/i.test(color) ? color : data.ornamentInk;
  const vectors = data.ornament
    .map(({ d, opacity, strokeWidth }) =>
      strokeWidth
        ? `<path d="${d}" opacity="${opacity}" fill="none" stroke="${ink}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`
        : `<path d="${d}" opacity="${opacity}" fill-rule="evenodd"/>`
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${data.crop.join(' ')}" width="${w}" height="${h}">${transparent ? '' : `<rect width="${data.width}" height="${data.height}" fill="${data.paper}"/>`}<g data-layer="ornament" fill="${ink}">${vectors}</g>${data.fixed ? `<g data-layer="fixed">${data.fixed}</g>` : ''}${mark}</svg>`;
}

// Some original outlined initials use a paper-colored line through a thicker
// stroke. Knock out that line instead of printing it onto the destination.
export function transparentLibraryTrace(data: LibraryArtwork, ink: string) {
  const paint = /(fill|stroke)="(#[a-f0-9]{6})"/gi;
  const paper = data.paper.toLowerCase();
  const isPaper = (hex: string) =>
    paper !== data.ink.toLowerCase() && hex.toLowerCase() === paper;
  if (![...data.trace.matchAll(paint)].some(([, , hex]) => isPaper(hex)))
    return recolorLibraryTrace(data, ink, data.paper);
  const knockout = data.trace.replace(
    paint,
    (_, attr, hex) => `${attr}="${isPaper(hex) ? 'black' : 'none'}"`
  );
  const trace = recolorLibraryTrace(data, ink, 'none');
  return `<defs><mask id="trace-knockout" maskUnits="userSpaceOnUse" x="0" y="0" width="${data.width}" height="${data.height}"><rect width="${data.width}" height="${data.height}" fill="white"/>${knockout}</mask></defs><g mask="url(#trace-knockout)">${trace}</g>`;
}
