#!/usr/bin/env node
/**
 * Submit the current public sitemap to IndexNow after a verified deployment.
 * Derived from rankup/scripts/indexnow-submit.mjs; project key is public config.
 * Ownership proof is mandatory, including for --dry-run. Acceptance is not indexing.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
export const DEFAULT_SITE_URL = 'https://weddingcrestdesign.com';

export function getPublicIndexNowKey() {
  const config = JSON.parse(
    readFileSync(
      new URL('../src/config/indexnow.json', import.meta.url),
      'utf8'
    )
  );
  if (!/^[A-Za-z0-9-]{8,128}$/.test(config.key)) {
    throw new Error('Invalid public IndexNow key configuration.');
  }
  return config.key;
}

function decodeXml(value) {
  return value.replace(
    /&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi,
    (_, entity) => {
      if (entity.startsWith('#x')) {
        return String.fromCodePoint(parseInt(entity.slice(2), 16));
      }
      if (entity.startsWith('#')) {
        return String.fromCodePoint(parseInt(entity.slice(1), 10));
      }
      return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' }[entity];
    }
  );
}

export function sitemapUrls(xml, siteUrl) {
  if (/<(?:[\w-]+:)?sitemapindex\b/i.test(xml)) {
    throw new Error(
      'A URL sitemap is required; sitemap indexes are not page URLs.'
    );
  }
  if (!/<(?:[\w-]+:)?urlset\b/i.test(xml)) {
    throw new Error('Sitemap response is not a URL-set XML document.');
  }
  const urls = [
    ...new Set(
      [
        ...xml.matchAll(/<(?:[\w-]+:)?loc\b[^>]*>([^<]+)<\/(?:[\w-]+:)?loc>/gi),
      ].map((match) => decodeXml(match[1].trim()))
    ),
  ];
  if (urls.length === 0 || urls.length > 10000) {
    throw new Error(
      `Sitemap must contain between 1 and 10000 URLs; got ${urls.length}.`
    );
  }
  const site = new URL(siteUrl);
  for (const value of urls) {
    const url = new URL(value);
    if (
      url.origin !== site.origin ||
      url.username ||
      url.password ||
      url.hash
    ) {
      throw new Error(
        `Sitemap URL does not belong to the canonical origin: ${value}`
      );
    }
  }
  return urls;
}

export async function pushIndexNow({
  siteUrl = DEFAULT_SITE_URL,
  sitemapUrl,
  key = getPublicIndexNowKey(),
  dryRun = false,
  fetchImpl = fetch,
  timeoutMs = 30000,
} = {}) {
  const site = new URL(siteUrl);
  if (
    site.protocol !== 'https:' ||
    site.pathname !== '/' ||
    site.search ||
    site.hash ||
    site.username ||
    site.password
  ) {
    throw new Error(
      'Site URL must be an HTTPS origin without a path, query, or credentials.'
    );
  }
  if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) {
    throw new Error(
      'IndexNow key must contain 8–128 letters, digits, or dashes.'
    );
  }
  const keyLocation = new URL(`/${key}.txt`, site).href;
  const sitemapLocation = new URL(sitemapUrl || '/sitemap.xml', site);
  if (sitemapLocation.origin !== site.origin) {
    throw new Error('Sitemap must use the same canonical origin as the site.');
  }
  const requestOptions = () => ({
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  });
  const keyResponse = await fetchImpl(keyLocation, requestOptions());
  if (keyResponse.status !== 200 || (await keyResponse.text()).trim() !== key) {
    throw new Error(
      `Public key-file verification failed (HTTP ${keyResponse.status}); nothing submitted.`
    );
  }
  const sitemapResponse = await fetchImpl(sitemapLocation.href, {
    ...requestOptions(),
    headers: { accept: 'application/xml' },
  });
  if (sitemapResponse.status !== 200) {
    throw new Error(
      `Sitemap retrieval failed (HTTP ${sitemapResponse.status}); nothing submitted.`
    );
  }
  const urlList = sitemapUrls(await sitemapResponse.text(), site.href);
  const result = {
    siteUrl: site.origin,
    keyLocation,
    keyVerified: true,
    sitemapUrl: sitemapLocation.href,
    urlCount: urlList.length,
    urlList,
    endpoint: INDEXNOW_ENDPOINT,
    submitted: false,
    indexed: false,
  };
  if (dryRun) return { ...result, dryRun: true };

  const response = await fetchImpl(INDEXNOW_ENDPOINT, {
    ...requestOptions(),
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: site.hostname, key, keyLocation, urlList }),
  });
  if (response.status !== 200 && response.status !== 202) {
    throw new Error(
      `IndexNow did not accept the submission (HTTP ${response.status}).`
    );
  }
  return {
    ...result,
    submitted: true,
    httpStatus: response.status,
    keyValidationPending: response.status === 202,
    note: 'URLs received by IndexNow; this response does not guarantee indexing.',
  };
}

async function main() {
  const args = process.argv.slice(2);
  const options = {};
  let reportPath;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (['--site-url', '--sitemap', '--report'].includes(arg)) {
      const value = args[++index];
      if (!value || value.startsWith('--'))
        throw new Error(`Missing value for ${arg}.`);
      if (arg === '--site-url') options.siteUrl = value;
      else if (arg === '--sitemap') options.sitemapUrl = value;
      else reportPath = resolve(value);
    } else if (arg === '--help') {
      console.log(
        'node scripts/indexnow-push.mjs [--site-url https://example.com] [--sitemap /sitemap.xml] [--dry-run] [--report path.json]'
      );
      return;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  const result = {
    checkedAt: new Date().toISOString(),
    ...(await pushIndexNow(options)),
  };
  if (reportPath) {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(result, null, 2)}\n`);
  }
  console.log(JSON.stringify(result, null, 2));
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
