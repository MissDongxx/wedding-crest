/**
 * Curated public gallery (spec: only hand-picked examples become pages).
 * Deterministic ornaments keep every gallery visual consistent.
 */

import { getWeddingStyle } from './config';
import { weddingPalettes, WeddingStyleId } from './types';

export interface WeddingGalleryExample {
  slug: string;
  title: string;
  description: string;
  partner1: string;
  partner2: string;
  weddingDate: string;
  style: WeddingStyleId;
  layout: string;
  typography: string;
  palette: string[];
  location: string;
  flowers: string[];
  personalElements: string[];
}

export const weddingGalleryExamples: WeddingGalleryExample[] = [
  {
    slug: 'botanical-lake-como-wedding-crest',
    title: 'Botanical Lake Como Wedding Crest',
    description:
      'Sage botanical watercolor with olive branches for a villa wedding on Lake Como.',
    partner1: 'Emma',
    partner2: 'James',
    weddingDate: '2027-06-12',
    style: 'botanical_watercolor',
    layout: 'BOTANICAL_OVAL_01',
    typography: 'editorial_rose',
    palette: weddingPalettes[0].colors,
    location: 'Lake Como, Italy',
    flowers: ['White Rose', 'Olive Branch'],
    personalElements: ['Golden Retriever'],
  },
  {
    slug: 'minimal-black-and-white-wedding-crest',
    title: 'Minimal Black and White Wedding Crest',
    description: 'A single-line circle monogram for a modern city celebration.',
    partner1: 'Olivia',
    partner2: 'Noah',
    weddingDate: '2027-09-04',
    style: 'minimal_line_art',
    layout: 'MINIMAL_CIRCLE_01',
    typography: 'minimal_sans',
    palette: weddingPalettes[6].colors,
    location: 'New York City',
    flowers: ['Wildflower'],
    personalElements: ['Moon'],
  },
  {
    slug: 'vintage-french-wedding-monogram',
    title: 'Vintage French Wedding Monogram',
    description: 'Engraved shield crest in burgundy for a château celebration.',
    partner1: 'Charlotte',
    partner2: 'Henry',
    weddingDate: '2027-05-22',
    style: 'vintage_engraving',
    layout: 'VINTAGE_SHIELD_01',
    typography: 'vintage_engraving',
    palette: weddingPalettes[4].colors,
    location: 'Loire Valley, France',
    flowers: ['Peony', 'Lily'],
    personalElements: ['Bird'],
  },
  {
    slug: 'italian-villa-romance-wedding-crest',
    title: 'Italian Villa Romance Wedding Crest',
    description:
      'Golden-hour arch with blush roses for a Tuscany estate wedding.',
    partner1: 'Aria',
    partner2: 'Luca',
    weddingDate: '2027-07-10',
    style: 'italian_romance',
    layout: 'ITALIAN_ARCH_01',
    typography: 'romantic_script',
    palette: weddingPalettes[2].colors,
    location: 'Tuscany, Italy',
    flowers: ['Rose', 'Olive Branch'],
    personalElements: ['Wine'],
  },
  {
    slug: 'coastal-seaside-wedding-crest',
    title: 'Coastal Seaside Wedding Crest',
    description: 'Open breezy composition in dusty blue for a beach ceremony.',
    partner1: 'Hannah',
    partner2: 'Ethan',
    weddingDate: '2027-08-21',
    style: 'coastal',
    layout: 'COASTAL_OPEN_01',
    typography: 'coastal_light',
    palette: weddingPalettes[1].colors,
    location: 'Amalfi Coast, Italy',
    flowers: ['Hydrangea'],
    personalElements: ['Ocean'],
  },
  {
    slug: 'classic-luxury-ballroom-wedding-crest',
    title: 'Classic Luxury Ballroom Wedding Crest',
    description: 'Navy and ivory luxury oval for a black-tie hotel reception.',
    partner1: 'Victoria',
    partner2: 'Alexander',
    weddingDate: '2027-12-05',
    style: 'classic_luxury',
    layout: 'LUXURY_OVAL_01',
    typography: 'classic_caps',
    palette: weddingPalettes[5].colors,
    location: 'Vienna, Austria',
    flowers: ['Rose', 'Peony'],
    personalElements: ['Stars'],
  },
  {
    slug: 'sage-garden-wedding-monogram',
    title: 'Sage Garden Wedding Monogram',
    description: 'Soft sage oval with wildflowers for a garden celebration.',
    partner1: 'Lily',
    partner2: 'Jack',
    weddingDate: '2027-04-18',
    style: 'botanical_watercolor',
    layout: 'BOTANICAL_OPEN_01',
    typography: 'romantic_script',
    palette: weddingPalettes[3].colors,
    location: 'Cotswolds, England',
    flowers: ['Wildflower', 'Tulip'],
    personalElements: ['Home'],
  },
  {
    slug: 'modern-arch-wedding-monogram',
    title: 'Modern Arch Wedding Monogram',
    description:
      'Architectural arch monogram in warm neutrals for a gallery wedding.',
    partner1: 'Mia',
    partner2: 'Felix',
    weddingDate: '2027-10-02',
    style: 'minimal_line_art',
    layout: 'MINIMAL_ARCH_01',
    typography: 'modern_serif',
    palette: weddingPalettes[0].colors,
    location: 'Copenhagen, Denmark',
    flowers: ['Olive Branch'],
    personalElements: ['Mountains'],
  },
];

export function getGalleryExample(slug: string) {
  return (
    weddingGalleryExamples.find((example) => example.slug === slug) ?? null
  );
}

export function galleryExampleStyle(example: WeddingGalleryExample) {
  return getWeddingStyle(example.style);
}
