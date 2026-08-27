/**
 * Wedding Crest Studio domain types.
 *
 * Pure, isomorphic data: this module is imported by the server APIs, the
 * prompt compiler and the client wizard, so it must stay
 * free of any server-only dependency.
 */

export type WeddingStyleId =
  | 'botanical_watercolor'
  | 'minimal_line_art'
  | 'vintage_engraving'
  | 'italian_romance'
  | 'coastal'
  | 'classic_luxury';

export type WeddingLayoutShape = 'wreath' | 'oval' | 'arch' | 'open';

export interface WeddingLayoutTextSlot {
  x: number;
  y: number;
}

export interface WeddingLayout {
  id: string;
  /** Style ids this layout template is bound to. */
  styleIds: WeddingStyleId[];
  /** User facing composition family. */
  shape: WeddingLayoutShape;
  /** Composition hint injected into the illustration prompt. */
  composition: string;
  /** Center text slots on the 1000x1000 master canvas. */
  initials: WeddingLayoutTextSlot;
  names: WeddingLayoutTextSlot;
  date: WeddingLayoutTextSlot;
}

export interface WeddingStyle {
  id: WeddingStyleId;
  name: string;
  tagline: string;
  description: string;
  medium: string;
  aesthetic: string[];
  forbidden: string[];
  /** Layout ids this style supports (2-3 per style). */
  layouts: string[];
  /** Typography pairing ids recommended for this style. */
  typography: string[];
  /** Accent color used for style cards and previews. */
  previewColor: string;
}

export interface WeddingTypographyPairing {
  id: string;
  name: string;
  description: string;
  /**
   * Lettering style description sent verbatim to the image model when
   * the AI renders the couple's inscriptions into the crest artwork.
   * Describes the *look* of the lettering (e.g. "classical Roman
   * capital engraving") rather than font file names.
   */
  prompt: string;
  initialsFont: WeddingFontSpec;
  namesFont: WeddingFontSpec;
  dateFont: WeddingFontSpec;
}

export interface WeddingFontSpec {
  family: string;
  weight?: number;
  italic?: boolean;
  letterSpacing?: number;
  uppercase?: boolean;
}

export interface WeddingPalette {
  id: string;
  name: string;
  colors: [string, string, string];
}

export type WeddingNameDisplay =
  | 'initials_amp'
  | 'initials_joined'
  | 'initials_spaced'
  | 'initials_with_names'
  | 'full_names'
  | 'surname'
  | 'initials_only';

export type WeddingComplexity = 'minimal' | 'medium' | 'rich';

/**
 * Per-property flags the user can flip to "use the example reference image
 * instead of a concrete value" for that attribute. The four booleans map
 * 1:1 to the wizard steps that surface a "Same as example" option.
 * When a flag is true the prompt compiler omits the concrete value for
 * that property and instead instructs the multimodal model to match the
 * example image. Palette and typography are sent directly to the image model.
 */
export interface WeddingMatchExampleFlags {
  border: boolean;
  palette: boolean;
  flowers: boolean;
  elements: boolean;
}

/** Normalized project input consumed by the AI prompt compiler. */
export interface WeddingProjectInput {
  partner1: string;
  partner2: string;
  initials: string[];
  weddingDate?: string | null;
  style: WeddingStyleId | string;
  layout: string;
  typography: string;
  palette: string[];
  location?: string | null;
  venue?: string | null;
  flowers: string[];
  personalElements: string[];
  /** URLs of user-uploaded reference photos whose main subject should be
   *  incorporated into the generated crest. Drives auto model selection
   *  to a multimodal provider (e.g. google:nano-banana@2-lite on Runware). */
  personalImages?: string[];
  complexity: WeddingComplexity | string;
  nameDisplay: WeddingNameDisplay;
  showDate: boolean;
  /** Optional id of a `wedding_frame` row used as an AI reference image. */
  frameId?: string | null;
  /** Resolved frame asset URL forwarded to the multimodal image model. */
  frameUrl?: string | null;
  /** URL of the `wedding_example` reference image the user came in with
   *  (hydrated server-side from the `example_image` element). When set,
   *  the generate route forwards it to the multimodal model as the first
   *  reference image so flagged properties can match it. */
  exampleImage?: string | null;
  /** The example reference's own style id, captured when the user
   *  arrived from the Examples library. The prompt compiler uses this
   *  to detect "user kept the example's style" vs "user switched to a
   *  different style" - the latter needs an explicit override line. */
  exampleStyle?: string | null;
  /** Per-property "match the example image" flags. Each property with
   *  flag=true tells the prompt compiler to use "match the reference
   *  example image" phrasing instead of the concrete value. */
  matchExample?: WeddingMatchExampleFlags | null;
}

