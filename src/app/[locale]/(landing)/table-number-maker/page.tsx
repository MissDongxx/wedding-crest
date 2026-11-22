import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

import { envConfigs } from '@/config';
import { TableNumberMaker } from '@/shared/components/wedding/table-number-maker';
import { getAlternates } from '@/shared/lib/seo';
import { tableNumberPath } from '@/shared/wedding/table-number-maker';

const title = 'Free Wedding Table Number Maker | Printable PDF';
const description =
  'Make printable wedding table numbers with matching templates. Download a free 1–20 set, or change the count and print 4 × 6 or 5 × 7 in cards at home or at a print shop.';

export const dynamic = 'force-static';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const url = new URL(tableNumberPath, envConfigs.app_url).href;
  return {
    title,
    description,
    openGraph: { type: 'website', title, description, url },
    twitter: { card: 'summary', title, description },
    alternates: await getAlternates(tableNumberPath, 'en', envConfigs.app_url, [
      'en',
    ]),
    ...(locale === 'en' ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function TableNumberMakerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TableNumberMaker />;
}
