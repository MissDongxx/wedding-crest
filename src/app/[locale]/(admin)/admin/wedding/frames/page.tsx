import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { Link } from '@/core/i18n/navigation';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { TableCard } from '@/shared/blocks/table';
import { Button } from '@/shared/components/ui/button';
import { listWeddingFrames } from '@/shared/models/wedding';
import { Button as ButtonType, Crumb } from '@/shared/types/blocks/common';
import { Table } from '@/shared/types/blocks/table';

import { DeleteFrameButtonClient } from './_delete-button';

export default async function WeddingFramesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requirePermission({
    code: PERMISSIONS.WEDDING_FRAMES_READ,
    redirectUrl: '/no-permission',
    locale,
  });

  const t = await getTranslations('admin.wedding_frames');
  const rows = await listWeddingFrames();

  const crumbs: Crumb[] = [
    { title: t('list.crumbs.admin'), url: '/admin' },
    { title: t('list.crumbs.frames'), is_active: true },
  ];

  const table: Table = {
    columns: [
      { name: 'name', title: t('fields.name') },
      {
        name: 'style',
        title: t('fields.style'),
        callback: (row: { style: string | null }) =>
          row.style ?? t('values.all_styles'),
      },
      {
        name: 'url',
        title: t('fields.url'),
        type: 'image',
        className: 'w-24',
      },
      { name: 'sortOrder', title: t('fields.sort_order') },
      {
        name: 'isActive',
        title: t('fields.is_active'),
        callback: (row: { isActive: boolean }) =>
          row.isActive ? t('values.active') : t('values.inactive'),
      },
      {
        name: 'actions',
        title: t('fields.actions'),
        callback: (row: { id: string }) => (
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/wedding/frames/${row.id}/edit`}>
                <SmartIcon name="RiPencilLine" />
                {t('values.edit')}
              </Link>
            </Button>
            <DeleteFrameButtonClient
              id={row.id}
              label={t('values.delete')}
            />
          </div>
        ),
      },
    ],
    data: rows,
    emptyMessage: t('list.empty'),
  };

  const actions: ButtonType[] = [
    {
      id: 'add',
      title: t('list.buttons.add'),
      icon: 'RiAddLine',
      url: '/admin/wedding/frames/add',
    },
  ];

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('list.title')} actions={actions} />
        <TableCard table={table} />
      </Main>
    </>
  );
}
