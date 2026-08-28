import type { WeddingExamplePreview } from './types';

/**
 * Public fallback for the home gallery. The database remains the source of
 * truth, but the marketing page should keep its examples when that optional
 * table is temporarily unavailable during a cold start or migration.
 */
export const weddingHomeExampleFallbacks: WeddingExamplePreview[] = [
  {
    id: '81c011ae-5f38-4a08-b2a0-1b8da86bfd05',
    name: 'Rococo Rose Medallion',
    style: 'vintage_engraving',
    imageUrl:
      'https://images.weddingcrestdesign.com/uploads/a30962a5cc32e69724027dbf2db939ef.webp',
    altText: 'Vintage Rococo Baroque Heraldic Wedding Crest Design',
  },
  {
    id: '1315570e-ad55-4892-808e-3d21bd8bdd6a',
    name: 'Italy Crown Crest',
    style: 'vintage_engraving',
    imageUrl:
      'https://images.weddingcrestdesign.com/uploads/d3dc19423c75435044233a3a5e617ff9.webp',
    altText: 'Italy Crown Vintage Rococo Wedding Crest Design',
  },
  {
    id: 'd2ff7a00-07a0-4bf0-9660-3bf90be9aa84',
    name: 'Elegant Door Frame Style',
    style: 'vintage_engraving',
    imageUrl:
      'https://images.weddingcrestdesign.com/uploads/ee556f47d6a926f14776ba17e16bddec.webp',
    altText: 'Elegant Door Frame Style Wedding Emblem Wedding Crest Design',
  },
  {
    id: '106ea558-c7e5-4129-b956-ad8e3c4277b4',
    name: 'Romantic Watercolor Floral Heraldic Crest',
    style: 'minimal_line_art',
    imageUrl:
      'https://images.weddingcrestdesign.com/uploads/f98bae76f6bc08ab3aadc2dd0111cd32.webp',
    altText: 'Romantic Watercolor Floral Heraldic Crest Wedding Crest Design',
  },
  {
    id: '1bbe698d-5ec0-444e-9c5d-5da4f4fc793f',
    name: 'Minimal Line Art Wedding Crest',
    style: 'minimal_line_art',
    imageUrl:
      'https://images.weddingcrestdesign.com/uploads/d1a4c21b52e71d60a561b5c1fb34fdad.webp',
    altText: 'Minimal Line Art Wedding Crest Design Wedding Emblem',
  },
  {
    id: '31d2556e-fcfd-4036-a3b7-d79af73da92f',
    name: 'Elegant Green Wedding Crest',
    style: 'minimal_line_art',
    imageUrl:
      'https://images.weddingcrestdesign.com/uploads/dc3546d7a76f5899cd4b95e4be0fa309.webp',
    altText: 'Elegant Green Wedding Crest Design Wedding Emblem',
  },
  {
    id: 'ffcc9d84-e4a4-4ac2-967d-2a8436734225',
    name: 'Romantic Flower Watercolor Crest',
    style: 'botanical_watercolor',
    imageUrl:
      'https://images.weddingcrestdesign.com/uploads/ba17cb43fb6de44a2a545ccb771f6f93.webp',
    altText: 'Romantic Flower Watercolor Wedding Crest Design',
  },
  {
    id: '07f3cc53-3bfc-42be-9c25-28a6fe4ed05a',
    name: 'Romantic Dog Watercolor Crest',
    style: 'botanical_watercolor',
    imageUrl:
      'https://images.weddingcrestdesign.com/uploads/02498e775a63a6f403f7dd0c33cbe248.webp',
    altText: 'Romantic Dog Watercolor Crest Wedding Crest Design',
  },
  {
    id: '73472f92-2df0-4402-a3e3-288210d00c13',
    name: 'Tropical Style Wedding Crest',
    style: 'botanical_watercolor',
    imageUrl:
      'https://images.weddingcrestdesign.com/uploads/d8af45a4f0115ddf6fe3072a793471ec.webp',
    altText: 'Tropical Style Watercolor Wedding Crest Design',
  },
];
