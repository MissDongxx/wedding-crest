import fs from 'node:fs';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { normalizeImageBackgroundToWhite } from '/Users/xumingyue/Downloads/MyProjects/wedding-crest2/src/shared/lib/pure-image';
import { cropExtractedVector, vectorizeWeddingArtwork } from '/Users/xumingyue/Downloads/MyProjects/wedding-crest2/src/shared/wedding/vectorizer';

async function main() {

const png = new PNG({ width: 320, height: 320 });
for (let y = 0; y < 320; y++) for (let x = 0; x < 320; x++) {
  const i = (y * 320 + x) * 4;
  png.data[i] = png.data[i + 1] = png.data[i + 2] = 255;
  png.data[i + 3] = 255;
  const flower = (x - 95) ** 2 + (y - 90) ** 2 < 44 ** 2 || (x - 225) ** 2 + (y - 90) ** 2 < 44 ** 2;
  const leaf = Math.abs(x - 160) < 55 && y > 180 && y < 235;
  const lettering = y > 135 && y < 160 && x > 75 && x < 245;
  if (flower) { png.data[i] = 221; png.data[i + 1] = 127; png.data[i + 2] = 151; }
  if (leaf) { png.data[i] = 86; png.data[i + 1] = 126; png.data[i + 2] = 92; }
  if (lettering) { png.data[i] = png.data[i + 1] = png.data[i + 2] = 75; }
}
const source = PNG.sync.write(png);
const normalized = normalizeImageBackgroundToWhite(source);
if (normalized.checkerboardDetected) throw new Error('false checkerboard detection');
const vectors = vectorizeWeddingArtwork(normalized.buffer);
const extracted = cropExtractedVector(vectors.master, vectors, {x:160,y:155}, .5);
const imageNodes = (vectors.master.match(/<image\b/g) || []).length;
const pathNodes = (vectors.master.match(/<path\b/g) || []).length;
if (imageNodes !== 0 || pathNodes < 3) throw new Error('not a true vector result');
const zip = new JSZip(); zip.file('primary.svg', vectors.master); zip.file('monogram.svg', extracted); zip.file('black.svg', vectors.monochrome);
const archive = await zip.generateAsync({type:'nodebuffer', compression:'DEFLATE'});
fs.writeFileSync('/tmp/verified-vector-pack.zip', archive);
const legacy = normalizeImageBackgroundToWhite(fs.readFileSync('/tmp/current-ai-crest.png'));
if (!legacy.checkerboardDetected) throw new Error('legacy checkerboard was not detected');
console.log(JSON.stringify({sourceWhite:true,pathNodes,imageNodes,masterBytes:vectors.master.length,blackBytes:vectors.monochrome.length,zipBytes:archive.length,legacyCheckerboardDetected:legacy.checkerboardDetected,zip:'/tmp/verified-vector-pack.zip'}));

}
main().catch((error) => { console.error(error); process.exit(1); });
