/**
 * Wedding Crest SVG Composer.
 *
 * Core product principle: the AI provider only paints the illustration layer.
 * Typography, layout and variants are composed programmatically here, so
 * names, initials and dates can never be misspelled or warped by a model.
 *
 * This module is isomorphic (pure string building) so the client wizard and
 * result page can re-compose locally for instant typography previews.
 */

import {
  getWeddingLayout,
  getWeddingStyle,
  getWeddingTypography,
} from './config';
import {
  WeddingComposeRequest,
  weddingPalettes,
  WeddingProjectInput,
} from './types';

const CANVAS = 1000;

export type WeddingMockupType =
  | 'invitation'
  | 'save_the_date'
  | 'menu'
  | 'welcome_sign';

export const WEDDING_MOCKUP_TYPES: { id: WeddingMockupType; name: string }[] = [
  { id: 'invitation', name: 'Invitation' },
  { id: 'save_the_date', name: 'Save the Date' },
  { id: 'menu', name: 'Menu' },
  { id: 'welcome_sign', name: 'Welcome Sign' },
];

/* -------------------------------------------------------------------------- */
/* Utilities                                                                   */
/* -------------------------------------------------------------------------- */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "2027-06-12" -> "June 12, 2027" (falls back to the raw string). */
export function formatWeddingDate(value?: string | null): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const [, year, month, day] = match;
  const monthName = MONTHS[parseInt(month, 10) - 1] ?? '';
  if (!monthName) return value;
  return `${monthName} ${parseInt(day, 10)}, ${year}`;
}

function initialsOf(input: WeddingProjectInput): string[] {
  const letters = (input.initials ?? [])
    .map((letter) => letter.trim().charAt(0).toUpperCase())
    .filter(Boolean);
  if (letters.length > 0) return letters.slice(0, 2);
  return [
    input.partner1?.trim().charAt(0).toUpperCase() || 'A',
    input.partner2?.trim().charAt(0).toUpperCase() || 'B',
  ];
}

function surnameOf(input: WeddingProjectInput): string {
  const parts = (partner: string) =>
    partner.trim().split(/\s+/).filter(Boolean);
  const p2 = parts(input.partner2 ?? '');
  const p1 = parts(input.partner1 ?? '');
  const surname =
    p2.length > 1 ? p2[p2.length - 1] : p1.length > 1 ? p1[p1.length - 1] : '';
  return surname;
}

export interface WeddingDisplayTexts {
  /** Large center line: initials monogram, full names or surname. */
  headline: string;
  /** Smaller supporting line with both full names ("" for full_names/surname). */
  names: string;
  /** Formatted wedding date ("" when hidden). */
  date: string;
}

export function resolveWeddingDisplayTexts(
  input: WeddingProjectInput
): WeddingDisplayTexts {
  const [a, b] = initialsOf(input);
  const fullNames = `${(input.partner1 ?? '').trim()} & ${(input.partner2 ?? '').trim()}`;
  const display = input.nameDisplay || 'initials_amp';
  let headline = '';
  let names = fullNames;

  switch (display) {
    case 'initials_joined':
      headline = `${a}${b}`;
      break;
    case 'initials_spaced':
      headline = `${a} ${b}`;
      break;
    case 'full_names':
      headline = fullNames;
      names = '';
      break;
    case 'surname': {
      const surname = surnameOf(input);
      headline = surname ? `The ${surname}s` : `${a} & ${b}`;
      names = '';
      break;
    }
    case 'initials_amp':
    default:
      headline = `${a} & ${b}`;
      break;
  }

  const date =
    input.showDate === false ? '' : formatWeddingDate(input.weddingDate);
  return { headline, names, date };
}

function fontStack(family: string): string {
  const sans = "'Manrope', 'DM Sans', system-ui, sans-serif";
  const serif = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
  const isSans = /sans|manrope|dm/i.test(family);
  return `${escapeXml(family)}, ${isSans ? sans : serif}`.replace(
    /&amp;/g,
    '&amp;'
  );
}

