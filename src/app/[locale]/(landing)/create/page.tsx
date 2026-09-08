import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { envConfigs } from '@/config';
import { getAlternates } from '@/shared/lib/seo';
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
    // Self-referencing canonical + full hreflang set. `/create?style=...`
    // parameter variants resolve to the clean `/create` canonical so Google
    // stops flagging them as duplicate pages without a user-selected canonical.
    alternates: await getAlternates('/create', locale, envConfigs.app_url),
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
