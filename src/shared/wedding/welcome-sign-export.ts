import {
  drawSign,
  loadSignResources,
  signSizes,
  type SignDetails,
  type SignSize,
  type SignTemplate,
} from './welcome-sign';
import type { SignAppearance } from './welcome-sign-customization';

const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  for (let j = 0; j < 8; j++) i = i & 1 ? 0xedb88320 ^ (i >>> 1) : i >>> 1;
  return i >>> 0;
});

function pngChunk(name: string, data: Uint8Array) {
  const result = new Uint8Array(data.length + 12);
  const view = new DataView(result.buffer);
  view.setUint32(0, data.length);
  result.set(encoder.encode(name), 4);
  result.set(data, 8);
  let crc = 0xffffffff;
  for (let i = 4; i < result.length - 4; i++)
    crc = crcTable[(crc ^ result[i]) & 255] ^ (crc >>> 8);
  view.setUint32(result.length - 4, (crc ^ 0xffffffff) >>> 0);
  return result;
}

export async function exportWelcomeSign(
  template: SignTemplate,
  details: SignDetails,
  size: SignSize,
  format: 'png' | 'pdf',
  appearance?: SignAppearance,
  monogram?: HTMLImageElement
) {
  await loadSignResources(template);
  const [inW, inH] = signSizes[size];
  const width = inW * 300;
  const height = inH * 300;
  // Small horizontal strips also avoid large-canvas allocation limits on mobile.
  const stripHeight = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  const render = (y: number) => {
    canvas.height = Math.min(stripHeight, height - y);
    const ctx = canvas.getContext('2d', {
      alpha: false,
      willReadFrequently: format === 'png',
    });
    if (!ctx) throw new Error('Canvas context unavailable');
    drawSign(ctx, template, details, size, width, y, appearance, monogram);
    return ctx;
  };

  try {
    if (format === 'png') {
      const header = new Uint8Array(13);
      const h = new DataView(header.buffer);
      h.setUint32(0, width);
      h.setUint32(4, height);
      header.set([8, 2], 8); // eight-bit RGB
      const density = new Uint8Array(9);
      const p = new DataView(density.buffer);
      p.setUint32(0, 11811);
      p.setUint32(4, 11811);
      density[8] = 1;
      const parts: BlobPart[] = [
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        pngChunk('IHDR', header),
        pngChunk('pHYs', density),
      ];
      let y = 0;
      const scanlines = new ReadableStream<Uint8Array<ArrayBuffer>>({
        async pull(controller) {
          if (y >= height) {
            controller.close();
            return;
          }
          // Yield before each strip so the progress state paints and scrolling stays responsive.
          await new Promise((resolve) => setTimeout(resolve, 0));
          const ctx = render(y);
          const rows = canvas.height;
          const pixels = ctx.getImageData(0, 0, width, rows).data;
          const rowLength = width * 3 + 1;
          const bytes = new Uint8Array(rowLength * rows);
          for (let row = 0, k = 0; row < rows; row++) {
            let i = row * rowLength;
            bytes[i++] = 1; // PNG Sub filter
            for (let col = 0; col < width; col++, k += 4) {
              for (let c = 0; c < 3; c++)
                bytes[i++] = pixels[k + c] - (col ? pixels[k + c - 4] : 0);
            }
          }
          y += rows;
          controller.enqueue(bytes);
        },
      });
      const reader = scanlines
        .pipeThrough(new CompressionStream('deflate'))
        .getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(pngChunk('IDAT', value));
      }
      parts.push(pngChunk('IEND', new Uint8Array()));
      return new Blob(parts, { type: 'image/png' });
    }

    const pageW = inW * 72;
    const pageH = inH * 72;
    const parts: BlobPart[] = [];
    const offsets = [0];
    let offset = 0;
    const append = (data: string | Blob) => {
      const part = typeof data === 'string' ? encoder.encode(data) : data;
      offset += part instanceof Blob ? part.size : part.byteLength;
      parts.push(part);
    };
    const object = (id: number, value: string) => {
      offsets[id] = offset;
      append(`${id} 0 obj\n${value}\nendobj\n`);
    };
    append('%PDF-1.4\n%âãÏÓ\n');
    object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    const count = Math.ceil(height / stripHeight);
    const names = Array.from(
      { length: count },
      (_, i) => `/Im${i} ${i + 5} 0 R`
    ).join(' ');
    object(
      3,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << ${names} >> >> /Contents 4 0 R >>`
    );
    const instructions = Array.from({ length: count }, (_, i) => {
      const y = i * stripHeight;
      const rows = Math.min(stripHeight, height - y);
      return `q ${pageW} 0 0 ${(rows * 0.24).toFixed(2)} 0 ${(pageH - (y + rows) * 0.24).toFixed(2)} cm /Im${i} Do Q\n`;
    }).join('');
    object(
      4,
      `<< /Length ${instructions.length} >>\nstream\n${instructions}endstream`
    );
    for (let i = 0; i < count; i++) {
      render(i * stripHeight);
      const jpg = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error('Canvas encoding failed')),
          'image/jpeg',
          0.98
        )
      );
      const id = i + 5;
      offsets[id] = offset;
      append(
        `${id} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.size} >>\nstream\n`
      );
      append(jpg);
      append('\nendstream\nendobj\n');
    }
    const start = offset;
    append(
      `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((v) => `${String(v).padStart(10, '0')} 00000 n \n`)
        .join(
          ''
        )}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`
    );
    return new Blob(parts, { type: 'application/pdf' });
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}
