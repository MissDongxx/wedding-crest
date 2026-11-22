import type { SignScene, SignTemplate } from './welcome-sign';

export const nameFontOptions = [
  { value: 'template', label: 'Template font' },
  { value: 'serif', label: 'Classic Serif' },
  { value: 'sans', label: 'Modern Sans' },
  { value: 'pinyon', label: 'Fine Script' },
] as const;
export type NameFont = (typeof nameFontOptions)[number]['value'];
export type SignPaletteId = 'template' | 'light' | 'deep';
export type SignAppearance = { nameFont: NameFont; palette: SignPaletteId };
export const defaultAppearance: SignAppearance = {
  nameFont: 'template',
  palette: 'template',
};

type Preset = readonly [
  label: string,
  paper: string,
  ink: string,
  accent: string,
  panel?: string,
];
const presets: Record<SignScene['id'], readonly [Preset, Preset]> = {
  chateau: [
    ['Parchment & Ink', '#f1e6d1', '#593b2d', '#845941'],
    ['Midnight Blue', '#22354c', '#fcf3dc', '#d0af77'],
  ],
  meadow: [
    ['Peach Linen', '#fdf0df', '#534031', '#8d5862'],
    ['Deep Garden', '#283d34', '#fff5da', '#d8b57e'],
  ],
  editorial: [
    ['Warm Newsprint', '#f4e3cf', '#342924', '#854633'],
    ['Merlot Ink', '#42272e', '#fbede3', '#e2b29a'],
  ],
  oriental: [
    ['Ivory & Vermilion', '#fff1d3', '#842e31', '#9f3836'],
    ['Aubergine & Gold', '#3f233d', '#fee5ad', '#edbb77'],
  ],
  chapel: [
    ['Stone & Olive', '#f0eadd', '#3c4136', '#7a7f65'],
    ['Forest & Linen', '#29463b', '#fff5dc', '#c5c793'],
  ],
  noir: [
    ['Champagne & Bronze', '#f7ebd7', '#4b3729', '#966840'],
    ['Onyx & Silver', '#242531', '#f4f3fa', '#babfcd'],
  ],
  rose: [
    ['Petal & Plum', '#f9e5e4', '#5f354b', '#8f526c'],
    ['Mulberry', '#472539', '#fff1e0', '#e2a6b4'],
  ],
  olive: [
    ['Sage & Stone', '#eef0e2', '#384639', '#637452'],
    ['Evergreen', '#263b2f', '#faf0da', '#cad598'],
  ],
  gallery: [
    ['Ivory & Graphite', '#f3e8d8', '#302d31', '#72635d'],
    ['Ink & Cream', '#2c2830', '#fff4df', '#d1b59d'],
  ],
  ribbon: [
    ['Peony & Wine', '#f9e3e4', '#742943', '#ac486b'],
    ['Berry & Brass', '#492b43', '#fff2dd', '#e0ac86'],
  ],
  coast: [
    ['Sea Glass', '#ebf1ed', '#294560', '#517695'],
    ['Night Tide', '#263d57', '#fff4db', '#a8c7ea'],
  ],
  desert: [
    ['Sandstone', '#c28f70', '#66402f', '#a87156', '#fff0d1'],
    ['Canyon Clay', '#753a3e', '#542e38', '#944b55', '#f5d9c7'],
  ],
};

export function signPaletteOptions(template: SignTemplate) {
  const [light, deep] = presets[template.sceneId];
  return [
    {
      id: 'template',
      label: 'Template colors',
      paper: template.paper,
      ink: template.ink,
      accent: template.accent,
      panel: undefined,
    },
    ...(
      [
        ['light', light],
        ['deep', deep],
      ] as const
    ).map(([id, [label, paper, ink, accent, panel]]) => ({
      id,
      label,
      paper,
      ink,
      accent,
      panel,
    })),
  ] as const;
}

export function signPalette(template: SignTemplate, id: SignPaletteId) {
  const options = signPaletteOptions(template);
  return options.find((option) => option.id === id) ?? options[0];
}
