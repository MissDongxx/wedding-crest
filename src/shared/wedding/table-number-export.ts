import {
  svgImage,
  tableCardSvg,
  tableCountLimit,
  tableCropMarks,
  tableLayout,
  tableSizes,
  type TableDesign,
  type TablePaper,
  type TablePrint,
  type TableSize,
} from './table-number-maker';

type PrintOptions = {
  design: TableDesign;
  count: number;
  size: TableSize;
  mode: TablePrint;
  paper: TablePaper;
};

const text = new TextEncoder();
const coord = (n: number) => Number(n.toFixed(3));

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Artwork loading failed'));
    image.src = src;
  });
}

export async function exportTableNumbers({
  design,
  count,
  size,
  mode,
  paper,
}: PrintOptions) {
  if (!Number.isInteger(count) || count < 1 || count > tableCountLimit)
    throw new Error('Invalid table count');

  const layout = tableLayout(size, mode, paper);
  const [cardWidth, cardHeight] = tableSizes[size];
  const canvas = document.createElement('canvas');
  const scale = 300 / 72;
  canvas.width = Math.round(cardWidth * scale);
  canvas.height = Math.round(cardHeight * scale);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas initialization failed');

  const pageCount = Math.ceil(count / layout.slots.length);
  const offsets = [0];
  const parts: BlobPart[] = [];
  let offset = 0;
  const append = (content: string | Blob) => {
    const part = typeof content === 'string' ? text.encode(content) : content;
    offset += part instanceof Blob ? part.size : part.byteLength;
    parts.push(part);
  };
  const begin = (id: number) => {
    offsets[id] = offset;
    append(`${id} 0 obj\n`);
  };
  const object = (id: number, body: string) => {
    begin(id);
    append(body + '\nendobj\n');
  };
  const kids = Array.from(
    { length: pageCount },
    (_, i) => `${3 + i * 2} 0 R`
  ).join(' ');
  const artworkId = 3 + pageCount * 2;
  append('%PDF-1.4\n%âãÏÓ\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);

  try {
    for (let page = 0, number = 1; page < pageCount; page++) {
      const pageId = 3 + page * 2;
      const commands: string[] = [];
      const images: string[] = [];
      for (const slot of layout.slots) {
        if (number > count) break;
        const image = await loadImage(
          svgImage(tableCardSvg(design, size, number))
        );
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const jpg = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('PDF image encoding failed'));
            },
            'image/jpeg',
            0.95
          );
        });
        const id = artworkId + number - 1;
        const name = `/Card${number}`;
        begin(id);
        append(
          `<< /Type /XObject /Subtype /Image /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Width ${canvas.width} /Height ${canvas.height} /Length ${jpg.size} >>\nstream\n`
        );
        append(jpg);
        append('\nendstream\nendobj\n');
        images.push(`${name} ${id} 0 R`);

        const { x, y, w, h } = slot;
        const bottom = layout.height - y - h;
        const matrix = [w, 0, 0, h, x, bottom];
        commands.push(`q ${matrix.map(coord).join(' ')} cm ${name} Do Q`);
        if (layout.crop) {
          commands.push('0.25 G 0.4 w');
          for (const [x1, y1, x2, y2] of tableCropMarks(slot)) {
            commands.push(
              `${coord(x1)} ${coord(layout.height - y1)} m ${coord(x2)} ${coord(layout.height - y2)} l S`
            );
          }
        }
        number++;
      }
      const stream = commands.join('\n') + '\n';
      object(
        pageId,
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${layout.width} ${layout.height}] /Resources << /XObject << ${images.join(' ')} >> >> /Contents ${pageId + 1} 0 R >>`
      );
      object(
        pageId + 1,
        `<< /Length ${stream.length} >>\nstream\n${stream}endstream`
      );
    }
    const xref = offset;
    append(
      `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((value) => `${String(value).padStart(10, '0')} 00000 n \n`)
        .join(
          ''
        )}trailer\n<< /Root 1 0 R /Size ${offsets.length} >>\nstartxref\n${xref}\n%%EOF\n`
    );
    return new Blob(parts, { type: 'application/pdf' });
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}
