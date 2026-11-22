import specimen from './monogram-specimen-outlines.json';

export const monogramFonts = [
  ['cormorant', 'Cormorant Garamond'],
  ['frauncesItalic', 'Fraunces Italic'],
  ['cinzel', 'Cinzel'],
  ['pinyon', 'Pinyon Script'],
  ['greatVibes', 'Great Vibes'],
  ['meaCulpa', 'Mea Culpa'],
  ['fleurDeLeah', 'Fleur De Leah'],
  ['allura', 'Allura'],
  ['alexBrush', 'Alex Brush'],
] as const;

export type MonogramFont = (typeof monogramFonts)[number][0];
export type MonogramLayout =
  | 'paired'
  | 'overlap'
  | 'stacked'
  | 'diagonal'
  | 'centerpiece';
export const monogramElements = {
  frame: ['none', 'circle', 'double', 'oval', 'shield', 'arch', 'diamond'],
  wreath: [
    'none',
    'laurel',
    'olive',
    'crescent',
    'sprig',
    'wildflower',
    'roses',
  ],
  embellishment: [
    'none',
    'bow',
    'ribbon',
    'rules',
    'flourish',
    'sparkles',
    'pearls',
  ],
} as const;
export type MonogramElement = keyof typeof monogramElements;
export type MonogramFrame = (typeof monogramElements.frame)[number];
type MonogramWreath = (typeof monogramElements.wreath)[number];
type MonogramEmbellishment = (typeof monogramElements.embellishment)[number];
export type MonogramSeparator = 'ampersand' | 'dot' | 'none';
type Glyph = readonly [
  x: number,
  y: number,
  width: number,
  height: number,
  path: string,
];
export type MonogramAtlas = Record<
  MonogramFont,
  Record<string, Glyph | undefined>
>;
const specimenAtlas = specimen as unknown as MonogramAtlas;

export async function loadMonogramAtlas() {
  const module = await import('./monogram-outlines.json');
  return module.default as unknown as MonogramAtlas;
}

export const monogramSize = 360;
export const monogramPngSize = 2400;
export const defaultMonogram = {
  initials: 'AL',
  font: 'greatVibes',
  layout: 'paired',
  frame: 'none',
  wreath: 'none',
  embellishment: 'none',
  separator: 'ampersand',
  spacing: 42,
  front: 'last',
  ink: '#34443b',
} satisfies MonogramOptions;

export interface MonogramOptions {
  initials: string;
  font: MonogramFont;
  layout: MonogramLayout;
  frame: MonogramFrame;
  wreath: MonogramWreath;
  embellishment: MonogramEmbellishment;
  frameInk?: string;
  wreathInk?: string;
  embellishmentInk?: string;
  separator: MonogramSeparator;
  spacing: number;
  front: 'first' | 'last';
  ink: string;
  background?: string;
}

type LayoutOptions = Pick<
  MonogramOptions,
  'layout' | 'separator' | 'spacing' | 'front'
>;

export const monogramLayoutChoices = {
  paired: {
    layout: 'paired',
    separator: 'ampersand',
    spacing: 20,
    front: 'last',
  },
  overlap: { layout: 'overlap', separator: 'none', spacing: 82, front: 'last' },
  stacked: { layout: 'stacked', separator: 'none', spacing: 31, front: 'last' },
  minimal: { layout: 'paired', separator: 'dot', spacing: 45, front: 'last' },
  diagonal: {
    layout: 'diagonal',
    separator: 'none',
    spacing: 48,
    front: 'last',
  },
  centerpiece: {
    layout: 'centerpiece',
    separator: 'none',
    spacing: 35,
    front: 'last',
  },
  spaced: { layout: 'paired', separator: 'none', spacing: 88, front: 'last' },
} as const satisfies Record<string, LayoutOptions>;

export type MonogramLayoutChoice = keyof typeof monogramLayoutChoices;

export function normalizeInitials(value: string) {
  return value
    .normalize('NFD')
    .replace(/[^a-z]/gi, '')
    .toUpperCase()
    .slice(0, 3);
}

