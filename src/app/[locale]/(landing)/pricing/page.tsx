import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { getMetadata } from '@/shared/lib/seo';
import { getCurrentSubscription } from '@/shared/models/subscription';
import { getUserInfo } from '@/shared/models/user';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const revalidate = 3600;

export const generateMetadata = getMetadata({
  metadataKey: 'pages.pricing.metadata',
  canonicalUrl: '/pricing',
});

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Parallelize data fetching
  const [user, t, Page] = await Promise.all([
    getUserInfo(),
    getTranslations('pages.pricing'),
    getThemePage('dynamic-page'),
  ]);

  // get current subscription
  let currentSubscription;
  if (user) {
    try {
      currentSubscription = await getCurrentSubscription(user.id);
    } catch {
      // subscription lookup failed, continue without it
    }
  }

  // build page sections
  const page: DynamicPage = {
    title: t.raw('page.title'),
    show_sections: ['pricing'],
    sections: {
      pricing: {
        ...t.raw('page.sections.pricing'),
        data: {
          currentSubscription,
        },
      },
    },
  };

  return <Page locale={locale} page={page} />;
}
