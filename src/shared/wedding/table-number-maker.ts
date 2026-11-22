import {
  illustratedTableTemplates,
  renderIllustratedTableCard,
} from './table-number-artwork';
import { tableNameLines } from './table-number-text';
import {
  matchingSpec,
  matchingTableTemplates,
  type MatchingMaterials,
  type WelcomeMatch,
} from './table-number-welcome-match';

export const tableNumberPath = '/table-number-maker';
export const tableNumberMonogramEditPath =
  '/wedding-monogram-maker?edit=table-number#monogram-maker';
export const tableNumberHandoff = 'wedding-table-number-monogram-v1';
export const tableCountLimit = 100;

export const tableTemplates = {
  ...illustratedTableTemplates,
  classic: { label: 'Classic', ink: '#382d2b', paper: '#fdf9f1' },
  botanical: { label: 'Botanical', ink: '#3a5142', paper: '#f6f8ee' },
  crest: { label: 'Crest', ink: '#75414b', paper: '#fcf2ef' },
  ...matchingTableTemplates,
} as const;
export const tableSizes = {
  '4x6': [288, 432],
  '5x7': [360, 504],
} as const;

export type TableTemplate = keyof typeof tableTemplates;
export const defaultTableTemplate: TableTemplate = 'porcelain';
export function isTableTemplate(value: unknown): value is TableTemplate {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(tableTemplates, value)
  );
}
export type TableSize = keyof typeof tableSizes;
export type TablePaper = 'letter' | 'a4';
export type TablePrint = 'home' | 'shop';
export type TableMonogram = { svg: string; ink: string; editable?: boolean };
export type TableDesign = {
  template: TableTemplate;
  ink: string;
  names: string;
  date: string;
  monogram?: TableMonogram;
  autumnArtwork?: string;
  welcomeMatch?: WelcomeMatch;
  matchingMaterials?: MatchingMaterials;
};

const sheets = {
  letter: [792, 612],
  a4: [841.89, 595.28],
} as const;

export const tableInk = (ink: string) => /^#[\da-f]{6}$/i.test(ink);
export function readTableMonogram(
  value: string | null
): TableMonogram | undefined {
  try {
    const data = JSON.parse(value || 'null');
    if (
      typeof data?.svg === 'string' &&
      data.svg.length <= 300_000 &&
      /^<svg\s/.test(data.svg) &&
      data.svg.endsWith('</svg>') &&
      typeof data.ink === 'string' &&
      tableInk(data.ink)
    ) {
      return {
        svg: data.svg,
        ink: data.ink,
        editable: data.editor?.version === 1,
      };
    }
  } catch {}
}

export function tableLayout(
  size: TableSize,
  mode: TablePrint,
  paper: TablePaper
) {
  const [cardWidth, cardHeight] = tableSizes[size];
  if (mode === 'shop') {
    return {
      width: cardWidth,
      height: cardHeight,
      crop: false,
      slots: [{ x: 0, y: 0, w: cardWidth, h: cardHeight }],
    };
  }
  const [width, height] = sheets[paper];
  // Landscape keeps both cards upright and leaves space for crop marks.
  const w = cardWidth;
  const h = cardHeight;
  const gap = 18;
  const x = (width - 2 * w - gap) / 2;
  const y = (height - h) / 2;
  return {
    width,
    height,
    crop: true,
    slots: [
      { x, y, w, h },
      { x: x + w + gap, y, w, h },
    ],
  };
}

