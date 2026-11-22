import type { SignScene, SignTemplate } from './welcome-sign';

export const signImageRoot = '/images/wedding/welcome-sign';
export const signShareImage = {
  path: `${signImageRoot}/wedding-welcome-sign-maker-share.jpg`,
  width: 1200,
  height: 630,
  alt: 'Wedding welcome sign maker with illustrated floral, elegant script and red-and-gold templates',
} as const;

const description: Record<
  SignScene['id'],
  { scene: string; boards: readonly [string, string, string] }
> = {
  chateau: {
    scene: 'on an easel in a French château courtyard',
    boards: [
      'Ivory wedding welcome sign with a blue hand-drawn border, chandelier and script names',
      'Sage wedding welcome sign with a leafy crest and couple’s initials',
      'Dark wedding welcome sign with a gold border and serif names',
    ],
  },
  meadow: {
    scene: 'on an easel in a wildflower meadow',
    boards: [
      'Wedding welcome sign framed by an oval watercolor wildflower wreath',
      'Blush wedding welcome sign with pressed wildflowers and calligraphy names',
      'Cream wedding welcome sign with wildflowers along the bottom',
    ],
  },
  editorial: {
    scene: 'on a black easel in a stone gallery',
    boards: [
      'Newspaper-style wedding welcome sign with a masthead and serif names',
      'Black editorial welcome sign with centered ivory names',
      'Cream editorial wedding sign with left-aligned names and a fine rule',
    ],
  },
  oriental: {
    scene: 'among red drapery at a Chinese wedding entrance',
    boards: [
      'Red wedding welcome sign with a gold floral crown and double happiness seal',
      'Ivory wedding welcome sign with gold floral sprays and red calligraphy',
      'Burgundy Chinese wedding sign with a gold frame and stacked names',
    ],
  },
  chapel: {
    scene: 'on a wooden easel inside a chapel',
    boards: [
      'Sage chapel wedding sign with an initial crest and double-line border',
      'Ivory wedding welcome sign with a rounded arch and calligraphy names',
      'Navy chapel welcome sign with a botanical branch and large initials',
    ],
  },
  noir: {
    scene: 'in a candlelit black-tie reception',
    boards: [
      'Black and gold Art Deco wedding welcome sign with fine corner rays',
      'Champagne Art Deco welcome sign with a large script heading',
      'Midnight blue wedding welcome sign with silver-toned geometric corners',
    ],
  },
  rose: {
    scene: 'on an easel in an English rose garden',
    boards: [
      'Ivory wedding welcome sign with diagonal rose clusters and staggered script names',
      'Blush rose wedding sign with large calligraphy names and painted floral corners',
      'Pink letterpress-style wedding sign with rose corners and paired names',
    ],
  },
  olive: {
    scene: 'on a wooden easel in a Tuscan olive grove',
    boards: [
      'White wedding welcome sign with a tall watercolor olive branch and script names',
      'Sage wedding welcome sign framed by olive leaves',
      'Cream wedding sign with an olive sprig above centered calligraphy',
    ],
  },
  gallery: {
    scene: 'in a bright minimalist gallery',
    boards: [
      'White minimalist wedding welcome sign with a sweeping lowercase welcome',
      'Black minimalist wedding sign with a white calligraphy heading',
      'Ivory wedding welcome sign with widely spaced uppercase serif names',
    ],
  },
  ribbon: {
    scene: 'against red curtains at a wedding reception',
    boards: [
      'Pink-striped wedding welcome sign with a red satin bow and floral border',
      'Blush wedding welcome sign with scalloped trim and script names',
      'Wine-colored wedding sign with a line-drawn bow and thin border',
    ],
  },
  coast: {
    scene: 'on a terrace overlooking the coast',
    boards: [
      'Blue and ivory wedding welcome sign surrounded by a toile floral border',
      'Porcelain-blue floral wedding sign with centered calligraphy names',
      'Pale blue coastal wedding welcome sign with engraved landscape accents',
    ],
  },
  desert: {
    scene: 'on a wooden easel at a sunset desert venue',
    boards: [
      'Terracotta wedding welcome sign with a cream arch and handwritten names',
      'Sand-colored arch wedding sign with a large calligraphy welcome',
      'Rust and cream wedding welcome sign with a botanical sprig inside an arch',
    ],
  },
};

export const templateImageAlt = (template: SignTemplate) =>
  description[template.sceneId].boards[template.variation];
export const sceneImageAlt = (template: SignTemplate) =>
  `${templateImageAlt(template)} ${description[template.sceneId].scene}`;