function fontAttributes(spec: {
  family: string;
  weight?: number;
  italic?: boolean;
  letterSpacing?: number;
}): string {
  const parts = [
    `font-family="${fontStack(spec.family)}"`,
    `font-weight="${spec.weight ?? 400}"`,
  ];
  if (spec.italic) parts.push('font-style="italic"');
  if (spec.letterSpacing) parts.push(`letter-spacing="${spec.letterSpacing}"`);
  return parts.join(' ');
}

/** Shrink long headlines so they stay inside the crest frame. */
function headlineSize(text: string, base: number): number {
  if (text.length <= 8) return base;
  if (text.length <= 12) return base * 0.82;
  if (text.length <= 18) return base * 0.64;
  if (text.length <= 26) return base * 0.5;
  return base * 0.4;
}

function normalizePalette(palette?: string[]): [string, string, string] {
  if (palette && palette.length >= 3) {
    return [palette[0], palette[1], palette[2]];
  }
  return weddingPalettes[0].colors;
}

function inkColor(palette?: string[]): string {
  return normalizePalette(palette)[0];
}

/* -------------------------------------------------------------------------- */
/* Style ornaments (deterministic placeholder frames, no AI needed)            */
/* -------------------------------------------------------------------------- */

interface ShapePoint {
  x: number;
  y: number;
  /** Leaf rotation in degrees. */
  angle: number;
}

function shapePoints(shape: string, step: number, phase = 0): ShapePoint[] {
  const points: ShapePoint[] = [];
  const push = (x: number, y: number, angle: number) =>
    points.push({ x, y, angle });

  if (shape === 'wreath') {
    const r = 415;
    for (let t = 0; t < 360; t += step) {
      const rad = ((t + phase) * Math.PI) / 180;
      push(500 + r * Math.cos(rad), 500 + r * Math.sin(rad), t + 90);
    }
    return points;
  }

  if (shape === 'oval') {
    const rx = 395;
    const ry = 435;
    for (let t = 0; t < 360; t += step) {
      const rad = ((t + phase) * Math.PI) / 180;
      const x = 500 + rx * Math.cos(rad);
      const y = 500 + ry * Math.sin(rad);
      // Approximate tangent angle for an ellipse.
      const angle =
        (Math.atan2(ry * Math.cos(rad), -rx * Math.sin(rad)) * 180) / Math.PI;
      push(x, y, angle);
    }
    return points;
  }

  if (shape === 'arch') {
    // Rounded top (semicircle) + straight sides + flat base.
    const r = 345;
    const cy = 470;
    const top = 0;
    const bottom = 880;
    for (let t = 180; t <= 360; t += step / 2) {
      const rad = (t * Math.PI) / 180;
      const x = 500 + r * Math.cos(rad);
      const y = cy + r * Math.sin(rad);
      const angle =
        (Math.atan2(-Math.cos(rad), Math.sin(rad)) * 180) / Math.PI + 90;
      push(x, y, angle);
    }
    const sideSteps = Math.max(4, Math.round((bottom - cy) / (step * 4)));
    for (let i = 0; i <= sideSteps; i += 1) {
      const y = cy + ((bottom - cy) * i) / sideSteps;
      push(500 - r, y, 180);
      push(500 + r, y, 0);
    }
    for (let x = 500 - r; x <= 500 + r; x += step * 3) {
      push(x, bottom, 90);
    }
    return points;
  }

  // open: corner sprays on two opposite corners.
  for (let t = -70; t <= 70; t += step / 1.5) {
    const rad = (t * Math.PI) / 180;
    const r1 = 240 + (t + 70) * 1.1;
    push(
      160 + r1 * Math.cos(rad - Math.PI / 4),
      190 + r1 * Math.sin(rad - Math.PI / 4),
      t + 135
    );
    const r2 = 240 + (70 - t) * 1.1;
    push(
      840 - r2 * Math.cos(rad - Math.PI / 4),
      830 - r2 * Math.sin(rad - Math.PI / 4),
      t + 315
    );
  }
  return points;
}