export function moveInitialToCenter(value: string, index: number) {
  const letters = [...normalizeInitials(value)];
  if (letters.length !== 3 || (index !== 0 && index !== 2))
    return letters.join('');
  [letters[1], letters[index]] = [letters[index], letters[1]];
  return letters.join('');
}

type Piece = {
  x: number;
  y: number;
  w: number;
  h: number;
  glyph?: Glyph;
};
const n = (value: number) => Number(value.toFixed(3));

function pathFor(
  piece: Piece,
  fit: number,
  offsetX: number,
  offsetY: number,
  gap = 0
) {
  const x = n(offsetX + piece.x * fit);
  const y = n(offsetY + piece.y * fit);
  if (!piece.glyph) {
    return `<circle cx="${n(x + (piece.w * fit) / 2)}" cy="${n(y + (piece.h * fit) / 2)}" r="${n((piece.w * fit) / 2)}"/>`;
  }

  const [left, top, , height, d] = piece.glyph;
  const scale = (piece.h / height) * fit;
  const transform = `translate(${x} ${y}) scale(${n(scale)}) translate(${left === 0 ? 0 : -left} ${top === 0 ? 0 : -top})`;
  const knockout = gap
    ? ` fill="black" stroke="black" stroke-width="${n(gap / scale)}" stroke-linejoin="round"`
    : '';
  return `<path d="${d}" transform="${transform}"${knockout}/>`;
}

const ring = '<circle cx="180" cy="180" r="148" stroke-width="1.6"/>';
const mirror = (art: string) =>
  `<g transform="translate(360 0) scale(-1 1)">${art}</g>`;

function motif(art: string, x: number, y: number, angle = 0, size = 1) {
  return `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${size})">${art}</g>`;
}

const engravingLeaf =
  '<path d="M0 0C12-12 26-15 41-6 31 5 13 8 0 0Z" fill="currentColor" fill-opacity=".13" stroke-width="1.1"/><path d="M2 0q16-4 33-5m-25 4 9-7m-2 5 9 4m-1-6 6-4" stroke-width=".76"/>';
const oliveLeaf =
  '<path d="M0 0C11-7 28-11 47-4 26 3 15 8 0 0Z" fill="currentColor" fill-opacity=".3" stroke-width=".94"/><path d="M1 0q20-3 39-4" stroke-width=".7"/>';
const roundLeaf =
  '<path d="M0 0C4-13 18-19 29-12 36-6 30 5 21 8 11 10 4 6 0 0Z" fill="currentColor" fill-opacity=".2" stroke-width="1.1"/><path d="M0 0q13-4 26-9m-14 5 3-7m3 5 5 4" stroke-width=".8"/>';
const dot = '<circle r="2.2" fill="currentColor" stroke="none"/>';
const buds =
  '<path d="M0 0Q10-16 16-29M7-13l-7-11m12 4 13-5" stroke-width="1.1"/><ellipse cx="16" cy="-30" rx="2.4" ry="3.5" fill="currentColor"/><circle cx="0" cy="-25" r="2.5"/><circle cx="26" cy="-26" r="2"/>';
type Placement = [x: number, y: number, angle?: number, size?: number];

function scatter(art: string, positions: Placement[]) {
  return positions.map((position) => motif(art, ...position)).join('');
}

const laurelBranch =
  '<path d="M184 316C103 309 45 260 45 189 45 135 65 94 111 59" stroke-width="1.9"/>' +
  scatter(engravingLeaf, [
    [160, 312, -152, 0.72],
    [146, 308, 160, 0.72],
    [130, 302, -133, 0.79],
    [116, 296, 178, 0.86],
    [103, 287, -112, 0.88],
    [89, 276, -164, 0.95],
    [77, 264, -88, 0.92],
    [66, 249, -145, 1],
    [57, 232, -72, 0.99],
    [50, 214, -124, 0.97],
    [46, 194, -56, 0.93],
    [46, 173, -103, 0.92],
    [50, 153, -42, 0.91],
    [57, 129, -84, 0.87],
    [69, 106, -26, 0.83],
    [84, 85, -63, 0.73],
    [100, 68, -43, 0.65],
  ]);
