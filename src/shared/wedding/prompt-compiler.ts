import {
  getWeddingLayout,
  getWeddingStyle,
  getWeddingTypography,
  WEDDING_LAYOUT_VERSION,
  WEDDING_PROMPT_VERSION,
  WEDDING_STYLE_VERSION,
} from './config';
import {
  resolveWeddingDisplayTexts,
  resolveWeddingLocationText,
} from './display-text';
import type { WeddingPromptRequest } from './types';

/** Keep reference roles identical to the compiler's numbered image contract. */
export function getWeddingReferenceImages(
  input: WeddingPromptRequest,
  edit?: { kind: string; sourceImageUrl: string }
): string[] {
  return [
    ...(edit
      ? [edit.sourceImageUrl]
      : input.exampleImage
        ? [input.exampleImage]
        : []),
    ...((!edit || edit.kind === 'design') && input.frameUrl
      ? [input.frameUrl]
      : []),
    ...(input.personalImages ?? []).filter(Boolean),
  ];
}

function inscriptionLines(input: WeddingPromptRequest) {
  const texts = resolveWeddingDisplayTexts(input);
  const location = resolveWeddingLocationText(input);
  return [
    `Main inscription: "${texts.headline}" (largest, centered; preserve its existing position when a crest reference is supplied).`,
    ...(texts.names
      ? [`Names line: "${texts.names}" (smaller than the main inscription).`]
      : []),
    ...(texts.date
      ? [
          `Date line: "${texts.date}" (secondary text, smaller than the main inscription).`,
        ]
      : []),
    ...(location
      ? [
          `Location line: "${location}" (secondary text, smaller than the main inscription; print exactly, not as a scenic illustration).`,
        ]
      : []),
    `Text placement: preserve an existing matching text region in the crest reference when available. For newly added secondary lines without an existing region, use clear lower-center negative space below the ${texts.names ? 'names line' : 'main inscription'}, in this order: ${[texts.date ? 'date' : '', location ? 'location' : ''].filter(Boolean).join(', ') || 'no additional lines'}. Never place text across the monogram, flowers or border; if space is insufficient, extend clean white space below the artwork rather than overlaying it.`,
    `Exact text inventory: ${JSON.stringify([texts.headline, texts.names, texts.date, location].filter(Boolean))}. Each listed inscription appears once. Preserve intentional repeated letters within an inscription, including identical partner initials; do not deduplicate them. Replace old reference inscriptions rather than retaining or tracing their old letters. Add no extra characters or duplicated letterforms, stray stems, disconnected strokes, pseudo-letters, words, dates, logos or watermarks. Decorative flourishes must not resemble additional letters or alter the intended glyphs.`,
  ];
}

const artisticLetteringRule =
  'Artistic lettering: use a bespoke wedding monogram with graceful calligraphic rhythm, considered stroke contrast and balanced ornament; preserve the recognizable skeleton and exact count of the requested letters. Do not substitute generic word-processor typesetting or plain default serif/sans text. Supporting names, date and location stay smaller and clearly legible.';

/**
 * Compile the wedding crest generation prompt.
 *
 * Reference-first contract (spec: wedding-illustration-v5):
 * - When the project carries an example reference image, every visual
 *   property the user did NOT explicitly change is delegated to the
 *   reference ("follow the example") instead of being described in the
 *   prompt. The model sees a colored example and copies it - the prompt
 *   never re-describes (and therefore never contradicts) it.
 * - A concrete user choice always wins: the prompt states the chosen
 *   value and explicitly overrides the reference for that property.
 * - With no reference image, concrete values are described as before,
 *   and an empty palette falls back to a free-choice full-color line
 *   so text-to-image runs never drift to monochrome.
 * - The lettering style is never user-selected. With a reference the
 *   model re-uses its lettering style; without one the style-recommended
 *   typography pairing is described.
 */
export interface WeddingLetteringEditOptions {
  replaceLetteringStyle?: boolean;
}