/**
 * Deterministic decorative frame for a style, used in wizard previews, style
 * cards and gallery visuals before/without a real AI illustration.
 */
export function buildStyleOrnament(
  styleId: string,
  palette: string[],
  shape: string
): string {
  const style = getWeddingStyle(styleId);
  const [primary, soft, mid] = normalizePalette(palette);
  const parts: string[] = [];

  const leafRing = (
    step: number,
    leafSize: number,
    withFlowers: boolean,
    opacity: number
  ) => {
    const points = shapePoints(shape, step);
    return points
      .map((point, index) => {
        const flower = withFlowers && index % 5 === 2;
        if (flower) {
          return `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${leafSize * 0.45}" fill="${mid}" opacity="${opacity}"/>`;
        }
        return `<ellipse cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" rx="${leafSize}" ry="${leafSize * 0.38}" fill="${primary}" opacity="${opacity}" transform="rotate(${point.angle.toFixed(1)} ${point.x.toFixed(1)} ${point.y.toFixed(1)})"/>`;
      })
      .join('');
  };

  switch (style.id) {
    case 'botanical_watercolor':
      parts.push(leafRing(14, 27, true, 0.78));
      break;
    case 'minimal_line_art':
      parts.push(
        `<circle cx="500" cy="500" r="418" fill="none" stroke="${primary}" stroke-width="2"/>`,
        `<circle cx="500" cy="500" r="400" fill="none" stroke="${primary}" stroke-width="1" opacity="0.55"/>`
      );
      break;
    case 'vintage_engraving':
      parts.push(
        `<ellipse cx="500" cy="500" rx="405" ry="440" fill="none" stroke="${primary}" stroke-width="3"/>`,
        `<ellipse cx="500" cy="500" rx="382" ry="417" fill="none" stroke="${primary}" stroke-width="1.5" stroke-dasharray="6 5" opacity="0.7"/>`
      );
      break;
    case 'italian_romance':
      parts.push(
        leafRing(16, 24, true, 0.6),
        `<ellipse cx="500" cy="500" rx="370" ry="405" fill="${soft}" opacity="0.35"/>`
      );
      break;
    case 'coastal':
      parts.push(leafRing(22, 22, true, 0.55));
      break;
    case 'classic_luxury':
      parts.push(
        `<circle cx="500" cy="500" r="425" fill="none" stroke="${primary}" stroke-width="4"/>`,
        `<circle cx="500" cy="500" r="405" fill="none" stroke="${primary}" stroke-width="1.5" opacity="0.8"/>`,
        `<circle cx="500" cy="500" r="395" fill="${soft}" opacity="0.25"/>`
      );
      break;
    default:
      parts.push(leafRing(16, 24, true, 0.7));
      break;
  }

  return parts.join('');
}

/* -------------------------------------------------------------------------- */
/* Typography + composition layers                                             */
/* -------------------------------------------------------------------------- */

function typographyLayer(input: WeddingComposeRequest, ink: string): string {
  const layout = getWeddingLayout(input.layout);
  const typography = getWeddingTypography(input.typography);
  const texts = resolveWeddingDisplayTexts(input);
  const parts: string[] = [];

  // Soft wash behind the text so type stays legible over the illustration.
  if (input.illustrationUrl) {
    parts.push(
      `<ellipse cx="500" cy="555" rx="285" ry="215" fill="${normalizePalette(input.palette)[1]}" opacity="0.55"/>`
    );
  }

  const headlineFontSize = headlineSize(texts.headline, 118);
  parts.push(
    `<text x="${layout.initials.x}" y="${layout.initials.y}" text-anchor="middle" dominant-baseline="middle" fill="${ink}" font-size="${headlineFontSize}" ${fontAttributes(typography.initialsFont)}>${escapeXml(texts.headline)}</text>`
  );

  if (texts.names) {
    const namesFontSize = texts.names.length > 24 ? 28 : 36;
    parts.push(
      `<text x="${layout.names.x}" y="${layout.names.y}" text-anchor="middle" dominant-baseline="middle" fill="${ink}" font-size="${namesFontSize}" ${fontAttributes(typography.namesFont)}>${escapeXml(texts.names)}</text>`
    );
  }

  if (texts.date) {
    parts.push(
      `<text x="${layout.date.x}" y="${layout.date.y}" text-anchor="middle" dominant-baseline="middle" fill="${ink}" font-size="21" opacity="0.9" ${fontAttributes(typography.dateFont)}>${escapeXml(texts.date)}</text>`
    );
  }

  return parts.join('');
}

