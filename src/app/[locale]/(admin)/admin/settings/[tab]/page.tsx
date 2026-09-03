import { revalidatePath } from 'next/cache';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import { getAllConfigs, saveConfigs } from '@/shared/models/config';
import {
  getSettingGroups,
  getSettings,
  getSettingTabs,
} from '@/shared/services/settings';
import { Crumb } from '@/shared/types/blocks/common';
import { Form as FormType } from '@/shared/types/blocks/form';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string; tab: string }>;
}) {
  const { locale, tab } = await params;
  setRequestLocale(locale);

  // Check if user has permission to read settings
  await requirePermission({
    code: PERMISSIONS.SETTINGS_READ,
    redirectUrl: '/no-permission',
    locale,
  });

  const configs = await getAllConfigs();

  const settingGroups = await getSettingGroups();
  const settings = await getSettings();

  const t = await getTranslations('admin.settings');

  const crumbs: Crumb[] = [
    { title: t('edit.crumbs.admin'), url: '/admin' },
    { title: t('edit.crumbs.settings'), is_active: true },
  ];

  const tabs = await getSettingTabs(tab ?? 'auth');

  const handleSubmit = async (data: FormData, passby: any) => {
    'use server';

    // Reading settings and writing settings are separate capabilities. The
    // page only needs read access; enforce write access again inside the
    // server action so a read-only admin cannot mutate configuration.
    await requirePermission({ code: PERMISSIONS.SETTINGS_WRITE });

    const updates: Record<string, string> = {};
    data.forEach((value, name) => {
      updates[name] = value as string;
    });

    // Persist only the submitted form fields. Saving the full render-time
    // snapshot could overwrite newer settings (or a partial auth snapshot)
    // with empty values.
    await saveConfigs(updates);

    // Public pages are ISR-cached and the favicon link comes from the
    // root layout. Purge the cache so a new App Logo (favicon) shows up
    // on the next page load instead of waiting for the next revalidate.
    revalidatePath('/', 'layout');

    return {
      status: 'success',
      message: 'Settings updated',
    };
  };

  let forms: FormType[] = [];

  settingGroups.forEach((group) => {
    if (group.tab !== tab) {
      return;
    }

    forms.push({
      title: group.title,
      description: group.description,
      fields: settings
        .filter((setting) => setting.group === group.name)
        .map((setting) => ({
          name: setting.name,
          title: setting.title,
          type: setting.type as any,
          placeholder: setting.placeholder,
          group: setting.group,
          options: setting.options,
          tip: setting.tip,
          value: setting.value,
          attributes: setting.attributes,
        })),
      passby: {
        provider: group.name,
        tab: group.tab,
      },
      data: configs,
      submit: {
        button: {
          title: t('edit.buttons.submit'),
        },
        handler: handleSubmit as any,
      },
    });
  });

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('edit.title')} tabs={tabs} />
        {forms.map((form) => (
          <FormCard
            key={form.title}
            title={form.title}
            description={form.description}
            form={form}
            className="mb-8 md:max-w-xl"
            defaultCollapsed={false}
            collapsible={true}
          />
        ))}
      </Main>
    </>
  );
}
