import type { LibraryArtwork, LibraryGlyphs } from './monogram-library';
import { renderStyledCapital } from './monogram-meadow-letters';

export function renderRestoredLetters(
  id: string,
  first: string,
  second: string,
  data: LibraryArtwork,
  glyphs?: LibraryGlyphs
) {
  const ink = data.ink;
  const pair = !!first && !!second;
  const cap = (
    c: string,
    center: number,
    top: number,
    scale: number,
    outlined = false
  ) =>
    renderStyledCapital(c, center, ink, {
      top,
      scale,
      weight: 2.1,
      outline: outlined ? data.paper : undefined,
    });
  const curve = (d: string, pen: number) =>
    `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${pen}" stroke-linecap="round"/>`;
  let marks = '';
  if (id === '01-02') {
    // The crown's mark always combines one serif initial with one writing-hand initial.
    const a = cap(first, pair ? 116 : 129, pair ? 132 : 139, 1.37);
    const slanted = second && glyphs?.pinyon[second];
    let b = '';
    if (slanted) {
      const [x, y, w, h, d] = slanted;
      const k = Math.min((pair ? 58 : 62) / w, 52 / h);
      b = `<path d="${d}" fill="${ink}" fill-rule="evenodd" transform="translate(${pair ? 135 : 129} ${pair ? 177 : 167}) scale(${k}) translate(${-x - w / 2} ${-y - h / 2})"/>`;
    }
    marks =
      a.svg +
      b +
      (pair
        ? curve('M104 195C100 181 116 179 127 186S150 195 152 187', 0.55)
        : '');
  } else if (id === '01-03') {
    const a = cap(first, pair ? 118 : 127, 88, 1.43);
    const b = cap(second, pair ? 138 : 129, pair ? 99 : 88, 1.37);
    marks =
      a.svg +
      b.svg +
      (pair
        ? curve(
            `M${a.right - 3} 111C128 129 138 142 151 131C166 118 154 108 143 108`,
            1.1
          )
        : '');
  } else if (id === '01-04') {
    const a = cap(first, pair ? 117 : 128, 88, 1.28, true);
    const b = cap(second, pair ? 136 : 129, pair ? 91 : 88, 1.25, true);
    const loop =
      'M111 119C119 108 138 114 132 122C128 127 120 118 121 126C123 137 137 133 144 126';
    marks =
      a.svg +
      b.svg +
      (pair
        ? curve(loop, 1.75) +
          `<path d="${loop}" stroke="${data.paper}" stroke-width=".58" fill="none"/>`
        : '');
  }
  return `<g data-layer="restored-style-initials" data-style="${id}">${marks}</g>`;
}
