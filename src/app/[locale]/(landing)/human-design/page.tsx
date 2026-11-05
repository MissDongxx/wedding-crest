import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';

import { HumanDesignOrder } from '@/shared/components/wedding/human-design-order';

export const metadata = { robots: { index: false, follow: false } };
export default async function HumanDesignPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense>
      <HumanDesignOrder />
    </Suspense>
  );
}
