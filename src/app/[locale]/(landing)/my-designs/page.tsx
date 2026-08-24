import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Button } from '@/shared/components/ui/button';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { getUserInfo } from '@/shared/models/user';
import {
  getWeddingProject,
  listWeddingProjectsForUser,
  type WeddingProject,
  type WeddingProjectRow,
} from '@/shared/models/wedding';
import { composeWeddingCrest } from '@/shared/wedding/composer';
import { weddingPalettes } from '@/shared/wedding/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.myDesigns' });
  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function MyDesignsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pages.myDesigns');
  const user = await getUserInfo();

  let projects: WeddingProject[] = [];
  if (user) {
    const rows = await listWeddingProjectsForUser(user.id);
    projects = (
      await Promise.all(
        rows.map((row: WeddingProjectRow) => getWeddingProject(row.id))
      )
    ).filter((project): project is WeddingProject => project !== null);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
      <ScrollAnimation>
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h1 className="font-serif text-3xl text-balance md:text-4xl">
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-3 text-balance">
            {user ? t('description') : t('description_guest')}
          </p>
        </div>
      </ScrollAnimation>

      {!user ? (
        <div className="bg-muted/40 rounded-2xl border p-8 text-center">
          <p className="text-muted-foreground mb-4 text-sm">
            {t('signin_hint')}
          </p>
          <Button asChild>
            <Link href="/sign-in?callbackUrl=/my-designs">{t('signin')}</Link>
          </Button>
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-muted/40 rounded-2xl border p-8 text-center">
          <p className="text-muted-foreground mb-4 text-sm">{t('empty')}</p>
          <Button asChild>
            <Link href="/create">{t('create_new')}</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <DesignCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

function DesignCard({
  project,
}: {
  project: WeddingProject;
}) {
  const fallback = composeWeddingCrest({
    ...project.input,
    partner1: project.partner1,
    partner2: project.partner2,
    initials: [
      project.partner1.charAt(0).toUpperCase(),
      project.partner2.charAt(0).toUpperCase(),
    ],
    palette:
      project.input.palette && project.input.palette.length > 0
        ? project.input.palette
        : weddingPalettes[0].colors,
    illustrationUrl: project.generations?.[0]?.sourceImageUrl ?? undefined,
  });
  return (
    <Link
      href={`/design/${project.id}`}
      className="group bg-card block overflow-hidden rounded-2xl border shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
    >
      <div className="bg-wedding-ivory p-6">
        <div className="mx-auto w-full max-w-[200px]" dangerouslySetInnerHTML={{ __html: fallback }} />
      </div>
      <div className="p-4">
        <p className="font-serif text-base">
          {project.partner1} & {project.partner2}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {project.status === 'complete'
            ? 'Ready'
            : project.status === 'failed'
              ? 'Failed'
              : 'Generating...'}
        </p>
      </div>
    </Link>
  );
}
