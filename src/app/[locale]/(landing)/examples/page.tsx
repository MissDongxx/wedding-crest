import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { CrestPreview } from '@/shared/components/wedding/crest-preview';
import { weddingGalleryExamples } from '@/shared/wedding/gallery';

export const dynamic = 'force-static';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.examples' });
  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function ExamplesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pages.examples');

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
      <ScrollAnimation>
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h1 className="font-serif text-3xl text-balance md:text-4xl">
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-3 text-balance">
            {t('description')}
          </p>
        </div>
      </ScrollAnimation>

      <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
        {weddingGalleryExamples.map((example, idx) => (
          <ScrollAnimation key={example.slug} delay={idx * 0.04}>
            <Link
              href={`/examples/${example.slug}`}
              className="group bg-card block overflow-hidden rounded-2xl border shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
            >
              <div className="bg-wedding-ivory p-4">
                <CrestPreview
                  className="mx-auto w-full"
                  config={{
                    partner1: example.partner1,
                    partner2: example.partner2,
                    weddingDate: example.weddingDate,
                    style: example.style,
                    layout: example.layout,
                    typography: example.typography,
                    palette: example.palette,
                    nameDisplay:
                      idx % 3 === 0
                        ? 'initials_amp'
                        : idx % 3 === 1
                          ? 'full_names'
                          : 'initials_joined',
                  }}
                />
              </div>
              <div className="p-4">
                <p className="font-serif text-base">
                  {example.partner1} & {example.partner2}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {example.location}
                </p>
              </div>
            </Link>
          </ScrollAnimation>
        ))}
      </div>
    </div>
  );
}
