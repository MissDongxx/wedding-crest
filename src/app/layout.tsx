import '@/config/style/global.css';

import { getLocale, setRequestLocale } from 'next-intl/server';
import NextTopLoader from 'nextjs-toploader';

import { envConfigs } from '@/config';
import { locales } from '@/config/locale';
import { UtmCapture } from '@/shared/blocks/common/utm-capture';
import { Configs, getAllConfigs } from '@/shared/models/config';
import { getAdsManagerWithConfigs } from '@/shared/services/ads';
import { getAffiliateManagerWithConfigs } from '@/shared/services/affiliate';
import { getAnalyticsManagerWithConfigs } from '@/shared/services/analytics';
import { getCustomerServiceWithConfigs } from '@/shared/services/customer_service';

// Resolve the favicon from a pre-fetched `configs` object so the root
// layout only calls `getAllConfigs()` once per request (it was being
// awaited twice — once for the services and once here). The DB-backed
// config cache is the slow path; a 1-minute TTL was hitting it for every
// anonymous request.
async function resolveFaviconHref(
  configs: Awaited<ReturnType<typeof getAllConfigs>> | null
) {
  // The admin-configured App Logo wins so the favicon always matches the
  // brand. The separate favicon env value remains available for installs
  // that have not configured a logo yet.
  return (
    (configs && configs.app_logo) || process.env.NEXT_PUBLIC_APP_FAVICON || ''
  );
}

// Fonts are self-hosted OFL families loaded through
// src/config/style/wedding-fonts.css (no build-time network fetch).

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  setRequestLocale(locale);

  const isProduction = process.env.NODE_ENV === 'production';
  const isDebug = process.env.NEXT_PUBLIC_DEBUG === 'true';

  // app url
  const appUrl = envConfigs.app_url || '';

  // ads components
  let adsMetaTags = null;
  let adsHeadScripts = null;
  let adsBodyScripts = null;

  // analytics components
  let analyticsMetaTags = null;
  let analyticsHeadScripts = null;
  let analyticsBodyScripts = null;

  // affiliate components
  let affiliateMetaTags = null;
  let affiliateHeadScripts = null;
  let affiliateBodyScripts = null;

  // customer service components
  let customerServiceMetaTags = null;
  let customerServiceHeadScripts = null;
  let customerServiceBodyScripts = null;

  // Pre-fetched configs (single DB read on the cold path; subsequent
  // calls within the 5-minute in-memory TTL are free). Used by the
  // service constructors and by `resolveFaviconHref` so we don't
  // re-await `getAllConfigs()` a second time. Always fetched — the
  // favicon needs the admin-configured logo even outside
  // production/debug, and getAllConfigs() is a no-op when no DB is
  // configured (it just falls back to env vars).
  let configs: Configs | null = null;
  configs = await getAllConfigs();

  if (isProduction || isDebug) {
    // Service construction is purely sync — building a manager with the
    // pre-fetched configs avoids the previous `Promise.all` of async
    // wrappers that each called `getAllConfigs()` if `configs` was
    // omitted. We pass the configs through directly.
    const adsService = getAdsManagerWithConfigs(configs);
    const analyticsService = getAnalyticsManagerWithConfigs(configs);
    const affiliateService = getAffiliateManagerWithConfigs(configs);
    const customerService = getCustomerServiceWithConfigs(configs);

    // get ads components — keep meta tags in <head> synchronously for
    // SEO (e.g. <meta name="google-adsense-account"> must be in the
    // initial HTML so crawlers see it). Head/body scripts are moved to
    // the body, where each provider now uses `next/script` with
    // `lazyOnload` / `afterInteractive` so they no longer block render.
    adsMetaTags = adsService.getMetaTags();
    analyticsMetaTags = analyticsService.getMetaTags();
    affiliateMetaTags = affiliateService.getMetaTags();
    customerServiceMetaTags = customerService.getMetaTags();

    adsHeadScripts = adsService.getHeadScripts();
    analyticsHeadScripts = analyticsService.getHeadScripts();
    affiliateHeadScripts = affiliateService.getHeadScripts();
    customerServiceHeadScripts = customerService.getHeadScripts();

    adsBodyScripts = adsService.getBodyScripts();
    analyticsBodyScripts = analyticsService.getBodyScripts();
    affiliateBodyScripts = affiliateService.getBodyScripts();
    customerServiceBodyScripts = customerService.getBodyScripts();
  }

  // Resolve the favicon from the same configs object we already fetched —
  // no second `getAllConfigs()` call.
  const faviconHref = await resolveFaviconHref(configs);

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Polyfill for esbuild's __name helper used in inline scripts */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'if(typeof globalThis.__name==="undefined"){globalThis.__name=function(){}}',
          }}
        />
        {/* No explicit `type` so browsers can fetch and sniff whichever
            format the admin uploaded (webp, png, svg, ico, ...). */}
        <link rel="icon" href={faviconHref} />
        <link rel="alternate icon" href={faviconHref} />
        <link rel="apple-touch-icon" href={faviconHref} />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        {/* inject locales */}
        {locales ? (
          <>
            {locales.map((loc) => (
              <link
                key={loc}
                rel="alternate"
                hrefLang={loc}
                href={`${appUrl}${loc === 'en' ? '' : `/${loc}`}`}
              />
            ))}
          </>
        ) : null}

        {/* inject ads meta tags */}
        {adsMetaTags}
        {/* inject ads head scripts */}
        {adsHeadScripts}

        {/* inject analytics meta tags */}
        {analyticsMetaTags}
        {/* inject analytics head scripts */}
        {analyticsHeadScripts}

        {/* inject affiliate meta tags */}
        {affiliateMetaTags}
        {/* inject affiliate head scripts */}
        {affiliateHeadScripts}

        {/* inject customer service meta tags */}
        {customerServiceMetaTags}
        {/* inject customer service head scripts */}
        {customerServiceHeadScripts}
      </head>
      <body suppressHydrationWarning className="overflow-x-hidden">
        <NextTopLoader
          color="#8a8f6e"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
        />

        <UtmCapture />

        {children}

        {/* inject ads body scripts */}
        {adsBodyScripts}

        {/* inject analytics body scripts */}
        {analyticsBodyScripts}

        {/* inject affiliate body scripts */}
        {affiliateBodyScripts}

        {/* inject customer service body scripts */}
        {customerServiceBodyScripts}
      </body>
    </html>
  );
}
