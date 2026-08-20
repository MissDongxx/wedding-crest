import { composeWeddingCrest } from '@/shared/wedding/composer';
import {
  WeddingProjectInput,
  weddingPalettes,
} from '@/shared/wedding/types';

export interface CrestPreviewConfig {
  partner1: string;
  partner2: string;
  style: string;
  layout: string;
  typography: string;
  palette?: string[];
  weddingDate?: string;
  nameDisplay?: WeddingProjectInput['nameDisplay'];
  showDate?: boolean;
}

/** Sample crests used across marketing surfaces (hero, styles, gallery). */
export const weddingShowcaseCrests: CrestPreviewConfig[] = [
  {
    partner1: 'Emma',
    partner2: 'James',
    style: 'botanical_watercolor',
    layout: 'BOTANICAL_OVAL_01',
    typography: 'editorial_rose',
    palette: weddingPalettes[0].colors,
    weddingDate: '2027-06-12',
  },
  {
    partner1: 'Olivia',
    partner2: 'Noah',
    style: 'minimal_line_art',
    layout: 'MINIMAL_CIRCLE_01',
    typography: 'minimal_sans',
    palette: weddingPalettes[1].colors,
    weddingDate: '2027-09-04',
    nameDisplay: 'initials_spaced',
  },
  {
    partner1: 'Charlotte',
    partner2: 'Henry',
    style: 'vintage_engraving',
    layout: 'VINTAGE_SHIELD_01',
    typography: 'vintage_engraving',
    palette: weddingPalettes[4].colors,
    weddingDate: '2027-05-22',
  },
  {
    partner1: 'Aria',
    partner2: 'Luca',
    style: 'italian_romance',
    layout: 'ITALIAN_ARCH_01',
    typography: 'romantic_script',
    palette: weddingPalettes[2].colors,
    weddingDate: '2027-07-10',
    nameDisplay: 'initials_joined',
  },
];

/**
 * Deterministic crest visual for marketing surfaces: the ornament layer
 * (no AI illustration) keeps pages instant and consistent.
 */
export function CrestPreview({
  config,
  className,
}: {
  config: CrestPreviewConfig;
  className?: string;
}) {
  const svg = composeWeddingCrest({
    partner1: config.partner1,
    partner2: config.partner2,
    initials: [config.partner1.charAt(0), config.partner2.charAt(0)],
    weddingDate: config.weddingDate ?? null,
    style: config.style,
    layout: config.layout,
    typography: config.typography,
    palette: config.palette ?? weddingPalettes[0].colors,
    location: null,
    venue: null,
    flowers: [],
    personalElements: [],
    complexity: 'medium',
    nameDisplay: config.nameDisplay ?? 'initials_amp',
    showDate: config.showDate !== false,
  });
  return (
    <div
      className={className}
      role="img"
      aria-label={`${config.partner1} and ${config.partner2} wedding crest`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