function watermarkLayer(): string {
  return `<g><defs><pattern id="wc-preview-watermark" width="260" height="180" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)"><text x="0" y="90" font-family="'Manrope', system-ui, sans-serif" font-size="20" letter-spacing="4" fill="#6b6b6b" opacity="0.16">WEDDING CREST STUDIO PREVIEW</text></pattern></defs><rect x="0" y="0" width="${CANVAS}" height="${CANVAS}" fill="url(#wc-preview-watermark)"/></g>`;
}

/** Inner crest content on the shared 1000x1000 coordinate space. */
function crestInner(
  request: WeddingComposeRequest,
  variant: 'primary' | 'bw'
): string {
  const style = getWeddingStyle(request.style);
  const layout = getWeddingLayout(request.layout);
  const ink = variant === 'bw' ? '#1f1f1f' : inkColor(request.palette);
  const parts: string[] = [];

  if (request.illustrationUrl) {
    const imageTag = `<image href="${escapeXml(request.illustrationUrl)}" x="0" y="0" width="${CANVAS}" height="${CANVAS}" preserveAspectRatio="xMidYMid meet"${variant === 'bw' ? ' filter="url(#wc-bw-filter)"' : ''}/>`;
    if (variant === 'bw') {
      parts.push(
        `<defs><filter id="wc-bw-filter"><feColorMatrix type="saturate" values="0"/></filter></defs>`,
        imageTag
      );
    } else {
      parts.push(imageTag);
    }
  } else {
    // Deterministic placeholder frame - used before AI generation.
    parts.push(
      `<rect x="0" y="0" width="${CANVAS}" height="${CANVAS}" fill="${normalizePalette(request.palette)[1]}"/>`,
      `<ellipse cx="500" cy="555" rx="300" ry="230" fill="#ffffff" opacity="0.55"/>`,
      buildStyleOrnament(style.id, request.palette, layout.shape)
    );
  }

  parts.push(typographyLayer(request, ink));
  if (request.previewWatermark) parts.push(watermarkLayer());
  return parts.join('');
}

function wrapSvg(
  inner: string,
  width: number,
  height: number,
  extraDefs = ''
): string {
  // Omit explicit width/height attributes so the SVG scales to fit its
  // container via viewBox. The previous fixed width/height attributes forced
  // a 1000px render box, which overflowed narrow viewports (e.g. mobile 390px)
  // and broke layouts that wrap the SVG without a width-controlling parent.
  // Consumers size the SVG via their own wrappers (max-w-*, aspect-*, w-full).
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img">${extraDefs}${inner}</svg>`;
}

/* -------------------------------------------------------------------------- */
/* Public composers                                                            */
/* -------------------------------------------------------------------------- */

/** Primary master crest: illustration + programmatic typography. */
export function composeWeddingCrest(request: WeddingComposeRequest): string {
  return wrapSvg(crestInner(request, 'primary'), CANVAS, CANVAS);
}

/** Black & white version of the master crest. */
export function composeWeddingBlackWhite(
  request: WeddingComposeRequest
): string {
  return wrapSvg(crestInner(request, 'bw'), CANVAS, CANVAS);
}

