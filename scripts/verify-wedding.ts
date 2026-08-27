// Quick sanity check: compile prompts for the four key scenarios and
// dump them. Run with: npx tsx scripts/verify-wedding.ts
import { compileWeddingPrompt } from '../src/shared/wedding/prompt-compiler';
import type { WeddingPromptRequest } from '../src/shared/wedding/types';

const baseFields = {
  partner1: 'Anna',
  partner2: 'James',
  initials: ['A', 'J'],
  weddingDate: '2026-06-12',
  style: 'botanical_watercolor' as const,
  layout: 'BOTANICAL_OVAL_01',
  typography: 'editorial_rose',
  palette: [] as string[],
  location: 'Lake Como' as string | null,
  venue: 'Villa del Balbianello' as string | null,
  flowers: [] as string[],
  personalElements: [] as string[],
  personalImages: [] as string[],
  complexity: 'medium' as const,
  nameDisplay: 'initials_amp' as const,
  showDate: true,
  exampleImage: null as string | null,
  exampleStyle: null as string | null,
  matchExample: null,
  frameId: null,
  frameUrl: null,
};

function dump(label: string, input: WeddingPromptRequest) {
  const out = compileWeddingPrompt(input);
  console.log(`\n========== ${label} ==========`);
  console.log(out);
  console.log(`(${out.length} chars, ${out.split('\n').length} lines)`);
}

// 1) No reference, free palette, no settings, no flowers, initials only
dump('1) NO EXAMPLE - free palette, single-line monogram', {
  ...baseFields,
  styleVersion: 'style-system-v1',
  promptVersion: 'wedding-illustration-v5-reference-first',
});

// 2) No reference, picked sage_ivory palette, no flowers
dump('2) NO EXAMPLE - picked palette', {
  ...baseFields,
  styleVersion: 'style-system-v1',
  promptVersion: 'wedding-illustration-v5-reference-first',
  palette: ['#A3AA91', '#F5F0E6', '#D8CDBA'],
  flowers: ['Rose', 'Peony'],
  personalElements: ['Dog'],
});

// 3) Example + everything follows the reference (default on arrival)
dump('3) EXAMPLE - all "same as example"', {
  ...baseFields,
  styleVersion: 'style-system-v1',
  promptVersion: 'wedding-illustration-v5-reference-first',
  exampleImage: 'https://cdn.example.com/example.png',
  exampleStyle: 'botanical_watercolor',
  matchExample: {
    border: true,
    palette: true,
    flowers: true,
    elements: true,
  },
});

// 4) Example + user picked palette/border/flowers/elements (overrides)
dump('4) EXAMPLE - user picked palette + border + flowers + elements', {
  ...baseFields,
  styleVersion: 'style-system-v1',
  promptVersion: 'wedding-illustration-v5-reference-first',
  exampleImage: 'https://cdn.example.com/example.png',
  exampleStyle: 'botanical_watercolor',
  matchExample: {
    border: false,
    palette: false,
    flowers: false,
    elements: false,
  },
  palette: ['#6E3B47', '#F5EFE8', '#B08A8E'],
  frameId: 'frame_001',
  frameUrl: 'https://cdn.example.com/frame.png',
  flowers: ['Tulip', 'Hydrangea'],
  personalElements: ['Mountains'],
  personalImages: ['https://cdn.example.com/pet.png'],
});

// 5) Example + user SWITCHED to a different style (style override)
dump('5) EXAMPLE - user switched style to vintage_engraving', {
  ...baseFields,
  styleVersion: 'style-system-v1',
  promptVersion: 'wedding-illustration-v5-reference-first',
  exampleImage: 'https://cdn.example.com/example.png',
  exampleStyle: 'botanical_watercolor',
  style: 'vintage_engraving',
  matchExample: {
    border: true,
    palette: true,
    flowers: true,
    elements: true,
  },
});

// 6) Text line rules: initials_with_names (two-line) vs initials_amp (single-line)
dump('6a) EXAMPLE - initials_amp, no showDate -> single line', {
  ...baseFields,
  styleVersion: 'style-system-v1',
  promptVersion: 'wedding-illustration-v5-reference-first',
  nameDisplay: 'initials_amp',
  showDate: false,
});

dump('6b) EXAMPLE - initials_with_names -> two lines', {
  ...baseFields,
  styleVersion: 'style-system-v1',
  promptVersion: 'wedding-illustration-v5-reference-first',
  nameDisplay: 'initials_with_names',
  showDate: true,
});

dump('6c) EXAMPLE - full_names (single headline, full name)', {
  ...baseFields,
  styleVersion: 'style-system-v1',
  promptVersion: 'wedding-illustration-v5-reference-first',
  nameDisplay: 'full_names',
  showDate: true,
});

dump('6d) EXAMPLE - initials_with_names but partner2 empty -> names line suppressed', {
  ...baseFields,
  styleVersion: 'style-system-v1',
  promptVersion: 'wedding-illustration-v5-reference-first',
  nameDisplay: 'initials_with_names',
  partner2: '',
  showDate: true,
});
