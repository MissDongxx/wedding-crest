import type { SignArtwork, SignDetails, SignTemplate } from './welcome-sign';
import { signPalette, type SignAppearance } from './welcome-sign-customization';

const faces = {
  book: '"Sign Book", Georgia, serif',
  serif: '"Sign Garamond", Georgia, serif',
  italic: '"Sign Fraunces Italic", Georgia, serif',
  bodoni: '"Sign Bodoni", Georgia, serif',
  classic: '"Sign Classic", Georgia, serif',
  cinzel: '"Sign Cinzel", Georgia, serif',
  sans: '"Sign Sans", Arial, sans-serif',
  script: '"Sign Script", Georgia, serif',
  fine: '"Sign Fine", "Sign Script", Georgia, serif',
  pinyon: '"Sign Pinyon", "Sign Script", Georgia, serif',
  alex: '"Sign Alex", "Sign Script", Georgia, serif',
  hand: '"Sign Hand", "Sign Script", Georgia, serif',
};
type Face = keyof typeof faces;
type TypeStyle = {
  color?: string;
  tracking?: number;
  align?: CanvasTextAlign;
  max?: number;
  upper?: boolean;
};

export function drawReferenceSign(
  ctx: CanvasRenderingContext2D,
  template: SignTemplate,
  details: SignDetails,
  h: number,
  date: string,
  assets: ReadonlyMap<SignArtwork, HTMLImageElement>,
  appearance: SignAppearance
) {
  const { sceneId, variation: v } = template;
  const { paper, ink, accent, panel } = signPalette(
    template,
    appearance.palette
  );
  const inheritedColors = appearance.palette === 'template';
  const accentColor = (original: string) =>
    inheritedColors ? original : accent;
  const textColor = (original: string) => (inheritedColors ? original : ink);
  const nameFace = (original: Face): Face =>
    appearance.nameFont === 'template' ? original : appearance.nameFont;
  const nameStyle = (style: TypeStyle): TypeStyle =>
    appearance.nameFont === 'pinyon'
      ? { ...style, upper: false, tracking: 0 }
      : style;
  const { first, second } = details;
  const ry = (y: number) => y * h;
  const xCenter = 300;
  const box = (
    x: number,
    y: number,
    w: number,
    height: number,
    fill: string
  ) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, height);
  };
  const stroke = (
    x: number,
    y: number,
    w: number,
    height: number,
    color = accent,
    weight = 1
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = weight;
    ctx.strokeRect(x, y, w, height);
  };
  const shape = (d: string, color = accent, weight?: number) => {
    const p = new Path2D(d);
    if (weight) {
      ctx.strokeStyle = color;
      ctx.lineWidth = weight;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(p);
    } else {
      ctx.fillStyle = color;
      ctx.fill(p);
    }
  };
  const rule = (
    left: number,
    right: number,
    y: number,
    color = accent,
    weight = 1
  ) => shape(`M${left} ${ry(y)}H${right}`, color, weight);
  const translated = (x: number, y: number, s: number, fn: () => void) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    fn();
    ctx.restore();
  };
  const fit = (
    text: string,
    face: Face,
    px: number,
    max: number,
    tracking: number
  ) => {
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`;
    for (let i = 0; i < 8; i++) {
      ctx.font = `${px}px ${faces[face]}`;
      const m = ctx.measureText(text);
      const inkWidth = Math.max(
        m.width,
        m.actualBoundingBoxLeft + m.actualBoundingBoxRight
      );
      if (inkWidth <= max || px <= 9) break;
      px = Math.max(9, Math.min(px - 0.2, (px * max) / inkWidth));
    }
    return px;
  };
  const type = (
    value: string,
    x: number,
    y: number,
    face: Face,
    px: number,
    {
      color = ink,
      tracking = 0,
      align = 'center',
      max = 497,
      upper = false,
    }: TypeStyle = {}
  ) => {
    const label = upper ? value.toLocaleUpperCase() : value;
    ctx.textAlign = align;
    const size = fit(label, face, px, max, tracking);
    ctx.font = `${size}px ${faces[face]}`;
    ctx.fillStyle = color;
    ctx.fillText(label, x, ry(y), max);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  };
  const caps = (value: string, y: number, px = 17, config: TypeStyle = {}) =>
    type(value, 300, y, 'sans', px, { upper: true, tracking: 3, ...config });
  const numeric = details.date.split('-');
  const numericDate =
    numeric.length === 3 ? [numeric[1], numeric[2], numeric[0]].join('.') : '';
  const initials =
    `${Array.from(first.trim())[0] ?? ''} · ${Array.from(second.trim())[0] ?? ''}`.toLocaleUpperCase();
  const finish = (
    y: number,
    {
      dots = false,
      color = ink,
      tracking = 2.5,
      max = 435,
    }: TypeStyle & { dots?: boolean } = {}
  ) =>
    type(dots ? numericDate : date, 300, y, 'sans', 16, {
      color,
      tracking,
      max,
      upper: !dots,
    });
  const paired = (
    y: number,
    face: Face,
    px: number,
    {
      join = '&',
      fallback = 0.126,
      x = 300,
      ...cfg
    }: TypeStyle & { join?: string; fallback?: number; x?: number } = {}
  ) => {
    face = nameFace(face);
    cfg = nameStyle(cfg);
    const both = `${first} ${join} ${second}`;
    const max = cfg.max ?? 479;
    ctx.textAlign = cfg.align ?? 'center';
    const sized = fit(
      cfg.upper ? both.toLocaleUpperCase() : both,
      face,
      px,
      max,
      cfg.tracking ?? 0
    );
    if (sized >= Math.min(px * 0.72, 43))
      type(both, x, y, face, sized, { ...cfg, max });
    else {
      const a = `${first} ${join}`,
        upper = cfg.upper ?? false,
        track = cfg.tracking ?? 0;
      const target = Math.min(px, fallback * h * 0.67);
      const match = Math.min(
        fit(upper ? a.toLocaleUpperCase() : a, face, target, max, track),
        fit(
          upper ? second.toLocaleUpperCase() : second,
          face,
          target,
          max,
          track
        )
      );
      type(a, x, y - fallback * 0.51, face, match, { ...cfg, max });
      type(second, x, y + fallback * 0.42, face, match, { ...cfg, max });
    }
  };
  const names = (
    start: number,
    end: number,
    face: Face,
    px: number,
    {
      join = '&',
      joinFace = 'script',
      joinSize = 34,
      x = 300,
      drift = 0,
      ...cfg
    }: TypeStyle & {
      join?: string;
      joinFace?: Face;
      joinSize?: number;
      x?: number;
      drift?: number;
    } = {}
  ) => {
    face = nameFace(face);
    cfg = nameStyle(cfg);
    const max = cfg.max ?? 473,
      track = cfg.tracking ?? 0,
      upper = cfg.upper ?? false;
    const maxPx = Math.min(
      px,
      (end - start) *
        h *
        (face === 'fine' || face === 'pinyon' || face === 'hand' ? 0.84 : 0.69)
    );
    ctx.textAlign = cfg.align ?? 'center';
    const a = upper ? first.toLocaleUpperCase() : first;
    const b = upper ? second.toLocaleUpperCase() : second;
    let match = Math.min(
      fit(a, face, maxPx, max, track),
      fit(b, face, maxPx, max, track)
    );
    const joinY = start + (end - start) * 0.424;
    fit(join, joinFace, joinSize, 150, 0);
    const connector = ctx.measureText(join);
    const topSpace = ry(joinY - start) - connector.actualBoundingBoxAscent - 3;
    const bottomSpace =
      ry(end - joinY) - connector.actualBoundingBoxDescent - 3;
    for (let i = 0; i < 4; i++) {
      fit(a, face, match, max, track);
      const down = ctx.measureText(a).actualBoundingBoxDescent;
      const up = ctx.measureText(b).actualBoundingBoxAscent;
      const ratio = Math.min(
        1,
        down > 0 ? topSpace / down : 1,
        up > 0 ? bottomSpace / up : 1
      );
      if (ratio >= 1) break;
      match = Math.max(9, match * ratio);
    }
    type(first, x - drift, start, face, match, { ...cfg, max });
    type(join, x, joinY, joinFace, joinSize, {
      color: cfg.color,
      align: cfg.align,
      max: 150,
    });
    type(second, x + drift, end, face, match, { ...cfg, max });
  };
  const inkArt = (
    key: SignArtwork,
    x: number,
    y: number,
    w: number,
    hh: number,
    opts: { flip?: boolean; turn?: number; alpha?: number; fill?: boolean } = {}
  ) => {
    const im = assets.get(key);
    if (!im) return;
    ctx.save();
    ctx.translate(x + w / 2, y + hh / 2);
    if (opts.turn) ctx.rotate(opts.turn);
    if (opts.flip) ctx.scale(-1, 1);
    ctx.globalAlpha = opts.alpha ?? 1;
    const s = Math.min(w / im.naturalWidth, hh / im.naturalHeight);
    const dw = opts.fill ? w : im.naturalWidth * s,
      dh = opts.fill ? hh : im.naturalHeight * s;
    ctx.drawImage(im, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  };
  const branch = (
    x: number,
    y: number,
    s: number,
    flip = false,
    tone = accent
  ) => {
    translated(x, y, s, () => {
      if (flip) ctx.scale(-1, 1);
      shape(
        'M-80 29C-39 16 21 -5 80 -27 M-63 23Q-51 -7 -36 -15Q-41 11 -59 21 M-44 15Q-20 35 -7 26Q-24 15 -44 15 M-23 8Q-9 -21 8 -26Q3 -5 -21 6 M3 -1Q21 12 35 6Q21 -2 4 -1 M22 -8Q32 -24 48 -28Q46 -14 23 -8 M47 -16Q67 -18 77 -33Q57 -33 47 -16',
        tone,
        1.45
      );
    });
  };
  const arch = (
    left: number,
    top: number,
    bottom: number,
    color: string,
    weight?: number
  ) => {
    const r = 300 - left,
      right = 600 - left;
    shape(
      `M${left} ${bottom}V${top + r}A${r} ${r} 0 0 1 ${right} ${top + r}V${bottom}Z`,
      color,
      weight
    );
  };
  const seal = (y: number, col = accent, s = 1) => {
    translated(300, ry(y), s, () => {
      for (const x of [-28, 3]) {
        for (const [dx, dy, w, hh] of [
          [0, 0, 25, 3],
          [2, 7, 21, 2],
          [11, -6, 3, 15],
          [2, 12, 21, 9],
          [0, 23, 25, 3],
          [6, 20, 3, 5],
          [17, 20, 3, 5],
          [2, 29, 21, 11],
        ])
          box(x + dx, dy - 20, w, hh, col);
        box(x + 6, -6, 13, 4, paper);
        box(x + 6, 12, 13, 5, paper);
      }
    });
  };

  box(0, 0, 600, h, paper);
  switch (sceneId) {
    case 'chateau': {
      const offset = v === 1 ? 42 : 26,
        right = 600 - offset,
        bottom = h - offset;
      shape(
        `M${offset + 13} ${offset} C14 40 78 84 81 54 S20 41 31 112 C43 176 60 222 31 280 C6 339 70 335 57 303 S19 348 31 407 C51 477 13 523 35 587 Q64 661 31 ${bottom - 69} T${offset + 15} ${bottom}
        C119 ${bottom - 19} 144 ${bottom + 14} 240 ${bottom - 2} S405 ${bottom + 6} 474 ${bottom - 3} S549 ${bottom - 16} ${right - 10} ${bottom}
        Q${right + 2} ${bottom + 2} ${right - 4} ${bottom - 30} C534 ${bottom - 93} 565 ${bottom - 84} 570 580 S547 487 577 404 C602 349 545 343 551 326 Q565 301 578 353
        C558 310 579 271 568 219 S540 135 566 90 C597 40 545 25 524 52 Q542 76 571 38 Q581 22 547 27 C462 43 429 24 362 26 S210 45 145 25 S84 36 ${offset + 13} ${offset}Z`,
        accent,
        v === 2 ? 1.25 : 2
      );
      if (v === 1) {
        branch(300, ry(0.205), 0.84, false);
        branch(300, ry(0.255), -0.72, true);
        type(initials, 300, 0.388, 'classic', 81, { tracking: 6 });
        caps('the wedding of', 0.454, 14, { tracking: 4.2 });
        paired(0.593, 'serif', 57);
        finish(0.786, { dots: true });
      } else {
        translated(300, ry(0.16), v === 2 ? 0.7 : 1, () => {
          // An original ink chandelier, like the hand-drawn venue vignette in the proof.
          shape(
            'M0 -72V-32 M-9 -61Q0 -69 9 -61L0 -40 M0 -34C-2 -1 12 5 0 29 C-12 5 2 -1 0 -34 M0 -28Q-27 -13 -42 7Q-62 28 -75 10 M0 -18Q-23 -2 -28 29Q-35 49 -48 31 M0 -28Q27 -13 42 7Q62 28 75 10 M0 -18Q23 -2 28 29Q35 49 48 31 M-75 10V-4M-48 31V16M75 10V-4M48 31V16M0 29V45 M-9 45Q0 58 9 45',
            accent,
            1.55
          );
        });
        type('welcome to the', 300, 0.328, 'pinyon', 39, { max: 332 });
        type('wedding of', 300, 0.377, 'pinyon', 39, { max: 310 });
        names(0.515, 0.683, v === 2 ? 'serif' : 'alex', v === 2 ? 78 : 101, {
          join: 'and',
          joinFace: 'pinyon',
          joinSize: 39,
          drift: v === 2 ? 0 : 27,
          max: 414,
        });
        type(date, 350, 0.808, 'pinyon', 33, { max: 300 });
        branch(127, ry(0.833), 0.6, false);
        branch(127, ry(0.88), 0.55, true);
      }
      break;
    }
    case 'meadow':
      if (v === 0) {
        inkArt('wreath', 36, ry(0.058), 528, ry(0.875), { fill: true });
        type('WELCOME', 300, 0.341, 'serif', 25, { tracking: 6 });
        caps('to the wedding of', 0.377, 13, { tracking: 2.3 });
        names(0.494, 0.649, 'pinyon', 87, {
          max: 352,
          join: '&',
          joinSize: 35,
        });
        finish(0.719, { tracking: 1.9, max: 340 });
      } else if (v === 1) {
        stroke(34, 30, 532, h - 60, accent, 1.3);
        inkArt('meadow', 18, ry(0.712), 564, ry(0.274));
        caps('welcome to the wedding of', 0.284, 15, { tracking: 2 });
        names(0.443, 0.615, 'fine', 108, {
          max: 456,
          join: 'and',
          joinSize: 31,
        });
        finish(0.696, { dots: true });
      } else {
        inkArt('meadow', -27, ry(0.665), 654, ry(0.369), { alpha: 0.9 });
        type('Welcome', 300, 0.239, 'hand', 102, { max: 437 });
        caps('to the wedding of', 0.31, 14, { tracking: 3.1 });
        paired(0.49, 'serif', 66, { max: 468 });
        finish(0.607, { tracking: 3 });
      }
      break;
    case 'editorial':
      if (v === 0) {
        rule(42, 558, 0.145, ink, 1.3);
        type('The Wedding Post', 300, 0.119, 'classic', 35, { max: 506 });
        caps('wedding edition', 0.182, 13, { tracking: 4 });
        type('FOREVER BEGINS TODAY', 300, 0.309, 'bodoni', 50, { max: 519 });
        rule(42, 558, 0.344, ink, 1.2);
        caps('the wedding of', 0.424, 14, { tracking: 3.7 });
        names(0.536, 0.705, 'bodoni', 90, {
          joinFace: 'italic',
          joinSize: 36,
          max: 494,
        });
        rule(42, 558, 0.777, ink, 1);
        finish(0.837, { tracking: 3 });
      } else if (v === 1) {
        caps('the wedding issue', 0.193, 19, { tracking: 5.5, color: accent });
        rule(76, 524, 0.218, accent, 0.95);
        names(0.446, 0.651, 'bodoni', 105, {
          max: 488,
          joinFace: 'italic',
          joinSize: 46,
        });
        finish(0.807, { color: accent, tracking: 4 });
      } else {
        type('The wedding of', 58, 0.243, 'italic', 36, {
          align: 'left',
          max: 485,
        });
        names(0.442, 0.652, 'bodoni', 112, {
          x: 58,
          align: 'left',
          max: 480,
          joinFace: 'italic',
          joinSize: 39,
        });
        rule(58, 542, 0.737, accent, 1);
        type(date, 58, 0.808, 'serif', 25, {
          align: 'left',
          tracking: 1.4,
          max: 475,
        });
      }
      break;
    case 'oriental': {
      if (v === 0) {
        // Portrait source: a dense floral crown, then flowing welcome and a small seal between the names.
        inkArt('gold', -66, ry(-0.077), 397, ry(0.325), {
          turn: 0.25,
          alpha: 0.96,
          fill: true,
        });
        inkArt('gold', 274, ry(-0.085), 397, ry(0.352), {
          turn: -0.16,
          flip: true,
          alpha: 0.98,
          fill: true,
        });
        inkArt('gold', 16, ry(0.717), 431, ry(0.31), {
          turn: -0.2,
          alpha: 0.21,
        });
        type('welcome', 300, 0.393, 'hand', 128, {
          max: 492,
          color: textColor('#f9e1a2'),
        });
        caps('to the wedding of', 0.446, 15, {
          color: textColor('#eed19a'),
          tracking: 4,
        });
        ctx.textAlign = 'left';
        const face = nameFace('serif');
        const style = nameStyle({
          color: textColor('#ffdfab'),
          upper: true,
          tracking: 2.35,
          max: 218,
        });
        const a = style.upper ? first.toLocaleUpperCase() : first;
        const b = style.upper ? second.toLocaleUpperCase() : second;
        const match = Math.min(
          fit(a, face, 48, 218, style.tracking ?? 0),
          fit(b, face, 48, 218, style.tracking ?? 0)
        );
        if (match >= 27) {
          type(first, 269, 0.577, face, match, { ...style, align: 'right' });
          seal(0.557, accentColor('#f5c976'), 0.68);
          type(second, 331, 0.577, face, match, { ...style, align: 'left' });
        } else {
          names(0.538, 0.684, 'serif', 58, {
            ...style,
            max: 460,
            joinSize: 28,
          });
        }
        finish(0.76, {
          dots: true,
          color: textColor('#ffdfab'),
          tracking: 3.2,
        });
        caps('thank you for celebrating with us', 0.829, 13, {
          color: textColor('#efcf9d'),
          tracking: 2.5,
        });
        break;
      }
      const tone = v === 1 ? accent : textColor('#f5d89a');
      const floral = v === 1 ? 0.41 : 0.97;
      inkArt('gold', -109, ry(0.12), 277, ry(0.71), {
        turn: -0.24,
        alpha: floral,
        fill: true,
      });
      inkArt('gold', 432, ry(0.17), 278, ry(0.66), {
        turn: 0.25,
        flip: true,
        alpha: floral,
        fill: true,
      });
      if (v === 2) stroke(31, 30, 538, h - 60, accent, 1);
      seal(0.175, tone, 1.03);
      type('Welcome', 300, 0.321, v === 2 ? 'pinyon' : 'fine', 110, {
        color: tone,
        max: 398,
      });
      caps('to our wedding', 0.378, 13, { color: tone, tracking: 3 });
      rule(155, 215, 0.371, tone, 1);
      rule(385, 445, 0.371, tone, 1);
      if (v === 1)
        paired(0.555, 'alex', 81, {
          max: 401,
          join: 'and',
          fallback: 0.14,
          color: ink,
        });
      else
        names(0.506, 0.674, v === 2 ? 'pinyon' : 'fine', 115, {
          join: '&',
          joinFace: 'pinyon',
          joinSize: 28,
          drift: 0,
          max: 365,
          color: tone,
        });
      branch(300, ry(0.755), 0.35, false, tone);
      finish(0.833, { color: tone, tracking: 2.5, max: 390 });
      break;
    }
    case 'chapel': {
      if (v === 1) arch(44, ry(0.084), ry(0.912), accent, 1.75);
      else {
        stroke(33, 33, 534, h - 66, accent, v === 0 ? 1.4 : 1.8);
        stroke(42, 42, 516, h - 84, accent, 0.7);
      }
      if (v === 2) {
        branch(300, ry(0.173), 0.94);
        type(initials, 300, 0.362, 'cinzel', 85, { tracking: 4.3, max: 393 });
        caps('to the wedding of', 0.457, 16, { tracking: 3 });
        paired(0.636, 'serif', 58, { max: 460 });
        finish(0.819, { dots: true });
        break;
      }
      type(initials, 300, 0.154, 'cinzel', 43, { tracking: 3 });
      branch(300, ry(0.238), 0.72);
      type('WELCOME', 300, 0.335, 'serif', 31, { tracking: 5 });
      type('to our wedding', 300, 0.375, 'pinyon', 33);
      names(
        v === 1 ? 0.512 : 0.492,
        0.681,
        v === 1 ? 'pinyon' : 'cinzel',
        v === 1 ? 109 : 67,
        {
          max: 433,
          join: '&',
          joinFace: 'script',
          joinSize: 44,
          upper: v !== 1,
        }
      );
      branch(300, ry(0.743), -0.69, true);
      finish(0.828, { dots: v === 1, tracking: 2 });
      break;
    }
    case 'noir': {
      for (const i of [23, 31, 45])
        stroke(i, i, 600 - 2 * i, h - 2 * i, accent, i === 23 ? 1.5 : 0.68);
      for (const [x, y, sx, sy] of [
        [30, 32, 1, 1],
        [570, 32, -1, 1],
        [30, h - 32, 1, -1],
        [570, h - 32, -1, -1],
      ]) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(sx, sy);
        shape(
          'M10 153V60Q40 28 41 11H156 M21 145V65Q51 35 53 22H145 M0 65L65 0 M0 83L83 0 M11 111L111 11 M27 102L102 27 M42 76L76 42 M16 56l9 9 -9 9 -9 -9Z M56 16l9 9 -9 9 -9 -9Z',
          accent,
          0.94
        );
        ctx.restore();
      }
      if (v === 1) {
        type('Welcome', 300, 0.362, 'pinyon', 131, { max: 477 });
        caps('to the wedding of', 0.441, 15, { tracking: 2.6 });
        rule(154, 446, 0.49, accent, 0.8);
        paired(0.646, 'cinzel', 44, { max: 431, tracking: 0.65 });
        finish(0.805, { tracking: 2.6 });
        break;
      }
      type('WELCOME TO', 300, 0.289, 'cinzel', 29, { tracking: 2.2 });
      type('THE WEDDING OF', 300, 0.338, 'cinzel', 24, { tracking: 2 });
      rule(143, 457, 0.382, accent, 0.8);
      names(0.491, 0.663, 'cinzel', 72, {
        max: 428,
        upper: true,
        joinFace: v === 2 ? 'script' : 'serif',
        joinSize: 38,
      });
      rule(143, 457, 0.729, accent, 0.82);
      type(date, 300, 0.805, 'cinzel', 19, { tracking: 1, max: 430 });
      break;
    }
    case 'rose':
      inkArt('rose', v === 2 ? 315 : -38, -33, v === 2 ? 330 : 371, ry(0.355), {
        flip: v === 2,
        alpha: 0.92,
      });
      inkArt(
        'rose',
        v === 2 ? -41 : 288,
        ry(0.69),
        v === 2 ? 352 : 331,
        ry(0.331),
        { turn: Math.PI, flip: v === 2, alpha: 0.92 }
      );
      caps('welcome', 0.28, 24, { tracking: 7.5 });
      caps('to the wedding of', 0.324, 13, { tracking: 2.45 });
      if (v === 2)
        paired(0.549, 'pinyon', 76, { max: 461, join: 'and', fallback: 0.167 });
      else
        names(0.455, 0.646, v === 1 ? 'alex' : 'fine', v === 1 ? 108 : 127, {
          max: 412,
          join: '+',
          joinFace: 'script',
          joinSize: 36,
          drift: v === 1 ? 0 : 29,
        });
      finish(0.762, { tracking: 3.2 });
      break;
    case 'olive':
      if (v === 2) {
        inkArt('olive', 158, ry(0.082), 284, ry(0.27), { alpha: 0.96 });
        caps('welcome to the wedding of', 0.435, 15, { tracking: 2.7 });
        paired(0.602, 'pinyon', 81, { max: 460, join: 'and', fallback: 0.145 });
        finish(0.798, { tracking: 2.65 });
        break;
      }
      if (v === 0)
        inkArt('olive', -213, ry(0.17), 595, ry(0.823), {
          turn: -0.85,
          alpha: 0.88,
          fill: true,
        });
      else {
        inkArt('olive', -160, ry(0.135), 381, ry(0.755), {
          turn: -0.8,
          alpha: 0.81,
          fill: true,
        });
        inkArt('olive', 406, ry(0.71), 325, ry(0.35), {
          turn: 1.9,
          alpha: 0.82,
          fill: true,
        });
      }
      type('WELCOME', 357, 0.258, 'classic', 20, { tracking: 4.5, max: 395 });
      type('TO THE WEDDING OF', 357, 0.312, 'classic', 18, {
        tracking: 2,
        max: 395,
      });
      names(0.472, 0.663, v === 0 ? 'hand' : 'alex', 118, {
        x: 356,
        max: 353,
        join: '+',
        joinFace: 'script',
        joinSize: 32,
      });
      type(date, 356, 0.84, 'classic', 19, {
        tracking: 1.3,
        max: 351,
        upper: true,
      });
      break;
    case 'gallery':
      if (v === 2) {
        caps('welcome to our wedding', 0.23, 16, { tracking: 4.8 });
        names(0.441, 0.651, 'classic', 80, {
          max: 481,
          upper: true,
          tracking: 6,
          join: 'and',
          joinFace: 'fine',
          joinSize: 52,
        });
        finish(0.798, { tracking: 3.5 });
        break;
      }
      type(
        'welcome',
        xCenter,
        0.443,
        v === 0 ? 'hand' : 'pinyon',
        v === 0 ? 163 : 152,
        { max: 522 }
      );
      caps('to our wedding', 0.59, 16, { tracking: 4.6 });
      paired(0.669, 'sans', 29, {
        upper: true,
        tracking: 5.0,
        max: 486,
        fallback: 0.077,
      });
      finish(0.763, { dots: true, tracking: 4 });
      break;
    case 'ribbon':
      if (v !== 2) {
        ctx.save();
        ctx.globalAlpha = v === 0 ? 0.45 : 0.27;
        for (let x = 0; x < 600; x += 48) box(x, 0, 23, h, accent);
        ctx.restore();
        const y1 = ry(0.078),
          y2 = ry(0.918),
          x1 = 43,
          x2 = 557;
        let d = `M${x1} ${y1}`;
        for (let i = 1; i <= 11; i++)
          d += `q${(x2 - x1) / 22} ${i % 2 === 0 ? 5 : -14} ${(x2 - x1) / 11} 0`;
        for (let i = 1; i <= 17; i++)
          d += `q${i % 2 === 0 ? -4 : 15} ${(y2 - y1) / 34} 0 ${(y2 - y1) / 17}`;
        for (let i = 1; i <= 11; i++)
          d += `q${-(x2 - x1) / 22} ${i % 2 === 0 ? -5 : 14} ${-(x2 - x1) / 11} 0`;
        for (let i = 1; i <= 17; i++)
          d += `q${i % 2 === 0 ? 4 : -15} ${-(y2 - y1) / 34} 0 ${-(y2 - y1) / 17}`;
        shape(d + 'Z', paper);
        shape(d + 'Z', accent, 2.15);
      }
      if (v === 2) {
        stroke(31, 31, 538, h - 62, accent, 1.08);
        translated(300, ry(0.181), 1, () => {
          shape(
            'M0 10C-39 -24 -68 -28 -64 -3C-62 18 -28 14 0 10C39 -24 68 -28 64 -3C62 18 28 14 0 10M0 10Q-18 54 -49 56M0 10Q23 48 54 59',
            accent,
            1.8
          );
        });
      } else
        inkArt('ribbon', 39, ry(0.063), 522, ry(0.85), {
          fill: true,
          alpha: v === 0 ? 1 : 0.78,
        });
      caps('welcome to', 0.363, 17, { tracking: 3 });
      caps('our wedding', 0.409, 17, { tracking: 3 });
      if (v === 1)
        paired(0.575, 'pinyon', 68, { max: 385, join: 'and', fallback: 0.153 });
      else
        names(0.525, 0.656, v === 2 ? 'fine' : 'alex', v === 2 ? 115 : 96, {
          max: 382,
          join: '&',
          joinSize: 37,
        });
      finish(0.748, { dots: true, tracking: 3 });
      break;
    case 'coast':
      if (v === 2) {
        inkArt('coast', -55, ry(0.035), 710, ry(0.28), { alpha: 0.83 });
        inkArt('coast', -80, ry(0.739), 760, ry(0.28), {
          alpha: 0.5,
          flip: true,
        });
        stroke(28, 28, 544, h - 56, accent, 1.2);
        type('Welcome', 300, 0.435, 'pinyon', 106, { max: 462 });
        caps('to our wedding', 0.489, 14, { tracking: 3.9 });
        paired(0.617, 'serif', 62, { max: 445 });
        finish(0.72, { dots: true, tracking: 3.8 });
        break;
      }
      inkArt('toile', -18, ry(0.001), 636, h, {
        fill: true,
        alpha: v === 1 ? 0.72 : 1,
      });
      if (v === 1) stroke(27, 27, 546, h - 54, accent, 1);
      type('WELCOME', 300, 0.289, 'serif', 26, { tracking: 7.5, max: 382 });
      caps('to the wedding of', 0.335, 12, { tracking: 3.9, max: 373 });
      names(0.464, 0.647, v === 1 ? 'pinyon' : 'serif', v === 1 ? 108 : 71, {
        upper: v !== 1,
        tracking: v === 1 ? 0 : 5.5,
        max: 376,
        join: 'and',
        joinFace: 'pinyon',
        joinSize: 48,
      });
      finish(0.757, { dots: true, tracking: 4, max: 386 });
      break;
    case 'desert': {
      const archPaper =
        panel ?? (v === 2 ? '#edd4ad' : v === 1 ? '#f6e2c3' : '#eddbc1');
      arch(38, ry(0.082), h, archPaper);
      if (v === 1) arch(50, ry(0.098), h, accent, 1.2);
      const col = textColor(v === 2 ? '#733e30' : '#703f2d');
      branch(300, ry(0.245), 0.83, false, col);
      if (v === 1) {
        type('Welcome', 300, 0.42, 'pinyon', 118, { max: 425, color: col });
        caps('to the wedding of', 0.484, 13, { tracking: 2.4, color: col });
        paired(0.642, 'serif', 60, { max: 414, color: col, fallback: 0.14 });
        finish(0.831, { dots: true, tracking: 3.1, color: col });
        break;
      }
      names(0.443, 0.652, v === 0 ? 'hand' : 'pinyon', v === 0 ? 130 : 119, {
        max: 411,
        join: 'and',
        joinFace: 'serif',
        joinSize: 25,
        color: col,
      });
      type('welcome to our wedding', 300, 0.795, 'serif', 21, {
        tracking: 1.7,
        color: col,
      });
      finish(0.849, { dots: true, tracking: 3.5, color: col });
      break;
    }
  }
}
