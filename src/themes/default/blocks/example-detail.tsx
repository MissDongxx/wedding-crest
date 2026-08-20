'use client';

import Link from 'next/link';

import { Button } from '@/shared/components/ui/button';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { CrestPreview } from '@/shared/components/wedding/crest-preview';
import type { WeddingGalleryExample } from '@/shared/wedding/gallery';

/**
 * Single example detail view. Wrapped as a client component so it can
 * prefill the wizard via sessionStorage on click.
 */
export function ExampleDetail({ example }: { example: WeddingGalleryExample }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
      <ScrollAnimation>
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div className="bg-wedding-ivory rounded-2xl border p-6 sm:p-8">
            <CrestPreview
              className="mx-auto w-full max-w-xs"
              config={{
                partner1: example.partner1,
                partner2: example.partner2,
                weddingDate: example.weddingDate,
                style: example.style,
                layout: example.layout,
                typography: example.typography,
                palette: example.palette,
                nameDisplay: 'initials_amp',
              }}
            />
          </div>
          <div>
            <p className="text-muted-foreground text-sm tracking-[0.2em] uppercase">
              {example.location}
            </p>
            <h1 className="mt-3 font-serif text-3xl text-balance md:text-4xl">
              {example.title}
            </h1>
            <p className="text-muted-foreground mt-4 text-balance">
              {example.description}
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Style</dt>
                <dd className="mt-1">{example.style}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Typography</dt>
                <dd className="mt-1">{example.typography}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Flowers</dt>
                <dd className="mt-1">{example.flowers.join(', ') || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Personal</dt>
                <dd className="mt-1">
                  {example.personalElements.join(', ') || '—'}
                </dd>
              </div>
            </dl>
            <Button asChild className="mt-8" size="lg">
              <Link
                href={`/create?style=${example.style}`}
                onClick={(event) => {
                  if (typeof window !== 'undefined') {
                    try {
                      sessionStorage.setItem(
                        'wedding_wizard_prefill',
                        JSON.stringify(example)
                      );
                    } catch {
                      /* sessionStorage may be unavailable; safe to ignore */
                    }
                  }
                  event.stopPropagation();
                }}
              >
                Create a similar crest
              </Link>
            </Button>
          </div>
        </div>
      </ScrollAnimation>
    </div>
  );
}
