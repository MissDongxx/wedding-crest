import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(process.cwd(), 'public');
const limit = 3 * 1024 * 1024;

async function directorySize(path) {
  const entries = await readdir(path, { withFileTypes: true });
  let total = 0;

  for (const entry of entries) {
    const entryPath = join(path, entry.name);
    total += entry.isDirectory()
      ? await directorySize(entryPath)
      : (await stat(entryPath)).size;
  }

  return total;
}

const bytes = await directorySize(root);
const mebibytes = bytes / 1024 / 1024;
console.log(`public/ size: ${bytes} bytes (${mebibytes.toFixed(2)} MiB)`);
console.log(`limit: ${limit} bytes (3.00 MiB)`);

if (bytes > limit) {
  console.error('public/ exceeds the 3 MiB asset budget.');
  process.exit(1);
}

console.log('asset budget: PASS');
