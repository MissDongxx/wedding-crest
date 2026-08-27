/**
 * Patch script for Cloudflare Workers deployment.
 *
 * OpenNext Cloudflare build may reference Node.js-only modules like
 * `canvas` and `child_process` that don't exist (or throw at import
 * time) in the Workers runtime. This script walks every .js / .mjs
 * file in `.open-next/` and replaces the offending require() calls
 * with a stub so the module can be loaded.
 *
 * Stub shape matters: detect-libc (transitive dep of @libsql/client)
 * calls `childProcess.execSync(...)` at module init. A bare `({})`
 * stub throws "execSync is not a function". We need an object whose
 * commonly-used methods return harmless values.
 *
 * Idempotent — running it on a clean build is a no-op.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const root = join(process.cwd(), '.open-next');
if (!existsSync(root)) {
  console.log('[patch-cf] No .open-next directory found, skipping.');
  process.exit(0);
}

// Stub for `canvas` — no API surface, the only consumer is bundle
// resolution and downstream code paths that need it are not exercised
// in this Worker (no image manipulation at request time).
const STUB_CANVAS = '({})';

// Stub for `child_process` — must satisfy methods called at module
// load time. `execSync` is the one detect-libc / Next dev helpers hit;
// `exec` and `spawn` are also wired in case any runtime path uses them.
const STUB_CHILD_PROCESS = String.raw`({
  exec(cmd, cb){ if(typeof cb==='function') cb(null,''); return ''; },
  execSync(cmd){ return ''; },
  spawn(cmd){ return { on(){}, stdout:{on(){}}, stderr:{on(){}}, kill(){}, pid:0 }; },
  spawnSync(){ return { status:0, stdout:'', stderr:'' }; }
})`;

// Stub for `fs` — only synchronous read methods need to be callable
// without throwing. We don't expect any code path on Workers to actually
// read from disk; this just keeps dev-time probes from hanging.
const STUB_FS = String.raw`({
  existsSync(){ return false; },
  readFileSync(){ return ''; },
  writeFileSync(){},
  statSync(){ return { isFile(){return false;}, isDirectory(){return false;} }; },
  readdirSync(){ return []; },
  mkdirSync(){},
  unlinkSync(){}
})`;

const STUB_FS_PROMISES = String.raw`({
  readFile(){ return Promise.resolve(''); },
  writeFile(){ return Promise.resolve(); },
  stat(){ return Promise.resolve({ isFile(){return false;}, isDirectory(){return false;} }); },
  readdir(){ return Promise.resolve([]); },
  mkdir(){ return Promise.resolve(); },
  unlink(){ return Promise.resolve(); }
})`;

const STUB_OS = String.raw`({
  platform(){ return 'linux'; },
  arch(){ return 'x64'; },
  hostname(){ return 'workers'; },
  cpus(){ return []; },
  release(){ return '1.0.0'; },
  type(){ return 'Linux'; }
})`;

const STUB_WORKER_THREADS = String.raw`({
  isMainThread: true,
  parentPort: null,
  workerData: null,
  Worker(){ return { on(){}, postMessage(){}, terminate(){} }; }
})`;

// Modules we leave alone — Workers `nodejs_compat` polyfills them
// sufficiently for next-intl, postgres.js, etc.:
//   fs, os, path, crypto, http, https, url, buffer, stream, util,
//   events, process, querystring, assert, async_hooks, perf_hooks,
//   diagnostics_channel, module, net, zlib, console, constants.

const STUBS = {
  canvas: STUB_CANVAS,
  child_process: STUB_CHILD_PROCESS,
  'node:child_process': STUB_CHILD_PROCESS,
  // Note: we deliberately do NOT stub fs / os / worker_threads.
  // The Workers `nodejs_compat` polyfill supports them; stubbing fs
  // broke Next's runtime file lookup, and stubbing os broke
  // platform-aware code in drizzle-orm. Only the modules that the
  // polyfill does NOT cover (canvas, child_process) get stubbed.
};

let totalPatched = 0;
let totalFiles = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
    } else if (st.isFile() && (full.endsWith('.js') || full.endsWith('.mjs'))) {
      totalFiles += 1;
      let code = readFileSync(full, 'utf-8');
      let patched = false;
      for (const [mod, stub] of Object.entries(STUBS)) {
        // match require("mod") and require('mod'), but not require("mod/sub")
        const re = new RegExp(
          `require\\((["'])${mod.replace(/[:]/g, '\\$&')}\\1\\)`,
          'g'
        );
        if (re.test(code)) {
          code = code.replace(re, stub);
          patched = true;
        }
      }
      if (patched) {
        writeFileSync(full, code);
        totalPatched += 1;
        console.log(`[patch-cf] stubbed in ${full.replace(process.cwd() + '/', '')}`);
      }
    }
  }
}

walk(root);
console.log(
  `[patch-cf] scanned ${totalFiles} files, patched ${totalPatched} (canvas/child_process).`
);
