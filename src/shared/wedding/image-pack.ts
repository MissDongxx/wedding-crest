import JSZip from 'jszip';

import { removeEdgeBackground } from './image-pack-pixels';

export interface ImagePackDetails {
  partner1: string;
  partner2: string;
  dateLabel: string;
  palette: string[];
  invitationHeading: string;
  welcomeHeading: string;
  thanksHeading: string;
  invitationBody: string;
  welcomeBody: string;
  thanksBody: string;
}

function canvas(width: number, height: number) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  const context = element.getContext('2d');
  if (!context) throw new Error('Image export requires Canvas support.');
  return { element, context };
}

async function encode(element: HTMLCanvasElement, mime: string) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    element.toBlob(
      (result) =>
        result
          ? resolve(result)
          : reject(new Error(`Image export failed: ${mime}`)),
      mime,
      0.95
    );
  });
  // Browsers may silently return PNG when an encoder is unsupported.
  if (blob.type !== mime)
    throw new Error(
      `This browser does not support ${mime} export. Please use a current Chrome, Edge, Firefox or Safari browser.`
    );
  return blob.arrayBuffer();
}

function fitImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
  x: number,
  y: number,
  width: number,
  height: number
) {
  const scale = Math.min(width / image.width, height / image.height);
  const w = image.width * scale,
    h = image.height * scale;
  context.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
}

function centeredText(
  context: CanvasRenderingContext2D,
  text: string,
  y: number,
  size: number,
  maxWidth: number,
  family = 'Georgia, serif'
) {
  context.font = `${size}px ${family}`;
  const measured = context.measureText(text).width;
  if (measured > maxWidth)
    context.font = `${Math.max(12, (size * maxWidth) / measured)}px ${family}`;
  context.fillText(text, 500, y);
}

/** Flat, full-bleed stationery artwork: no scene props, perspective or shadows.
 * Pixel sizes correspond to the documented physical sizes at 300 pixels/inch.
 * Source crest detail is preserved, not increased by the larger page canvas.
 */
