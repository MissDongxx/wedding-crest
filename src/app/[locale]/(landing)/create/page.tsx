import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { WeddingWizard } from '@/themes/default/blocks/wedding-wizard';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.create' });
  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function CreatePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <WeddingWizard />
    </Suspense>
  );
}
