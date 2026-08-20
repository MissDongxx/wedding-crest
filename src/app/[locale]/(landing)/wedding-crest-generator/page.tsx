import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SeoArticle } from '@/shared/components/wedding/seo-article';

export const dynamic = 'force-static';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.seo.generator' });
  return { title: t('meta_title'), description: t('meta_description') };
}

export default async function GeneratorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SeoArticle articleKey="generator" locale={locale} />;
}
