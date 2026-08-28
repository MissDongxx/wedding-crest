import { getTranslations, setRequestLocale } from 'next-intl/server';

import { envConfigs } from '@/config';
import { locales } from '@/config/locale';
import { getMetadata } from '@/shared/lib/seo';
import { DynamicPage } from '@/shared/types/blocks/landing';
import HomePage from '@/themes/default/pages/home-page';

export const revalidate = 3600;
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const generateMetadata = getMetadata({
  metadataKey: 'pages.index.metadata',
  canonicalUrl: '/',
});

// JSON-LD structured data for homepage
const baseUrl = envConfigs.app_url;

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
  ],
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Wedding Crest Design',
  url: baseUrl,
  description:
    'Design a custom wedding crest in minutes with AI-illustrated artwork and programmatic typography.',
};

// FAQ schema built from the i18n FAQ section (spec: FAQ rich results)
function buildFaqJsonLd(items: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (items || []).map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tp] = await Promise.all([
    getTranslations('pages.index'),
    getTranslations('pages.pricing'),
  ]);

  // get page data
  const page: DynamicPage = t.raw('page');

  // FAQ items for structured data
  const faqItems =
    (page.sections?.faq?.items as Array<{
      question: string;
      answer: string;
    }>) || [];
  const faqJsonLd = buildFaqJsonLd(faqItems);

  // inject pricing section
  if (page.sections) {
    page.sections.pricing = {
      ...tp.raw('page.sections.pricing'),
    };
  }

  return (
    <>
      {/* Structured Data: BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Structured Data: Organization */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd),
        }}
      />
      {/* Structured Data: FAQ */}
      {faqJsonLd.mainEntity.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <HomePage page={page} />
    </>
  );
}
