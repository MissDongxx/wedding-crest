import { getTranslations, setRequestLocale } from 'next-intl/server';
import { envConfigs } from '@/config';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Smartphone, Share, ExternalLink, Download, ArrowRight, CheckCircle2, Info, Zap, AlertTriangle, KeyRound, ImagePlus } from 'lucide-react';
import Link from 'next/link';
import { getUserInfo } from '@/shared/models/user';
import { getApikeys, ApikeyStatus } from '@/shared/models/apikey';
import { CopyUrlButton } from './copy-url-button';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'shortcuts' });

  return {
    title: t('metadata.title'),
    description: t('metadata.description'),
  };
}

export default async function ShortcutsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('shortcuts');
  const baseUrl = envConfigs.app_url;
  const user = await getUserInfo();

  // Check if user has an active API key and build personal URL
  let personalUrl: string | null = null;
  if (user?.id) {
    const apikeys = await getApikeys({
      userId: user.id,
      status: ApikeyStatus.ACTIVE,
      limit: 1,
    });
    if (apikeys.length > 0) {
      personalUrl = `${baseUrl}/api/v1/remove-watermark?key=${apikeys[0].key}`;
    }
  }

  const shortcutFileUrl = `${baseUrl}/shortcuts/Remove-Gemini-Watermark.shortcut`;
  const iCloudUrl = 'https://www.icloud.com/shortcuts/a742d9085e2846b9aa398cd4ac9d29f8';

  const howItWorksSteps = [
    {
      icon: <ImagePlus className="h-4 w-4" />,
      title: t('how_steps.step1.title'),
      description: t('how_steps.step1.description'),
    },
    {
      icon: <Share className="h-4 w-4" />,
      title: t('how_steps.step2.title'),
      description: t('how_steps.step2.description'),
    },
    {
      icon: <Zap className="h-4 w-4" />,
      title: t('how_steps.step3.title'),
      description: t('how_steps.step3.description'),
    },
    {
      icon: <Download className="h-4 w-4" />,
      title: t('how_steps.step4.title'),
      description: t('how_steps.step4.description'),
    },
  ];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-16">
      {/* Header */}
      <div className="mb-12 text-center">
        <div className="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
          <Smartphone className="text-primary h-8 w-8" />
        </div>
        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
          {t('title')}
        </h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
          {t('description')}
        </p>
      </div>

      {/* Step 1: Get the Shortcut */}
      <div className="mb-8 rounded-3xl border-2 border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-8 text-center relative">
        <div className="absolute -top-4 left-8 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-bold">
          {t('step_label', { number: 1 })}
        </div>
        <h2 className="mb-2 text-2xl font-bold">{t('install_title')}</h2>
        <p className="text-muted-foreground mb-8">{t('install_description')}</p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20" asChild>
            <a href={iCloudUrl} target="_blank" rel="noopener noreferrer">
              <Download className="mr-2 h-5 w-5" />
              {t('install_button')}
            </a>
          </Button>
          <span className="text-muted-foreground text-sm">{t('or_text')}</span>
          <Button size="lg" variant="outline" className="rounded-full px-8" asChild>
            <a href={shortcutFileUrl} download>
              <ExternalLink className="mr-2 h-5 w-5" />
              {t('download_button')}
            </a>
          </Button>
        </div>
      </div>

      {/* Step 2: Your Personal URL */}
      {personalUrl ? (
        <div className="mb-8 rounded-3xl border-2 border-green-300 bg-gradient-to-b from-green-50 to-green-50/50 p-8 text-center relative dark:border-green-700 dark:from-green-950/40 dark:to-green-950/20">
          <div className="absolute -top-4 left-8 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-bold">
            {t('step_label', { number: 2 })}
          </div>
          <div className="bg-green-100 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl dark:bg-green-900/60">
            <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="mb-2 text-2xl font-bold">{t('personal_url_title')}</h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">{t('personal_url_description')}</p>
          <div className="bg-background mx-auto max-w-xl flex items-center gap-2 rounded-xl border-2 border-green-200 p-3 dark:border-green-800">
            <code className="flex-1 truncate text-left text-xs sm:text-sm text-green-700 dark:text-green-300">{personalUrl}</code>
            <CopyUrlButton url={personalUrl} copyLabel={t('copy_button')} copiedLabel={t('copied_button')} />
          </div>
          <p className="text-muted-foreground mt-4 text-sm">{t('personal_url_hint')}</p>
        </div>
      ) : (
        <div className="mb-8 rounded-3xl border-2 border-amber-300 bg-gradient-to-b from-amber-50 to-amber-50/50 p-8 text-center relative dark:border-amber-700 dark:from-amber-950/40 dark:to-amber-950/20">
          <div className="absolute -top-4 left-8 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-bold">
            {t('step_label', { number: 2 })}
          </div>
          <div className="bg-amber-100 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl dark:bg-amber-900/60">
            <KeyRound className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="mb-2 text-2xl font-bold">{t('api_key_title')}</h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">{t('api_key_description')}</p>
          <Button size="lg" className="rounded-full px-8 shadow-lg shadow-amber-500/20 bg-amber-500 hover:bg-amber-600 text-white" asChild>
            <Link href={user ? `/${locale}/settings/apikeys` : `/${locale}/sign-in`}>
              <KeyRound className="mr-2 h-5 w-5" />
              {user ? t('api_key_button') : t('sign_in_button')}
            </Link>
          </Button>
        </div>
      )}

      {/* Step 3: Use the Shortcut */}
      <div className="mb-12 rounded-3xl border-2 border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-8 relative">
        <div className="absolute -top-4 left-8 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-bold">
          {t('step_label', { number: 3 })}
        </div>
        <h2 className="mb-4 text-2xl font-bold text-center">{t('step3_title')}</h2>
        <div className="space-y-4 max-w-xl mx-auto">
          <div className="flex gap-3 items-start">
            <div className="bg-primary/10 rounded-full p-2 shrink-0 mt-0.5">
              <ImagePlus className="h-5 w-5 text-primary" />
            </div>
            <p className="text-muted-foreground leading-relaxed">{t('step3_instruction1')}</p>
          </div>
          <div className="flex gap-3 items-start">
            <div className="bg-primary/10 rounded-full p-2 shrink-0 mt-0.5">
              <Share className="h-5 w-5 text-primary" />
            </div>
            <p className="text-muted-foreground leading-relaxed">{t('step3_instruction2')}</p>
          </div>
          <div className="flex gap-3 items-start">
            <div className="bg-primary/10 rounded-full p-2 shrink-0 mt-0.5">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <p className="text-muted-foreground leading-relaxed">{t('step3_instruction3')}</p>
          </div>
          <div className="flex gap-3 items-start">
            <div className="bg-primary/10 rounded-full p-2 shrink-0 mt-0.5">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-muted-foreground leading-relaxed">{t('step3_instruction4')}</p>
          </div>
        </div>
      </div>

      {/* How it works - compact cards */}
      <h2 className="mb-4 text-center text-lg font-semibold text-muted-foreground">{t('how_it_works')}</h2>
      <div className="grid grid-cols-2 gap-3 mb-12">
        {howItWorksSteps.map((step, index) => (
          <Card key={index} className="border border-border/50 bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-primary/10 rounded-full p-1.5 shrink-0">{step.icon}</span>
                <span className="text-sm font-semibold">{step.title}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Important Notes */}
      <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50/50 p-6 dark:border-amber-900/50 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <h2 className="mb-3 text-lg font-bold">{t('notes_title')}</h2>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li className="flex gap-2">
                <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>
                  {t('notes.note1_before')}
                  <Link href={`/${locale}/pricing`} className="text-primary underline underline-offset-2 hover:text-primary/80">{t('notes.note1_link')}</Link>
                  {t('notes.note1_after')}
                </span>
              </li>
              <li className="flex gap-2">
                <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                {t('notes.note2')}
              </li>
              <li className="flex gap-2">
                <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                {t('notes.note3')}
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Usage Tips */}
      <div className="mb-8 rounded-2xl border border-primary/10 bg-primary/5 p-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              {t('tips_title')}
            </h2>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li className="flex gap-2">
                <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                {t('tips.tip1')}
              </li>
              <li className="flex gap-2">
                <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                {t('tips.tip2')}
              </li>
            </ul>
          </div>
          <div className="shrink-0">
            <Button size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20" asChild>
              <Link href="/">
                {t('back_to_home')}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
