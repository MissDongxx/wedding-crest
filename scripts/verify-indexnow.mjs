#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';

import {
  getPublicIndexNowKey,
  INDEXNOW_ENDPOINT,
  pushIndexNow,
  sitemapUrls,
} from './indexnow-push.mjs';

const root = resolve(process.env.SEO_SOURCE_ROOT || process.cwd());
const source = (name) => readFileSync(resolve(root, name), 'utf8');
const examples = JSON.parse(
  source('src/config/locale/messages/en/pages/examples.json')
);
const seo = JSON.parse(source('src/config/locale/messages/en/pages/seo.json'));
assert.equal(
  seo.logo.meta_title,
  'Wedding Logo Maker: Custom Crests & Monograms for Couples'
);
assert.equal(seo.logo.meta_title.length, 57);
assert.equal(examples.meta_description.length, 154);
assert.equal(
  examples.meta_description,
  'Browse real wedding crest examples in watercolor, line art and vintage styles. Find ideas for your invitations, then personalize a crest for your wedding.'
);
assert(
  !/\bfree\b/i.test(`${seo.logo.meta_title} ${examples.meta_description}`)
);
console.log(
  'PASS targeted metadata: logo title 57 chars; examples description 154 chars; no free offer claim.'
);

const require = createRequire(import.meta.url);
const ts = require('typescript');
const config = JSON.parse(source('src/config/indexnow.json'));
const key = getPublicIndexNowKey();
assert.equal(key, config.key);
const evaluate = (name, imports) => {
  const output = ts.transpileModule(source(name), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    reportDiagnostics: true,
  });
  assert.equal(output.diagnostics.length, 0);
  const exports = {};
  vm.runInNewContext(output.outputText, {
    exports,
    require: (specifier) => {
      assert(
        Object.hasOwn(imports, specifier),
        `Unexpected module: ${specifier}`
      );
      return imports[specifier];
    },
    Response,
  });
  return exports;
};
const constants = evaluate('src/shared/lib/indexnow.ts', {
  '@/config/indexnow.json': config,
});
assert.equal(constants.INDEXNOW_KEY, key);
assert.equal(constants.INDEXNOW_KEY_PATH, `/${key}.txt`);
const route = evaluate(`src/app/${key}.txt/route.ts`, {
  '@/shared/lib/indexnow': constants,
});
assert.equal(route.dynamic, 'force-static');
const response = route.GET();
assert.equal(response.status, 200);
assert.equal(await response.text(), `${key}\n`);
assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');
console.log(
  'PASS actual application key route: HTTP 200; UTF-8 text body equals the public key; no public asset dependency.'
);

const siteUrl = 'https://example.test';
const keyLocation = `${siteUrl}/${key}.txt`;
const xml =
  '<?xml version="1.0"?><urlset><url><loc>https://example.test/</loc></url><url><loc>https://example.test/create?a=1&amp;b=2</loc></url><url><loc>https://example.test/</loc></url></urlset>';
assert.deepEqual(sitemapUrls(xml, siteUrl), [
  `${siteUrl}/`,
  `${siteUrl}/create?a=1&b=2`,
]);

function fixture({
  keyBody = key,
  keyStatus = 200,
  sitemapBody = xml,
  sitemapStatus = 200,
  postStatus = 200,
} = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url === keyLocation)
      return new Response(keyBody, { status: keyStatus });
    if (url === `${siteUrl}/sitemap.xml`)
      return new Response(sitemapBody, { status: sitemapStatus });
    assert.equal(url, INDEXNOW_ENDPOINT);
    assert.equal(options.method, 'POST');
    return new Response('', { status: postStatus });
  };
  return { calls, fetchImpl };
}
for (const postStatus of [200, 202]) {
  const test = fixture({ postStatus });
  const result = await pushIndexNow({
    siteUrl,
    key,
    fetchImpl: test.fetchImpl,
  });
  assert.equal(result.submitted, true);
  assert.equal(result.indexed, false);
  assert.equal(result.httpStatus, postStatus);
  assert.equal(result.keyValidationPending, postStatus === 202);
  assert.equal(result.urlCount, 2);
  assert.equal(test.calls.length, 3);
  assert.deepEqual(JSON.parse(test.calls[2].options.body), {
    host: 'example.test',
    key,
    keyLocation,
    urlList: [`${siteUrl}/`, `${siteUrl}/create?a=1&b=2`],
  });
}
console.log(
  'PASS IndexNow POST: verified key, current sitemap, same-host deduped URLs, canonical payload; 200/202 reported as received, never indexed.'
);
const dry = fixture();
const dryResult = await pushIndexNow({
  siteUrl,
  key,
  dryRun: true,
  fetchImpl: dry.fetchImpl,
});
assert.equal(dryResult.submitted, false);
assert.equal(dryResult.keyVerified, true);
assert.equal(dry.calls.length, 2);
console.log(
  'PASS dry-run still verifies the key and reads the sitemap; no POST.'
);

for (const [label, options, pattern] of [
  ['wrong key body', { keyBody: 'wrong-key' }, /key-file verification failed/],
  ['missing key', { keyStatus: 404 }, /key-file verification failed/],
  ['missing sitemap', { sitemapStatus: 404 }, /Sitemap retrieval failed/],
  [
    'empty sitemap',
    { sitemapBody: '<urlset></urlset>' },
    /between 1 and 10000/,
  ],
  [
    'HTML instead of XML',
    { sitemapBody: '<html>error</html>' },
    /not a URL-set/,
  ],
  [
    'sitemap index',
    {
      sitemapBody:
        '<sitemapindex><sitemap><loc>https://example.test/one.xml</loc></sitemap></sitemapindex>',
    },
    /sitemap indexes/,
  ],
  [
    'foreign host',
    {
      sitemapBody: '<urlset><url><loc>https://other.test/</loc></url></urlset>',
    },
    /canonical origin/,
  ],
]) {
  const test = fixture(options);
  await assert.rejects(
    pushIndexNow({ siteUrl, key, fetchImpl: test.fetchImpl }),
    pattern,
    label
  );
  assert(!test.calls.some((call) => call.options.method === 'POST'), label);
}
console.log(
  'PASS wrong/missing key, failed/empty/HTML/index sitemap and foreign-host URLs all stop before POST.'
);
const denied = fixture({ postStatus: 429 });
await assert.rejects(
  pushIndexNow({ siteUrl, key, fetchImpl: denied.fetchImpl }),
  /HTTP 429/
);
await assert.rejects(
  pushIndexNow({
    siteUrl: 'http://example.test',
    key,
    fetchImpl: denied.fetchImpl,
  }),
  /HTTPS origin/
);
await assert.rejects(
  pushIndexNow({
    siteUrl,
    sitemapUrl: 'https://other.test/sitemap.xml',
    key,
    fetchImpl: denied.fetchImpl,
  }),
  /same canonical origin/
);
console.log(
  'PASS rejected submission stays a failure; unsafe site/sitemap origins rejected.'
);
