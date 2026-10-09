import { MetadataRoute } from 'next';

import { envConfigs } from '@/config';
import { defaultLocale, locales } from '@/config/locale';

const STYLE_ROUTES = [
  'wedding-crest/botanical-watercolor',
  'wedding-crest/minimal-line-art',
  'wedding-crest/vintage-engraving',
  'wedding-crest/italian-romance',
  'wedding-crest/coastal',
  'wedding-crest/classic-luxury',
];

// Policy pages live in content/pages/*.mdx. Only English and Chinese versions
// exist, and `getLocalPage()` does not fall back to English, so the other
// locales 404 — they must not be advertised here.
const LEGAL_ROUTES = [
  '/privacy-policy',
  '/terms-of-service',
  '/acceptable-use',
  '/contact',
];
const LEGAL_LOCALES = ['en', 'zh'];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = envConfigs.app_url;

  const staticRoutes = [
    '',
    '/create',
    '/examples',
    '/wedding-crest-generator',
    '/wedding-monogram-maker',
    '/wedding-logo-maker',
    '/pricing',
  ];

  const sitemapEntries: MetadataRoute.Sitemap = [];

  staticRoutes.forEach((route) => {
    // The homepage is English-only now; every other route keeps its localized
    // variants, which render and are indexed normally.
    const routeLocales = route === '' ? [defaultLocale] : locales;
    routeLocales.forEach((locale) => {
      const isDefault = locale === defaultLocale;
      const localePath = isDefault ? '' : `/${locale}`;
      const finalUrl = `${baseUrl}${localePath}${route}`;
      sitemapEntries.push({
        url: finalUrl,
        lastModified: new Date(),
        changeFrequency: route === '' ? 'weekly' : 'monthly',
        priority: route === '' ? 1.0 : 0.9,
      });
    });
  });

  STYLE_ROUTES.forEach((route) => {
    locales.forEach((locale) => {
      const isDefault = locale === defaultLocale;
      const localePath = isDefault ? '' : `/${locale}`;
      sitemapEntries.push({
        url: `${baseUrl}${localePath}/${route}`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.8,
      });
    });
  });

  LEGAL_ROUTES.forEach((route) => {
    LEGAL_LOCALES.forEach((locale) => {
      const localePath = locale === defaultLocale ? '' : `/${locale}`;
      sitemapEntries.push({
        url: `${baseUrl}${localePath}${route}`,
        lastModified: new Date(),
        changeFrequency: 'yearly',
        priority: 0.3,
      });
    });
  });

  return sitemapEntries;
}
