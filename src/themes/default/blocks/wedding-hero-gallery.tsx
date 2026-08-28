'use client';

import { useMemo } from 'react';
import Image from 'next/image';

import { Link } from '@/core/i18n/navigation';
import { useWeddingExamples } from '@/shared/components/wedding/wedding-examples-provider';

const HERO_EXAMPLES = 4;

function shuffle<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function GallerySkeleton() {
  return (
    <div
      className="border-border/60 bg-muted/40 aspect-square animate-pulse rounded-2xl border"
      aria-hidden="true"
    />
  );
}

export function WeddingHeroGallery() {
  const { status, examples } = useWeddingExamples();
  const heroExamples = useMemo(
    () => shuffle(examples).slice(0, HERO_EXAMPLES),
    [examples]
  );

  if (status === 'error') {
    return null;
  }

  if (status === 'ready' && heroExamples.length === 0) {
    return null;
  }

  if (status === 'loading') {
    return (
      <div className="mx-auto mt-12 max-w-6xl px-4 md:mt-16" aria-busy="true">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {Array.from({ length: HERO_EXAMPLES }, (_, index) => (
            <GallerySkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-12 max-w-6xl px-4 md:mt-16">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {heroExamples.map((example, index) => (
          <Link
            key={example.id}
            href={`/create?style=${encodeURIComponent(example.style)}&exampleId=${encodeURIComponent(example.id)}`}
            className="group border-border/60 bg-card hover:border-primary/40 relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-colors md:p-6"
            title={example.altText ?? example.name}
            aria-label={example.altText ?? example.name}
          >
            <Image
              src={example.imageUrl}
              alt={example.altText ?? example.name}
              width={640}
              height={640}
              sizes="(min-width: 768px) 25vw, 50vw"
              quality={60}
              priority={index === 0}
              loading={index === 0 ? undefined : 'lazy'}
              className="aspect-square h-auto w-full object-cover"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
