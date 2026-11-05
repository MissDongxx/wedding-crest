import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Button } from '@/shared/components/ui/button';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import {
  getWeddingProject,
  listWeddingProjectsForUser,
  type WeddingProject,
  type WeddingProjectRow,
} from '@/shared/models/wedding';
import { getWeddingActor } from '@/shared/models/wedding-actor';

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
  const actor = await getWeddingActor();
  const hasIdentity = Boolean(actor.ownerId);
  const localePrefix = locale === 'en' ? '' : `/${locale}`;

  let projects: WeddingProject[] = [];
  if (hasIdentity) {
    const ownerIds = [
      ...new Set(
        [actor.user?.id, actor.guestOwnerId].filter((id): id is string =>
          Boolean(id)
        )
      ),
    ];
    const rows = (
      await Promise.all(
        ownerIds.map((ownerId) => listWeddingProjectsForUser(ownerId))
      )
    ).flat();
    const uniqueRows = [...new Map(rows.map((row) => [row.id, row])).values()];
    projects = (
      await Promise.all(
        uniqueRows.map((row: WeddingProjectRow) => getWeddingProject(row.id))
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
            {hasIdentity ? t('description') : t('description_guest')}
          </p>
        </div>
      </ScrollAnimation>

      {projects.length === 0 ? (
        <div className="bg-muted/40 rounded-2xl border p-8 text-center">
          <p className="text-muted-foreground mb-4 text-sm">{t('empty')}</p>
          <Button asChild>
            <Link href={`${localePrefix}/create`}>{t('create_new')}</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <DesignCard
              key={project.id}
              project={project}
              localePrefix={localePrefix}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DesignCard({
  project,
  localePrefix,
}: {
  project: WeddingProject;
  localePrefix: string;
}) {
  const generation = project.generations?.find(
    (item) => item.sourceImageUrl || item.finalImageUrl
  );
  const imageUrl = generation?.sourceImageUrl || generation?.finalImageUrl;
  return (
    <Link
      href={`${localePrefix}/design/${project.id}`}
      className="group bg-card block overflow-hidden rounded-2xl border shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
    >
      <div className="bg-wedding-ivory p-6">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`${project.partner1} and ${project.partner2} wedding crest`}
            className="mx-auto aspect-square w-full max-w-[200px] object-contain"
          />
        ) : (
          <div className="bg-muted/40 text-muted-foreground mx-auto flex aspect-square w-full max-w-[200px] items-center justify-center rounded-xl text-sm">
            Draft
          </div>
        )}
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
