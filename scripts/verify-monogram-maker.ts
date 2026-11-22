import { strict as assert } from 'node:assert';

import {
  defaultMonogram,
  loadMonogramAtlas,
  monogramElements,
  monogramFonts,
  monogramLayoutChoices,
  moveInitialToCenter,
  normalizeInitials,
  renderMonogramElementSvg,
  renderMonogramSvg,
} from '../src/shared/wedding/monogram-maker';

async function main() {
  const atlas = await loadMonogramAtlas();
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const layouts = ['paired', 'overlap'] as const;
  const frames = ['none', 'circle', 'double'] as const;
  let checked = 0;

  assert.equal(normalizeInitials('á & l 🤍mqrst'), 'ALM');
  assert.equal(moveInitialToCenter('ALM', 2), 'AML');
  assert.equal(renderMonogramSvg({ ...defaultMonogram, initials: '' }), '');
  assert.equal(renderMonogramSvg({ ...defaultMonogram, initials: 'WQ' }), '');
  assert.equal(
    renderMonogramSvg(defaultMonogram),
    renderMonogramSvg(defaultMonogram, atlas)
  );

  for (const [font] of monogramFonts) {
    for (const a of alphabet) {
      for (const b of alphabet) {
        for (const layout of layouts) {
          for (const frame of frames) {
            const svg = renderMonogramSvg(
              {
                ...defaultMonogram,
                font,
                layout,
                frame,
                initials: a + b,
              },
              atlas
            );
            assert.ok(
              svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')
            );
            assert.doesNotMatch(svg, /NaN|Infinity|<text|font-family/);
            assert.equal(svg.includes('maskUnits'), layout === 'overlap');
            assert.equal(svg.includes('r="148"'), frame !== 'none');
            checked++;
          }
        }
      }
    }
    for (const initials of ['W', 'WWW', 'JQF', 'MMW', 'III']) {
      const svg = renderMonogramSvg(
        { ...defaultMonogram, font, initials },
        atlas
      );
      assert.equal(svg.match(/<path /g)?.length, initials.length);
      checked++;
    }
  }

  const overlap = {
    ...defaultMonogram,
    initials: 'MQ',
    layout: 'overlap',
  } as const;
  const first = renderMonogramSvg({ ...overlap, front: 'first' }, atlas);
  const last = renderMonogramSvg({ ...overlap, front: 'last' }, atlas);
  assert.notEqual(first, last);
  assert.notEqual(last, renderMonogramSvg({ ...overlap, spacing: 0 }, atlas));
  const paired = { ...defaultMonogram, initials: 'MQ' };
  assert.notEqual(
    renderMonogramSvg({ ...paired, separator: 'dot' }, atlas),
    renderMonogramSvg({ ...paired, separator: 'ampersand' }, atlas)
  );
  const choices = Object.values(monogramLayoutChoices);
  assert.equal(choices.length, 7);
  let layerCombinations = 0;
  for (const [font] of monogramFonts) {
    for (const layout of choices) {
      const artwork = new Set<string>();
      for (const frame of monogramElements.frame) {
        for (const wreath of monogramElements.wreath) {
          for (const embellishment of monogramElements.embellishment) {
            const svg = renderMonogramSvg(
              {
                ...defaultMonogram,
                ...layout,
                initials: 'MW',
                font,
                frame,
                wreath,
                embellishment,
                frameInk: '#ab1234',
                wreathInk: '#3456ab',
                embellishmentInk: '#775533',
              },
              atlas
            );
            assert.ok(svg.length > 100);
            assert.doesNotMatch(svg, /NaN|Infinity|<text|<image/);
            assert.equal(
              svg.includes(
                'data-monogram-layer="frame" fill="none" color="#ab1234"'
              ),
              frame !== 'none'
            );
            assert.equal(
              svg.includes(
                'data-monogram-layer="wreath" fill="none" color="#3456ab"'
              ),
              wreath !== 'none'
            );
            assert.equal(
              svg.includes(
                'data-monogram-layer="embellishment" fill="none" color="#775533"'
              ),
              embellishment !== 'none'
            );
            artwork.add(svg);
            layerCombinations++;
          }
        }
      }
      assert.equal(
        artwork.size,
        monogramElements.frame.length *
          monogramElements.wreath.length *
          monogramElements.embellishment.length
      );
    }
  }
  assert.equal(
    new Set(
      monogramElements.frame.map((value) =>
        renderMonogramElementSvg('frame', value)
      )
    ).size,
    monogramElements.frame.length
  );
  assert.equal(
    new Set(
      monogramElements.wreath.map((value) =>
        renderMonogramElementSvg('wreath', value)
      )
    ).size,
    monogramElements.wreath.length
  );
  assert.equal(
    new Set(
      monogramElements.embellishment.map((value) =>
        renderMonogramElementSvg('embellishment', value)
      )
    ).size,
    monogramElements.embellishment.length
  );
  assert.match(
    renderMonogramSvg(
      { ...defaultMonogram, wreath: 'laurel', wreathInk: 'invalid' },
      atlas
    ),
    /data-monogram-layer="wreath" fill="none" color="#34443b"/
  );
  const layoutsAtAL = choices.map((layout) =>
    renderMonogramSvg(
      { ...defaultMonogram, ...layout, font: 'cormorant' },
      atlas
    )
  );
  assert.equal(new Set(layoutsAtAL).size, choices.length);
  for (const frame of ['none', 'circle', 'diamond'] as const) {
    const sample = {
      ...defaultMonogram,
      font: 'cormorant',
      separator: 'none',
      frame,
    } as const;
    const read = (spacing: number) =>
      [
        ...renderMonogramSvg({ ...sample, spacing }, atlas).matchAll(
          /transform="translate\(([-.\d]+) [-.\d]+\) scale\(([-.\d]+)\) translate/g
        ),
      ].map((item) => [Number(item[1]), Number(item[2])]);
    const tight = read(0);
    const wide = read(100);
    assert.equal(tight.length, 2);
    assert.equal(wide.length, 2);
    assert.deepEqual(
      tight.map((p) => p[1]),
      wide.map((p) => p[1])
    );
    assert.ok(wide[1][0] - wide[0][0] - (tight[1][0] - tight[0][0]) > 30);
  }
  const clear = renderMonogramSvg(defaultMonogram, atlas);
  const invalid = renderMonogramSvg(
    { ...defaultMonogram, background: 'invalid' },
    atlas
  );
  assert.equal(clear, invalid);
  const filled = renderMonogramSvg(
    { ...defaultMonogram, background: '#eadbee' },
    atlas
  );
  const backgroundRect = '<rect width="360" height="360" fill="#eadbee"/>';
  assert.ok(filled.includes('>' + backgroundRect + '<g'));
  assert.equal(filled.replace(backgroundRect, ''), clear);
  console.log(
    'PASS distinct layouts, measurable spacing with fixed glyph scale, and optional SVG background.'
  );
  console.log(
    `PASS ${layerCombinations} independent element combinations across ${monogramFonts.length} fonts and ${choices.length} layouts; per-layer colors and choice previews verified.`
  );
  console.log(
    `PASS ${checked} SVG combinations across ${monogramFonts.length} fonts; layer order, spacing and separators verified.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
