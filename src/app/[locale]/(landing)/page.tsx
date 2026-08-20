import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { envConfigs } from '@/config';
import { getCurrentSubscription } from '@/shared/models/subscription';
import { getUserInfo } from '@/shared/models/user';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const revalidate = 3600;

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
  const [user, t, tp, Page] = await Promise.all([
    getUserInfo(),
    getTranslations('pages.index'),
    getTranslations('pages.pricing'),
    getThemePage('dynamic-page'),
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

  // get current subscription
  let currentSubscription;
  if (user) {
    try {
      currentSubscription = await getCurrentSubscription(user.id);
    } catch {
      // subscription lookup failed, continue without it
    }
  }

  // inject pricing section
  if (page.sections) {
    page.sections.pricing = {
      ...tp.raw('page.sections.pricing'),
      data: {
        currentSubscription,
      },
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
      <Page locale={locale} page={page} />
    </>
  );
}
