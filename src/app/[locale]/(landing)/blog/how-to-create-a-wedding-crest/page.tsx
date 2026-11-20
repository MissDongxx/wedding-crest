import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { setRequestLocale } from 'next-intl/server';

import { PRODUCTION_APP_URL } from '@/config';
import {
  weddingCrestGuide as guide,
  guideContents,
  guideFaqs,
} from '@/shared/content/wedding-crest-guide';

import Tutorial from '../../../../../../content/posts/how-to-create-a-wedding-crest.mdx';
import styles from './article.module.css';

export const dynamic = 'force-static';
export const dynamicParams = false;
export function generateStaticParams() {
  return [{ locale: 'en' }];
}

const articleUrl = `${PRODUCTION_APP_URL}${guide.path}`;
export const metadata: Metadata = {
  title: guide.title,
  description: guide.description,
  alternates: {
    canonical: articleUrl,
    languages: { en: articleUrl, 'x-default': articleUrl },
  },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'article',
    title: guide.title,
    description: guide.description,
    url: articleUrl,
    siteName: 'Wedding Crest Design',
    publishedTime: guide.published,
    modifiedTime: guide.published,
    authors: [guide.author],
    images: [
      {
        url: `${PRODUCTION_APP_URL}${guide.image}`,
        width: 1254,
        height: 1254,
        alt: guide.imageAlt,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: guide.title,
    description: guide.description,
    images: [`${PRODUCTION_APP_URL}${guide.image}`],
  },
};

const figures = {
  rococo: {
    file: 'rococo-example.webp',
    width: 1254,
    height: 1254,
    alt: 'Ornate Rococo-style wedding crest from the example library',
    caption:
      'Library example: Rococo Rose Medallion. Use an ornate frame as a visual reference, not a requirement for every crest.',
  },
  pet: {
    file: 'pet-example.webp',
    width: 1254,
    height: 1254,
    alt: 'Watercolor wedding crest with a dog, from the public example library',
    caption:
      'Library example: Romantic Dog Watercolor Crest. A personal subject can be part of the composition; a new AI generation will interpret your own reference.',
  },
  names: {
    file: 'creator-names.webp',
    width: 1440,
    height: 1000,
    alt: 'Wedding Crest Design Names screen with partner names, optional date, and name display choices',
    caption:
      'Actual creator interface: enter your names and choose a name-display treatment. The sample names here are illustrative.',
  },
  palette: {
    file: 'creator-palette.webp',
    width: 1440,
    height: 1000,
    alt: 'Wedding Crest Design Palette screen showing preset palettes and custom color controls',
    caption:
      'Actual creator interface: select a palette or add your own hex colors. Any style reference is inspiration, not a finished personalized result.',
  },
} as const;

function GuideImage({ name }: { name: keyof typeof figures }) {
  const image = figures[name];
  return (
    <figure>
      <div className="overflow-hidden rounded-2xl border bg-white">
        <Image
          src={`/images/blog/wedding-crest/${image.file}`}
          alt={image.alt}
          width={image.width}
          height={image.height}
          sizes="(max-width: 768px) 100vw, 760px"
          className={
            name === 'rococo' || name === 'pet'
              ? 'mx-auto h-auto w-full max-w-lg'
              : 'h-auto w-full'
          }
        />
      </div>
      <figcaption>{image.caption}</figcaption>
    </figure>
  );
}

function GuideFaq() {
  return (
    <div>
      {guideFaqs.map((faq) => (
        <details key={faq.question}>
          <summary>{faq.question}</summary>
          <p>{faq.answer}</p>
        </details>
      ))}
    </div>
  );
}

export default async function WeddingCrestTutorial({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${articleUrl}#article`,
        headline: guide.title,
        description: guide.description,
        image: [`${PRODUCTION_APP_URL}${guide.image}`],
        datePublished: `${guide.published}T00:00:00+08:00`,
        dateModified: `${guide.published}T00:00:00+08:00`,
        author: {
          '@type': 'Organization',
          name: guide.author,
          url: `${PRODUCTION_APP_URL}/blog`,
        },
        publisher: {
          '@type': 'Organization',
          name: 'Wedding Crest Design',
          url: PRODUCTION_APP_URL,
        },
        mainEntityOfPage: articleUrl,
        inLanguage: 'en',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: PRODUCTION_APP_URL,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Blog',
            item: `${PRODUCTION_APP_URL}/blog`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'How to Create a Wedding Crest',
            item: articleUrl,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: guideFaqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      },
    ],
  };

  return (
    <article className="pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, '\\u003c'),
        }}
      />
      <header className="bg-muted/30 border-b px-5 py-12 md:py-20">
        <div className="mx-auto max-w-6xl">
          <nav
            aria-label="Breadcrumb"
            className="text-muted-foreground mb-10 flex flex-wrap gap-2 text-sm"
          >
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/blog">Blog</Link>
            <span aria-hidden>/</span>
            <span>Wedding crest guide</span>
          </nav>
          <div className="grid items-center gap-10 md:grid-cols-[1.25fr_1fr] md:gap-16">
            <div>
              <p className="text-muted-foreground mb-5 text-xs font-medium tracking-[0.2em] uppercase">
                The wedding design journal · A practical guide
              </p>
              <h1 className="font-serif text-4xl leading-[1.1] tracking-tight text-balance md:text-6xl">
                How to Create a Wedding Crest
              </h1>
              <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed">
                From your first initials to the final print proof. A
                step-by-step guide to a wedding emblem that tells your story.
              </p>
              <p className="text-muted-foreground mt-6 text-sm">
                By {guide.author}
                <br />
                <time dateTime={guide.published}>October 20, 2026</time> ·
                Interface checked October 20, 2026
              </p>
              <Link
                href="#how-to-create-a-wedding-crest"
                className="mt-8 inline-flex items-center gap-3 border-b border-current pb-1 font-medium"
              >
                Go to the design steps <span aria-hidden>↓</span>
              </Link>
            </div>
            <figure className="mx-auto w-full max-w-md">
              <Image
                src={guide.image}
                alt={guide.imageAlt}
                width={1254}
                height={1254}
                priority
                sizes="(max-width: 768px) 90vw, 440px"
                className="h-auto w-full rounded-t-[45%] rounded-b-2xl border bg-white"
              />
              <figcaption className="text-muted-foreground mt-3 text-center text-xs">
                Romantic Flower Watercolor Crest · From our example library
              </figcaption>
            </figure>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-10 px-5 pt-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
        <nav
          aria-label="On this page"
          className="self-start rounded-xl border p-5 lg:sticky lg:top-24"
        >
          <p className="mb-4 text-xs font-semibold tracking-widest uppercase">
            In this guide
          </p>
          <ol className="space-y-3 text-sm leading-relaxed">
            {guideContents.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="text-muted-foreground hover:text-foreground hover:underline"
                >
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="max-w-[760px] min-w-0">
          <div className={styles.body}>
            <Tutorial
              components={{
                GuideImage,
                GuideFaq,
                a: ({ href, children }) => (
                  <Link href={href || '#'}>{children}</Link>
                ),
                h2: (props) => <h2 {...props} />,
                h3: (props) => <h3 {...props} />,
                table: (props) => (
                  <div
                    className="overflow-x-auto"
                    role="region"
                    aria-label="Guide comparison table"
                    tabIndex={0}
                  >
                    <table {...props} />
                  </div>
                ),
              }}
            />
          </div>
          <section
            className="bg-muted/40 mt-12 rounded-2xl border p-7 md:p-10"
            aria-labelledby="guide-cta"
          >
            <p className="text-muted-foreground text-xs tracking-widest uppercase">
              Make it yours
            </p>
            <h2 id="guide-cta" className="mt-3 font-serif text-3xl">
              Start with your names. Build your story.
            </h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              Choose a reference or bring your own ideas. Review the artwork
              before deciding on a download.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                href="/create"
                className="bg-primary text-primary-foreground rounded-full px-6 py-3 text-sm font-medium"
              >
                Create your wedding crest
              </Link>
              <Link
                href="/wedding-crest-examples"
                className="rounded-full border px-6 py-3 text-sm font-medium"
              >
                Browse real examples
              </Link>
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}
