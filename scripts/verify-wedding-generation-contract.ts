import assert from 'node:assert/strict';

import {
  resolveWeddingDisplayTexts,
  resolveWeddingLocationText,
} from '../src/shared/wedding/display-text';
import {
  compileWeddingDesignEditPrompt,
  compileWeddingPrompt,
  compileWeddingTextEditPrompt,
  getWeddingReferenceImages,
} from '../src/shared/wedding/prompt-compiler';
import type { WeddingPromptRequest } from '../src/shared/wedding/types';

const base: WeddingPromptRequest = {
  partner1: 'Anna',
  partner2: 'Alex',
  initials: ['A', 'A'],
  weddingDate: '2026-06-12',
  style: 'botanical_watercolor',
  layout: 'BOTANICAL_OVAL_01',
  typography: 'editorial_rose',
  palette: [],
  location: 'Lake Como',
  venue: 'Villa Example',
  flowers: [],
  personalElements: [],
  personalImages: ['https://fixture.test/pet.png'],
  complexity: 'medium',
  nameDisplay: 'initials_amp',
  showDate: true,
  exampleImage: 'https://fixture.test/example.png',
  exampleStyle: 'botanical_watercolor',
  frameUrl: 'https://fixture.test/frame.png',
};
let checks = 0;
function check(label: string, run: () => void) {
  run();
  checks += 1;
  console.log(`PASS: ${label}`);
}

