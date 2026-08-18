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
  const flowers =
    input.flowers.filter(Boolean).join(', ') || 'subtle seasonal flowers';
  const personalElements =
    input.personalElements.filter(Boolean).join(', ') ||
    'no extra personal object';
  const palette = input.palette.join(', ');

  return [
    `Create a refined ${style.name.toLowerCase()} wedding crest illustration.`,
    `Visual medium: ${style.medium}.`,
    `Composition: ${layout.shape} arrangement, symmetrical balance, generous empty central area for typography.`,
    `Flowers: ${flowers}.`,
    `Personal elements: ${personalElements}.`,
    `Wedding setting inspiration: ${input.location || 'a refined destination wedding'}${input.venue ? `, ${input.venue}` : ''}.`,
    `Palette: ${palette}. Complexity: ${input.complexity}.`,
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
