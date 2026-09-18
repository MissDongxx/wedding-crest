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

  return sitemapEntries;
}
