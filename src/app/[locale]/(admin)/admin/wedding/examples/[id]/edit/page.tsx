import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { revalidatePath } from 'next/cache';

import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import { getWeddingExample, updateWeddingExample } from '@/shared/models/wedding';
import { Crumb } from '@/shared/types/blocks/common';
import { Form } from '@/shared/types/blocks/form';
import {
  isWeddingExampleStyle,
  weddingExampleStyles,
} from '@/shared/wedding/types';

export default async function WeddingExampleEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  await requirePermission({
    code: PERMISSIONS.WEDDING_EXAMPLES_WRITE,
    redirectUrl: '/no-permission',
    locale,
  });

  const row = await getWeddingExample(id);
  if (!row) notFound();

  const t = await getTranslations('admin.wedding_examples');

  const crumbs: Crumb[] = [
    { title: t('list.crumbs.admin'), url: '/admin' },
    { title: t('list.crumbs.examples'), url: '/admin/wedding/examples' },
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
        name: 'style',
        type: 'select',
        title: t('fields.style'),
        options: weddingExampleStyles.map((s) => ({ value: s.id, title: s.name })),
        value: row.style,
        validation: { required: true },
      },
      {
        name: 'imageUrl',
        type: 'upload_image',
        title: t('fields.image_url'),
        value: row.imageUrl,
        validation: { required: true },
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
    passby: { type: 'wedding_example', id: row.id },
    data: {},
    submit: {
      button: { title: t('edit.buttons.submit') },
      handler: async (data) => {
        'use server';

        const patch: Record<string, unknown> = {};
        const name = (data.get('name') as string | null)?.trim();
        if (name) patch.name = name;
        const style = (data.get('style') as string | null)?.trim();
        if (style) {
          if (!isWeddingExampleStyle(style)) {
            throw new Error('unsupported example style');
          }
          patch.style = style;
        }
        const imageUrl = (data.get('imageUrl') as string | null)?.trim();
        if (imageUrl) patch.imageUrl = imageUrl;
        const altText = (data.get('altText') as string | null)?.trim();
        patch.altText = altText || null;
        const sortOrderRaw = data.get('sortOrder') as string | null;
        if (sortOrderRaw !== null) patch.sortOrder = Number(sortOrderRaw) || 0;
        const isActiveRaw = data.get('isActive');
        patch.isActive = isActiveRaw === 'true';

        const updated = await updateWeddingExample(id, patch);
        if (!updated) throw new Error('update example failed');

        // Find Your Style reads examples from the DB; the home page itself
        // is ISR-cached so purge it after any change.
        revalidatePath('/', 'layout');

        return {
          status: 'success',
          message: 'example updated',
          redirect_url: '/admin/wedding/examples',
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
