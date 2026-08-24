import {
  getWeddingLayout,
  getWeddingStyle,
  WEDDING_LAYOUT_VERSION,
  WEDDING_PROMPT_VERSION,
  WEDDING_STYLE_VERSION,
} from './config';
import type { WeddingPromptRequest } from './types';

export function compileWeddingPrompt(input: WeddingPromptRequest) {
  const style = getWeddingStyle(input.style);
  const layout = getWeddingLayout(input.layout);
  const match = input.matchExample ?? null;
  const hasExample = Boolean(input.exampleImage);

  // Per-property wording. When the user flipped a property to
  // "match the example", the concrete value is replaced with a directive
  // to follow the reference image so the multimodal model can reconcile
  // them. Properties that the user *didn't* flag (or properties without
  // an example) still get the concrete text so the model has something
  // to work with.
  const flowersLine = match?.flowers
    ? 'Flowers: match the floral and botanical elements shown in the reference example image.'
    : `Flowers: ${input.flowers.filter(Boolean).join(', ') || 'subtle seasonal flowers'}.`;
  const personalElementsLine = match?.elements
    ? 'Personal elements: match the personal ornaments and motifs shown in the reference example image.'
    : `Personal elements: ${input.personalElements.filter(Boolean).join(', ') || 'no extra personal object'}.`;
  const paletteLine = match?.palette
    ? 'Palette: match the color palette of the reference example image exactly.'
    : `Palette: ${input.palette.join(', ')}.`;
  const borderLine =
    match?.border && hasExample
      ? 'Border / ornament: replicate the border shape, corner ornaments, and overall framing of the reference example image.'
      : null;

  return [
    `Create a refined ${style.name.toLowerCase()} wedding crest illustration.`,
    `Visual medium: ${style.medium}.`,
    `Composition: ${layout.shape} arrangement, symmetrical balance, generous empty central area for typography.`,
    flowersLine,
    personalElementsLine,
    `Wedding setting inspiration: ${input.location || 'a refined destination wedding'}${input.venue ? `, ${input.venue}` : ''}.`,
    paletteLine,
    `Complexity: ${input.complexity}.`,
    // Border is a single line because it doesn't have a "concrete value"
    // by default — the user always picked (or skipped) a specific frame
    // and we kept that frameId for the SVG composer. The "match example"
    // variant is the only time the prompt itself has to drive the border.
    ...(borderLine ? [borderLine] : []),
    // Reference images travel in two flavors: the example (match its
    // visual language) and personal photos (paint the subject). The
    // first reference image is always the example when both are present;
    // the prompt makes that ordering explicit so the model doesn't
    // confuse them.
    ...(hasExample || (input.personalImages ?? []).length > 0
      ? [
          `Reference images: ${[
            hasExample ? '1 example crest' : '',
            ...((input.personalImages ?? []).length > 0
              ? [
                  `${(input.personalImages ?? []).length} personal photo${(input.personalImages ?? []).length > 1 ? 's' : ''}`,
                ]
              : []),
          ]
            .filter(Boolean)
            .join(' + ')}. ${
            hasExample
              ? 'Reference image #1 is a finished example crest - replicate its visual language (style, composition, palette, border, flowers, and personal motifs) as instructed above.'
              : ''
          }${
            (input.personalImages ?? []).length > 0
              ? ' For the personal photos, paint the main subject of each as an illustrated element in the crest\'s medium, integrated naturally into the composition. Keep the subjects recognizable but render them in the chosen style (e.g. watercolor washes for botanical_watercolor, engraved line work for vintage_engraving).'
              : ''
          }`.trim(),
        ]
      : []),
    'The illustration must contain no words, letters, initials, numbers, dates, logos, watermark, mockup, or paper texture.',
    `Avoid: ${style.forbidden.join(', ')}.`,
    'Return one polished illustration layer only; leave the center clear for programmatic SVG typography.',
  ].join('\n');
}

export function getWeddingVersions() {
  return {
    promptVersion: WEDDING_PROMPT_VERSION,
    styleVersion: WEDDING_STYLE_VERSION,
    layoutVersion: WEDDING_LAYOUT_VERSION,
  };
}