/** Pure typographic monogram - fully vector, no illustration. */
export function composeWeddingMonogram(input: WeddingProjectInput): string {
  const typography = getWeddingTypography(input.typography);
  const texts = resolveWeddingDisplayTexts(input);
  const ink = inkColor(input.palette);
  const [primary, soft] = normalizePalette(input.palette);
  const monogram = texts.headline;
  const inner = [
    `<circle cx="500" cy="500" r="452" fill="none" stroke="${ink}" stroke-width="2.5"/>`,
    `<circle cx="500" cy="500" r="435" fill="none" stroke="${ink}" stroke-width="1" opacity="0.6"/>`,
    `<circle cx="500" cy="500" r="420" fill="${soft}" opacity="0.3"/>`,
    `<text x="500" y="505" text-anchor="middle" dominant-baseline="middle" fill="${ink}" font-size="${headlineSize(monogram, 150)}" ${fontAttributes(typography.initialsFont)}>${escapeXml(monogram)}</text>`,
    `<circle cx="500" cy="800" r="5" fill="${primary}"/>`,
    `<path d="M 440 800 H 490 M 510 800 H 560" stroke="${ink}" stroke-width="1.2" opacity="0.7"/>`,
  ].join('');
  return wrapSvg(inner, CANVAS, CANVAS);
}

/** Simplified mark: single initial in a minimal ring. */
export function composeWeddingSimplifiedMark(
  input: WeddingProjectInput
): string {
  const typography = getWeddingTypography(input.typography);
  const [a] = initialsOf(input);
  const ink = inkColor(input.palette);
  const inner = [
    `<circle cx="500" cy="500" r="440" fill="none" stroke="${ink}" stroke-width="3"/>`,
    `<text x="500" y="510" text-anchor="middle" dominant-baseline="middle" fill="${ink}" font-size="380" ${fontAttributes(typography.initialsFont)}>${escapeXml(a)}</text>`,
  ].join('');
  return wrapSvg(inner, CANVAS, CANVAS);
}

/* -------------------------------------------------------------------------- */
/* Mockups - deterministic stationery scenes reusing the master crest          */
/* -------------------------------------------------------------------------- */

interface MockupScene {
  width: number;
  height: number;
  /** Crest placement region on the scene canvas (top-left origin). */
  crest: { x: number; y: number; size: number };
  background: (ink: string, paper: string, soft: string) => string;
}

