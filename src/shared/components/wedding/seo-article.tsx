import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { Button } from '@/shared/components/ui/button';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import {
  listWeddingExamples,
  type WeddingExampleRow,
} from '@/shared/models/wedding';

export type SeoArticleKey = 'generator' | 'monogram' | 'logo';

export async function SeoArticle({
  articleKey,
}: {
  articleKey: SeoArticleKey;
}) {
  const t = await getTranslations(`pages.seo.${articleKey}`);
  const featured = (
    (await listWeddingExamples({ activeOnly: true })) as WeddingExampleRow[]
  ).slice(0, 6);

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
        <h1 className="font-serif text-3xl text-balance md:text-4xl">
          {t('heading')}
        </h1>
        <p className="text-muted-foreground mt-4 text-balance">{t('intro')}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/create">{t('cta')}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/examples">See examples</Link>
          </Button>
        </div>
      </ScrollAnimation>

      {featured.length > 0 && (
        <div className="bg-wedding-ivory mt-12 grid grid-cols-2 gap-4 rounded-2xl border p-6 sm:grid-cols-3">
          {featured.map((example) => (
            <Link
              key={example.id}
              href={`/create?style=${encodeURIComponent(example.style)}&exampleId=${encodeURIComponent(example.id)}`}
              className="relative aspect-square overflow-hidden rounded-xl"
            >
              <Image
                src={example.imageUrl}
                alt={example.altText ?? example.name}
                fill
                sizes="(min-width: 640px) 33vw, 50vw"
                className="object-cover"
              />
            </Link>
          ))}
        </div>
      )}

      <div className="mt-12 space-y-8">
        {[1, 2, 3, 4].map((n) => (
          <section key={n}>
            <h2 className="font-serif text-2xl">{t(`section_${n}_title`)}</h2>
            <p className="text-muted-foreground mt-3 text-pretty leading-relaxed">
              {t(`section_${n}_body`)}
            </p>
          </section>
        ))}
      </div>

      <section className="mt-16 space-y-4">
        <h2 className="font-serif text-2xl">Frequently asked questions</h2>
        {[1, 2, 3].map((n) => (
          <details key={n} className="rounded-xl border bg-card p-4">
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
          <Link href="/create">{t('cta')}</Link>
        </Button>
      </div>
    </article>
  );
}
