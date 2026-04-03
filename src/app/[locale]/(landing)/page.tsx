import { getTranslations, setRequestLocale } from 'next-intl/server';

import { envConfigs } from '@/config';
import { getThemePage } from '@/core/theme';
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
  name: 'RemoveGeminiWatermark',
  url: baseUrl,
  logo: `${baseUrl}/logo.png`,
  description:
    'Free browser-based tool to remove AI watermarks from Gemini-generated images.',
  sameAs: ['https://x.com/RemoveGeminiWM'],
};

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
      <Page locale={locale} page={page} />
    </>
  );
}