export function compileWeddingPrompt(
  input: WeddingPromptRequest,
  options: WeddingLetteringEditOptions = {}
) {
  const style = getWeddingStyle(input.style);
  const layout = getWeddingLayout(input.layout);
  const match = input.matchExample ?? null;
  const hasExample = Boolean(input.exampleImage);
  const hasFrame = Boolean(input.frameUrl);
  const personalImages = (input.personalImages ?? []).filter(Boolean);
  const personalImageCount = personalImages.length;

  // The user switched away from the example's style when the wizard
  // recorded the example's style and the project now carries a different
  // one. Legacy projects without the recorded style are treated as
  // "kept" so the reference stays authoritative.
  const styleSwitched =
    hasExample &&
    input.exampleStyle != null &&
    input.exampleStyle !== input.style;

  // --- Style / medium -------------------------------------------------------
  const styleLine = styleSwitched
    ? `Artistic style & medium: ${style.name}, ${style.medium}. Apply this style, overriding the example reference image's style.`
    : hasExample
      ? 'Artistic style & medium: follow the example reference image exactly.'
      : `Visual medium: ${style.medium}.`;

  // --- Quality / resolution -------------------------------------------------
  // Generic quality directive applied to every generated crest. Image
  // models tend to drift toward softer, lower-detail output unless the
  // prompt explicitly asks for sharpness — which is especially true
  // when the reference image is small or the multimodal model tends to
  // return a low-res raster. Stays illustration-aligned (no
  // "photorealistic" or "photograph" terms) so it doesn't fight the
  // chosen style.
  const qualityLine =
    'Quality: highly detailed, sharp focus, ultra high definition, crisp clean lines, intricate ornamentation, professional illustration quality.';

  // --- Composition ----------------------------------------------------------
  const compositionLine = hasExample
    ? "Composition: follow the example reference image's composition and framing, keeping the center clear so the lettering sits prominently and reads cleanly."
    : `Composition: ${layout.shape} arrangement, symmetrical balance, keeping the center of the composition clear and open so the lettering below sits prominently and reads cleanly.`;

  // --- Background -----------------------------------------------------------
  const backgroundLine = hasExample
    ? 'Background: solid pure white (#FFFFFF) as in the example reference image. Do not use transparency, an alpha channel, a gray/white checkerboard, grid, paper texture, backdrop, scenery, shadow or gradient.'
    : 'Background: solid pure white (#FFFFFF) behind the entire crest. Fill every pixel outside the artwork with clean white. Do not use transparency, an alpha channel, a gray/white checkerboard, grid, paper texture, backdrop, scenery, shadow or gradient.';

  // --- Palette --------------------------------------------------------------
  // Palette is optional: an example project defaults to the reference's
  // palette; a from-scratch project defaults to a free-choice full-color
  // palette. A picked palette always overrides the reference.
  const palettePicked = input.palette.filter(Boolean).length > 0;
  const paletteLine =
    hasExample && (match?.palette || !palettePicked)
      ? "Palette: use the example reference image's exact color palette."
      : palettePicked
        ? hasExample
          ? `Palette: ${input.palette.join(', ')}. Apply these as the dominant colors throughout the florals, ornaments and accents, overriding the example reference image's palette.`
          : `Palette: ${input.palette.join(', ')}. Paint the florals, ornaments and accents in these colors - full color rendering.`
        : `Palette: choose a refined full-color palette typical of a ${style.name.toLowerCase()} wedding crest. Render in full color - avoid monochrome, black-and-white or grayscale output.`;

  // --- Flowers ----------------------------------------------------------------
  const flowersPicked = input.flowers.filter(Boolean).length > 0;
  const flowersLine =
    hasExample && (match?.flowers || !flowersPicked)
      ? 'Flowers: match the floral and botanical elements shown in the example reference image.'
      : flowersPicked
        ? `Flowers: ${input.flowers.filter(Boolean).join(', ')}${hasExample ? ". Use exactly these flowers, replacing the example reference image's florals." : '.'}`
        : 'Flowers: subtle seasonal flowers.';

  // --- Personal elements -------------------------------------------------------
  const elementsPicked = input.personalElements.filter(Boolean).length > 0;
  const personalElementsLine =
    hasExample && (match?.elements || !elementsPicked)
      ? 'Personal elements: match the personal ornaments and motifs shown in the example reference image.'
      : elementsPicked
        ? `Personal elements: ${input.personalElements.filter(Boolean).join(', ')}${hasExample ? '. Add these even if the example reference image does not contain them, rendered in its artistic style.' : '.'}`
        : 'Personal elements: no extra personal object.';

  // --- Setting inspiration (typed -> overrides; blank -> follow reference) ----
  const settingTyped =
    !input.showLocation && Boolean(input.location || input.venue);
  const settingLine = settingTyped
    ? `Wedding setting inspiration: ${input.location || 'a refined destination wedding'}${input.venue ? `, ${input.venue}` : ''}${hasExample ? ". Use this setting, overriding the example's." : '.'}`
    : hasExample || input.showLocation
      ? null
      : 'Wedding setting inspiration: a refined destination wedding.';

  // --- Complexity (visual density follows the reference when present) ---------
  const complexityLine = hasExample ? null : `Complexity: ${input.complexity}.`;

  // --- Border -----------------------------------------------------------------
  // A selected frame supplies geometry only, never its decorative treatment.
  const borderLine = hasFrame
    ? `Border geometry only: reference image #${hasExample ? 2 : 1} supplies only the selected outer silhouette, contour and proportions. Reshape the border to that contour, without copying the frame reference's colors, line weight, texture, material, ornaments or lettering. ${hasExample && !styleSwitched ? "Preserve the example crest's border drawing technique, line treatment, brushwork, material, ornamental motifs and decorative character; adapt its existing ornaments to the new contour." : `Render the new contour in the selected ${style.name} medium (${style.medium}) and its ornamental language.`} Border colors follow the Palette instruction above, never the frame reference's colors. Paint it as an integrated border, not a pasted template.`
    : match?.border && hasExample
      ? "Border / framing: replicate the example reference image's border, corner ornaments and overall framing."
      : null;

  // --- Lettering ---------------------------------------------------------------
  // Main inscription always renders. The names line appears only when the
  // user chose the initials-with-names display and typed both names; the
  // date line only when the date is shown. With a reference the model keeps
  // its lettering style; without one the style-recommended pairing applies.
  const typography = getWeddingTypography(input.typography);
  const inscriptions = inscriptionLines(input);
  const typographySection =
    hasExample && !options.replaceLetteringStyle
      ? [
          "Lettering: replace the inscribed text with the following, keeping the example reference image's lettering style exactly (same typeface, weight, casing and size hierarchy):",
          ...inscriptions,
          "Render every quoted inscription exactly, letter for letter, in the example reference image's lettering style, with no extra words, dates, logos or watermarks.",
        ].join('\n')
      : [
          ...inscriptions,
          `Lettering style: ${typography.prompt}. ${artisticLetteringRule}`,
          'Render every quoted inscription exactly, letter for letter, with no extra words, dates, logos or watermarks.',
        ].join('\n');

  // --- Reference images ---------------------------------------------------------
  // Enumerate the attached references. Deliberately NO catch-all
  // "replicate its visual language" sentence: each property above already
  // says either "follow the example" or "override it", and a global
  // replicate directive would contradict the user's explicit overrides.
  const referenceBlock =
    hasExample || hasFrame || personalImageCount > 0
      ? [
          `Reference images: ${[
            hasExample ? '1 example crest' : '',
            hasFrame ? '1 frame / border reference' : '',
            ...(personalImageCount > 0
              ? [
                  `${personalImageCount} personal photo${personalImageCount > 1 ? 's' : ''}`,
                ]
              : []),
          ]
            .filter(Boolean)
            .join(' + ')}. ${
            hasExample ? 'Reference image #1 is the example crest.' : ''
          }${
            hasFrame
              ? ` Reference image #${hasExample ? 2 : 1} is the selected frame: geometry only, not a style, palette, ornament or lettering reference.`
              : ''
          }${
            personalImageCount > 0
              ? " For the personal photos, paint the main subject of each as an illustrated element in the crest's medium, integrated naturally into the composition. Keep the subjects recognizable but render them in the chosen style (e.g. watercolor washes for botanical_watercolor, engraved line work for vintage_engraving)."
              : ''
          }`.trim(),
        ]
      : [];

  return [
    hasExample
      ? 'Replicate the wedding crest shown in reference image #1 as your starting point.'
      : `Create a refined ${style.name.toLowerCase()} wedding crest illustration.`,
    styleLine,
    qualityLine,
    compositionLine,
    backgroundLine,
    flowersLine,
    personalElementsLine,
    ...(settingLine ? [settingLine] : []),
    paletteLine,
    ...(complexityLine ? [complexityLine] : []),
    ...(borderLine ? [borderLine] : []),
    typographySection,
    ...referenceBlock,
    `Avoid: ${[...style.forbidden, 'mockup', 'paper texture'].join(', ')}.`,
    'Return one polished, complete wedding crest image with the exact lettering and border integrated into the AI artwork.',
  ].join('\n');
}

/**
 * Build a "lettering re-render" prompt used by the result page's
 * small-modification flow. The reference image carries the existing
 * illustration; this prompt only asks the model to re-render the
 * typography described by the latest project settings while keeping
 * everything else identical.
 */
export function compileWeddingTextEditPrompt(
  input: WeddingPromptRequest,
  options: WeddingLetteringEditOptions = {}
) {
  return [
    'Edit the wedding crest shown in the reference image.',
    'Keep the entire illustration - composition, framing, border, ornaments, palette, floral and personal motifs, and all artwork details - exactly as it appears.',
    'Keep a solid pure white (#FFFFFF) background exactly as in the reference image. Replace the lettering only; do not introduce transparency, a checkerboard, grid, paper texture, backdrop, shadow or gradient.',
    options.replaceLetteringStyle
      ? 'Replace ONLY the inscriptions with the following exact text and explicitly requested lettering style:'
      : 'Replace ONLY the inscriptions with the following exact text; retain the existing artistic lettering treatment:',
    ...inscriptionLines(input),
    'Location changes in this text-only edit add, replace or remove the printed location line only; keep all existing scenery, architecture and illustrated setting unchanged. Remove old date or location inscriptions omitted from the exact text inventory.',
    options.replaceLetteringStyle
      ? `Lettering style: the user explicitly requested ${getWeddingTypography(input.typography).prompt}. Apply this requested change instead of retaining the reference lettering style. ${artisticLetteringRule}`
      : "Lettering style: preserve the current crest reference image's bespoke artistic letterforms, calligraphic character, stroke contrast, ornamental treatment and visual hierarchy; adapt only the requested characters. Do not replace its monogram with a default font or generic typesetting.",
    'Text rules: render every inscription exactly as quoted, letter for letter, in the same casing; keep the lettering crisp, evenly spaced and elegantly typeset so it reads clearly; include no other words, letters, numbers, dates, logos, watermarks or symbols anywhere in the image.',
    'Do not change anything else in the design.',
  ].join('\n');
}

/** Re-render the complete AI image after palette, motif, frame, or layout edits. */
export function compileWeddingDesignEditPrompt(
  input: WeddingPromptRequest,
  options: WeddingLetteringEditOptions = {}
) {
  const style = getWeddingStyle(input.style);
  const layout = getWeddingLayout(input.layout);
  const specification = compileWeddingPrompt(
    {
      ...input,
      // The route sends the current crest first, not the original example.
      exampleImage: 'current-crest-reference',
      matchExample: null,
    },
    options
  );
  return [
    'Redesign the wedding crest shown in reference image #1.',
    'Use the reference as the visual starting point, but apply every updated requirement in the complete specification below, including artwork, palette, motifs, frame, composition, and exact lettering.',
    ...(input.showLocation
      ? [
          'The requested location is printed text only. Do not change the existing scenery, architecture or illustrated wedding setting to depict that location.',
        ]
      : []),
    specification,
    `Reference image #1 is the current crest being edited, not the original library example. Every mention of the example in the specification refers to this current crest. ${options.replaceLetteringStyle ? 'The user explicitly requested the lettering style specified above; apply that change.' : 'Preserve its bespoke artistic lettering.'} Preserve all unchanged visual details. The selected frame, when supplied as reference image #2, controls geometry only.`,
    `Selected artwork requirements take precedence over the reference: render the artwork in ${style.name}, ${style.medium}. Use the selected ${layout.shape} composition (${input.layout}); a supplied frame controls the outer border contour, not the artistic treatment. Keep the lettering style governed separately by the lettering instruction above.`,
    'Return one complete updated AI-generated crest image. Do not layer separate programmatic elements over the result.',
  ].join('\n\n');
}

export function getWeddingVersions() {
  return {
    promptVersion: WEDDING_PROMPT_VERSION,
    styleVersion: WEDDING_STYLE_VERSION,
    layoutVersion: WEDDING_LAYOUT_VERSION,
  };
}
