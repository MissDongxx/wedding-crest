#!/usr/bin/env tsx
/**
 * Domain-level checks for the Wedding Crest Design product.
 *
 * Runs without a database or AI provider so the verify-loop can complete
 * deterministically. Each check prints PASS/FAIL and the script exits
 * non-zero on any failure.
 */
import {
  composeWeddingBlackWhite,
  composeWeddingCrest,
  composeWeddingMockup,
  composeWeddingMockups,
  composeWeddingMonogram,
  composeWeddingSimplifiedMark,
  formatWeddingDate,
  WEDDING_MOCKUP_TYPES,
} from '../src/shared/wedding/composer';
import {
  decideGenerationAllowance,
  decideReview,
  getWeddingLayout,
  getWeddingStyle,
  getWeddingTypography,
  layoutsForStyle,
  selectLayout,
  WEDDING_FREE_MAX_BATCHES,
  WEDDING_FREE_MAX_PROJECTS,
  WEDDING_GUEST_MAX_BATCHES,
  WEDDING_PAID_MAX_BATCHES,
} from '../src/shared/wedding/config';
import { compileWeddingPrompt } from '../src/shared/wedding/prompt-compiler';
import {
  WEDDING_MAX_FLOWERS,
  WEDDING_MAX_PALETTE_COLORS,
  WEDDING_MAX_PERSONAL_ELEMENTS,
  weddingFlowerOptions,
  weddingLayouts,
  weddingPalettes,
  weddingPersonalElementOptions,
  weddingStyles,
  type WeddingProjectInput,
} from '../src/shared/wedding/types';

let failures = 0;
let total = 0;

function check(name: string, ok: boolean, detail?: string): void {
  total += 1;
  if (ok) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  }
}

function group(label: string, fn: () => void) {
  console.log(`\n[${label}]`);
  fn();
}

function sampleInput(): WeddingProjectInput {
  return {
    partner1: 'Emma',
    partner2: 'James',
    initials: ['E', 'J'],
    weddingDate: '2027-06-12',
    style: 'botanical_watercolor',
    layout: 'BOTANICAL_OVAL_01',
    typography: 'editorial_rose',
    palette: weddingPalettes[0].colors.slice(0, 2),
    location: 'Lake Como, Italy',
    venue: 'Villa del Balbianello',
    flowers: ['White Rose', 'Olive Branch'],
    personalElements: ['Golden Retriever'],
    complexity: 'medium',
    nameDisplay: 'initials_amp',
    showDate: true,
  };
}

group('Catalog integrity', () => {
  check('exactly 6 styles', weddingStyles.length === 6);
  const ids = new Set(weddingStyles.map((s) => s.id));
  check('all style ids are unique', ids.size === weddingStyles.length);
  check('at least 12 layouts', weddingLayouts.length >= 12);
  const layoutIds = new Set(weddingLayouts.map((l) => l.id));
  check('layout ids unique', layoutIds.size === weddingLayouts.length);
  check('exactly 7 palettes', weddingPalettes.length === 7);
  const styleIdSet = new Set(weddingStyles.map((s) => s.id));
  for (const layout of weddingLayouts) {
    check(
      `layout ${layout.id} has at least one valid style`,
      layout.styleIds.some((sid) => styleIdSet.has(sid))
    );
  }
  for (const style of weddingStyles) {
    check(
      `style ${style.id} has matching layouts`,
      layoutsForStyle(style.id).length > 0
    );
    check(`style ${style.id} has typography`, style.typography.length > 0);
  }
  for (const id of [
    'botanical_watercolor',
    'minimal_line_art',
    'vintage_engraving',
    'italian_romance',
    'coastal',
    'classic_luxury',
  ]) {
    check(`style lookup: ${id}`, Boolean(getWeddingStyle(id)));
  }
  for (const id of [
    'editorial_rose',
    'classic_caps',
    'modern_serif',
    'editorial_italic',
    'romantic_script',
    'minimal_sans',
    'vintage_engraving',
    'coastal_light',
  ]) {
    check(`typography lookup: ${id}`, Boolean(getWeddingTypography(id)));
  }
});

group('Limits & quota', () => {
  check(
    'max flowers = 3',
    WEDDING_MAX_FLOWERS === 3 && weddingFlowerOptions.length >= 5
  );
  check(
    'max personal elements = 2',
    WEDDING_MAX_PERSONAL_ELEMENTS === 2 &&
      weddingPersonalElementOptions.length >= 5
  );
  check('max palette colors = 3', WEDDING_MAX_PALETTE_COLORS === 3);
  check('guest max batches = 1', WEDDING_GUEST_MAX_BATCHES === 1);
  check('free max batches = 5', WEDDING_FREE_MAX_BATCHES === 5);
  check('paid max batches = 4', WEDDING_PAID_MAX_BATCHES >= 4);
  check('free max projects = 1', WEDDING_FREE_MAX_PROJECTS === 1);

  // allowance decisions
  check(
    'guest with 0 batches allowed (1/1)',
    decideGenerationAllowance({
      batches: 0,
      paid: false,
      isGuest: true,
      projectsWithGenerations: 0,
    }).allowed
  );
  check(
    'guest with 1 batch NOT allowed',
    !decideGenerationAllowance({
      batches: 1,
      paid: false,
      isGuest: true,
      projectsWithGenerations: 0,
    }).allowed
  );
  check(
    'free user with 1 project + 5 batches NOT allowed',
    !decideGenerationAllowance({
      batches: 5,
      paid: false,
      isGuest: false,
      projectsWithGenerations: 1,
    }).allowed
  );
  check(
    'free user with 1 project + 4 batches allowed',
    decideGenerationAllowance({
      batches: 4,
      paid: false,
      isGuest: false,
      projectsWithGenerations: 1,
    }).allowed
  );
  check(
    'free user with 0 projects + 0 batches allowed',
    decideGenerationAllowance({
      batches: 0,
      paid: false,
      isGuest: false,
      projectsWithGenerations: 0,
    }).allowed
  );
  check(
    'paid user with 3 batches allowed (cap is 4)',
    decideGenerationAllowance({
      batches: 3,
      paid: true,
      isGuest: false,
      projectsWithGenerations: 5,
    }).allowed
  );
  check(
    'paid user with 4 batches NOT allowed (cap reached)',
    !decideGenerationAllowance({
      batches: 4,
      paid: true,
      isGuest: false,
      projectsWithGenerations: 5,
    }).allowed
  );
});