const MOCKUP_SCENES: Record<WeddingMockupType, MockupScene> = {
  invitation: {
    width: 1000,
    height: 1250,
    crest: { x: 300, y: 190, size: 400 },
    background: (ink, paper, soft) =>
      [
        `<rect x="0" y="0" width="1000" height="1250" fill="${soft}"/>`,
        `<rect x="60" y="60" width="880" height="1130" fill="${paper}" stroke="${ink}" stroke-width="1.5"/>`,
        `<rect x="78" y="78" width="844" height="1094" fill="none" stroke="${ink}" stroke-width="0.8" opacity="0.6"/>`,
        `<text x="500" y="700" text-anchor="middle" fill="${ink}" font-size="30" letter-spacing="10" font-family="'Cormorant Garamond', Georgia, serif">TOGETHER WITH THEIR FAMILIES</text>`,
        `<text x="500" y="760" text-anchor="middle" fill="${ink}" font-size="26" letter-spacing="6" font-family="'Cormorant Garamond', Georgia, serif">INVITE YOU TO CELEBRATE</text>`,
        `<path d="M 350 820 H 650" stroke="${ink}" stroke-width="1" opacity="0.5"/>`,
        `<rect x="470" y="900" width="60" height="60" rx="30" fill="${ink}" opacity="0.85"/>`,
        `<text x="500" y="945" text-anchor="middle" fill="${paper}" font-size="28" font-family="'Cormorant Garamond', Georgia, serif">W</text>`,
        `<rect x="350" y="1030" width="300" height="1.5" fill="${ink}" opacity="0.4"/>`,
      ].join(''),
  },
  save_the_date: {
    width: 1000,
    height: 1250,
    crest: { x: 310, y: 240, size: 380 },
    background: (ink, paper, soft) =>
      [
        `<rect x="0" y="0" width="1000" height="1250" fill="${soft}"/>`,
        `<rect x="80" y="80" width="840" height="1090" fill="${paper}"/>`,
        `<text x="500" y="740" text-anchor="middle" fill="${ink}" font-size="44" letter-spacing="14" font-family="'Cinzel', Georgia, serif">SAVE THE DATE</text>`,
        `<text x="500" y="830" text-anchor="middle" fill="${ink}" font-size="34" font-family="'Cormorant Garamond', Georgia, serif" font-style="italic">of their wedding day</text>`,
        `<path d="M 420 880 H 580" stroke="${ink}" stroke-width="1" opacity="0.5"/>`,
        `<text x="500" y="960" text-anchor="middle" fill="${ink}" font-size="30" letter-spacing="5" font-family="'Cormorant Garamond', Georgia, serif">RECEPTION TO FOLLOW</text>`,
      ].join(''),
  },
  menu: {
    width: 1000,
    height: 1250,
    crest: { x: 320, y: 150, size: 360 },
    background: (ink, paper, soft) =>
      [
        `<rect x="0" y="0" width="1000" height="1250" fill="${soft}"/>`,
        `<rect x="70" y="70" width="860" height="1110" fill="${paper}" stroke="${ink}" stroke-width="1.2"/>`,
        `<text x="500" y="680" text-anchor="middle" fill="${ink}" font-size="40" letter-spacing="16" font-family="'Cinzel', Georgia, serif">MENU</text>`,
        `<path d="M 380 720 H 620" stroke="${ink}" stroke-width="1" opacity="0.5"/>`,
        [0, 1, 2, 3]
          .map(
            (i) =>
              `<rect x="360" y="${780 + i * 70}" width="280" height="10" rx="5" fill="${ink}" opacity="${0.32 - i * 0.05}"/>`
          )
          .join(''),
      ].join(''),
  },
  welcome_sign: {
    width: 1400,
    height: 900,
    crest: { x: 130, y: 190, size: 520 },
    background: (ink, paper, soft) =>
      [
        `<rect x="0" y="0" width="1400" height="900" fill="${soft}"/>`,
        `<rect x="70" y="70" width="1260" height="760" fill="${paper}" stroke="${ink}" stroke-width="2"/>`,
        `<rect x="92" y="92" width="1216" height="716" fill="none" stroke="${ink}" stroke-width="1" opacity="0.5"/>`,
        `<text x="920" y="330" text-anchor="middle" fill="${ink}" font-size="72" font-family="'Cormorant Garamond', Georgia, serif">Welcome</text>`,
        `<text x="920" y="410" text-anchor="middle" fill="${ink}" font-size="34" letter-spacing="8" font-family="'Cormorant Garamond', Georgia, serif" font-style="italic">to our wedding</text>`,
        `<path d="M 780 470 H 1060" stroke="${ink}" stroke-width="1.2" opacity="0.5"/>`,
        `<text x="920" y="540" text-anchor="middle" fill="${ink}" font-size="26" letter-spacing="5" font-family="'Cormorant Garamond', Georgia, serif">KINDLY TAKE YOUR SEAT</text>`,
      ].join(''),
  },
};

function crestGroup(
  request: WeddingComposeRequest,
  region: { x: number; y: number; size: number }
): string {
  const scale = region.size / CANVAS;
  return `<g transform="translate(${region.x} ${region.y}) scale(${scale.toFixed(4)})">${crestInner(request, 'primary')}</g>`;
}

/** One deterministic mockup scene embedding the master crest. */
export function composeWeddingMockup(
  request: WeddingComposeRequest,
  type: WeddingMockupType
): string {
  const scene = MOCKUP_SCENES[type];
  const [ink, paper, soft] = normalizePalette(request.palette);
  const background = scene.background(ink, paper, soft);
  return wrapSvg(
    `${background}${crestGroup(request, scene.crest)}`,
    scene.width,
    scene.height
  );
}

export function composeWeddingMockups(request: WeddingComposeRequest): {
  id: WeddingMockupType;
  name: string;
  svg: string;
}[] {
  return WEDDING_MOCKUP_TYPES.map((type) => ({
    id: type.id,
    name: type.name,
    svg: composeWeddingMockup(request, type.id),
  }));
}
