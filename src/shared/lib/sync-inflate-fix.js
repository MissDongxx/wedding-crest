'use strict';

/**
 * Drop-in replacement for pngjs/lib/sync-inflate.js
 * that avoids the broken `zlib.Inflate.call(this, opts)` pattern.
 *
 * The original uses old-style ES5 inheritance (`util.inherits` + `.call()`)
 * which fails when zlib.Inflate is an ES6 class (Cloudflare Workers, etc.).
 *
 * We simply use `zlib.inflateSync` directly — the `maxLength` / `chunkSize`
 * safety limits are unnecessary for our controlled server-side usage.
 */

let zlib = require('zlib');

function inflateSync(buffer) {
  return zlib.inflateSync(buffer);
}

module.exports = inflateSync;
