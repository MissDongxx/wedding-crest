import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from 'canvas';
import JSZip from 'jszip';

import {
  renderPrintableStationery,
  type ImagePackDetails,
} from '../src/shared/wedding/image-pack';

async function main() {
  // Native Canvas exercises the exact downloadable renderer, not UI screenshots.
  (globalThis as any).document = {
    createElement: (name: string) => {
      assert.equal(name, 'canvas');
      return createCanvas(1, 1);
    },
  };
  const out = path.resolve(process.argv[2] || 'artifacts/printable-stationery');
  fs.mkdirSync(out, { recursive: true });
  const zip = await JSZip.loadAsync(
    fs.readFileSync('artifacts/image-pack-complete/browser-download.zip')
  );
  const primary = Object.values(zip.files).find((f) =>
    /\/01-primary\/primary-ai-crest\./.test(f.name)
  )!;
  const img = await loadImage(await primary.async('nodebuffer'));
  const crest = createCanvas(img.width, img.height);
  crest.getContext('2d').drawImage(img, 0, 0);
  const details: ImagePackDetails = {
    partner1: 'Ra',
    partner2: 'Ja',
    dateLabel: 'October 6, 2026',
    palette: ['#b9b29c'],
    invitationHeading: 'Together with their families',
    welcomeHeading: 'Welcome to our wedding',
    thanksHeading: 'With heartfelt thanks',
    invitationBody: 'Invite you to celebrate their wedding.',
    welcomeBody: 'We are so happy you are here to celebrate with us.',
    thanksBody: 'Thank you for being part of our celebration.',
  };
  for (const [scene, w, h] of [
    ['invitation', 1500, 2100],
    ['welcome', 1800, 2400],
    ['thanks', 2100, 1500],
  ] as const) {
    const c = renderPrintableStationery(
      scene,
      crest as unknown as HTMLCanvasElement,
      details
    ) as unknown as ReturnType<typeof createCanvas>;
    assert.equal(c.width, w);
    assert.equal(c.height, h);
    const pixels = c.getContext('2d').getImageData(0, 0, w, h);
    for (const [x, y] of [
      [0, 0],
      [w - 1, 0],
      [0, h - 1],
      [w - 1, h - 1],
    ]) {
      const i = (y * w + x) * 4;
      assert.deepEqual(
        Array.from(pixels.data.slice(i, i + 4)),
        [255, 253, 248, 255]
      );
    }
    fs.writeFileSync(
      path.join(out, `${scene}-print.png`),
      c.toBuffer('image/png')
    );
    console.log(
      `PASS ${scene}: ${w} x ${h}, flat paper covers all four corners`
    );
  }
  const source = fs.readFileSync('src/shared/wedding/image-pack.ts', 'utf8');
  const renderer = source.slice(
    source.indexOf('export function renderPrintableStationery'),
    source.indexOf('/** Enrich only')
  );
  assert(
    !/\.rotate\(|shadowBlur|shadowOffset|createLinearGradient/.test(renderer)
  );
  assert(
    /renderPrintableStationery\(\s*scene,\s*transparent\.element,\s*details/.test(source)
  );
  console.log(
    'PASS downloadable compositions use flat renderer, no scene transforms/shadows; UI preview files untouched'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