check(
  'selected frame controls geometry, example controls artistic border treatment',
  () => {
    const prompt = compileWeddingPrompt(base);
    assert.match(prompt, /Border geometry only: reference image #2/);
    assert.match(
      prompt,
      /Preserve the example crest's border drawing technique/
    );
    assert.match(prompt, /without copying the frame reference's colors/);
    assert.doesNotMatch(prompt, /exact framing language|this border overrides/);
  }
);
check('explicit palette and style overrides remain authoritative', () => {
  const prompt = compileWeddingPrompt({
    ...base,
    style: 'vintage_engraving',
    palette: ['#112233', '#AABBCC'],
    matchExample: {
      border: false,
      palette: false,
      flowers: true,
      elements: true,
    },
  });
  assert.match(prompt, /overriding the example reference image's style/);
  assert.match(prompt, /Palette: #112233, #AABBCC/);
  assert.match(
    prompt,
    /Render the new contour in the selected Vintage Engraving/
  );
  assert.match(prompt, /Border colors follow the Palette instruction above/);
});
check('no example uses chosen style, frame #1 and bespoke lettering', () => {
  const input = { ...base, exampleImage: null };
  const prompt = compileWeddingPrompt(input);
  assert.match(prompt, /Border geometry only: reference image #1/);
  assert.match(prompt, /selected Botanical Watercolor medium/);
  assert.match(prompt, /bespoke wedding monogram/);
  assert.deepEqual(getWeddingReferenceImages(input), [
    base.frameUrl,
    ...base.personalImages!,
  ]);
});
check('initial reference order is example, frame, personal photos', () => {
  assert.deepEqual(getWeddingReferenceImages(base), [
    base.exampleImage,
    base.frameUrl,
    ...base.personalImages!,
  ]);
});
check('design edit uses current crest #1 and selected frame #2', () => {
  const prompt = compileWeddingDesignEditPrompt(base);
  assert.deepEqual(
    getWeddingReferenceImages(base, {
      kind: 'design',
      sourceImageUrl: 'https://fixture.test/current.png',
    }),
    ['https://fixture.test/current.png', base.frameUrl, ...base.personalImages!]
  );
  assert.match(prompt, /Border geometry only: reference image #2/);
  assert.match(prompt, /Reference image #1 is the current crest being edited/);
  assert.doesNotMatch(prompt, /Cormorant Garamond/);
});
check('text and quick edits omit frame and original example references', () => {
  for (const kind of ['lettering', 'reduce_colors', 'assistant']) {
    assert.deepEqual(
      getWeddingReferenceImages(base, {
        kind,
        sourceImageUrl: 'https://fixture.test/current.png',
      }),
      ['https://fixture.test/current.png', ...base.personalImages!]
    );
  }
  assert.deepEqual(
    getWeddingReferenceImages(
      { ...base, frameUrl: null },
      { kind: 'design', sourceImageUrl: 'https://fixture.test/current.png' }
    ),
    ['https://fixture.test/current.png', ...base.personalImages!]
  );
});
check(
  'text edit preserves current artistic lettering rather than default typeface',
  () => {
    const prompt = compileWeddingTextEditPrompt(base);
    assert.match(
      prompt,
      /preserve the current crest reference image's bespoke artistic letterforms/
    );
    assert.doesNotMatch(
      prompt,
      /Cormorant Garamond|Lettering style: elegant high-contrast serif/
    );
  }
);
check(
  'intentional identical partner initials remain twice in exact inventory',
  () => {
    assert.equal(resolveWeddingDisplayTexts(base).headline, 'A & A');
    const prompt = compileWeddingPrompt(base);
    assert.match(prompt, /Exact text inventory: \["A & A","June 12, 2026"\]/);
    assert.match(prompt, /identical partner initials; do not deduplicate them/);
    assert.match(prompt, /stray stems, disconnected strokes/);
  }
);
check('legacy location remains setting inspiration, not printed text', () => {
  assert.equal(resolveWeddingLocationText(base), '');
  const prompt = compileWeddingPrompt(base);
  assert.match(prompt, /Wedding setting inspiration: Lake Como, Villa Example/);
  assert.doesNotMatch(prompt, /Location line:/);
  assert.deepEqual(Object.keys(resolveWeddingDisplayTexts(base)), [
    'headline',
    'names',
    'date',
  ]);
});
check(
  'location opt-in prints venue and location without changing scenery',
  () => {
    const input = { ...base, showLocation: true };
    assert.equal(resolveWeddingLocationText(input), 'Villa Example, Lake Como');
    assert.match(
      compileWeddingTextEditPrompt(input),
      /keep all existing scenery, architecture and illustrated setting unchanged/
    );
    assert.match(
      compileWeddingDesignEditPrompt(input),
      /Do not change the existing scenery, architecture or illustrated wedding setting/
    );
    assert.equal(
      resolveWeddingLocationText({ ...input, venue: ' Lake Como ' }),
      'Lake Como'
    );
    for (const compile of [
      compileWeddingPrompt,
      compileWeddingTextEditPrompt,
      compileWeddingDesignEditPrompt,
    ]) {
      const prompt = compile(input);
      assert.match(prompt, /Location line: "Villa Example, Lake Como"/);
      assert.doesNotMatch(prompt, /Wedding setting inspiration:/);
      assert.match(prompt, /in this order: date, location/);
      assert.match(prompt, /preserve an existing matching text region/);
      assert.match(prompt, /extend clean white space below the artwork/);
    }
  }
);
check(
  'no names means no phantom names anchor; location-only/date-only supported',
  () => {
    for (const compile of [
      compileWeddingPrompt,
      compileWeddingTextEditPrompt,
      compileWeddingDesignEditPrompt,
    ]) {
      const prompt = compile({ ...base, showLocation: true });
      assert.match(
        prompt,
        /below the main inscription, in this order: date, location/
      );
      assert.doesNotMatch(prompt, /Names line:|below the names line/);
      const locationOnly = compile({
        ...base,
        showLocation: true,
        showDate: false,
      });
      assert.doesNotMatch(locationOnly, /Date line:/);
      assert.match(locationOnly, /in this order: location/);
      const withNames = compile({
        ...base,
        nameDisplay: 'initials_with_names',
        showLocation: true,
      });
      assert.match(
        withNames,
        /below the names line, in this order: date, location/
      );
    }
  }
);
check(
  'explicit lettering-style replacement is opt-in for both edit paths',
  () => {
    for (const compile of [
      compileWeddingTextEditPrompt,
      compileWeddingDesignEditPrompt,
    ]) {
      assert.doesNotMatch(compile(base), /Cormorant Garamond/);
      assert.doesNotMatch(
        compile(base, { replaceLetteringStyle: false }),
        /Cormorant Garamond/
      );
      const prompt = compile(base, { replaceLetteringStyle: true });
      assert.match(prompt, /Cormorant Garamond/);
      assert.match(prompt, /explicitly requested/);
      assert.doesNotMatch(
        prompt,
        /preserve the current crest reference image's bespoke artistic letterforms|Preserve its bespoke artistic lettering\./
      );
    }
  }
);
check(
  'design edit honors selected artwork style and layout separately from lettering',
  () => {
    const prompt = compileWeddingDesignEditPrompt({
      ...base,
      style: 'vintage_engraving',
      layout: 'VINTAGE_SHIELD_01',
    });
    assert.match(prompt, /overriding the example reference image's style/);
    assert.match(
      prompt,
      /render the artwork in Vintage Engraving, classic copperplate engraving/
    );
    assert.match(
      prompt,
      /Use the selected .* composition \(VINTAGE_SHIELD_01\)/
    );
    assert.match(prompt, /Preserve its bespoke artistic lettering/);
  }
);
console.log(`PASS: ${checks} generation contract checks (no provider calls)`);
