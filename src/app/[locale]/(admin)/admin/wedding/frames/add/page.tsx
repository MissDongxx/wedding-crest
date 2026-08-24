import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import { getUuid } from '@/shared/lib/hash';
import { createWeddingFrame } from '@/shared/models/wedding';
import { Crumb } from '@/shared/types/blocks/common';
import { Form } from '@/shared/types/blocks/form';

export default async function WeddingFrameAddPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requirePermission({
    code: PERMISSIONS.WEDDING_FRAMES_WRITE,
    redirectUrl: '/no-permission',
    locale,
  });

  const t = await getTranslations('admin.wedding_frames');

  const crumbs: Crumb[] = [
    { title: t('list.crumbs.admin'), url: '/admin' },
    { title: t('list.crumbs.frames'), url: '/admin/wedding/frames' },
    { title: t('add.crumbs.add'), is_active: true },
  ];

  const form: Form = {
    fields: [
      {
        name: 'name',
        type: 'text',
        title: t('fields.name'),
        validation: { required: true, max: 120 },
      },
      {
        name: 'url',
        type: 'upload_image',
        title: t('fields.url'),
        validation: { required: true },
      },
      {
        name: 'thumbnailUrl',
        type: 'upload_image',
        title: t('fields.thumbnail_url'),
      },
      {
        name: 'altText',
        type: 'text',
        title: t('fields.alt_text'),
      },
      {
        name: 'sortOrder',
        type: 'number',
        title: t('fields.sort_order'),
        value: '0',
      },
      {
        name: 'isActive',
        type: 'switch',
        title: t('fields.is_active'),
        value: 'true',
      },
    ],
    passby: { type: 'wedding_frame' },
    data: {},
    submit: {
      button: { title: t('add.buttons.submit') },
      handler: async (data) => {
        'use server';

        const name = (data.get('name') as string | null)?.trim() ?? '';
        const url = (data.get('url') as string | null)?.trim() ?? '';
        const thumbnailUrl = (data.get('thumbnailUrl') as string | null)?.trim() || null;
        const altText = (data.get('altText') as string | null)?.trim() || null;
        const sortOrderRaw = data.get('sortOrder') as string | null;
        const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : 0;
        const isActive = data.get('isActive') === 'true';

        if (!name || !url) {
          throw new Error('name and url are required');
        }

        const created = await createWeddingFrame({
          id: getUuid(),
          name,
          style: null,
          url,
          thumbnailUrl,
          altText,
          sortOrder,
          isActive,
        });
        if (!created) throw new Error('create frame failed');

        return {
          status: 'success',
          message: 'frame added',
          redirect_url: '/admin/wedding/frames',
        };
      },
    },
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('add.title')} />
        <FormCard form={form} className="md:max-w-xl" />
      </Main>
    </>
  );
}
