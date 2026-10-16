import { PRODUCTION_APP_URL } from '@/config';

// One Tap is an optional automatic prompt. Do not load GIS on development
// ports or arbitrary previews, which may not be registered with Google.
// The explicit Google OAuth button remains available on those origins.
export function isOneTapOriginAllowed(origin: string, appURL: string) {
  try {
    const url = new URL(origin);
    if (
      url.protocol !== 'https:' ||
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.hostname.endsWith('.localhost')
    ) {
      return false;
    }

    const allowedOrigins = new Set([
      PRODUCTION_APP_URL,
      'https://www.weddingcrestdesign.com',
    ]);
    try {
      allowedOrigins.add(new URL(appURL).origin);
    } catch {
      // Keep the explicit production origins when optional config is invalid.
    }
    return allowedOrigins.has(url.origin);
  } catch {
    return false;
  }
}
