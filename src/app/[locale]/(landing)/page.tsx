import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { getCurrentSubscription } from '@/shared/models/subscription';
import { getUserInfo } from '@/shared/models/user';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const revalidate = 3600;

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

  return <Page locale={locale} page={page} />;
}
