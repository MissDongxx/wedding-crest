'use client';

import { useMemo } from 'react';
import Image from 'next/image';

import { Link } from '@/core/i18n/navigation';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { useWeddingExamples } from '@/shared/components/wedding/wedding-examples-provider';
import { Section } from '@/shared/types/blocks/landing';
import { weddingExampleStyles, weddingStyles } from '@/shared/wedding/types';

const EXAMPLES_PER_STYLE = 3;

function StyleSkeleton() {
  return (
    <div
      className="border-border/60 bg-card h-80 animate-pulse rounded-2xl border shadow-sm"
      aria-hidden="true"
    />
  );
}

/**
 * Client-rendered style gallery. The section copy is part of the static page;
 * only the optional example photos wait for the post-hydration API request.
 */
export function WeddingStyles({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  const { status, examples } = useWeddingExamples();
  const examplesByStyle = useMemo(() => {
    const grouped = new Map<string, typeof examples>();
    for (const example of examples) {
      const list = grouped.get(example.style) ?? [];
      if (list.length < EXAMPLES_PER_STYLE) {
        list.push(example);
        grouped.set(example.style, list);
      }
    }
    return grouped;
  }, [examples]);
  const stylesWithExamples = useMemo(
    () =>
      weddingExampleStyles.filter(
        (style) => (examplesByStyle.get(style.id) ?? []).length > 0
      ),
    [examplesByStyle]
  );

  if (
    status === 'error' ||
    (status === 'ready' && stylesWithExamples.length === 0)
  ) {
    return null;
  }

  const isLoading = status === 'loading';
  const styles = isLoading ? weddingExampleStyles : stylesWithExamples;

  return (
    <section id={section.id} className={`py-16 md:py-24 ${className ?? ''}`}>
      <div className="mx-auto max-w-full px-4 md:max-w-6xl">
        <ScrollAnimation>
          <div className="mx-auto mb-12 max-w-2xl text-center text-balance">
            <h2 className="mb-4 font-serif text-3xl font-medium tracking-tight md:text-4xl">
              {section.title}
            </h2>
            <p className="text-muted-foreground">{section.description}</p>
            <p className="text-muted-foreground mt-3 text-sm">{section.tip}</p>
          </div>
        </ScrollAnimation>

        <div
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          aria-busy={isLoading}
        >
          {styles.map((style, idx) => {
            if (isLoading) return <StyleSkeleton key={style.id} />;

            const meta = weddingStyles.find((s) => s.id === style.id);
            const styleExamples = examplesByStyle.get(style.id) ?? [];
            return (
              <ScrollAnimation key={style.id} delay={idx * 0.05}>
                <article className="group border-border/60 bg-card hover:border-primary/40 flex h-full flex-col rounded-2xl border shadow-sm transition-colors">
                  <Link
                    href={`/create?style=${style.id}`}
                    className="flex flex-1 flex-col items-center p-6 text-center"
                  >
                    <h3 className="font-serif text-xl font-medium">
                      {meta?.name ?? style.name}
                    </h3>
                    {meta ? (
                      <>
                        <p className="text-muted-foreground mt-1 text-xs tracking-widest uppercase">
                          {meta.tagline}
                        </p>
                        <p className="text-muted-foreground mt-3 flex-1 text-sm leading-relaxed">
                          {meta.description}
                        </p>
                      </>
                    ) : null}
                  </Link>

                  <div className="border-border/60 space-y-2 border-t p-4">
                    {styleExamples.map((example) => (
                      <Link
                        key={example.id}
                        href={`/create?style=${encodeURIComponent(style.id)}&exampleId=${encodeURIComponent(example.id)}`}
                        className="border-border/40 hover:border-primary/40 block overflow-hidden rounded-lg border transition-colors"
                        title={example.altText ?? example.name}
                        aria-label={example.altText ?? example.name}
                      >
                        <Image
                          src={example.imageUrl}
                          alt={example.altText ?? example.name}
                          width={512}
                          height={512}
                          sizes="(min-width: 768px) 25vw, 50vw"
                          quality={60}
                          className="aspect-square h-auto w-full object-cover"
                          loading="lazy"
                        />
                      </Link>
                    ))}
                  </div>
                </article>
              </ScrollAnimation>
            );
          })}
        </div>

        {section.buttons?.[0] && (
          <div className="mt-10 flex justify-center">
            <Link
              href={section.buttons[0].url ?? '/create'}
              className="border-border hover:border-primary/40 hover:bg-accent inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm transition-colors"
            >
              {section.buttons[0].title}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
