import '@/config/style/global.css';

import { getLocale, setRequestLocale } from 'next-intl/server';
import NextTopLoader from 'nextjs-toploader';

import { envConfigs } from '@/config';
import { locales } from '@/config/locale';
import { UtmCapture } from '@/shared/blocks/common/utm-capture';
import { getAllConfigs } from '@/shared/models/config';
import { getAdsService } from '@/shared/services/ads';
import { getAffiliateService } from '@/shared/services/affiliate';
import { getAnalyticsService } from '@/shared/services/analytics';
import { getCustomerService } from '@/shared/services/customer_service';

// Resolve the favicon URL once per render from the merged env+DB config.
// We deliberately reuse the same `app_logo` value the marketing header shows,
// so the favicon follows whatever the admin uploads — there is no separate
// `app_favicon` to keep in sync. `NEXT_PUBLIC_APP_FAVICON` is still honored
// as a hard override when it is *explicitly* set in the environment
// (we detect "explicit" by reading the raw env var, not the defaulted
// `envConfigs.app_favicon` value, otherwise the default `/favicon.webp`
// would always win and the admin upload would never reach the favicon).
async function resolveFaviconHref() {
  const explicitFavicon = process.env.NEXT_PUBLIC_APP_FAVICON;
  if (explicitFavicon && explicitFavicon.length > 0) {
    return explicitFavicon;
  }
  try {
    const configs = await getAllConfigs();
    return configs.app_logo || envConfigs.app_logo || '/logo.webp';
  } catch {
    return envConfigs.app_logo || '/logo.webp';
  }
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

  if (isProduction || isDebug) {
    const configs = await getAllConfigs();

    const [adsService, analyticsService, affiliateService, customerService] =
      await Promise.all([
        getAdsService(configs),
        getAnalyticsService(configs),
        getAffiliateService(configs),
        getCustomerService(configs),
      ]);

    // get ads components
    adsMetaTags = adsService.getMetaTags();
    adsHeadScripts = adsService.getHeadScripts();
    adsBodyScripts = adsService.getBodyScripts();

    // get analytics components
    analyticsMetaTags = analyticsService.getMetaTags();
    analyticsHeadScripts = analyticsService.getHeadScripts();
    analyticsBodyScripts = analyticsService.getBodyScripts();

    // get affiliate components
    affiliateMetaTags = affiliateService.getMetaTags();
    affiliateHeadScripts = affiliateService.getHeadScripts();
    affiliateBodyScripts = affiliateService.getBodyScripts();

    // get customer service components
    customerServiceMetaTags = customerService.getMetaTags();
    customerServiceHeadScripts = customerService.getHeadScripts();
    customerServiceBodyScripts = customerService.getBodyScripts();
  }

  // Resolve the favicon from the merged config (admin-controlled) regardless
  // of the production flag — the favicon should reflect the studio logo even
  // in dev/preview.
  const faviconHref = await resolveFaviconHref();

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
        <link rel="icon" href={faviconHref} type="image/webp" />
        <link rel="alternate icon" href={faviconHref} type="image/webp" />
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