const oliveBranch =
  '<path d="M182 315C95 321 29 254 47 179Q54 142 83 112m-36 85q-13-41-9-78m31 153q-28-10-47-31" stroke-width="1.65"/>' +
  scatter(oliveLeaf, [
    [156, 314, -146, 0.8],
    [142, 313, 157, 0.63],
    [127, 309, -114, 0.88],
    [111, 303, 176, 0.83],
    [94, 293, -97, 0.89],
    [79, 282, -164, 0.99],
    [66, 268, -81, 0.88],
    [56, 250, -138, 1],
    [49, 233, -68, 0.9],
    [45, 211, -116, 1],
    [48, 192, -56, 0.86],
    [55, 174, -29, 0.83],
    [65, 149, -26, 0.75],
    [80, 114, -54, 0.78],
    [38, 145, -101, 0.77],
    [36, 126, -70, 0.73],
    [31, 251, -136, 0.61],
    [21, 240, -163, 0.61],
  ]) +
  '<g fill="currentColor" fill-opacity=".65" stroke-width="1"><path d="M60 258q9-3 14-13m-25-29q13 1 19-10m28 93q12-1 19-9" fill="none"/><ellipse cx="74" cy="242" rx="4" ry="6" transform="rotate(28 74 242)"/><ellipse cx="68" cy="204" rx="4" ry="5"/><ellipse cx="116" cy="288" rx="4" ry="5" transform="rotate(52 116 288)"/></g>';
const sprig =
  '<path d="M108 317C55 284 33 240 46 194S52 123 35 86m17 137q24-28 32-54m-31 95q-22-16-29-40" stroke-width="1.6"/>' +
  scatter(roundLeaf, [
    [98, 310, -59, 0.7],
    [84, 299, -158, 0.83],
    [71, 286, -66, 0.88],
    [58, 269, -149, 0.94],
    [49, 248, -53, 1.02],
    [43, 227, -129, 0.89],
    [44, 202, -53, 0.9],
    [48, 181, -124, 0.94],
    [52, 157, -54, 0.8],
    [51, 133, -118, 0.81],
    [44, 109, -74, 0.74],
    [37, 90, -107, 0.56],
    [71, 194, -28, 0.72],
    [83, 173, -56, 0.7],
    [29, 238, -115, 0.61],
  ]) +
  scatter(buds, [
    [62, 276, -112, 0.62],
    [42, 167, -31, 0.66],
    [53, 148, 38, 0.53],
  ]);

const blossom =
  '<path d="M0-3C-11-8-6-20 1-16 7-23 16-13 10-6 23-7 25 7 15 9 12 19 1 20-3 10-14 16-23 5-16-2-18-12-5-12 0-3Z" fill="currentColor" fill-opacity=".09" stroke-width="1.65"/><path d="M-2 0q-4-5-8-4m9 4q4-7 5-9m-3 10q8-1 13 3m-14-2q4 6 5 10m-7-10q-6 3-9 2" stroke-width=".9"/><circle r="2.8" fill="currentColor" stroke="none"/>';
const rose =
  '<path d="M-21-6Q-29 5-19 15-16 24-3 22 9 28 16 17 28 14 25 1 29-7 18-13 15-24 4-22-5-28-12-20-24-19-21-6Z" fill="currentColor" fill-opacity=".09" stroke-width="1.5"/><path d="M-21-6q8-5 16 1-4-10 3-15m-18 35Q-11 16-7 7m4 15q0-8 8-13 10 0 11 8m9-16q-9-4-14 2 3-12 7-16m-30-7q7-5 16-2M-7 7q-7-8 3-12 10-3 10 5-2 7-7 2-1-2 2-3m5 1q5-2 5 3M-15 5q3-1 8 2" stroke-width="1.15"/>';
const crescentLeft =
  '<path d="M178 316C112 317 76 291 45 242m84 69q-33-4-58-12m5-17Q53 278 31 261" stroke-width="1.5"/>' +
  scatter(engravingLeaf, [
    [154, 315, -159, 0.7],
    [136, 312, 166, 0.57],
    [120, 306, -110, 0.61],
    [108, 302, 160, 0.69],
    [94, 294, -103, 0.7],
    [75, 280, -155, 0.67],
    [60, 262, -100, 0.58],
    [47, 246, -129, 0.59],
  ]) +
  scatter(buds, [
    [76, 284, -58, 0.65],
    [136, 312, 33, 0.63],
    [104, 304, -121, 0.59],
  ]);
