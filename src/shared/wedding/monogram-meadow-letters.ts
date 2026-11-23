/** Original-style, custom capitals. No system or candidate font is consulted. */
type Shape = {
  w: number;
  stem?: string;
  hair?: string;
  stems?: number[];
  feet?: number[];
};
const alphabet: Record<string, Shape> = {
  A: {
    w: 21,
    stem: 'M10.4 0L19.3 27.9',
    hair: 'M10.4 0 1.3 28M4.3 28C-1.9 25.9 3.7 10.2 15 16.4',
    feet: [2, 19],
  },
  B: {
    w: 18,
    stems: [2.4],
    stem: 'M12.4 1.5C19.2 4.6 16 11.9 10.2 12.4M12.8 14C21.2 17.4 19.2 26.5 12.3 27.4',
    hair: 'M2.4 .2H8.7C18.7 .2 20.2 12.8 8.3 12.8H2.4M8.1 12.8C21.6 12.1 23 28 9.6 28H2.4',
  },
  C: {
    w: 21,
    stem: 'M4.8 3.7C-.6 8 -1.6 20.2 5.4 25.2',
    hair: 'M19.7 6C15.4 -4 1.2 -1.4 1.2 14.6C1.2 28.4 14.5 32.6 20.1 22.7M19.8 .1 19.7 6.7',
  },
  D: {
    w: 22,
    stems: [2.8],
    stem: 'M16.7 3.5C23.1 8.3 22.8 21.5 16.5 24.8',
    hair: 'M2.8 .2H7.8C16 .2 21.3 5.2 21.3 14C21.3 22.9 15.6 28 7.8 28H2.8',
  },
  E: {
    w: 18,
    stems: [2.4],
    hair: 'M2.4 .2H16.2L17.1 5.3M2.4 13H13.2M13.2 9.6V16.5M2.4 28H16.9L17.8 22.8',
  },
  F: {
    w: 18,
    stems: [2.4],
    hair: 'M2.4 .2H16.1L17.3 5.4M2.4 13H12.9M12.9 9.5V16.4',
  },
  G: {
    w: 23,
    stem: 'M4.8 3.7C-.6 8 -1.6 20.2 5.4 25.2M20.1 17V25.6',
    hair: 'M19.8 6C15.3 -4 1.2 -1.4 1.2 14.6C1.2 28.6 14.5 31.3 20.1 25.6M19.9 .3 19.8 6.7M16.5 17H22.2',
  },
  H: {
    w: 21.7,
    stems: [2.5, 19.2],
    hair: 'M2.5 14C8.1 13.6 13.3 13.6 19.2 14',
  },
  I: { w: 9, stems: [4.5] },
  J: {
    w: 16,
    stem: 'M13.3 0V21C13.3 25.2 11.4 27.9 8.2 28.25',
    hair: 'M13.3 20.7C13.3 29.9 3.2 31 1.6 24.3M10.6 .2H16',
  },
  K: {
    w: 22,
    stems: [2.4],
    stem: 'M8.7 11.5 19.8 28',
    hair: 'M2.4 17.5 19.8 0M17.1 .2H22',
    feet: [20],
  },
  L: { w: 18, stems: [2.5], hair: 'M2.5 28H16L17.4 22.5' },
  M: {
    w: 29,
    stem: 'M2.2 0 14.7 27.8M26.3 .2V28',
    hair: 'M2.2 0V28M14.7 27.8 26.3 .2M0 .2H4.6M23.8 .2H29',
    feet: [2.2, 26.3],
  },
  N: {
    w: 23,
    stem: 'M2.4 0 20.4 28',
    hair: 'M2.4 0V28M20.4 0V28M0 .2H4.8M17.8 .2H23',
    feet: [2.4],
  },
  O: {
    w: 23,
    stem: 'M5.2 3.7C.2 8 -.1 20.7 5.4 24.9M17.9 3.6C23.2 8 23.2 20.4 17.5 25.1',
    hair: 'M11.5 -.25C-2 -.25-2 28.3 11.5 28.3C25 28.3 25 -.25 11.5 -.25Z',
  },
  P: {
    w: 19,
    stems: [2.6],
    stem: 'M12.8 1.3C19.9 5.3 17.7 13.1 12.5 15',
    hair: 'M2.6 .2H8.6C22 .2 22 15.6 8.6 15.6H2.6',
  },
  Q: {
    w: 24,
    stem: 'M5.2 3.7C.2 8 -.1 20.7 5.4 24.9M17.9 3.6C23.2 8 23.2 20.4 17.5 25.1',
    hair: 'M11.5 -.25C-2 -.25-2 28.3 11.5 28.3C25 28.3 25 -.25 11.5 -.25ZM9.4 23.3C14.3 21 15.8 31.6 23.9 29.2',
  },
  R: {
    w: 22,
    stems: [2.6],
    stem: 'M12.8 1.3C19.9 5.3 17.7 13.1 12.5 15M9.5 15.6C14.6 16.6 15.1 25.3 19.7 27.3',
    hair: 'M2.6 .2H8.6C22 .2 22 15.6 8.6 15.6H2.6M19.1 27.1C20.2 28.6 21.4 28.3 22.1 27.4',
  },
  S: {
    w: 18,
    stem: 'M4.1 3.1C-.2 9.3 3.4 11.2 9 14C14.6 16.8 18.2 19.9 14.4 25',
    hair: 'M15.8 6.1C15.3 -.9 5.4 -2.1 2.8 4.2C-1.7 15.1 21.1 13.1 15 24.9C12.3 30.8 2.2 29.3 1.3 22.2M16 .4V6.6M1.2 22V27.9',
  },
  T: { w: 22, stems: [11], hair: 'M.6 5.1 1.5 .2H20.5L21.4 5.1' },
  U: {
    w: 23,
    stem: 'M2.7 .2V18.7C2.7 24.6 5.6 28.2 11.7 28.2',
    hair: 'M2.7 17.7C2.7 32 20.5 32.2 20.5 17.7V.2M0 .2H5.5M17.8 .2H23',
  },
  V: { w: 22, stem: 'M2.2 .2 11 28', hair: 'M11 28 20 .2M0 .2H5.2M17.4 .2H22' },
  W: {
    w: 33,
    stem: 'M2.5 .2 9.6 28M15.1 4.8 22.7 28',
    hair: 'M9.6 28 17 .2M22.7 28 30.4 .2M0 .2H5.3M14.1 .2H19.2M27.5 .2H33',
  },
  X: {
    w: 23,
    stem: 'M2.4 .2 20.5 28',
    hair: 'M20.6 .2 2.4 28M0 .2H5M17.9 .2H23',
    feet: [2.4, 20.5],
  },
  Y: {
    w: 22,
    stem: 'M2.2 .2 11.2 14.4V28',
    hair: 'M11.2 14.4 20.2 .2M0 .2H5.2M17.6 .2H22',
    feet: [11.2],
  },
  Z: {
    w: 20,
    stem: 'M18.5 .2 1.3 28',
    hair: 'M1.1 5.3 2 .2H18.5M1.3 28H18.2L19.3 22.8',
  },
};
export function renderStyledCapital(
  letter: string,
  center: number,
  ink: string,
  options: {
    top?: number;
    maxWidth?: number;
    scale?: number;
    weight?: number;
    outline?: string;
  } = {}
) {
  const glyph = alphabet[letter];
  if (!glyph) return { svg: '', right: center };
  const zoom = options.scale ?? 1;
  const scale = Math.min(zoom, (options.maxWidth ?? 25 * zoom) / glyph.w);
  const x = center - (glyph.w * scale) / 2;
  let heavy = glyph.stem ?? '';
  let fine = glyph.hair ?? '';
  for (const s of glyph.stems ?? []) {
    heavy += `M${s} .2V27.8`;
    fine += `M${s - 2.45} .2H${s + 2.45}`;
  }
  for (const s of [...(glyph.stems ?? []), ...(glyph.feet ?? [])]) {
    fine += `M${s - 2.45} 28H${s + 2.45}`;
  }
  return {
    svg: `<g transform="translate(${x} ${options.top ?? 114}) scale(${scale} ${zoom})" fill="none" stroke="${ink}" stroke-linejoin="round">${
      options.outline
        ? `<path d="${heavy}" stroke-width="2.7"/><path d="${fine}" stroke-width="1.25"/><path d="${heavy}" stroke="${options.outline}" stroke-width="1.55"/><path d="${fine}" stroke="${options.outline}" stroke-width=".55"/>`
        : `<path d="${heavy}" stroke-width="${options.weight ?? 1.36}"/><path d="${fine}" stroke-width=".48"/>`
    }</g>`,
    right: center + (glyph.w * scale) / 2 - 1.8,
  };
}
export function renderMeadowLetters(
  first: string,
  second: string,
  ink: string
) {
  const a = renderStyledCapital(first, second ? 116.4 : 127.5, ink);
  const b = renderStyledCapital(second, first ? 137.3 : 127.5, ink);
  const arc =
    a.svg && b.svg
      ? `<path d="M${a.right} 141.2 C${a.right + 2} 147.8 135.3 150.8 ${b.right - 4.5} 145.6 C${b.right + 1.9} 141  ${b.right + 2.2} 125.7 129.7 123.3" fill="none" stroke="${ink}" stroke-width=".52" stroke-linecap="round"/>`
      : '';
  return `<g data-layer="meadow-style-initials">${a.svg}${b.svg}${arc}</g>`;
}
