import { MetadataRoute } from 'next';

import { envConfigs } from '@/config';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = envConfigs.app_url;

  const routes = [
    '',
    '/tools/gemini',
    '/pricing',
    '/blog',
    '/showcases',
    '/updates',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1.0 : route === '/tools/gemini' ? 0.9 : 0.7,
  }));
}