const crescent =
  crescentLeft +
  mirror(crescentLeft) +
  scatter(blossom, [
    [61, 266, -24, 0.62],
    [108, 303, 18, 0.79],
    [176, 312, -8, 0.72],
    [251, 302, -24, 0.95],
    [302, 263, 11, 0.76],
  ]) +
  scatter(dot, [
    [79, 254],
    [94, 278],
    [229, 286],
    [272, 309],
    [283, 279],
  ]);
const wildflower =
  '<path d="M171 319C101 309 47 250 40 191Q36 143 66 101m27 182Q71 257 72 219M47 220Q24 204 20 176m42 77q-5-35-4-59M53 143q-1-22 8-51m125 227c71-11 123-56 132-123 6-39-8-68-23-93m-7 161q12-38 41-66m-66 90q27-2 63-32m-11-89q10-29 8-51" stroke-width="1.5"/>' +
  scatter(engravingLeaf, [
    [146, 314, -128, 0.71],
    [121, 303, 165, 0.73],
    [99, 290, -98, 0.78],
    [78, 270, -159, 0.78],
    [59, 244, -72, 0.72],
    [46, 214, -139, 0.73],
    [41, 194, -62, 0.64],
    [44, 161, -71, 0.67],
    [47, 148, -118, 0.6],
    [217, 310, -41, 0.7],
    [240, 300, 12, 0.61],
    [263, 288, -65, 0.7],
    [280, 274, 19, 0.68],
    [299, 250, -49, 0.73],
    [315, 220, 17, 0.65],
    [318, 191, -74, 0.71],
    [316, 156, 6, 0.65],
  ]) +
  scatter(buds, [
    [45, 230, -45, 0.78],
    [45, 162, 18, 0.85],
    [72, 263, -50, 0.62],
    [120, 306, -52, 0.67],
    [241, 297, 24, 0.78],
    [311, 220, 32, 0.83],
    [319, 164, -34, 0.84],
  ]) +
  scatter(blossom, [
    [62, 94, -7, 0.82],
    [40, 134, -32, 0.65],
    [20, 175, 24, 0.59],
    [72, 219, 11, 0.87],
    [58, 194, -12, 0.61],
    [97, 271, -4, 0.69],
    [293, 101, 39, 0.86],
    [324, 119, -9, 0.6],
    [329, 197, 15, 0.63],
    [313, 252, -5, 0.89],
    [270, 270, 17, 0.79],
  ]) +
  scatter(dot, [
    [24, 153],
    [25, 213],
    [76, 237],
    [92, 254],
    [321, 235],
    [284, 119],
    [309, 280],
    [248, 278],
  ]);
const roseLeaves =
  '<path d="M176 316Q103 319 69 272 28 221 58 151 71 118 58 82m11 190Q46 248 23 253m35-95Q42 137 37 112M184 316q85-2 121-80 23-47-9-92m-51 157q46-7 78-37m-11-51q1-25 21-53m-35 10q-8-28-3-58" stroke-width="1.6"/>' +
  scatter(engravingLeaf, [
    [158, 315, -148, 0.8],
    [139, 314, 170, 0.84],
    [113, 305, -117, 0.85],
    [87, 293, 159, 0.74],
    [62, 262, -152, 0.86],
    [49, 240, -110, 0.76],
    [46, 213, -153, 0.94],
    [49, 186, -63, 0.72],
    [53, 167, -107, 0.75],
    [62, 132, -62, 0.72],
    [59, 102, -120, 0.64],
    [202, 313, -22, 0.88],
    [232, 307, 4, 0.86],
    [255, 293, -53, 0.77],
    [283, 266, 19, 0.88],
    [301, 244, -66, 0.77],
    [311, 216, 35, 0.88],
    [313, 192, -57, 0.69],
    [305, 158, -94, 0.64],
  ]) +
  scatter(buds, [
    [58, 184, -10, 0.65],
    [72, 275, -99, 0.83],
    [113, 306, 29, 0.67],
    [63, 130, 21, 0.84],
    [247, 304, 29, 0.67],
    [297, 249, 48, 0.74],
    [309, 181, -20, 0.68],
  ]);