export function tableCropMarks({
  x,
  y,
  w,
  h,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const marks: [number, number, number, number][] = [];
  for (const dx of [0, 1]) {
    for (const dy of [0, 1]) {
      const xx = x + dx * w,
        yy = y + dy * h;
      const sx = dx ? 1 : -1,
        sy = dy ? 1 : -1;
      marks.push(
        [xx + sx * 2, yy, xx + sx * 7, yy],
        [xx, yy + sy * 2, xx, yy + sy * 7]
      );
    }
  }
  return marks;
}

const xml = (value: string) =>
  value.replace(
    /[&<>"'\u0000-\u001F]/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[c] ?? ''
  );
export const svgImage = (svg: string) =>
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(svg.replace(/[\uD800-\uDFFF]/gu, '\uFFFD'));

const vine =
  '<path d="M0 66Q9 21 49 0M12 35Q-5 13 22 12Q27 25 12 35M25 20Q21 -2 43 -5Q44 10 25 20M10 47Q29 33 42 38Q35 55 10 47M31 13Q48 7 56 13Q47 25 31 13"/>';

export function tableCardSvg(
  design: TableDesign,
  size: TableSize,
  number: number
) {
  const [w, h] = tableSizes[size];
  const nameLines = tableNameLines(design.names);
  const matching = matchingSpec(design.template, design.welcomeMatch);
  if (matching) {
    const { palette, template } = matching;
    const art = design.matchingMaterials;
    const color = tableInk(design.ink) ? design.ink : palette.ink;
    const numberSize = number >= 100 ? 86 : 113;
    const textX =
      template.sceneId === 'olive' && template.variation !== 2 ? 177 : 150;
    const namesY =
      template.sceneId === 'meadow' && template.variation ? 258 : 285;
    const numberY =
      (template.sceneId === 'meadow' && template.variation ? 226 : 244) -
      (nameLines.length > 2 ? 9 : 0);
    const details = (
      value: string,
      y: number,
      fontSize: number,
      names = false
    ) => {
      if (!value.trim()) return '';
      const size = Math.min(
        fontSize,
        (textX === 177 ? 160 : 174) /
          Math.max(1, Array.from(value).length * 0.61)
      );
      return `<text x="${textX}" y="${y}" font-size="${size}" font-family="${names && art?.font ? 'PaperNames, Georgia, serif' : 'Georgia, serif'}">${xml(value)}</text>`;
    };
    const matchedFont = art?.font
      ? `<style>@font-face{font-family:PaperNames;src:url('${art.font}') format('woff2')}</style>`
      : '';
    const plate = art?.plate
      ? `<image width="300" height="420" href="${art.plate}" preserveAspectRatio="none"/>`
      : `<rect width="300" height="420" fill="${palette.paper}"/><rect x="18" y="18" width="264" height="384" fill="none" stroke="${palette.accent}"/>`;
    const mark = design.monogram
      ? `<image x="${textX - 20}" y="87" width="40" height="40" href="${svgImage(design.monogram.svg)}"/>`
      : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 300 420" preserveAspectRatio="none" aria-label="Table ${number}" data-welcome-template="${template.id}">
    ${matchedFont}${plate}${mark}
    <g text-anchor="middle" fill="${color}" font-family="Georgia, serif">
    <text x="${textX}" y="143" font-size="11" letter-spacing="3">TABLE</text>
    <text x="${textX}" y="${numberY}" font-size="${numberSize}">${number}</text>
    ${nameLines.length < 2 ? `<path d="M${textX - 18} ${namesY - 18}h36" stroke="${palette.accent}" stroke-width=".8"/>` : ''}
    ${nameLines.map((line, i) => details(line, namesY - (nameLines.length - 1 - i) * 10, nameLines.length === 1 ? 21 : 14, true)).join('')}
    ${details(design.date, namesY + 18, 11)}
    </g></svg>`;
  }
  const illustrated = renderIllustratedTableCard({
    template: design.template,
    color: tableInk(design.ink)
      ? design.ink
      : tableTemplates[design.template].ink,
    number,
    names: design.names.trim(),
    date: design.date.trim(),
    monogramUrl: design.monogram && svgImage(design.monogram.svg),
    monogramInk: design.monogram?.ink,
    autumnArtwork: design.autumnArtwork,
  });
  if (illustrated)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 300 420" preserveAspectRatio="none" aria-label="Table ${number}">${illustrated}</svg>`;
  const { paper: lightPaper, ink: defaultInk } =
    tableTemplates[design.template];
  const ink = tableInk(design.ink) ? design.ink : defaultInk;
  const rgb = Number.parseInt((design.monogram?.ink ?? ink).slice(1), 16);
  const luma =
    ((rgb >> 16) * 299 + ((rgb >> 8) & 255) * 587 + (rgb & 255) * 114) / 1000;
  const paper = luma > 160 ? '#29251f' : lightPaper;
  const c = w / 2;

  const label = (text: string, y: number, font: number) => {
    const fit = Math.min(
      font,
      (w - 46) / Math.max(1, Array.from(text).length * 0.63)
    );
    return `<text x="${c}" y="${y}" font-size="${fit}">${xml(text)}</text>`;
  };
  const frame =
    design.template === 'classic'
      ? `<rect x="13" y="13" width="${w - 26}" height="${h - 26}" stroke-width=".65"/><path d="M${c - 14} ${h * 0.68}h28" stroke-width=".6"/>`
      : design.template === 'botanical'
        ? `<g stroke-width="1"><g transform="translate(16 21)">${vine}</g><g transform="translate(${w - 16} ${h - 21}) rotate(180)">${vine}</g></g>`
        : `<path d="M${c} 19Q${c + 30} 36 ${w - 20} 39V${h - 66}Q${w - 20} ${h - 37} ${c} ${h - 18}Q20 ${h - 37} 20 ${h - 66}V39Q${c - 30} 36 ${c} 19Z" stroke-width=".9"/><rect x="11" y="11" width="${w - 22}" height="${h - 22}" stroke-width=".4"/>`;
  const mark = design.monogram
    ? `<image x="${c - w * 0.15}" y="${h * 0.115}" width="${w * 0.3}" height="${w * 0.3}" href="${svgImage(design.monogram.svg)}"/>`
    : `<path d="M${c} ${h * 0.2 - 5}l5 5-5 5-5-5Z" fill="${ink}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${paper}"/>
<g fill="none" stroke="${ink}">${frame}</g>${mark}
<g text-anchor="middle" fill="${ink}" font-family="Georgia, 'Times New Roman', serif">
<text x="${c}" y="${h * 0.39}" font-family="Arial, sans-serif" font-size="9" letter-spacing="3">TABLE</text>
<text x="${c}" y="${h * 0.605}" font-size="${w * (number >= 100 ? 0.35 : 0.41)}">${number}</text>
${nameLines.map((line, i) => label(line, h * 0.78 - (nameLines.length - 1 - i) * 12, 13)).join('')}
${design.date.trim() ? label(design.date.trim(), h * (nameLines.length ? 0.83 : 0.78), nameLines.length ? 10 : 13) : ''}
</g></svg>`;
}
