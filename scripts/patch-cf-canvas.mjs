/**
 * Patch script for Cloudflare Workers deployment.
 * OpenNext Cloudflare build may reference Node.js-only modules like `canvas`
 * that don't exist in the Workers runtime. This script no-ops if no patching is needed.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const workerPath = join(process.cwd(), '.open-next', 'worker.js');

if (!existsSync(workerPath)) {
  console.log('[patch-cf-canvas] No worker.js found, skipping.');
  process.exit(0);
}

let code = readFileSync(workerPath, 'utf-8');

// Replace any `require("canvas")` with a no-op stub
if (code.includes('require("canvas")') || code.includes("require('canvas')")) {
  code = code.replace(
    /require\(["']canvas["']\)/g,
    '({})'
  );
  writeFileSync(workerPath, code);
  console.log('[patch-cf-canvas] Patched canvas require to no-op stub.');
} else {
  console.log('[patch-cf-canvas] No canvas require found, no patching needed.');
}
