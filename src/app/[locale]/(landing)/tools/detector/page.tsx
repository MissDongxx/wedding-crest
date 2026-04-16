import { getTranslations, setRequestLocale } from 'next-intl/server';

import { envConfigs } from '@/config';
import { getMetadata } from '@/shared/lib/seo';
import DetectorClient from './detector-client';

const baseUrl = envConfigs.app_url;

export const generateMetadata = getMetadata({
  metadataKey: 'pages.tools-detector.metadata',
  canonicalUrl: '/tools/detector',
});

export default async function DetectorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('pages.tools-detector');

  // FAQ data for structured data and display
  const faqItems: { question: string; answer: string }[] = t.raw('faq.items');
  const detectItems: { title: string; description: string }[] =
    t.raw('detect.items');
  const steps: { step: string; title: string; description: string }[] =
    t.raw('how_it_works.steps');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'AI Watermark Detector',
    description:
      'Free tool to detect AI watermarks and C2PA metadata in images',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'Detect Gemini star watermark',
      'Check for C2PA metadata',
      'Analyze Exif and XMP data',
      '100% browser-based processing',
      'No image upload required',
    ],
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item: { question: string; answer: string }) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: baseUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'AI Watermark Detector',
        item: `${baseUrl}/tools/detector`,
      },
    ],
  };

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="pt-24 pb-16 md:pt-36">
        {/* Hero Section */}
        <div className="mx-auto mb-12 max-w-3xl px-4 text-center">
          <div className="bg-primary/10 text-primary mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium">
            <span>🔍</span>
            <span>{t('badge')}</span>
          </div>

          <h1 className="text-foreground mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            {t('h1')
              .split(t('h1_highlight'))
              .reduce<(React.ReactNode[])>((acc, part, i) => {
                if (i === 0) {
                  acc.push(part);
                } else {
                  acc.push(
                    <span
                      key={i}
                      className="from-primary to-primary/60 bg-gradient-to-r bg-clip-text text-transparent"
                    >
                      {t('h1_highlight')}
                    </span>
                  );
                  acc.push(part);
                }
                return acc;
              }, [])}
          </h1>

          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            {t('subtitle')}
          </p>
        </div>

        {/* Detector Tool */}
        <div className="mx-auto max-w-4xl px-4">
          <DetectorClient />
        </div>

        {/* How Detection Works */}
        <div className="mx-auto mt-24 max-w-4xl px-4">
          <h2 className="text-foreground mb-12 text-center text-3xl font-bold">
            {t('how_it_works.title')}
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((item) => (
              <div
                key={item.step}
                className="group relative rounded-xl border border-border/40 bg-white/30 p-6 backdrop-blur-sm transition-colors hover:border-primary/20"
              >
                <span className="text-primary/20 text-5xl font-bold">
                  {item.step}
                </span>
                <h3 className="text-foreground mt-2 text-lg font-semibold">
                  {item.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* What We Detect */}
        <div className="mx-auto mt-24 max-w-4xl px-4">
          <h2 className="text-foreground mb-12 text-center text-3xl font-bold">
            {t('detect.title')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {detectItems.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-border/40 p-5"
              >
                <h3 className="text-foreground font-semibold">
                  {item.title}
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mx-auto mt-24 max-w-3xl px-4">
          <h2 className="text-foreground mb-12 text-center text-3xl font-bold">
            {t('faq.title')}
          </h2>
          <div className="space-y-4">
            {faqItems.map((item: { question: string; answer: string }, idx: number) => (
              <details
                key={idx}
                className="border-border group rounded-xl border"
              >
                <summary className="text-foreground cursor-pointer px-6 py-4 font-medium transition-colors hover:text-primary">
                  {item.question}
                </summary>
                <p className="text-muted-foreground px-6 pb-4 text-sm leading-relaxed">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mx-auto mt-24 max-w-2xl px-4 text-center">
          <h2 className="text-foreground mb-4 text-2xl font-bold">
            {t('cta.title')}
          </h2>
          <p className="text-muted-foreground mb-6">
            {t('cta.description')}
          </p>
          <a
            href="/tools/gemini"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-6 py-3 font-medium transition-colors"
          >
            {t('cta.button')}
          </a>
        </div>
      </div>
    </>
  );
}
