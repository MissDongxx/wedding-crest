import { monogramLayoutChoices, type MonogramOptions } from './monogram-maker';

type StyleDesign = Pick<
  MonogramOptions,
  'font' | 'frame' | 'wreath' | 'embellishment' | 'ink' | 'spacing'
>;
type Palette = 'ink_charcoal' | 'ink_wine' | 'ink_moss' | 'ink_blue';

export const monogramStyles = {
  editorial: {
    layout: 'diagonal',
    palette: 'ink_charcoal',
    paper: '#f4efe6',
    design: {
      font: 'cormorant',
      frame: 'none',
      wreath: 'none',
      embellishment: 'none',
      spacing: 6,
      ink: '#262722',
    },
  },
  signature: {
    layout: 'diagonal',
    palette: 'ink_moss',
    paper: '#f6f2e6',
    design: {
      font: 'pinyon',
      frame: 'cameo',
      wreath: 'none',
      embellishment: 'none',
      spacing: 16,
      ink: '#49513b',
    },
  },
  scallop: {
    layout: 'overlap',
    palette: 'ink_wine',
    paper: '#f2e6df',
    design: {
      font: 'frauncesItalic',
      frame: 'scalloped',
      wreath: 'none',
      embellishment: 'none',
      spacing: 74,
      ink: '#773843',
    },
  },
  laurel: {
    layout: 'overlap',
    palette: 'ink_blue',
    paper: '#e9ede7',
    design: {
      font: 'cinzel',
      frame: 'cameo',
      wreath: 'engravedLaurel',
      embellishment: 'none',
      spacing: 77,
      ink: '#415449',
    },
  },
  engraved: {
    layout: 'diagonal',
    palette: 'ink_wine',
    paper: '#eee7e2',
    design: {
      font: 'greatVibes',
      frame: 'ornateOval',
      wreath: 'none',
      embellishment: 'none',
      spacing: 9,
      ink: '#61404b',
    },
  },
} as const satisfies Record<
  string,
  {
    layout: keyof typeof monogramLayoutChoices;
    palette: Palette;
    paper: string;
    design: StyleDesign;
  }
>;

export type MonogramStyle = keyof typeof monogramStyles;
export const monogramStyleIds = Object.keys(monogramStyles) as MonogramStyle[];
export const defaultMonogramStyle: MonogramStyle = 'editorial';

export function monogramStyleOptions(
  style: MonogramStyle,
  initials: string
): MonogramOptions {
  const { layout, design } = monogramStyles[style];
  return { initials, ...monogramLayoutChoices[layout], ...design };
}

export function currentMonogramStyle(options: MonogramOptions) {
  return monogramStyleIds.find((style) => {
    const preset = monogramStyleOptions(style, options.initials);
    return (
      options.font === preset.font &&
      options.layout === preset.layout &&
      options.frame === preset.frame &&
      options.wreath === preset.wreath &&
      options.embellishment === preset.embellishment
    );
  });
}