export interface WeddingPromptRequest extends WeddingProjectInput {
  styleVersion?: string;
  promptVersion?: string;
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                      */
/* -------------------------------------------------------------------------- */

export const weddingStyles: WeddingStyle[] = [
  {
    id: 'botanical_watercolor',
    name: 'Botanical Watercolor',
    tagline: 'Soft · Romantic · Natural',
    description:
      'Delicate hand-painted florals for garden weddings and romantic celebrations.',
    medium: 'delicate hand-painted watercolor',
    aesthetic: ['luxury wedding stationery', 'editorial', 'romantic'],
    forbidden: [
      '3d rendering',
      'cartoon style',
      'clip art',
      'neon colors',
      'busy background',
    ],
    layouts: ['BOTANICAL_OVAL_01', 'BOTANICAL_OPEN_01'],
    typography: ['editorial_rose', 'romantic_script', 'editorial_italic'],
    previewColor: '#A3AA91',
  },
  {
    id: 'minimal_line_art',
    name: 'Minimal Line Art',
    tagline: 'Modern · Clean · Effortless',
    description:
      'Single-line elegance for modern city weddings and minimalist taste.',
    medium: 'refined single-line ink drawing',
    aesthetic: ['modern', 'minimal', 'architectural'],
    forbidden: [
      'watercolor',
      'shading',
      'cartoon style',
      'clip art',
      'busy background',
    ],
    layouts: ['MINIMAL_CIRCLE_01', 'MINIMAL_ARCH_01'],
    typography: ['modern_serif', 'minimal_sans', 'editorial_italic'],
    previewColor: '#8A8F8C',
  },
  {
    id: 'vintage_engraving',
    name: 'Vintage Engraving',
    tagline: 'Timeless · Heirloom · Estate',
    description:
      'Engraved crest detail for estate weddings and European traditions.',
    medium: 'classic copperplate engraving',
    aesthetic: ['heirloom', 'estate', 'european classic'],
    forbidden: [
      'watercolor',
      'gradient',
      'cartoon style',
      'clip art',
      'busy background',
    ],
    layouts: ['VINTAGE_SHIELD_01', 'VINTAGE_OVAL_01'],
    typography: ['vintage_engraving', 'classic_caps', 'editorial_rose'],
    previewColor: '#6B5B4E',
  },
  {
    id: 'italian_romance',
    name: 'Italian Romance',
    tagline: 'Lake Como · Villa · Golden',
    description:
      'Warm villa romance inspired by Lake Como and Tuscan celebrations.',
    medium: 'soft expressive gouache painting',
    aesthetic: ['italian villa', 'golden hour', 'romantic'],
    forbidden: [
      '3d rendering',
      'cartoon style',
      'clip art',
      'neon colors',
      'busy background',
    ],
    layouts: ['ITALIAN_ARCH_01', 'ITALIAN_OVAL_01'],
    typography: ['romantic_script', 'editorial_italic', 'editorial_rose'],
    previewColor: '#B79A6B',
  },
  {
    id: 'coastal',
    name: 'Coastal',
    tagline: 'Breezy · Seaside · Sun-washed',
    description:
      'Sun-washed seaside elements for beach and destination weddings.',
    medium: 'airy watercolor with fine ink accents',
    aesthetic: ['seaside', 'destination wedding', 'sun-washed'],
    forbidden: [
      '3d rendering',
      'cartoon style',
      'clip art',
      'heavy shadows',
      'busy background',
    ],
    layouts: ['COASTAL_OPEN_01', 'COASTAL_CIRCLE_01'],
    typography: ['coastal_light', 'minimal_sans', 'romantic_script'],
    previewColor: '#8FA8B8',
  },
  {
    id: 'classic_luxury',
    name: 'Classic Luxury',
    tagline: 'Black Tie · Ballroom · Refined',
    description:
      'Deep refined luxury for black-tie, hotel and ballroom weddings.',
    medium: 'rich classical oil-painted detail',
    aesthetic: ['black tie', 'ballroom', 'refined luxury'],
    forbidden: [
      'watercolor',
      'cartoon style',
      'clip art',
      'neon colors',
      'busy background',
    ],
    layouts: ['LUXURY_OVAL_01', 'LUXURY_SHIELD_01'],
    typography: ['classic_caps', 'vintage_engraving', 'modern_serif'],
    previewColor: '#4A4E69',
  },
];

/**
 * Curated categories used by the Examples library. Mirrors the six
 * generator styles so admin can attach an example image to any style
 * shown in the Find Your Style home section.
 */
export const weddingExampleStyles = [
  { id: 'botanical_watercolor', name: 'Botanical Watercolor' },
  { id: 'minimal_line_art', name: 'Minimal Line Art' },
  { id: 'vintage_engraving', name: 'Vintage Engraving' },
  { id: 'italian_romance', name: 'Italian Romance' },
  { id: 'coastal', name: 'Coastal' },
  { id: 'classic_luxury', name: 'Classic Luxury' },
] as const;

export type WeddingExampleStyleId = (typeof weddingExampleStyles)[number]['id'];
export const weddingExampleStyleIds = weddingExampleStyles.map(
  (style) => style.id
);

export function isWeddingExampleStyle(
  style: string
): style is WeddingExampleStyleId {
  return weddingExampleStyleIds.includes(style as WeddingExampleStyleId);
}

/* -------------------------------------------------------------------------- */
/* Layouts - 12 fixed composition templates                                    */
/* -------------------------------------------------------------------------- */

export const weddingLayouts: WeddingLayout[] = [
  {
    id: 'BOTANICAL_OVAL_01',
    styleIds: ['botanical_watercolor'],
    shape: 'oval',
    composition:
      'symmetrical oval arrangement with generous negative space in the center',
    initials: { x: 500, y: 460 },
    names: { x: 500, y: 590 },
    date: { x: 500, y: 645 },
  },
  {
    id: 'BOTANICAL_OPEN_01',
    styleIds: ['botanical_watercolor'],
    shape: 'open',
    composition:
      'open botanical arrangement without a closed border, generous negative space in the center',
    initials: { x: 500, y: 440 },
    names: { x: 500, y: 575 },
    date: { x: 500, y: 630 },
  },
  {
    id: 'MINIMAL_CIRCLE_01',
    styleIds: ['minimal_line_art'],
    shape: 'wreath',
    composition:
      'thin circular line frame with minimal elements, large empty center',
    initials: { x: 500, y: 470 },
    names: { x: 500, y: 600 },
    date: { x: 500, y: 655 },
  },
  {
    id: 'MINIMAL_ARCH_01',
    styleIds: ['minimal_line_art'],
    shape: 'arch',
    composition:
      'elegant architectural arch frame with minimal elements, large empty center',
    initials: { x: 500, y: 500 },
    names: { x: 500, y: 630 },
    date: { x: 500, y: 685 },
  },
  {
    id: 'VINTAGE_SHIELD_01',
    styleIds: ['vintage_engraving'],
    shape: 'arch',
    composition:
      'classic heraldic shield frame with engraved detail, empty center',
    initials: { x: 500, y: 480 },
    names: { x: 500, y: 610 },
    date: { x: 500, y: 665 },
  },
  {
    id: 'VINTAGE_OVAL_01',
    styleIds: ['vintage_engraving'],
    shape: 'oval',
    composition:
      'classical oval engraved frame with laurel detail, empty center',
    initials: { x: 500, y: 460 },
    names: { x: 500, y: 590 },
    date: { x: 500, y: 645 },
  },
  {
    id: 'ITALIAN_ARCH_01',
    styleIds: ['italian_romance'],
    shape: 'arch',
    composition:
      'romantic Italian villa arch with soft florals, generous empty center',
    initials: { x: 500, y: 500 },
    names: { x: 500, y: 630 },
    date: { x: 500, y: 685 },
  },
  {
    id: 'ITALIAN_OVAL_01',
    styleIds: ['italian_romance'],
    shape: 'oval',
    composition:
      'symmetrical oval arrangement of villa florals, generous empty center',
    initials: { x: 500, y: 460 },
    names: { x: 500, y: 590 },
    date: { x: 500, y: 645 },
  },
  {
    id: 'COASTAL_OPEN_01',
    styleIds: ['coastal'],
    shape: 'open',
    composition:
      'open breezy seaside composition without a closed border, generous empty center',
    initials: { x: 500, y: 440 },
    names: { x: 500, y: 575 },
    date: { x: 500, y: 630 },
  },
  {
    id: 'COASTAL_CIRCLE_01',
    styleIds: ['coastal'],
    shape: 'wreath',
    composition: 'circular seaside wreath arrangement, large empty center',
    initials: { x: 500, y: 470 },
    names: { x: 500, y: 600 },
    date: { x: 500, y: 655 },
  },
  {
    id: 'LUXURY_OVAL_01',
    styleIds: ['classic_luxury'],
    shape: 'oval',
    composition:
      'symmetrical oval arrangement of rich classical elements, generous empty center',
    initials: { x: 500, y: 460 },
    names: { x: 500, y: 590 },
    date: { x: 500, y: 645 },
  },
  {
    id: 'LUXURY_SHIELD_01',
    styleIds: ['classic_luxury'],
    shape: 'arch',
    composition:
      'refined heraldic shield arrangement of rich classical elements, empty center',
    initials: { x: 500, y: 480 },
    names: { x: 500, y: 610 },
    date: { x: 500, y: 665 },
  },
];

/** User-facing composition choices (spec: Wreath / Oval / Arch / Open). */
export const weddingCompositionChoices: {
  shape: WeddingLayoutShape;
  title: string;
  description: string;
}[] = [
  {
    shape: 'wreath',
    title: 'Wreath',
    description: 'A circular embrace of florals and greenery.',
  },
  {
    shape: 'oval',
    title: 'Oval',
    description: 'A classic oval frame with soft symmetry.',
  },
  {
    shape: 'arch',
    title: 'Arch',
    description: 'An architectural arch or shield silhouette.',
  },
  {
    shape: 'open',
    title: 'Open',
    description: 'No closed border - florals flow freely.',
  },
];

/* -------------------------------------------------------------------------- */
/* Typography - 8 fixed font pairings                                          */
/* -------------------------------------------------------------------------- */

export const weddingTypography: WeddingTypographyPairing[] = [
  {
    id: 'editorial_rose',
    name: 'Editorial Rose',
    description: 'Elegant serif initials with classic supporting text.',
    prompt:
      'elegant high-contrast serif lettering with refined editorial grace (in the spirit of Cormorant Garamond)',
    initialsFont: {
      family: 'Cormorant Garamond',
      weight: 500,
      letterSpacing: 6,
    },
    namesFont: { family: 'EB Garamond', weight: 500, letterSpacing: 2 },
    dateFont: {
      family: 'EB Garamond',
      weight: 400,
      letterSpacing: 4,
      uppercase: true,
    },
  },
  {
    id: 'classic_caps',
    name: 'Classic Capitals',
    description: 'Roman capitals with small-caps detail.',
    prompt:
      'classical engraved Roman capital lettering (in the spirit of Trajan and Cinzel), timeless and formal',
    initialsFont: { family: 'Cinzel', weight: 500, letterSpacing: 8 },
    namesFont: { family: 'Libre Baskerville', weight: 400, letterSpacing: 2 },
    dateFont: {
      family: 'Cinzel',
      weight: 400,
      letterSpacing: 5,
      uppercase: true,
    },
  },
  {
    id: 'modern_serif',
    name: 'Modern Serif',
    description: 'Contemporary serif balanced by a clean sans.',
    prompt:
      'contemporary serif lettering with a soft, slightly quirky character (in the spirit of Fraunces), balanced and modern',
    initialsFont: { family: 'Fraunces', weight: 500, letterSpacing: 4 },
    namesFont: { family: 'DM Sans', weight: 400, letterSpacing: 2 },
    dateFont: {
      family: 'DM Sans',
      weight: 400,
      letterSpacing: 4,
      uppercase: true,
    },
  },
  {
    id: 'editorial_italic',
    name: 'Editorial Italic',
    description: 'Magazine-style italic with airy captions.',
    prompt:
      'graceful italic serif lettering with an airy magazine feel (in the spirit of EB Garamond italic)',
    initialsFont: {
      family: 'EB Garamond',
      weight: 500,
      italic: true,
      letterSpacing: 5,
    },
    namesFont: { family: 'Source Sans 3', weight: 400, letterSpacing: 2 },
    dateFont: {
      family: 'Source Sans 3',
      weight: 400,
      letterSpacing: 4,
      uppercase: true,
    },
  },
  {
    id: 'romantic_script',
    name: 'Romantic Script',
    description: 'Softly romantic serif with delicate spacing.',
    prompt:
      'softly romantic italic serif lettering with delicate flowing strokes (in the spirit of Cormorant Garamond italic)',
    initialsFont: {
      family: 'Cormorant Garamond',
      weight: 500,
      italic: true,
      letterSpacing: 7,
    },
    namesFont: { family: 'Cormorant Garamond', weight: 500, letterSpacing: 3 },
    dateFont: {
      family: 'Cormorant Garamond',
      weight: 400,
      letterSpacing: 4,
      uppercase: true,
    },
  },
  {
    id: 'minimal_sans',
    name: 'Minimal Sans',
    description: 'Understated modern sans throughout.',
    prompt:
      'clean minimal sans-serif lettering with generous letter spacing (in the spirit of Manrope)',
    initialsFont: { family: 'Manrope', weight: 500, letterSpacing: 10 },
    namesFont: { family: 'Manrope', weight: 400, letterSpacing: 3 },
    dateFont: {
      family: 'Manrope',
      weight: 400,
      letterSpacing: 5,
      uppercase: true,
    },
  },
  {
    id: 'vintage_engraving',
    name: 'Vintage Engraving',
    description: 'Engraved capitals with old-style serif text.',
    prompt:
      'vintage engraved capital lettering with old-style serif details (in the spirit of Cinzel), heirloom quality',
    initialsFont: { family: 'Cinzel', weight: 400, letterSpacing: 10 },
    namesFont: {
      family: 'EB Garamond',
      weight: 400,
      italic: true,
      letterSpacing: 2,
    },
    dateFont: {
      family: 'Cinzel',
      weight: 400,
      letterSpacing: 6,
      uppercase: true,
    },
  },
  {
    id: 'coastal_light',
    name: 'Coastal Light',
    description: 'Light airy sans with a serif accent.',
    prompt:
      'light, airy sans-serif lettering (in the spirit of Source Sans Light), breezy and understated',
    initialsFont: { family: 'Source Sans 3', weight: 300, letterSpacing: 9 },
    namesFont: { family: 'Cormorant Garamond', weight: 500, letterSpacing: 2 },
    dateFont: {
      family: 'Source Sans 3',
      weight: 400,
      letterSpacing: 5,
      uppercase: true,
    },
  },
];

/* -------------------------------------------------------------------------- */
/* Palettes                                                                    */
/* -------------------------------------------------------------------------- */

export const weddingPalettes: WeddingPalette[] = [
  {
    id: 'sage_ivory',
    name: 'Sage & Ivory',
    colors: ['#A3AA91', '#F5F0E6', '#D8CDBA'],
  },
  {
    id: 'dusty_blue',
    name: 'Dusty Blue',
    colors: ['#8FA8B8', '#F4F1EA', '#C7D3D9'],
  },
  {
    id: 'blush_rose',
    name: 'Blush Rose',
    colors: ['#D4A9A0', '#F9F4F0', '#E5CDC5'],
  },
  {
    id: 'olive',
    name: 'Olive',
    colors: ['#7C7A54', '#F3EFE3', '#B9B48D'],
  },
  {
    id: 'burgundy',
    name: 'Burgundy',
    colors: ['#6E3B47', '#F5EFE8', '#B08A8E'],
  },
  {
    id: 'navy',
    name: 'Navy',
    colors: ['#33415C', '#F4F2EC', '#8D99AE'],
  },
  {
    id: 'black_ivory',
    name: 'Black & Ivory',
    colors: ['#2B2B2B', '#F7F4EE', '#A6A29A'],
  },
];

/* -------------------------------------------------------------------------- */
/* Wizard option chips                                                         */
/* -------------------------------------------------------------------------- */

export const weddingFlowerOptions = [
  'Rose',
  'Peony',
  'Lily',
  'Olive Branch',
  'Hydrangea',
  'Tulip',
  'Wildflower',
];

export const weddingPersonalElementOptions = [
  'Dog',
  'Cat',
  'Mountains',
  'Ocean',
  'Wine',
  'Travel',
  'Moon',
  'Stars',
  'Bird',
  'Butterfly',
  'Home',
];

export const weddingNameDisplayOptions: {
  value: WeddingNameDisplay;
  title: string;
  example: string;
}[] = [
  { value: 'initials_amp', title: 'E & J', example: 'Emma & James -> E & J' },
  { value: 'initials_joined', title: 'EJ', example: 'Emma & James -> EJ' },
  { value: 'initials_spaced', title: 'E J', example: 'Emma & James -> E J' },
  {
    value: 'initials_with_names',
    title: 'E & J + names',
    example: 'Initials on top, full names below',
  },
  {
    value: 'full_names',
    title: 'Emma & James',
    example: 'Show both full names',
  },
  { value: 'surname', title: 'The Millers', example: 'Share one surname' },
];

export const WEDDING_MAX_FLOWERS = 3;
export const WEDDING_MAX_PERSONAL_ELEMENTS = 2;
export const WEDDING_MAX_PALETTE_COLORS = 3;
