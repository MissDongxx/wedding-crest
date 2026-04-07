import { getTranslations, setRequestLocale } from 'next-intl/server';
import { envConfigs } from '@/config';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Smartphone, Share, ExternalLink, Download, ArrowRight, CheckCircle2, Info } from 'lucide-react';
import Link from 'next/link';

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

  const steps = [
    {
      title: t('steps.step1.title'),
      description: t('steps.step1.description'),
      icon: <Share className="h-6 w-6 text-primary" />,
      details: t('steps.step1.details'),
    },
    {
      title: t('steps.step2.title'),
      description: t('steps.step2.description'),
      icon: <Smartphone className="h-6 w-6 text-primary" />,
      details: t('steps.step2.details'),
    },
    {
      title: t('steps.step3.title'),
      description: t('steps.step3.description'),
      icon: <ExternalLink className="h-6 w-6 text-primary" />,
      details: [
        { label: 'URL', value: `${baseUrl}/api/v1/remove-watermark` },
        { label: 'Method', value: 'POST' },
        { label: 'Request Body', value: 'File / Form' },
        { label: 'Key', value: 'image' },
      ],
    },
    {
      title: t('steps.step4.title'),
      description: t('steps.step4.description'),
      icon: <Download className="h-6 w-6 text-primary" />,
      details: t('steps.step4.details'),
    },
  ];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-16">
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

      <div className="grid gap-8">
        {steps.map((step, index) => (
          <Card key={index} className="relative overflow-hidden border-2 transition-all hover:border-primary/50">
            <div className="bg-primary/5 absolute top-0 left-0 flex h-full w-12 items-center justify-center border-r text-2xl font-bold text-primary/20">
              {index + 1}
            </div>
            <CardHeader className="pl-16">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-muted p-2">
                  {step.icon}
                </div>
                <CardTitle>{step.title}</CardTitle>
              </div>
              <CardDescription className="text-base text-foreground/80 mt-2">
                {step.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pl-16">
              {Array.isArray(step.details) ? (
                <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                  {step.details.map((detail, dIdx) => (
                    <div key={dIdx} className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-medium">{detail.label}:</span>
                      <code className="bg-background px-2 py-0.5 rounded border border-primary/20 text-primary">{detail.value}</code>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-1 shrink-0" />
                  {step.details}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-primary/5 mt-16 rounded-3xl p-8 border border-primary/10">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-3 flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              {t('tips_title')}
            </h2>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex gap-2">
                <ArrowRight className="h-4 w-4 text-primary mt-1 shrink-0" />
                {t('tips.tip1')}
              </li>
              <li className="flex gap-2">
                <ArrowRight className="h-4 w-4 text-primary mt-1 shrink-0" />
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
