import { signVariants } from './welcome-sign-collection';
import {
  defaultAppearance,
  type SignAppearance,
} from './welcome-sign-customization';
import { drawReferenceSign } from './welcome-sign-reference';

export const signSizes = {
  '18x24': [18, 24],
  '24x36': [24, 36],
} as const;
export type SignSize = keyof typeof signSizes;
export type SignDetails = { first: string; second: string; date: string };
export const sampleDetails = {
  first: 'Charlotte',
  second: 'Henry',
  date: '2027-06-12',
};
export const signScenes = [
  {
    id: 'chateau',
    name: 'French Château',
    group: 'Classic',
    paper: '#fbfaf4',
    ink: '#334a61',
    accent: '#52738f',
  },
  {
    id: 'meadow',
    name: 'Wildflower Meadow',
    group: 'Garden',
    paper: '#fdfcf7',
    ink: '#464e35',
    accent: '#819166',
  },
  {
    id: 'editorial',
    name: 'The Editorial',
    group: 'Modern',
    paper: '#f6f3ed',
    ink: '#262422',
    accent: '#6f5140',
  },
  {
    id: 'oriental',
    name: 'Double Happiness',
    group: 'Destination',
    paper: '#931d25',
    ink: '#ffedbd',
    accent: '#d7a560',
  },
  {
    id: 'chapel',
    name: 'Chapel Vows',
    group: 'Classic',
    paper: '#626d58',
    ink: '#fff7e5',
    accent: '#d2d0aa',
  },
  {
    id: 'noir',
    name: 'Black Tie',
    group: 'Classic',
    paper: '#171611',
    ink: '#efddaa',
    accent: '#a78c4f',
  },
  {
    id: 'rose',
    name: 'English Rose',
    group: 'Garden',
    paper: '#fffaf5',
    ink: '#82584f',
    accent: '#a06a69',
  },
  {
    id: 'olive',
    name: 'Tuscan Olive',
    group: 'Garden',
    paper: '#fdfcf8',
    ink: '#30352b',
    accent: '#50704a',
  },
  {
    id: 'gallery',
    name: 'Gallery Minimal',
    group: 'Modern',
    paper: '#fffefa',
    ink: '#282928',
    accent: '#282928',
  },
  {
    id: 'ribbon',
    name: 'Velvet Ribbon',
    group: 'Modern',
    paper: '#fff3e3',
    ink: '#6d2832',
    accent: '#a64544',
  },
  {
    id: 'coast',
    name: 'Blue Coast',
    group: 'Destination',
    paper: '#fbf8ee',
    ink: '#40567b',
    accent: '#52739d',
  },
  {
    id: 'desert',
    name: 'Desert Sundown',
    group: 'Destination',
    paper: '#773e24',
    ink: '#673927',
    accent: '#af6f51',
  },
] as const;
export type SignScene = (typeof signScenes)[number];
export type SignTemplate = {
  id: string;
  sceneId: SignScene['id'];
  name: string;
  paper: string;
  ink: string;
  accent: string;
  variation: 0 | 1 | 2;
};

export const signTemplates: readonly SignTemplate[] = signScenes.flatMap(
  (scene): SignTemplate[] => {
    const collection = signVariants[scene.id];
    return [
      {
        ...scene,
        sceneId: scene.id,
        name: collection.signature,
        variation: 0,
      },
      ...collection.alternatives.map((variant, index): SignTemplate => {
        const [paper, ink, accent] = variant.palette;
        return {
          id: `${scene.id}-${variant.slug}`,
          sceneId: scene.id,
          name: variant.title,
          paper,
          ink,
          accent,
          variation: index === 0 ? 1 : 2,
        };
      }),
    ];
  }
);
export const signGroups = [
  'All',
  'Classic',
  'Garden',
  'Modern',
  'Destination',
] as const;

