import Image from 'next/image';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import {
  listWeddingExamples,
  type WeddingExampleRow,
} from '@/shared/models/wedding';
import { weddingExampleStyleIds, weddingStyles } from '@/shared/wedding/types';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.examples' });
  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

type PhotoExample = {
  id: string;
  style: string;
  name: string;
  imageUrl: string;
  altText: string | null;
  href: string;
};

type Category = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  previewColor: string;
  photos: PhotoExample[];
};

function splitPartnerNames(value: string): {
  partner1: string;
  partner2: string;
} {
  const parts = value
    .split('&')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return { partner1: parts[0], partner2: parts[1] };
  }
  return { partner1: value, partner2: '' };
}

export default async function ExamplesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pages.examples');

  const allowedStyles = new Set<string>(weddingExampleStyleIds);
  const dbRows = (await listWeddingExamples({
    activeOnly: true,
  })) as WeddingExampleRow[];

  const photosByStyle = new Map<string, PhotoExample[]>();
  for (const row of dbRows) {
    if (!row.imageUrl || !allowedStyles.has(row.style)) continue;
    const list = photosByStyle.get(row.style) ?? [];
    list.push({
      id: row.id,
      style: row.style,
      name: row.name,
      imageUrl: row.imageUrl,
      altText: row.altText ?? null,
      href: `/create?style=${encodeURIComponent(row.style)}&exampleId=${row.id}`,
    });
    photosByStyle.set(row.style, list);
  }

  const categories: Category[] = weddingStyles
    // Only show styles backed by real AI-generated examples.
    .filter((style) => (photosByStyle.get(style.id)?.length ?? 0) > 0)
    .map((style) => ({
      id: style.id,
      name: style.name,
      tagline: style.tagline,
      description: style.description,
      previewColor: style.previewColor,
      photos: photosByStyle.get(style.id) ?? [],
    }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
      <ScrollAnimation>
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h1 className="font-serif text-3xl text-balance md:text-4xl">
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-3 text-balance">
            {t('description')}
          </p>
        </div>
      </ScrollAnimation>

      {categories.length === 0 ? (
        <div className="text-muted-foreground py-16 text-center text-sm">
          {t('empty')}
        </div>
      ) : (
        <div className="space-y-16">
          {categories.map((category, categoryIdx) => (
            <CategorySection
              key={category.id}
              category={category}
              index={categoryIdx}
              browseAllLabel={t('browse_all')}
              startFromLabel={t('start_from_this')}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategorySection({
  category,
  index,
  browseAllLabel,
  startFromLabel,
}: {
  category: Category;
  index: number;
  browseAllLabel: string;
  startFromLabel: string;
}) {
  return (
    <section
      aria-labelledby={`category-${category.id}`}
      className="border-border/40 rounded-3xl border p-5 sm:p-8"
    >
      <ScrollAnimation delay={index * 0.04}>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: category.previewColor }}
              />
              <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
                {category.tagline}
              </p>
            </div>
            <h2
              id={`category-${category.id}`}
              className="font-serif text-2xl text-balance md:text-3xl"
            >
              {category.name}
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm text-balance">
              {category.description}
            </p>
          </div>
          <Link
            href={`/create?style=${encodeURIComponent(category.id)}`}
            className="border-border hover:border-primary/40 hover:bg-accent inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs transition-colors"
          >
            {browseAllLabel}
          </Link>
        </div>
      </ScrollAnimation>

      {category.photos.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {category.photos.map((photo, photoIdx) => (
            <ScrollAnimation key={photo.id} delay={photoIdx * 0.03}>
              <Link
                href={photo.href}
                className="group bg-card block overflow-hidden rounded-2xl border shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <div className="bg-wedding-ivory relative aspect-square overflow-hidden">
                  <Image
                    src={photo.imageUrl}
                    alt={photo.altText ?? photo.name}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="object-cover"
                  />
                  <span className="bg-background/85 absolute right-2 bottom-2 rounded-full px-2.5 py-1 text-[10px] font-medium tracking-wide uppercase shadow">
                    {startFromLabel}
                  </span>
                </div>
                <div className="p-3">
                  <p className="font-serif text-sm">
                    {splitPartnerNames(photo.name).partner1}
                    {splitPartnerNames(photo.name).partner2
                      ? ` & ${splitPartnerNames(photo.name).partner2}`
                      : ''}
                  </p>
                  {photo.altText ? (
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {photo.altText}
                    </p>
                  ) : null}
                </div>
              </Link>
            </ScrollAnimation>
          ))}
        </div>
      )}
    </section>
  );
}
