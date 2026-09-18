import { getTranslations, setRequestLocale } from 'next-intl/server';

import { envConfigs } from '@/config';
import { defaultLocale, locales } from '@/config/locale';
import { getAllConfigs } from '@/shared/models/config';

// get metadata for page component
export function getMetadata(
  options: {
    title?: string;
    description?: string;
    keywords?: string;
    metadataKey?: string;
    canonicalUrl?: string; // relative path or full url
    imageUrl?: string;
    appName?: string;
    noIndex?: boolean;
    // Restrict the hreflang set (defaults to every locale). Use this for
    // English-only pages so Google is not pointed at URLs that redirect.
    alternateLocales?: readonly string[];
  } = {}
) {
  return async function generateMetadata({
    params,
  }: {
    params: Promise<{ locale: string }>;
  }) {
    const { locale } = await params;
    setRequestLocale(locale);

    // merged configs: admin (DB) settings override env; ensures the browser
    // title / OG metadata reflect admin-configured app name, url, preview image
    const configs = await getAllConfigs();

    // passed metadata
    const passedMetadata = {
      title: options.title,
      description: options.description,
      keywords: options.keywords,
    };

    // default metadata
    const defaultMetadata = await getTranslatedMetadata(
      defaultMetadataKey,
      locale
    );

    // translated metadata
    let translatedMetadata: any = {};
    if (options.metadataKey) {
      translatedMetadata = await getTranslatedMetadata(
        options.metadataKey,
        locale
      );
    }

    // canonical + hreflang alternates
    const alternates = await getAlternates(
      options.canonicalUrl || '',
      locale || '',
      configs.app_url,
      options.alternateLocales
    );
    const canonicalUrl = alternates.canonical;

    const title =
      passedMetadata.title || translatedMetadata.title || defaultMetadata.title;
    const description =
      passedMetadata.description ||
      translatedMetadata.description ||
      defaultMetadata.description;

    // image url
    // A stale/empty DB value for `app_preview_image` must not leave og:image
    // pointing at the site root — fall back to the env default (usually
    // `/preview.webp`) and finally to a hard-coded path.
    let imageUrl =
      options.imageUrl ||
      configs.app_preview_image ||
      envConfigs.app_preview_image ||
      '/preview.webp';
    if (imageUrl.startsWith('http')) {
      imageUrl = imageUrl;
    } else {
      imageUrl = `${configs.app_url}${imageUrl}`;
    }

    // app name
    let appName = options.appName;
    if (!appName) {
      appName = configs.app_name || '';
    }

    return {
      title:
        passedMetadata.title ||
        translatedMetadata.title ||
        defaultMetadata.title,
      description:
        passedMetadata.description ||
        translatedMetadata.description ||
        defaultMetadata.description,
      keywords:
        passedMetadata.keywords ||
        translatedMetadata.keywords ||
        defaultMetadata.keywords,
      alternates,

      openGraph: {
        type: 'website',
        locale: locale,
        url: canonicalUrl,
        title,
        description,
        siteName: appName,
        images: [imageUrl.toString()],
      },

      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl.toString()],
        site: '@WeddingCrestDesign',
      },

      robots: {
        index: options.noIndex ? false : true,
        follow: options.noIndex ? false : true,
      },
    };
  };
}

const defaultMetadataKey = 'common.metadata';

async function getTranslatedMetadata(metadataKey: string, locale: string) {
  setRequestLocale(locale);
  const t = await getTranslations(metadataKey);

  return {
    title: t.has('title') ? t('title') : '',
    description: t.has('description') ? t('description') : '',
    keywords: t.has('keywords') ? t('keywords') : '',
  };
}

async function getCanonicalUrl(
  canonicalUrl: string,
  locale: string,
  appUrl: string
) {
  if (!canonicalUrl) {
    canonicalUrl = '/';
  }

  if (canonicalUrl.startsWith('http')) {
    // full url
    canonicalUrl = canonicalUrl;
  } else {
    // relative path
    if (!canonicalUrl.startsWith('/')) {
      canonicalUrl = `/${canonicalUrl}`;
    }

    canonicalUrl = `${appUrl}${
      !locale || locale === defaultLocale ? '' : `/${locale}`
    }${canonicalUrl}`;

    if (locale !== defaultLocale && canonicalUrl.endsWith('/')) {
      canonicalUrl = canonicalUrl.slice(0, -1);
    }
  }

  return canonicalUrl;
}

// Build the canonical + hreflang (languages) alternates for a page from its
// relative path (e.g. '/create'). Shared by getMetadata() and by pages that
// generate their own translated title/description (create / generator /
// logo / monogram) so every indexable page publishes a self-referencing
// canonical and a full hreflang set. Without these, Google flags localized
// and parameterized variants as "Duplicate without user-selected canonical".
export async function getAlternates(
  canonicalUrl: string,
  locale: string,
  appUrl: string,
  alternateLocales?: readonly string[]
) {
  const canonical = await getCanonicalUrl(canonicalUrl, locale, appUrl);

  const languages: Record<string, string> = {};
  for (const l of alternateLocales ?? locales) {
    languages[l] = await getCanonicalUrl(canonicalUrl, l, appUrl);
  }
  languages['x-default'] = await getCanonicalUrl(
    canonicalUrl,
    defaultLocale,
    appUrl
  );

  return { canonical, languages };
}
