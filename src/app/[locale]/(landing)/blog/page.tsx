import type { Metadata } from 'next';
import Link from 'next/link';
import { setRequestLocale } from 'next-intl/server';

import { PRODUCTION_APP_URL } from '@/config';
import { WeddingBlog } from '@/themes/default/blocks/wedding-blog';

export const dynamic = 'force-static';
export const dynamicParams = false;
export function generateStaticParams() {
  return [{ locale: 'en' }];
}
export const metadata: Metadata = {
  title: 'Wedding Crest Guides & Inspiration | Wedding Crest Design',
  description:
    'Practical wedding crest guides, real examples, and design advice. Learn to choose your initials, colors, and motifs and prepare your crest for stationery.',
  alternates: {
    canonical: `${PRODUCTION_APP_URL}/blog`,
    languages: {
      en: `${PRODUCTION_APP_URL}/blog`,
      'x-default': `${PRODUCTION_APP_URL}/blog`,
    },
  },
};
export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <header className="mx-auto max-w-6xl px-5 pt-12 pb-14">
        <Link
          href="/"
          className="text-muted-foreground text-sm underline underline-offset-4"
        >
          ← Home
        </Link>
        <p className="text-muted-foreground mt-10 text-xs tracking-[0.2em] uppercase">
          Wedding Crest Design · Blog
        </p>
        <h1 className="mt-4 font-serif text-4xl md:text-6xl">
          Thoughtful details, beautifully together.
        </h1>
        <p className="text-muted-foreground mt-5 max-w-2xl text-lg leading-relaxed">
          Practical guides to making a personal wedding crest, from choosing
          your first initials to preparing the finished artwork for your
          celebration.
        </p>
      </header>
      <WeddingBlog />
    </>
  );
}
