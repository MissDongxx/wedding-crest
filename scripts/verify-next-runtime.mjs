import assert from 'node:assert/strict';
import fs from 'node:fs';

import { nextRuntimeDistDir } from './next-runtime-config.mjs';

assert.equal(nextRuntimeDistDir(), '.next');
assert.equal(nextRuntimeDistDir(''), '.next');
assert.equal(nextRuntimeDistDir('.next-qa'), '.next-qa');
assert.equal(nextRuntimeDistDir('./.next-e2e'), '.next-e2e');
assert.equal(
  nextRuntimeDistDir('artifacts/e2e/next-cache'),
  'artifacts/e2e/next-cache'
);
for (const path of [
  '/private/tmp/next',
  '../next',
  '.',
  './',
  'src',
  'src/cache',
  'public/next',
  'content/cache',
  'scripts/cache',
  'node_modules/next',
  '.git/cache',
  'artifacts',
  'artifacts/task',
  '.next\\cache',
  '.next//cache',
]) {
  assert.throws(
    () => nextRuntimeDistDir(path),
    /project-relative cache directory/
  );
}
const source = fs.readFileSync(
  new URL('../next.config.mjs', import.meta.url),
  'utf8'
);
assert.match(source, /outputFileTracingRoot: projectRoot/);
assert.match(source, /turbopack: \{\s*root: projectRoot/);
assert.match(source, /const projectRoot = resolve\(import.meta.dirname\)/);
assert.match(
  source,
  /distDir: nextRuntimeDistDir\(process.env.NEXT_DIST_DIR\)/
);
console.log(
  'PASS: project-root tracing/Turbopack scope; default .next unchanged; relative isolated caches supported; absolute/traversal/source cache paths rejected.'
);
