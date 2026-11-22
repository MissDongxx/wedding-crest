import type { Metadata } from 'next';
import Link from 'next/link';
import { setRequestLocale } from 'next-intl/server';

import { envConfigs } from '@/config';
import { WelcomeSignMaker } from '@/shared/components/wedding/welcome-sign-maker';
import { getAlternates } from '@/shared/lib/seo';
import { signShareImage } from '@/shared/wedding/welcome-sign-images';

const path = '/wedding-welcome-sign-maker';
const title = 'Wedding Welcome Sign Maker';
const description =
  'Personalize 36 wedding welcome sign templates with names, date, fonts and colors. Download an 18 × 24 or 24 × 36 inch PDF or PNG for printing.';
export const dynamic = 'force-static';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const url = new URL(path, envConfigs.app_url).href;
  const image = {
    url: new URL(signShareImage.path, envConfigs.app_url).href,
    width: signShareImage.width,
    height: signShareImage.height,
    alt: signShareImage.alt,
  };
  return {
    title,
    description,
    openGraph: { type: 'website', title, description, url, images: [image] },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    alternates: await getAlternates(path, 'en', envConfigs.app_url, ['en']),
    ...(locale === 'en' ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function WelcomeSignPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <WelcomeSignMaker />
      {locale === 'en' && (
        <p className="container pb-12 text-center">
          <Link
            className="underline underline-offset-4"
            href="/table-number-maker"
          >
            Browse wedding table number templates
          </Link>
        </p>
      )}
    </>
  );
}