export function renderPrintableStationery(
  scene: 'invitation' | 'welcome' | 'thanks',
  crest: HTMLCanvasElement,
  details: ImagePackDetails
) {
  const sizes = {
    invitation: [1500, 2100], // 5 × 7 inches
    welcome: [1800, 2400], // 6 × 8 inches; larger prints need source review
    thanks: [2100, 1500], // 7 × 5 inches
  } as const;
  const [width, height] = sizes[scene];
  const { element, context: c } = canvas(width, height);
  const scale = width / 1000;
  const pageHeight = height / scale;
  c.scale(scale, scale);
  const accent =
    details.palette.find((color) => /^#[0-9a-f]{6}$/i.test(color)) || '#b9b29c';
  c.fillStyle = '#fffdf8';
  c.fillRect(0, 0, 1000, pageHeight);
  c.strokeStyle = accent;
  c.lineWidth = 2;
  c.strokeRect(40, 40, 920, pageHeight - 80);
  c.fillStyle = '#343b34';
  c.textAlign = 'center';
  if (scene === 'thanks') {
    centeredText(c, details.thanksHeading, 120, 46, 820);
    fitImage(c, crest, 390, 150, 220, 220);
    centeredText(c, `${details.partner1} & ${details.partner2}`, 435, 44, 820);
    c.beginPath();
    c.moveTo(460, 485);
    c.lineTo(540, 485);
    c.stroke();
    centeredText(c, details.thanksBody, 550, 24, 820);
  } else {
    const isWelcome = scene === 'welcome';
    if (isWelcome) centeredText(c, details.welcomeHeading, 140, 48, 820);
    const crestY = isWelcome ? 200 : 140;
    fitImage(c, crest, 320, crestY, 360, 380);
    if (!isWelcome)
      centeredText(
        c,
        details.invitationHeading.toLocaleUpperCase(),
        650,
        25,
        820,
        'Arial, sans-serif'
      );
    centeredText(c, details.partner1, 790, 70, 820);
    centeredText(c, '&', 875, 44, 820);
    centeredText(c, details.partner2, 970, 70, 820);
    if (details.dateLabel)
      centeredText(c, details.dateLabel, 1090, 30, 820, 'Arial, sans-serif');
    c.beginPath();
    c.moveTo(460, 1160);
    c.lineTo(540, 1160);
    c.stroke();
    centeredText(c, details[`${scene}Body`], 1230, 27, 820);
  }
  return element;
}

/** Enrich only the ZIP already gated by server ownership and payment checks.
 * Decode its bytes locally: no CORS dependency or credential-bearing image URL.
 */
export async function completeWeddingImagePack(
  archive: Blob,
  details: ImagePackDetails
): Promise<Blob> {
  const zip = await JSZip.loadAsync(await archive.arrayBuffer());
  const primary = Object.values(zip.files).find((entry) =>
    /\/01-primary\/primary-ai-crest\.(png|jpg|webp)$/i.test(entry.name)
  );
  if (!primary)
    throw new Error(
      'Selected original artwork is missing from the image pack.'
    );
  const prefix = primary.name.split('/01-primary/')[0];
  const blob = new Blob([await primary.async('arraybuffer')]);
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 8_000_000
    )
      throw new Error('Artwork dimensions exceed the image pack export limit.');
    const original = canvas(image.naturalWidth, image.naturalHeight);
    original.context.drawImage(image, 0, 0);
    const transparent = canvas(image.naturalWidth, image.naturalHeight);
    transparent.context.drawImage(image, 0, 0);
    const pixels = transparent.context.getImageData(
      0,
      0,
      image.naturalWidth,
      image.naturalHeight
    );
    const removed = removeEdgeBackground(
      pixels.data,
      pixels.width,
      pixels.height
    );
    transparent.context.putImageData(pixels, 0, 0);
    const alphaCount = pixels.data.reduce(
      (count, value, index) => count + (index % 4 === 3 && value < 255 ? 1 : 0),
      0
    );
    if (!alphaCount)
      throw new Error(
        'This artwork has no removable light edge background. Please select a crest on a plain white background for transparent export.'
      );
    for (const [extension, mime] of [
      ['png', 'image/png'],
      ['jpg', 'image/jpeg'],
      ['webp', 'image/webp'],
    ] as const) {
      const output = canvas(image.naturalWidth, image.naturalHeight);
      // JPEG has no alpha; composite it explicitly onto white.
      if (extension === 'jpg') {
        output.context.fillStyle = '#ffffff';
        output.context.fillRect(0, 0, image.naturalWidth, image.naturalHeight);
      }
      output.context.drawImage(original.element, 0, 0);
      zip.file(
        `${prefix}/04-formats/crest.${extension}`,
        await encode(output.element, mime)
      );
    }
    zip.file(
      `${prefix}/05-transparent/crest-transparent.png`,
      await encode(transparent.element, 'image/png')
    );
    zip.file(
      `${prefix}/05-transparent/crest-transparent.webp`,
      await encode(transparent.element, 'image/webp')
    );
    for (const scene of ['invitation', 'welcome', 'thanks'] as const) {
      const composed = renderPrintableStationery(
        scene,
        transparent.element,
        details
      );
      zip.file(
        `${prefix}/06-previews/${scene}-preview.png`,
        await encode(composed, 'image/png')
      );
      zip.file(
        `${prefix}/06-previews/${scene}-preview.jpg`,
        await encode(composed, 'image/jpeg')
      );
    }
    const guide = Object.values(zip.files).find((entry) =>
      entry.name.endsWith('/03-guide/wedding-crest-guide.txt')
    );
    if (guide)
      zip.file(
        guide.name,
        `${await guide.async('string')}\n\nExpanded image pack\n-------------------\n04-formats: PNG, JPEG (white background), WebP at original ${image.naturalWidth} × ${image.naturalHeight} resolution.\n05-transparent: PNG and WebP with alpha; edge-connected near-white background removed (${removed} pixels). Interior whites preserved; inspect fine edges before printing.\n06-previews: flat print artwork (no envelope, easel, scene background, perspective or shadows), PNG and JPEG. Invitation: 1500 × 2100 pixels, print at 5 × 7 inches; welcome sign: 1800 × 2400 pixels, print at 6 × 8 inches; thank-you card: 2100 × 1500 pixels, print at 7 × 5 inches. Set print size manually for 300 pixels/inch; disable fit-to-page. No bleed or crop marks included: ask your printer before borderless trimming. Larger signage requires a source-resolution check. Source crest detail is not improved by export size. Text and image are flattened, not editable templates.\nOriginal AI artwork and completed variations remain unchanged. No SVG/vector files or artificial resolution claims.\n`
      );
    return await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