const rosePositions: Placement[] = [
  [59, 86, -22, 0.61],
  [49, 197, -15, 0.86],
  [85, 280, 16, 1],
  [144, 316, -23, 0.68],
  [218, 311, 18, 0.63],
  [274, 283, -14, 0.91],
  [312, 229, 9, 1],
  [296, 118, 21, 0.61],
];
const roseCompanions: Placement[] = [
  [28, 247, 11, 0.49],
  [55, 152, -14, 0.52],
  [325, 265, 17, 0.54],
  [331, 157, 17, 0.54],
];
const roseKnockouts =
  scatter('<circle r="21" fill="black" stroke="none"/>', rosePositions) +
  scatter('<circle r="13" fill="black" stroke="none"/>', roseCompanions);
const roseGarden =
  `<defs><mask id="rose-knockouts" maskUnits="userSpaceOnUse" x="0" y="0" width="360" height="360"><rect width="360" height="360" fill="white" stroke="none"/>${roseKnockouts}</mask></defs><g mask="url(#rose-knockouts)">${roseLeaves}</g>` +
  scatter(rose, rosePositions) +
  scatter(blossom, roseCompanions);

const frames: Record<MonogramFrame, string> = {
  none: '',
  circle: ring,
  double: ring + '<circle cx="180" cy="180" r="141" stroke-width="0.9"/>',
  oval: '<ellipse cx="180" cy="180" rx="150" ry="122"/>',
  diamond:
    '<path d="M180 24 338 180 180 336 22 180Z"/><path d="M180 35 327 180 180 325 33 180Z" stroke-width=".8"/>',
  arch: '<path d="M71 308V145a109 109 0 0 1 218 0v163Z"/><path d="M79 300V145a101 101 0 0 1 202 0v155Z" stroke-width=".8"/>',
  shield:
    '<path d="M180 35q-58 34-118 31v101q0 93 118 152 118-59 118-152V66q-60 3-118-31Z"/><path d="M180 47q-57 29-109 28v92q0 85 109 142 109-57 109-142V75q-52 1-109-28Z" stroke-width=".8"/>',
} as const;

const wreaths: Record<MonogramWreath, string> = {
  none: '',
  laurel: laurelBranch + mirror(laurelBranch),
  olive: oliveBranch + mirror(motif(oliveBranch, -5, -4, 2)),
  crescent,
  sprig,
  wildflower,
  roses: roseGarden,
};

const embellishments: Record<MonogramEmbellishment, string> = {
  none: '',
  bow: '<path d="M180 43c-20-3-42-27-35-31 9-4 24 8 35 27 11-19 26-31 35-27 7 4-15 28-35 31Zm0 0q-17 7-19 20m19-20q17 7 19 20"/><ellipse cx="180" cy="41" rx="4" ry="3"/>',
  ribbon:
    '<path d="M149 302q31 8 62 0v15q-31 9-62 0Zm0 4-14-3 4 7-4 6 14 3m62-13 14-3-4 7 4 6-14 3m-62-2 9-4m53 4-9-4"/>',
  rules:
    '<path d="M136 48h30m28 0h30m-88 264h30m28 0h30M180 43l5 5-5 5-5-5Zm0 264 5 5-5 5-5-5Z"/>',
  flourish:
    '<path d="M180 34c-9-13-21-4-21 2 0 4 7 5 9 1M180 34c9-13 21-4 21 2 0 4-7 5-9 1m-12-3q-15 15-39 7c-12-4-12-13-5-13 5 0 7 6 3 7m41-1q15 15 39 7c12-4 12-13 5-13-5 0-7 6-3 7m-41 2 5 10-5 5-5-5Z"/>',
  sparkles:
    '<path d="M180 23q2 15 13 16-11 2-13 15-2-13-13-15 11-1 13-16Zm-24 11q1 8 7 9-6 1-7 8-1-7-7-8 6-1 7-9Zm48 0q1 8 7 9-6 1-7 8-1-7-7-8 6-1 7-9Z"/>',
  pearls:
    '<path d="M139 311h10m62 0h10"/><circle cx="180" cy="311" r="5"/><g fill="currentColor" stroke="none"><circle cx="160" cy="311" r="2"/><circle cx="169" cy="311" r="2.8"/><circle cx="191" cy="311" r="2.8"/><circle cx="200" cy="311" r="2"/></g>',
};

