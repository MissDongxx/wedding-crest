import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import {
  getGalleryExample,
  weddingGalleryExamples,
} from '@/shared/wedding/gallery';
import { ExampleDetail } from '@/themes/default/blocks/example-detail';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return weddingGalleryExamples.map((example) => ({ slug: example.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const example = getGalleryExample(slug);
  if (!example) return { title: 'Not found' };
  const t = await getTranslations({ locale, namespace: 'pages.examples' });
  return {
    title: t('detail_meta_title', { title: example.title }),
    description: example.description,
  };
}

export default async function ExampleDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const example = getGalleryExample(slug);
  if (!example) notFound();
  setRequestLocale(locale);

  return <ExampleDetail example={example} />;
}
