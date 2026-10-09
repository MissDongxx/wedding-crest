/**
 * Subset of the full locale messages that is shipped to the browser via
 * the `NextIntlClientProvider`. Server components continue to use the
 * full set via `getTranslations` (resolved from the request config), so
 * page content and admin screens are unaffected.
 *
 * Without this filter, the entire `localeMessagesPaths` list (53
 * namespaces, ~94 KB raw JSON per locale) is embedded into every page's
 * RSC payload — admin nav, settings forms, SEO articles and the
 * "featured on" copy all travel to the browser even though no client
 * component references them. Restricting to the namespaces actually
 * consumed by `useTranslations` calls in `src/**`/*.tsx cuts the
 * per-page payload to ~25 KB.
 *
 * To add a new client-facing translation: import the JSON path here.
 * Server-side `getTranslations` keeps working without changes.
 */
export const clientLocaleMessagesPaths = [
  'common',
  'pages/create',
  'pages/design',
  'pages/pricing',
  'ai/chat',
  'ai/image',
  'ai/music',
  'ai/video',
] as const;

/**
 * Given the full messages object assembled by the i18n request config,
 * return only the namespaces that client components consume. Walks the
 * path-against-nested-object map so `pages/create` resolves to
 * `messages.pages.create`.
 */
export function pickClientMessages(
  fullMessages: Record<string, any>
): Record<string, any> {
  const subset: Record<string, any> = {};
  for (const path of clientLocaleMessagesPaths) {
    const segments = path.split('/');
    let source: any = fullMessages;
    for (const seg of segments) {
      if (source == null || typeof source !== 'object') {
        source = undefined;
        break;
      }
      source = source[seg];
    }
    if (source == null) continue;

    let target: Record<string, any> = subset;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (!target[seg] || typeof target[seg] !== 'object') {
        target[seg] = {};
      }
      target = target[seg];
    }
    target[segments[segments.length - 1]] = source;
  }
  return subset;
}