function elementArt<K extends MonogramElement>(
  kind: K,
  value: MonogramOptions[K]
) {
  switch (kind) {
    case 'frame':
      return frames[value as MonogramFrame];
    case 'wreath':
      return wreaths[value as MonogramWreath];
    case 'embellishment':
      return embellishments[value as MonogramEmbellishment];
  }
}

const svgTag = (art: string, viewBox = `0 0 ${monogramSize} ${monogramSize}`) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${monogramSize}" height="${monogramSize}">${art}</svg>`;
const cleanInk = (ink: string | undefined, fallback: string) =>
  ink && /^#[\da-f]{6}$/i.test(ink) ? ink : fallback;
const scaleFromCenter = (art: string, scale: number) =>
  scale === 1
    ? art
    : `<g transform="translate(180 180) scale(${scale}) translate(-180 -180)">${art}</g>`;

function layer<K extends MonogramElement>(
  kind: K,
  value: MonogramOptions[K],
  color: string,
  transform?: string
) {
  const art = elementArt(kind, value);
  return art
    ? `<g data-monogram-layer="${kind}" fill="none" color="${color}" stroke="${color}" stroke-width="${transform ? 2.8 : 1.6}" stroke-linecap="round" stroke-linejoin="round"${transform ? ` transform="${transform}"` : ''}>${art}</g>`
    : '';
}

export function renderMonogramElementSvg<K extends MonogramElement>(
  kind: K,
  value: MonogramOptions[K]
) {
  const transform =
    kind === 'embellishment'
      ? value === 'bow' || value === 'flourish' || value === 'sparkles'
        ? 'translate(0 139)'
        : value === 'ribbon' || value === 'pearls'
          ? 'translate(0 -132)'
          : 'translate(0 46) scale(1 .74)'
      : undefined;
  const crop =
    kind === 'wreath' && value === 'crescent'
      ? '14 188 332 180'
      : kind === 'wreath' && value === 'sprig'
        ? '-14 59 164 278'
        : undefined;
  return svgTag(layer(kind, value, defaultMonogram.ink, transform), crop);
}

