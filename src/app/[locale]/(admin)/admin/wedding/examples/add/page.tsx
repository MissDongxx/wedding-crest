import { getTranslations, setRequestLocale } from 'next-intl/server';
import { revalidatePath } from 'next/cache';

import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import {
  isWeddingExampleStyle,
  weddingExampleStyles,
} from '@/shared/wedding/types';
import { getUuid } from '@/shared/lib/hash';
import { createWeddingExample } from '@/shared/models/wedding';
import { Crumb } from '@/shared/types/blocks/common';
import { Form } from '@/shared/types/blocks/form';

export default async function WeddingExampleAddPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requirePermission({
    code: PERMISSIONS.WEDDING_EXAMPLES_WRITE,
    redirectUrl: '/no-permission',
    locale,
  });

  const t = await getTranslations('admin.wedding_examples');

  const crumbs: Crumb[] = [
    { title: t('list.crumbs.admin'), url: '/admin' },
    { title: t('list.crumbs.examples'), url: '/admin/wedding/examples' },
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
        name: 'style',
        type: 'select',
        title: t('fields.style'),
        options: weddingExampleStyles.map((s) => ({ value: s.id, title: s.name })),
        validation: { required: true },
      },
      {
        name: 'imageUrl',
        type: 'upload_image',
        title: t('fields.image_url'),
        validation: { required: true },
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
    passby: { type: 'wedding_example' },
    data: {},
    submit: {
      button: { title: t('add.buttons.submit') },
      handler: async (data) => {
        'use server';

        const name = (data.get('name') as string | null)?.trim() ?? '';
        const style = (data.get('style') as string | null)?.trim() ?? '';
        const imageUrl = (data.get('imageUrl') as string | null)?.trim() ?? '';
        const altText = (data.get('altText') as string | null)?.trim() || null;
        const sortOrderRaw = data.get('sortOrder') as string | null;
        const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : 0;
        const isActive = data.get('isActive') === 'true';

        if (!name || !style || !imageUrl || !isWeddingExampleStyle(style)) {
          throw new Error('name, style, imageUrl are required');
        }

        const created = await createWeddingExample({
          id: getUuid(),
          name,
          style,
          imageUrl,
          altText,
          sortOrder,
          isActive,
        });
        if (!created) throw new Error('create example failed');

        // The Find Your Style home section reads examples from the DB on
        // every request but the home page itself is ISR-cached. Purge the
        // cache so the new tile shows up on the next page load.
        revalidatePath('/', 'layout');

        return {
          status: 'success',
          message: 'example added',
          redirect_url: '/admin/wedding/examples',
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
