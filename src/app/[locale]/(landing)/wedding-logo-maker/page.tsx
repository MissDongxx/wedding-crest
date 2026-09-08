import { getTranslations, setRequestLocale } from 'next-intl/server';

import { envConfigs } from '@/config';
import { getAlternates } from '@/shared/lib/seo';
import { SeoArticle } from '@/shared/components/wedding/seo-article';

export const dynamic = 'force-static';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.seo.logo' });
  return {
    title: t('meta_title'),
    description: t('meta_description'),
    alternates: await getAlternates(
      '/wedding-logo-maker',
      locale,
      envConfigs.app_url
    ),
  };
}

export default async function LogoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SeoArticle articleKey="logo" />;
}