export function renderMonogramSvg(
  options: MonogramOptions,
  atlas = specimenAtlas
) {
  const initials = normalizeInitials(options.initials);
  if (!initials) return '';

  const font = atlas[options.font];
  if ([...initials].some((char) => !font[char])) return '';
  const ink = cleanInk(options.ink, defaultMonogram.ink);
  const interlace = options.layout === 'overlap' && initials.length > 1;
  const spacing = Number.isFinite(options.spacing)
    ? Math.max(0, Math.min(100, options.spacing))
    : 42;

  const pieces: Piece[] = [...initials].map((char, index) => {
    const glyph = font[char]!; // Validated against the active atlas above.
    const centerpiece = options.layout === 'centerpiece' && initials.length > 1;
    const prominent = index === (initials.length === 3 ? 1 : 0);
    const h = centerpiece
      ? prominent
        ? 177
        : 90
      : initials.length === 1
        ? 165
        : initials.length === 3
          ? index === 1
            ? 154
            : 105
          : 135;
    const stagger = index - (initials.length - 1) / 2;
    return {
      glyph,
      h,
      w: (glyph[2] * h) / glyph[3],
      x: 0,
      y: centerpiece
        ? 172 - h
        : (165 - h) / 2 +
          stagger * (options.layout === 'diagonal' ? 76 : interlace ? 15 : 0),
    };
  });

  if (
    options.layout === 'paired' &&
    initials.length === 2 &&
    options.separator !== 'none'
  ) {
    const glyph = options.separator === 'ampersand' ? font['&'] : undefined;
    const h = glyph ? 42 : 7;
    pieces.splice(1, 0, {
      glyph,
      h,
      w: glyph ? (glyph[2] * h) / glyph[3] : h,
      x: 0,
      y: (165 - h) / 2,
    });
  }

  const stacked = options.layout === 'stacked';
  const rowWidth = Math.max(...pieces.map((piece) => piece.w));

  function arrange(distance: number) {
    for (const [i, piece] of pieces.entries()) {
      const previous = pieces[i - 1];
      if (stacked) {
        piece.x = (rowWidth - piece.w) / 2;
        piece.y = previous ? previous.y + previous.h + 2 + distance * 1.08 : 0;
      } else if (previous) {
        const narrower = Math.min(previous.w, piece.w);
        const gap = interlace
          ? -narrower * (0.045 + distance * 0.0053)
          : options.layout === 'diagonal'
            ? -narrower * 0.32 + distance * 0.74
            : options.layout === 'centerpiece'
              ? -narrower * 0.11 + distance * 0.71
              : 3 + distance * (pieces.length === 3 ? 0.55 : 0.88);
        piece.x = previous.x + previous.w + gap;
      }
    }
    const minY = Math.min(...pieces.map((p) => p.y));
    return {
      minY,
      height: Math.max(...pieces.map((p) => p.y + p.h)) - minY,
      width: Math.max(...pieces.map((p) => p.x + p.w)),
    };
  }

  // Fit against the widest setting first so the slider changes distance, not glyph size.
  const limits = arrange(interlace ? 0 : 100);
  const { minY, height, width } = arrange(spacing);
  const framed = options.frame !== 'none';
  const hasWreath = options.wreath !== 'none';
  const hasEmbellishment = options.embellishment !== 'none';
  // The tighter framed bounds fit a rectangle safely inside either circle.
  const maxWidth =
    options.frame === 'diamond'
      ? 162
      : options.frame === 'arch' || options.frame === 'shield'
        ? 175
        : framed
          ? 215
          : hasWreath
            ? 220
            : 292;
  const maxHeight =
    options.frame === 'arch'
      ? 205
      : options.frame === 'oval'
        ? 149
        : options.frame === 'diamond'
          ? 148
          : framed
            ? 166
            : hasWreath
              ? 160
              : 225;
  const fit = Math.min(
    maxWidth / limits.width,
    maxHeight / limits.height,
    1.32
  );
  const offsetX = (monogramSize - width * fit) / 2;
  const offsetY = (monogramSize - height * fit) / 2 - minY * fit;

  const shape = (piece: Piece) => pathFor(piece, fit, offsetX, offsetY);
  let artwork = pieces.map(shape).join('');
  if (interlace) {
    const front = options.front === 'first' ? 0 : pieces.length - 1;
    const frontPiece = pieces[front];
    artwork =
      `<defs><mask id="initial-cutout" maskUnits="userSpaceOnUse" x="0" y="0" width="${monogramSize}" height="${monogramSize}"><rect width="${monogramSize}" height="${monogramSize}" fill="white"/>${pathFor(frontPiece, fit, offsetX, offsetY, 3.2)}</mask></defs>` +
      `<g mask="url(#initial-cutout)">${pieces
        .filter((_, i) => i !== front)
        .map(shape)
        .join('')}</g>` +
      shape(frontPiece);
  }

  const frame = layer('frame', options.frame, cleanInk(options.frameInk, ink));
  const wreath = layer(
    'wreath',
    options.wreath,
    cleanInk(options.wreathInk, ink)
  );
  const embellishment = layer(
    'embellishment',
    options.embellishment,
    cleanInk(options.embellishmentInk, ink)
  );
  const central = scaleFromCenter(
    frame + `<g data-monogram-layer="letters" fill="${ink}">${artwork}</g>`,
    framed && hasWreath ? 0.69 : 1
  );

  const background = cleanInk(options.background, '');
  return svgTag(
    (background
      ? `<rect width="${monogramSize}" height="${monogramSize}" fill="${background}"/>`
      : '') +
      scaleFromCenter(wreath + central, hasEmbellishment ? 0.73 : 1) +
      embellishment
  );
}

export function monogramImageUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