group('Review thresholds', () => {
  check('score 9 accepted', decideReview(9) === 'accept');
  check('score 8.5 accepted', decideReview(8.5) === 'accept');
  check('score 8.0 repaired', decideReview(8) === 'repair');
  check('score 7.5 repaired', decideReview(7.5) === 'repair');
  check('score 7 rejected', decideReview(7) === 'reject');
  check('score 0 rejected', decideReview(0) === 'reject');
});

group('Composer output', () => {
  const input = sampleInput();
  const layout = getWeddingLayout(input.layout);
  check(
    'selected layout belongs to style',
    layout?.styleIds.includes(input.style as never) ?? false
  );
  const autoLayout = selectLayout(input.style as never);
  check('selectLayout returns valid id', Boolean(autoLayout));
  const crest = composeWeddingCrest(input);
  check(
    'crest is well-formed SVG',
    crest.startsWith('<svg') && crest.endsWith('</svg>')
  );
  check('crest contains partner initial E', crest.includes('>E'));
  check('crest contains partner initial J', crest.includes('J<'));
  check(
    'crest contains formatted date "June 12, 2027"',
    crest.includes('June 12, 2027')
  );
  check(
    'crest escapes ampersand in surname variant',
    !composeWeddingCrest({
      ...input,
      nameDisplay: 'surname',
      partner1: 'Miller & <co>',
      partner2: 'Smith',
    }).includes('<co>')
  );
  const noDate = composeWeddingCrest({
    ...input,
    showDate: false,
    weddingDate: null,
  });
  check('no date when showDate=false', !noDate.includes('June 12, 2027'));
  const watermark = composeWeddingCrest({
    ...input,
    previewWatermark: true,
  });
  check(
    'watermark layer applied when requested',
    watermark.includes('WEDDING CREST STUDIO PREVIEW')
  );
  const noWatermark = composeWeddingCrest({
    ...input,
    previewWatermark: false,
  });
  check(
    'no watermark when disabled',
    !noWatermark.includes('WEDDING CREST STUDIO PREVIEW')
  );

  // monogram, simplified, black & white
  for (const fn of [
    composeWeddingMonogram,
    composeWeddingSimplifiedMark,
    composeWeddingBlackWhite,
  ]) {
    const svg = fn(input);
    check(
      `composer (${fn.name}) returns well-formed SVG`,
      svg.startsWith('<svg') && svg.endsWith('</svg>')
    );
  }
  const bw = composeWeddingBlackWhite({
    ...input,
    illustrationUrl: 'https://example.com/illustration.png',
  });
  check(
    'black-white uses grayscale filter when illustration present',
    bw.includes('feColorMatrix')
  );
  const bwNoIllustration = composeWeddingBlackWhite(input);
  check(
    'black-white renders without illustration (placeholder)',
    bwNoIllustration.startsWith('<svg')
  );

  // mockups
  for (const type of WEDDING_MOCKUP_TYPES) {
    const svg = composeWeddingMockup(input, type.id);
    check(
      `mockup ${type.id} is well-formed`,
      svg.startsWith('<svg') && svg.endsWith('</svg>')
    );
  }
  const all = composeWeddingMockups(input);
  check('composeWeddingMockups returns 4 mockups', all.length === 4);
});

group('Prompt compilation', () => {
  const input = sampleInput();
  const prompt = compileWeddingPrompt(input);
  check('prompt is non-empty', prompt.length > 50);
  check(
    'prompt does NOT mention partner names (illustration layer is name-free)',
    !prompt.includes('Emma') && !prompt.includes('James')
  );
  check(
    'prompt includes style name',
    prompt.toLowerCase().includes('botanical')
  );
  check(
    'prompt contains "no ..." exclusion line',
    /no\s+[\w\s,]+/.test(prompt.toLowerCase())
  );
  // The prompt must explicitly mention forbidden text-like artifacts in its
  // "no ..." exclusion line, so the model knows to avoid them.
  for (const forbidden of [
    'letters',
    'initials',
    'numbers',
    'dates',
    'logos',
    'watermark',
  ]) {
    check(
      `prompt excludes forbidden "${forbidden}"`,
      prompt.toLowerCase().includes(forbidden)
    );
  }
  check('prompt includes location', prompt.includes('Lake Como'));
  check('prompt includes flowers', prompt.toLowerCase().includes('rose'));
});

group('Date formatting', () => {
  check(
    'formatWeddingDate: 2027-06-12 → "June 12, 2027"',
    formatWeddingDate('2027-06-12') === 'June 12, 2027'
  );
  check(
    'formatWeddingDate: 2027-12-05 → "December 5, 2027"',
    formatWeddingDate('2027-12-05') === 'December 5, 2027'
  );
  check(
    'formatWeddingDate: invalid returns original',
    formatWeddingDate('not-a-date') === 'not-a-date'
  );
});

console.log(
  `\n[result] ${total - failures}/${total} passed${
    failures ? `, ${failures} FAILED` : ''
  }`
);

if (failures > 0) {
  process.exit(1);
}
