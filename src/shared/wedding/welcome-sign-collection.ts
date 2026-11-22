export type SignVariant = {
  slug: string;
  title: string;
  palette: readonly [paper: string, ink: string, accent: string];
};

export const signVariants = {
  chateau: {
    signature: 'Château Classic',
    alternatives: [
      {
        slug: 'estate-crest',
        title: 'Estate Crest',
        palette: ['#e5e8d7', '#354335', '#75815d'],
      },
      {
        slug: 'gilded-vows',
        title: 'Gilded Vows',
        palette: ['#4b4137', '#fff4db', '#d1ad73'],
      },
    ],
  },
  meadow: {
    signature: 'Summer Meadow',
    alternatives: [
      {
        slug: 'pressed-blooms',
        title: 'Pressed Blooms',
        palette: ['#f7edf1', '#523c51', '#b288a0'],
      },
      {
        slug: 'field-notes',
        title: 'Field Notes',
        palette: ['#fff3d8', '#4f3c2a', '#9a5e39'],
      },
    ],
  },
  editorial: {
    signature: 'Wedding Editorial',
    alternatives: [
      {
        slug: 'cover-story',
        title: 'Cover Story',
        palette: ['#25242a', '#faf2ec', '#dbaa9c'],
      },
      {
        slug: 'the-column',
        title: 'The Column',
        palette: ['#eee6dc', '#3c3435', '#9a433c'],
      },
    ],
  },
  oriental: {
    signature: 'Red Lacquer',
    alternatives: [
      {
        slug: 'silk-invitation',
        title: 'Silk Invitation',
        palette: ['#fbefd7', '#7c211c', '#b53a2c'],
      },
      {
        slug: 'golden-vow',
        title: 'Golden Vow',
        palette: ['#4b171d', '#fae4bb', '#d4aa73'],
      },
    ],
  },
  chapel: {
    signature: 'Chapel Arch',
    alternatives: [
      {
        slug: 'ivory-arch',
        title: 'Ivory Arch',
        palette: ['#e3dccb', '#42362e', '#8f7660'],
      },
      {
        slug: 'evening-vows',
        title: 'Evening Vows',
        palette: ['#283c4a', '#f8e8cb', '#b7b79f'],
      },
    ],
  },
  noir: {
    signature: 'Black Tie',
    alternatives: [
      {
        slug: 'champagne-deco',
        title: 'Champagne Deco',
        palette: ['#f9ebd5', '#493228', '#9c6d3d'],
      },
      {
        slug: 'midnight-reception',
        title: 'Midnight Reception',
        palette: ['#1e2a3a', '#ffeccd', '#c5a27c'],
      },
    ],
  },
  rose: {
    signature: 'Wine & Roses',
    alternatives: [
      {
        slug: 'petal-poetry',
        title: 'Petal Poetry',
        palette: ['#fdf3ee', '#652d41', '#a35b73'],
      },
      {
        slug: 'rose-letterpress',
        title: 'Rose Letterpress',
        palette: ['#eedadc', '#58313c', '#986471'],
      },
    ],
  },
  olive: {
    signature: 'Tuscan Olive',
    alternatives: [
      {
        slug: 'olive-press',
        title: 'Olive Press',
        palette: ['#e5e7d4', '#333f32', '#646e44'],
      },
      {
        slug: 'terrace-script',
        title: 'Terrace Script',
        palette: ['#f4ebd7', '#525030', '#7d7544'],
      },
    ],
  },
  gallery: {
    signature: 'Gallery Type',
    alternatives: [
      {
        slug: 'museum-label',
        title: 'Museum Label',
        palette: ['#2b292c', '#f5eee4', '#c5afa1'],
      },
      {
        slug: 'letterpress-ivory',
        title: 'Letterpress Ivory',
        palette: ['#f7f3e9', '#343233', '#9f7a64'],
      },
    ],
  },
  ribbon: {
    signature: 'Velvet Script',
    alternatives: [
      {
        slug: 'sugar-stripe',
        title: 'Sugar Stripe',
        palette: ['#fae6d6', '#76253c', '#b95164'],
      },
      {
        slug: 'wine-ribbon',
        title: 'Wine Ribbon',
        palette: ['#582b44', '#fff0dd', '#e3a9ae'],
      },
    ],
  },
  coast: {
    signature: 'Coastal Toile',
    alternatives: [
      {
        slug: 'porcelain-script',
        title: 'Porcelain Script',
        palette: ['#fcf4e6', '#244c72', '#5077a3'],
      },
      {
        slug: 'blue-hour',
        title: 'Blue Hour',
        palette: ['#dee7ed', '#203d5f', '#57779f'],
      },
    ],
  },
  desert: {
    signature: 'Desert Horizon',
    alternatives: [
      {
        slug: 'mesa-arch',
        title: 'Mesa Arch',
        palette: ['#f5d4b2', '#682e26', '#a0543d'],
      },
      {
        slug: 'golden-hour',
        title: 'Golden Hour',
        palette: ['#9b523c', '#fff0d6', '#f0be8d'],
      },
    ],
  },
} as const satisfies Record<
  string,
  {
    signature: string;
    alternatives: readonly [SignVariant, SignVariant];
  }
>;
