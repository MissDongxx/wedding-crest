import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';

import { routing } from '@/core/i18n/config';
import { pickClientMessages } from '@/core/i18n/client-messages';
import { ThemeProvider } from '@/core/theme/provider';
import { Toaster } from '@/shared/components/ui/sonner';
import { AppContextProvider } from '@/shared/contexts/app';
import { getMetadata } from '@/shared/lib/seo';

export const generateMetadata = getMetadata();

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  // Pass a subset of the messages to the client. The request config still
  // loads the full set so server components can call `getTranslations` for
  // any namespace, but the client provider only carries the ~9 namespaces
  // referenced by `useTranslations(...)` calls in the source. This
  // shrinks the per-page RSC payload by ~60 KB (from ~86 KB of messages
  // to ~25 KB). See `clientLocaleMessagesPaths` for the allowlist.
  const messages = await getMessages();
  const clientMessages = pickClientMessages(messages);

  return (
    <NextIntlClientProvider locale={locale} messages={clientMessages}>
      <ThemeProvider>
        <AppContextProvider>
          {children}
          <Toaster position="top-center" richColors />
        </AppContextProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
