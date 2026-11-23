import {
  placeTableNumber,
  type TableNumberPlacement,
} from './table-number-placement';
import { tableNameLines } from './table-number-text';
import rawAtlas from './table-number-type.json';

export const illustratedTableTemplates = {
  porcelain: { label: 'Porcelain', ink: '#4e86bc', paper: '#ffffff' },
  scallop: { label: 'Sage Scallop', ink: '#096437', paper: '#fbfaf4' },
  lace: { label: 'Burgundy Lace', ink: '#790f11', paper: '#74120f' },
  goldArch: { label: 'Gold Arch', ink: '#1e1b16', paper: '#fcfaf1' },
  autumn: { label: 'Autumn Wash', ink: '#984510', paper: '#fbf7eb' },
} as const;

type Illustrated = keyof typeof illustratedTableTemplates;
type Family = keyof typeof rawAtlas;
type Glyph = [number, number, number, number, number, string];
const atlas = rawAtlas as unknown as Record<Family, Record<string, Glyph>>;
const point = (n: number) => Number(n.toFixed(2));
const normalWidth = 300;
const normalHeight = 420;
const center = normalWidth / 2;
const safeText = (text: string) =>
  text.replace(
    /[&<>"'\u0000-\u001F]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[character] ?? ''
  );

function outline(
  value: string,
  family: Family,
  x: number,
  top: number,
  height: number,
  width: number,
  anchor: 'middle' | 'start' = 'middle',
  strokeWidth = 0
) {
  const letters = Array.from(value, (glyph) => atlas[family][glyph]);
  if (letters.some((glyph) => !glyph)) return '';
  let cursor = 0;
  let left = Infinity;
  let right = -Infinity;
  let upper = Infinity;
  let lower = -Infinity;
  const nodes = letters.map(([advance, l, t, r, b, path]) => {
    left = Math.min(left, cursor + l);
    right = Math.max(right, cursor + r);
    upper = Math.min(upper, t);
    lower = Math.max(lower, b);
    const node = `<path transform="translate(${point(cursor)} 0)" d="${path}"/>`;
    cursor += advance;
    return node;
  });
  const scale = Math.min(height / (lower - upper), width / (right - left));
  const offset = anchor === 'middle' ? (right + left) / 2 : left;

  const stroke = strokeWidth
    ? ` stroke="currentColor" stroke-width="${strokeWidth}" stroke-linejoin="round"`
    : '';
  return `<g${stroke} transform="translate(${x} ${top}) scale(${scale.toFixed(5)}) translate(${point(-offset)} ${point(-upper)})">${nodes.join('')}</g>`;
}

function liveText(
  value: string,
  x: number,
  y: number,
  size: number,
  width: number,
  extra = ''
) {
  if (!value) return '';
  const fit = Math.min(size, width / (Array.from(value).length * 0.62));
  return `<text x="${x}" y="${y}" font-size="${point(fit)}" ${extra}>${safeText(value)}</text>`;
}

function waveFrame(x: number, y: number, w: number, h: number, depth: number) {
  const segments = [
    [w, 7, 1, 0, 0, -1],
    [h, 9, 0, 1, 1, 0],
    [w, 7, -1, 0, 0, 1],
    [h, 9, 0, -1, -1, 0],
  ];
  const samples: [number, number, number][] = [];
  let path = `M${x} ${y}`;
  for (const [length, count, dx, dy, ox, oy] of segments) {
    const part = length / count;
    for (let i = 0; i < count; i++) {
      const at = (advance: number, rise: number) =>
        `${point(x + dx * part * advance + ox * depth * rise)} ${point(y + dy * part * advance + oy * depth * rise)}`;
      path += ` C${at(0.03, 0.77)} ${at(0.21, 0.86)} ${at(0.5, 0.86)} C${at(0.79, 0.86)} ${at(0.97, 0.77)} ${at(1, 0)}`;
      samples.push([
        x + dx * part * 0.5 + ox * depth * 0.2,
        y + dy * part * 0.5 + oy * depth * 0.2,
        dx === 0 ? 90 : 0,
      ]);
      x += dx * part;
      y += dy * part;
    }
  }
  return { path: path + 'Z', samples };
}

const sageField =
  'M56 16C79 16 85 41 105 41S132 16 151 16 181 41 200 41 226 16 245 16C270 14 287 36 279 60C273 78 255 84 255 107C255 128 278 134 277 156C276 179 253 185 253 207C253 228 278 237 277 260C276 282 254 292 254 310C253 334 277 346 279 367C282 390 267 405 246 403C225 402 219 380 196 380C176 380 168 404 149 404C128 404 120 380 102 380C78 380 71 403 53 404C30 405 16 390 20 369C23 348 46 336 45 316C44 294 21 286 21 265C21 244 45 233 45 211C45 189 22 177 22 157C22 134 46 127 46 105C46 83 24 78 21 59C17 34 33 16 56 16Z';

const flourish =
  'M0 0C14 -5 23 -3 27 0S37 9 34 14C31 20 22 18 22 13C22 9 26 8 27 11M5 0C14 -6 20 -14 17 -19C15 -23 9 -20 11 -15M12 -4Q23 -11 33 -5M9 1Q20 5 21 9';
const leafBody =
  'M0 0C-4-11-15-22-15-38C-15-50-12-61-7-68C-4-58 12-50 15-33C18-18 9-7 0 0Z';

function autumnFallback() {
  const leaves = [
    [296, 210, -47, 0.89],
    [277, 248, -25, 0.91],
    [265, 288, -45, 1.02],
    [235, 320, -22, 1.19],
    [252, 360, 24, 1.16],
    [304, 333, 43, 1.2],
    [230, 406, -22, 1.06],
    [276, 413, 54, 1.37],
    [307, 279, 37, 0.9],
  ];
  return `<defs>
    <radialGradient id="wash"><stop stop-color="#eeb185" stop-opacity=".49"/><stop offset="1" stop-color="#f4cbad" stop-opacity="0"/></radialGradient>
    <linearGradient id="leaf" x2="28%" y2="92%"><stop stop-color="#9e390d"/><stop offset=".5" stop-color="#cb641f"/><stop offset="1" stop-color="#edae69"/></linearGradient>
  </defs>
  <ellipse cx="287" cy="14" rx="170" ry="125" fill="url(#wash)"/><ellipse cx="-2" cy="414" rx="125" ry="138" fill="url(#wash)"/>
  <path d="M282 432C278 358 284 305 304 224M282 404Q266 358 234 315M288 350Q275 298 257 274M290 339Q306 321 308 294M287 389Q270 362 257 353M283 418Q249 425 230 405" stroke="#c49966" stroke-width="1.65" fill="none"/>
  ${leaves.map(([x, y, angle, s], index) => `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${s})" opacity="${0.76 + 0.055 * (index % 4)}"><path d="${leafBody}" fill="url(#leaf)"/><path d="M0 0Q-2 -30 -7 -62" fill="none" stroke="#fbc98e" stroke-width=".65" opacity=".68"/></g>`).join('')}`;
}

function mark(url: string | undefined, x: number, y: number, size: number) {
  if (!url) return '';
  return `<image x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" href="${url}"/>`;
}

const typeColor = (accent: string, fallback: string) => {
  const [r, g, b] = accent
    .match(/[0-9a-f]{2}/gi)
    ?.map((x) => parseInt(x, 16)) ?? [0, 0, 0];
  return (299 * r + 587 * g + 114 * b) / 1000 > 184 ? fallback : accent;
};

let autumnRequest: Promise<string> | undefined;
export function loadTableAutumnArt() {
  if (!autumnRequest) {
    autumnRequest = fetch('/images/wedding/table-number/autumn-wash.webp')
      .then((response) => {
        if (!response.ok) throw new Error('Autumn artwork could not be loaded');
        return response.blob();
      })
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') resolve(reader.result);
              else reject(new Error('Unexpected artwork format'));
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          })
      )
      .catch((error) => {
        autumnRequest = undefined;
        throw error;
      });
  }
  return autumnRequest;
}

