import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Button } from '@/shared/components/ui/button';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import {
  listWeddingExamples,
  type WeddingExampleRow,
} from '@/shared/models/wedding';
import { getWeddingStyle } from '@/shared/wedding/config';

/**
 * URL: /wedding-crest/botanical_watercolor
 * Maps the raw WeddingStyleId (the URL segment) to its kebab-case
 * counterpart used as the i18n key under `pages.seo.styles.<key>`.
 */
const STYLE_ID_TO_KEY: Record<string, string> = {
  botanical_watercolor: 'botanical-watercolor',
  minimal_line_art: 'minimal-line-art',
  vintage_engraving: 'vintage-engraving',
  italian_romance: 'italian-romance',
  coastal: 'coastal',
  classic_luxury: 'classic-luxury',
};

export const revalidate = 60;

export function generateStaticParams() {
  return Object.keys(STYLE_ID_TO_KEY).map((style) => ({ style }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; style: string }>;
}) {
  const { locale, style } = await params;
  const key = STYLE_ID_TO_KEY[style];
  if (!key) return { title: 'Not found' };
  const t = await getTranslations({
    locale,
    namespace: `pages.seo.styles.${key}`,
  });
  return { title: t('meta_title'), description: t('meta_description') };
}

export default async function StylePage({
  params,
}: {
  params: Promise<{ locale: string; style: string }>;
}) {
  const { locale, style } = await params;
  const key = STYLE_ID_TO_KEY[style];
  if (!key) notFound();
  setRequestLocale(locale);
  const t = await getTranslations(`pages.seo.styles.${key}`);
  const seoStyleId = t('style_id') as
    | 'botanical_watercolor'
    | 'minimal_line_art'
    | 'vintage_engraving'
    | 'italian_romance'
    | 'coastal'
    | 'classic_luxury';
  const styleConfig = getWeddingStyle(seoStyleId);
  const examples = (
    (await listWeddingExamples({
      style: seoStyleId,
      activeOnly: true,
    })) as WeddingExampleRow[]
  )
    .filter((example) => example.style === seoStyleId)
    .slice(0, 6);

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [1, 2, 3].map((n) => ({
      '@type': 'Question',
      name: t(`faq_${n}_q`),
      acceptedAnswer: { '@type': 'Answer', text: t(`faq_${n}_a`) },
    })),
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <ScrollAnimation>
        <p className="text-muted-foreground text-sm tracking-[0.2em] uppercase">
          {styleConfig.name}
        </p>
        <h1 className="mt-3 font-serif text-3xl text-balance md:text-4xl">
          {t('heading')}
        </h1>
        <p className="text-muted-foreground mt-4 text-balance">{t('intro')}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={`/create?style=${seoStyleId}`}>{t('cta')}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/examples">See examples</Link>
          </Button>
        </div>
      </ScrollAnimation>

      {examples[0] && (
        <Link
          href={`/create?style=${encodeURIComponent(seoStyleId)}&exampleId=${encodeURIComponent(examples[0].id)}`}
          className="bg-wedding-ivory relative mt-12 block aspect-square overflow-hidden rounded-2xl border"
        >
          <Image
            src={examples[0].imageUrl}
            alt={examples[0].altText ?? examples[0].name}
            fill
            sizes="(min-width: 768px) 768px, 100vw"
            className="object-cover"
            priority
          />
        </Link>
      )}

      <div className="mt-12 space-y-8">
        {[1, 2, 3, 4].map((n) => (
          <section key={n}>
            <h2 className="font-serif text-2xl">{t(`section_${n}_title`)}</h2>
            <p className="text-muted-foreground mt-3 leading-relaxed text-pretty">
              {t(`section_${n}_body`)}
            </p>
          </section>
        ))}
      </div>

      {examples.length > 0 && (
        <div className="mt-12">
          <h2 className="font-serif text-2xl">Inspiration</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {examples.map((example) => (
              <Link
                key={example.id}
                href={`/create?style=${encodeURIComponent(seoStyleId)}&exampleId=${encodeURIComponent(example.id)}`}
                className="bg-wedding-ivory block overflow-hidden rounded-2xl border transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <Image
                  src={example.imageUrl}
                  alt={example.altText ?? example.name}
                  width={480}
                  height={480}
                  className="aspect-square h-auto w-full object-cover"
                />
                <p className="text-muted-foreground mt-2 text-center text-xs">
                  {example.name}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <section className="mt-16 space-y-4">
        <h2 className="font-serif text-2xl">Frequently asked questions</h2>
        {[1, 2, 3].map((n) => (
          <details key={n} className="bg-card rounded-xl border p-4">
            <summary className="cursor-pointer font-medium">
              {t(`faq_${n}_q`)}
            </summary>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {t(`faq_${n}_a`)}
            </p>
          </details>
        ))}
      </section>

      <div className="mt-16 text-center">
        <Button asChild size="lg">
          <Link href={`/create?style=${seoStyleId}`}>{t('cta')}</Link>
        </Button>
      </div>
    </article>
  );
}
