import { PRODUCTION_APP_URL } from '@/config';

// These are the two custom domains routed to this app in wrangler.toml.
const productionOrigins = [
  PRODUCTION_APP_URL,
  'https://www.weddingcrestdesign.com',
];

export function getAuthTrustedOrigins(
  configuredURLs: Array<string | undefined>,
  request?: Request
) {
  const origins = new Set(productionOrigins);
  for (const value of configuredURLs) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        origins.add(url.origin);
      }
    } catch {
      // Ignore malformed optional configuration, never broaden to a wildcard.
    }
  }

  // Next dev may select a different port when the configured port is occupied.
  // Trust only the actual loopback request URL in dev, not its Origin or
  // forwarded-host headers (both can be supplied by an external caller).
  if (process.env.NODE_ENV !== 'production' && request) {
    const url = new URL(request.url);
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      origins.add(url.origin);
    }
  }

  return [...origins];
}
