import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { Button } from '@/shared/components/ui/button';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { CrestPreview } from '@/shared/components/wedding/crest-preview';
import { weddingGalleryExamples } from '@/shared/wedding/gallery';
import { weddingPalettes } from '@/shared/wedding/types';

export type SeoArticleKey = 'generator' | 'monogram' | 'logo';

export async function SeoArticle({
  articleKey,
  locale,
}: {
  articleKey: SeoArticleKey;
  locale: string;
}) {
  const t = await getTranslations(`pages.seo.${articleKey}`);
  const featured = weddingGalleryExamples.slice(0, 6);

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

      <div className="bg-wedding-ivory mt-12 grid grid-cols-2 gap-4 rounded-2xl border p-6 sm:grid-cols-3">
        {featured.map((example, idx) => (
          <CrestPreview
            key={`${example.slug}-${idx}`}
            className="mx-auto w-full"
            config={{
              partner1: example.partner1,
              partner2: example.partner2,
              weddingDate: example.weddingDate,
              style: example.style,
              layout: example.layout,
              typography: example.typography,
              palette: example.palette.length
                ? example.palette
                : weddingPalettes[0].colors,
              nameDisplay:
                articleKey === 'monogram'
                  ? 'initials_joined'
                  : idx % 2 === 0
                    ? 'initials_amp'
                    : 'full_names',
            }}
          />
        ))}
      </div>

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
