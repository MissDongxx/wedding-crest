import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import postgres from '../../../node_modules/postgres/src/index.js';

const require = createRequire(import.meta.url);
const { AwsClient } = require('aws4fetch');
const { createCanvas, loadImage } = require('canvas');
const apply = process.argv.includes('--apply');
async function fetchWithRetry(url, init, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await fetch(url, init); } catch (error) { lastError = error; if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 750)); }
  }
  throw lastError;
}
const root = new URL('../../../', import.meta.url);
const artifactDir = new URL('./', import.meta.url);
const toml = fs.readFileSync(new URL('wrangler.toml', root), 'utf8');
const databaseUrl = toml.match(/localConnectionString\s*=\s*"([^"]+)"/)?.[1];
if (!databaseUrl) throw new Error('Hyperdrive localConnectionString not found');
const sql = postgres(databaseUrl, { max: 1, connect_timeout: 20, prepare: false, ssl: 'require' });

try {
  const frames = await sql`select id, name, url, thumbnail_url, updated_at from "wedding-crest".wedding_frame where lower(url) ~ '\\.svg(?:\\?.*)?$' order by id`;
  const configRows = await sql`select name, value from "wedding-crest".config where name in ('r2_access_key','r2_secret_key','r2_bucket_name','r2_upload_path','r2_endpoint','r2_domain')`;
  const config = Object.fromEntries(configRows.map((row) => [row.name, row.value ?? '']));
  fs.writeFileSync(new URL('frames-before.json', artifactDir), `${JSON.stringify(frames, null, 2)}\n`);
  if (!frames.length) {
    console.log(JSON.stringify({ apply, frames: 0, message: 'no SVG frames found' }, null, 2));
    process.exit(0);
  }

  const required = ['r2_access_key','r2_secret_key','r2_bucket_name','r2_endpoint','r2_domain'];
  for (const key of required) if (!config[key]) throw new Error(`${key} is not configured`);
  const uploadPath = (config.r2_upload_path || 'uploads').replace(/^\/+|\/+$/g, '');
  const client = new AwsClient({ accessKeyId: config.r2_access_key, secretAccessKey: config.r2_secret_key, region: 'auto' });
  const results = [];

  for (const frame of frames) {
    const source = await fetchWithRetry(frame.url);
    if (!source.ok) throw new Error(`download ${frame.id} failed: ${source.status}`);
    let svgText = Buffer.from(await source.arrayBuffer()).toString('utf8');
    const svgTag = svgText.match(/<svg\b[^>]*>/i)?.[0] ?? '';
    const viewBox = svgTag.match(/viewBox=["']([^"']+)["']/i)?.[1]?.trim().split(/[ ,]+/).map(Number);
    const parsedWidth = Number(svgTag.match(/\bwidth=["']([0-9.]+)/i)?.[1]);
    const parsedHeight = Number(svgTag.match(/\bheight=["']([0-9.]+)/i)?.[1]);
    const sourceWidth = parsedWidth || (viewBox?.length === 4 ? viewBox[2] : 1024) || 1024;
    const sourceHeight = parsedHeight || (viewBox?.length === 4 ? viewBox[3] : 1024) || 1024;
    if (!/\bwidth=["']/i.test(svgTag) || !/\bheight=["']/i.test(svgTag)) {
      const replacement = svgTag.replace('<svg', `<svg width="${sourceWidth}" height="${sourceHeight}"`);
      svgText = svgText.replace(svgTag, replacement);
    }
    const image = await loadImage(Buffer.from(svgText));
    const scale = 1536 / Math.max(sourceWidth, sourceHeight);
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = createCanvas(width, height);
    canvas.getContext('2d').drawImage(image, 0, 0, width, height);
    const png = canvas.toBuffer('image/png');
    const digest = crypto.createHash('md5').update(png).digest('hex');
    const key = `wedding-frames/${frame.id}-${digest.slice(0, 12)}.png`;
    const objectUrl = `${config.r2_endpoint.replace(/\/$/, '')}/${config.r2_bucket_name}/${uploadPath}/${key}`;
    const publicUrl = `${config.r2_domain.replace(/\/$/, '')}/${uploadPath}/${key}`;

    if (apply) {
      const upload = await client.fetch(new Request(objectUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/png', 'Content-Disposition': 'inline', 'Content-Length': String(png.length) },
        body: png,
      }));
      if (!upload.ok) throw new Error(`upload ${frame.id} failed: ${upload.status} ${upload.statusText}`);
      const check = await fetchWithRetry(publicUrl, { headers: { Range: 'bytes=0-31' } });
      const magic = Buffer.from(await check.arrayBuffer());
      if (!check.ok || check.headers.get('content-type') !== 'image/png' || magic[0] !== 0x89 || magic.subarray(1, 4).toString() !== 'PNG') {
        throw new Error(`public PNG verification failed for ${frame.id}: ${check.status} ${check.headers.get('content-type')}`);
      }
      await sql`update "wedding-crest".wedding_frame set url=${publicUrl}, updated_at=now() where id=${frame.id} and url=${frame.url}`;
    }
    results.push({ id: frame.id, sourceUrl: frame.url, publicUrl, sourceWidth, sourceHeight, width, height, pngBytes: png.length, sha256: crypto.createHash('sha256').update(png).digest('hex') });
  }

  fs.writeFileSync(new URL(apply ? 'migration-result.json' : 'migration-dry-run.json', artifactDir), `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify({ apply, frames: results.length, results }, null, 2));
} finally {
  await sql.end({ timeout: 2 });
}
