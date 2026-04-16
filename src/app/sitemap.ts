import { MetadataRoute } from 'next';

import { envConfigs } from '@/config';
import { defaultLocale, locales } from '@/config/locale';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = envConfigs.app_url;

  const routes = [
    '',
    '/tools/gemini',
    '/tools/detector',
    '/pricing',
    '/blog',
    '/showcases',
    '/updates',
    '/shortcuts',
  ];

  const sitemapEntries: MetadataRoute.Sitemap = [];

  routes.forEach((route) => {
    locales.forEach((locale) => {
      const isDefault = locale === defaultLocale;
      const localePath = isDefault ? '' : `/${locale}`;

      const finalUrl = `${baseUrl}${localePath}${route}`;

      sitemapEntries.push({
        url: finalUrl,
        lastModified: new Date(),
        changeFrequency: route === '' ? 'weekly' : 'monthly',
        priority:
          route === ''
            ? 1.0
            : route === '/tools/gemini'
              ? 0.9
              : route.startsWith('/tools/')
                ? 0.8
                : 0.7,
      });
    });
  });

  return sitemapEntries;
}
