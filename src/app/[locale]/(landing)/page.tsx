import { getTranslations, setRequestLocale } from 'next-intl/server';

import { envConfigs } from '@/config';
import { locales } from '@/config/locale';
import { getMetadata } from '@/shared/lib/seo';
import {
  listWeddingExamplesSafe,
  type WeddingExampleRow,
} from '@/shared/models/wedding';
import { DynamicPage } from '@/shared/types/blocks/landing';
import HomePage from '@/themes/default/pages/home-page';

export const revalidate = 3600;
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

async function getLandingExamples(): Promise<WeddingExampleRow[]> {
  return (await listWeddingExamplesSafe({ activeOnly: true })) as WeddingExampleRow[];
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
  logo: `${baseUrl}/logo.webp`,
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

  // Parallelize data fetching
  // TEMP-DEBUG: surface SSR errors into the response body so we can
  // see what fails on Cloudflare Workers (wrangler tail is silent
  // here). Remove once the home page renders cleanly.
  let t: any, tp: any, weddingExamples: WeddingExampleRow[];
  try {
    [t, tp, weddingExamples] = await Promise.all([
      getTranslations('pages.index'),
      getTranslations('pages.pricing'),
      getLandingExamples(),
    ]);
  } catch (e: any) {
    return (
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          padding: 24,
          font: '14px/1.5 ui-monospace, monospace',
          color: '#b91c1c',
          background: '#fef2f2',
        }}
      >
        SSR-ERROR: {e?.name}: {e?.message}
        {'\n\nSTACK:\n'}
        {(e?.stack || '').split('\n').slice(0, 25).join('\n')}
      </pre>
    );
  }

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

    for (const key of ['hero', 'styles']) {
      const section = page.sections[key];
      if (section) {
        section.data = {
          ...(section.data || {}),
          weddingExamples,
        };
      }
    }
  }

  let pageNode: React.ReactNode;
  try {
    pageNode = <HomePage page={page} />;
  } catch (e: any) {
    pageNode = (
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          padding: 24,
          font: '14px/1.5 ui-monospace, monospace',
          color: '#b91c1c',
          background: '#fef2f2',
        }}
      >
        PAGE-RENDER-ERROR: {e?.name}: {e?.message}
        {'\n\nSTACK:\n'}
        {(e?.stack || '').split('\n').slice(0, 25).join('\n')}
      </pre>
    );
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
      {pageNode}
    </>
  );
}
