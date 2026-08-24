import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import { getWeddingFrame, updateWeddingFrame } from '@/shared/models/wedding';
import { Crumb } from '@/shared/types/blocks/common';
import { Form } from '@/shared/types/blocks/form';

export default async function WeddingFrameEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  await requirePermission({
    code: PERMISSIONS.WEDDING_FRAMES_WRITE,
    redirectUrl: '/no-permission',
    locale,
  });

  const row = await getWeddingFrame(id);
  if (!row) notFound();

  const t = await getTranslations('admin.wedding_frames');

  const crumbs: Crumb[] = [
    { title: t('list.crumbs.admin'), url: '/admin' },
    { title: t('list.crumbs.frames'), url: '/admin/wedding/frames' },
    { title: row.name, is_active: true },
  ];

  const form: Form = {
    fields: [
      {
        name: 'name',
        type: 'text',
        title: t('fields.name'),
        value: row.name,
        validation: { required: true, max: 120 },
      },
      {
        name: 'url',
        type: 'upload_image',
        title: t('fields.url'),
        value: row.url,
        validation: { required: true },
      },
      {
        name: 'thumbnailUrl',
        type: 'upload_image',
        title: t('fields.thumbnail_url'),
        value: row.thumbnailUrl ?? '',
      },
      {
        name: 'altText',
        type: 'text',
        title: t('fields.alt_text'),
        value: row.altText ?? '',
      },
      {
        name: 'sortOrder',
        type: 'number',
        title: t('fields.sort_order'),
        value: String(row.sortOrder),
      },
      {
        name: 'isActive',
        type: 'switch',
        title: t('fields.is_active'),
        value: String(row.isActive),
      },
    ],
    passby: { type: 'wedding_frame', id: row.id },
    data: {},
    submit: {
      button: { title: t('edit.buttons.submit') },
      handler: async (data) => {
        'use server';

        const patch: Record<string, unknown> = {};
        const name = (data.get('name') as string | null)?.trim();
        if (name) patch.name = name;
        patch.style = null;
        const url = (data.get('url') as string | null)?.trim();
        if (url) patch.url = url;
        const thumbnailUrl = (data.get('thumbnailUrl') as string | null)?.trim();
        patch.thumbnailUrl = thumbnailUrl || null;
        const altText = (data.get('altText') as string | null)?.trim();
        patch.altText = altText || null;
        const sortOrderRaw = data.get('sortOrder') as string | null;
        if (sortOrderRaw !== null) patch.sortOrder = Number(sortOrderRaw) || 0;
        const isActiveRaw = data.get('isActive');
        patch.isActive = isActiveRaw === 'true';

        const updated = await updateWeddingFrame(id, patch);
        if (!updated) throw new Error('update frame failed');

        return {
          status: 'success',
          message: 'frame updated',
          redirect_url: '/admin/wedding/frames',
        };
      },
    },
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('edit.title')} />
        <FormCard form={form} className="md:max-w-xl" />
      </Main>
    </>
  );
}