let fontLoad: Promise<unknown> | undefined;
export function loadSignFonts() {
  fontLoad ??= Promise.all(
    [
      ['Sign Garamond', 'cormorant-garamond-common'],
      ['Sign Fraunces Italic', 'fraunces-italic-common'],
      ['Sign Sans', 'dm-sans-common'],
      ['Sign Script', 'allura-welcome-latin'],
      ['Sign Bodoni', 'bodoni-welcome-latin'],
      ['Sign Book', 'eb-garamond-common'],
      ['Sign Classic', 'libre-baskerville-common'],
      ['Sign Cinzel', 'cinzel-common'],
      ['Sign Pinyon', 'welcome-reference/pinyonscript'],
      ['Sign Alex', 'welcome-reference/alexbrush'],
      ['Sign Fine', 'welcome-reference/mrssaintdelafield'],
      ['Sign Hand', 'welcome-reference/ooohbaby'],
    ].map(async ([name, file]) => {
      try {
        const font = await new FontFace(
          name,
          `url(/fonts/wedding/${file}.woff2)`
        ).load();
        document.fonts.add(font);
      } catch {
        // The layout always supplies system fallback fonts.
      }
    })
  );
  return fontLoad;
}

export function formatSignDate(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(value.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(value);
}

const artFiles = {
  wreath: 'reference-wreath',
  meadow: 'meadow-watercolor',
  rose: 'rose-watercolor',
  olive: 'olive-watercolor',
  toile: 'reference-toile',
  coast: 'coast-toile',
  ribbon: 'reference-ribbon',
  gold: 'reference-gold-flowers',
} as const;
export type SignArtwork = keyof typeof artFiles;
const artByScene: Partial<Record<SignScene['id'], readonly SignArtwork[]>> = {
  meadow: ['wreath', 'meadow'],
  rose: ['rose'],
  olive: ['olive'],
  ribbon: ['ribbon'],
  oriental: ['gold'],
};
const artwork = new Map<SignArtwork, HTMLImageElement>();
const pending = new Map<SignArtwork, Promise<void>>();

function loadArt(id: SignArtwork) {
  const cached = pending.get(id);
  if (cached) return cached;
  const image = new Image();
  image.src = `/images/wedding/welcome-sign/artwork/${artFiles[id]}.webp`;
  const loading = image
    .decode()
    .then(() => {
      artwork.set(id, image);
    })
    .catch((error: unknown) => {
      pending.delete(id);
      throw error;
    });
  pending.set(id, loading);
  return loading;
}

function loadSignArtwork(template: SignTemplate) {
  return Promise.all(
    template.sceneId === 'coast'
      ? [loadArt(template.variation === 2 ? 'coast' : 'toile')]
      : (artByScene[template.sceneId] ?? []).map(loadArt)
  );
}

export async function loadSignResources(template: SignTemplate) {
  await Promise.all([loadSignFonts(), loadSignArtwork(template)]);
}

export async function makeSignOrnamentPlate(
  template: SignTemplate,
  appearance: SignAppearance
) {
  await loadSignArtwork(template);
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 1260;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Ornament preview is unavailable');
  try {
    ctx.scale(1.5, 1.4);
    drawReferenceSign(
      ctx,
      template,
      { first: '', second: '', date: '' },
      900,
      '',
      artwork,
      appearance,
      true
    );
    return canvas.toDataURL('image/webp', 0.94);
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}

export function drawSign(
  ctx: CanvasRenderingContext2D,
  template: SignTemplate,
  details: SignDetails,
  size: SignSize,
  width: number,
  offset = 0,
  appearance: SignAppearance = defaultAppearance,
  monogram?: HTMLImageElement
) {
  const [inW, inH] = signSizes[size];
  ctx.save();
  ctx.translate(0, -offset);
  ctx.scale(width / 600, width / 600);
  drawReferenceSign(
    ctx,
    template,
    details,
    (600 * inH) / inW,
    formatSignDate(details.date),
    artwork,
    appearance,
    false,
    monogram
  );
  ctx.restore();
}