type ArtOptions = {
  template: string;
  color: string;
  number: number;
  names: string;
  date: string;
  monogramUrl?: string;
  numberPlacement?: TableNumberPlacement;
  autumnArtwork?: string;
};

export function renderIllustratedTableCard(options: ArtOptions) {
  if (
    !Object.prototype.hasOwnProperty.call(
      illustratedTableTemplates,
      options.template
    )
  )
    return '';
  const key = options.template as Illustrated;
  const { paper, ink } = illustratedTableTemplates[key];
  const { monogramUrl: monogram, names, date, autumnArtwork } = options;
  const nameLines = tableNameLines(names);
  const accent = typeColor(options.color, ink);
  const number = String(options.number);
  const base = `<rect width="${normalWidth}" height="${normalHeight}" fill="${paper}"/>`;
  const centered = (content: string) =>
    `<g fill="${accent}" color="${accent}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif">${content}</g>`;
  const numberBlock = (art: string, x: number, y: number) =>
    placeTableNumber(
      art,
      options.numberPlacement,
      normalWidth,
      normalHeight,
      x,
      y
    );
  const printDetails = (
    y: number,
    size: number,
    width: number,
    space = 16,
    extra = ''
  ) =>
    nameLines
      .map((line, index) =>
        liveText(
          line,
          center,
          y - (nameLines.length - 1 - index) * 10,
          nameLines.length > 1 ? Math.min(size, 12) : size,
          width,
          extra
        )
      )
      .join('') + liveText(date, center, y + space, size * 0.8, width, extra);

  if (key === 'porcelain') {
    const frill = waveFrame(33, 60, 234, 319, 15);
    return (
      base +
      `<g fill="none" stroke="#689bc8" stroke-width="1.6" stroke-linecap="round">
      <path d="${frill.path}" stroke-width="1.8"/>
      <g opacity=".7"><ellipse cx="150" cy="220" rx="96" ry="157" stroke-width="2.1"/><ellipse cx="150" cy="220" rx="91" ry="151"/></g>
      <path d="M130 64c9 12 27 14 29 3 1-9-14-10-17-1-3 11 17 11 27-1M130 376c12-9 27-14 29-3 1 9-14 10-17 1-3-11 17-11 27 1" />
      ${frill.samples.map(([x, y, angle], i) => (i % 2 === 0 ? `<path transform="translate(${point(x)} ${point(y)}) rotate(${angle})" d="M-7 1c4-6 12-10 15-5s-6 8-6 3c0-1 1-1 2-1" opacity=".83"/>` : '')).join('')}
    </g>` +
      mark(monogram, center, 107, 42) +
      centered(
        numberBlock(
          outline(number, 'italic', center, 145, 139, 141) +
            outline('table', 'script', center, 298, 25, 78),
          center,
          220
        ) + printDetails(341, 11.5, 130, 13)
      )
    );
  }

  if (key === 'scallop') {
    return (
      base +
      `<path d="${sageField}" fill="#d1e6cb"/>` +
      mark(monogram, center, 59, 43) +
      centered(
        numberBlock(
          outline('Table', 'script', center, monogram ? 91 : 77, 49, 138) +
            outline(number, 'script', center, 150, 130, 159, 'middle', 7),
          center,
          178
        ) + printDetails(337, 18, 202, 18, 'font-style="italic"')
      )
    );
  }

  if (key === 'lace') {
    const outside = waveFrame(31, 40, 238, 340, 19);
    return (
      base +
      `<defs><pattern id="needlework" width="3.5" height="3.5" patternUnits="userSpaceOnUse"><path d="M-1 1L1-1M-1 4.5L4.5-1M2.5 4.5L4.5 2.5M-1 2.5L1 4.5M-1-1L4.5 4.5M2.5-1L4.5 1" stroke="#ffece3" stroke-width=".58" opacity=".93"/></pattern></defs>
      <path d="${outside.path}" fill="#a45b55" stroke="#fff0e3" stroke-width="1.7"/>
      <path d="${outside.path}" fill="url(#needlework)"/>
      <path d="${outside.path}" fill="none" stroke="#721718" stroke-width=".75" stroke-dasharray="1.6 2" transform="translate(5 7) scale(.967)"/>
      <rect x="58" y="65" width="184" height="292" fill="#faf8ee" stroke="#7e2118" stroke-width=".8"/>
      <rect x="54" y="61" width="192" height="300" fill="none" stroke="#fff7e6" stroke-width="1" stroke-dasharray="1 1.6"/>
      ${outside.samples.map(([x, y, angle]) => `<g transform="translate(${point(x)} ${point(y)}) rotate(${angle})" stroke="#fff4e7" stroke-width="1" fill="none"><circle r="8.7" stroke-dasharray="1.1 1.6"/><path d="M0-6Q3-9 4-4Q9-4 6 0Q9 3 4 4Q2 9 0 6Q-4 9-4 4Q-9 3-6 0Q-9-4-4-4Q-2-9 0-6Z" fill="#f9e4d6"/><circle r="1.35" fill="#8d3931" stroke="none"/></g>`).join('')}
    ` +
      mark(monogram, center, 104, 38) +
      centered(
        `<path transform="translate(0 ${monogram ? 17 : 0})" d="M128 131c-12-11-35-5-40 7s9 23 31 21c13-2 24-10 22-15-3-7-17-3-24 1-10 5-14 13-8 18 7 5 21 2 27-5" fill="none" stroke="${accent}" stroke-width=".62" opacity=".72"/>` +
          numberBlock(
            outline('Table', 'script', center, monogram ? 133 : 116, 53, 143) +
              outline(number, 'garamond', center, 204, 75, 119),
            center,
            196
          ) +
          printDetails(309, 13, 162, 16)
      )
    );
  }

  if (key === 'goldArch') {
    return (
      base +
      `<defs><linearGradient id="brass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#a27d42"/><stop offset=".45" stop-color="#d4bc80"/><stop offset=".77" stop-color="#7f612d"/><stop offset="1" stop-color="#c0a46b"/></linearGradient></defs>
      <path d="M28 388V137a122 112 0 0 1 244 0v251Z" fill="none" stroke="url(#brass)" stroke-width="1.5"/>
      <g transform="translate(231 388)" fill="none" stroke="#967843" stroke-width="1.65" stroke-linecap="round"><path d="${flourish}"/></g>` +
      mark(monogram, center, 99, 48) +
      centered(
        numberBlock(
          '<text x="150" y="144" font-size="11" letter-spacing=".7">TABLE</text>' +
            outline(number, 'cormorant', center, 171, 79, 144),
          center,
          190
        ) + printDetails(292, 13, 195, 18)
      )
    );
  }

  return (
    base +
    (autumnArtwork
      ? `<image x="0" y="0" width="300" height="420" preserveAspectRatio="none" href="${autumnArtwork}"/>`
      : autumnFallback()) +
    mark(monogram, 238, 67, 63) +
    `<g fill="${accent}" font-family="Georgia, 'Times New Roman', serif">
      ${numberBlock(
        outline('Table', 'script', 30, 31, 42, 114, 'start') +
          outline(number, 'cormorant', 27, 97, 201, 156, 'start'),
        106,
        162
      )}
      ${names ? liveText('The Wedding of', 30, 353, 10, 150, 'font-family="Arial, sans-serif" font-style="italic" font-weight="bold"') : ''}
       ${nameLines.map((line, index) => liveText(line, 30, 366 + index * 10, 12, 150, 'font-family="Arial, sans-serif" font-style="italic" font-weight="bold"')).join('')}
      ${liveText(date, 30, 385 + Math.max(0, nameLines.length - 2) * 9, 10, 150, 'font-family="Arial, sans-serif" font-style="italic"')}
    </g>`
  );
}
