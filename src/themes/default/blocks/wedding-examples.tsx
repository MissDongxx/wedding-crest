import Link from 'next/link';

import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { CrestPreview } from '@/shared/components/wedding/crest-preview';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';
import { weddingGalleryExamples } from '@/shared/wedding/gallery';

/**
 * Public gallery preview: eight curated examples linking to their
 * detail pages (which pre-fill the wizard).
 */
export function WeddingExamples({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  return (
    <section
      id={section.id}
      className={`bg-muted/40 py-16 md:py-24 ${className ?? ''}`}
    >
      <div className="mx-auto max-w-full px-4 md:max-w-6xl">
        <ScrollAnimation>
          <div className="mx-auto mb-12 max-w-2xl text-center text-balance">
            <h2 className="mb-4 font-serif text-3xl font-medium tracking-tight md:text-4xl">
              {section.title}
            </h2>
            <p className="text-muted-foreground">{section.description}</p>
          </div>
        </ScrollAnimation>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {weddingGalleryExamples.map((example, idx) => (
            <ScrollAnimation key={example.slug} delay={idx * 0.05}>
              <Link
                href={`/examples/${example.slug}`}
                className={cn(
                  'group border-border/60 bg-card hover:border-primary/40',
                  'flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm transition-all',
                  'hover:-translate-y-1 hover:shadow-md'
                )}
              >
                <div className="bg-wedding-ivory flex aspect-square items-center justify-center p-4">
                  <CrestPreview
                    config={{
                      partner1: example.partner1,
                      partner2: example.partner2,
                      weddingDate: example.weddingDate,
                      style: example.style,
                      layout: example.layout,
                      typography: example.typography,
                      palette: example.palette,
                      nameDisplay:
                        idx % 2 === 0 ? 'initials_amp' : 'full_names',
                    }}
                    className="w-full"
                  />
                </div>
                <div className="p-4">
                  <p className="text-foreground font-serif text-base">
                    {example.partner1} & {example.partner2}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {example.location}
                  </p>
                </div>
              </Link>
            </ScrollAnimation>
          ))}
        </div>

        {section.buttons?.[0] && (
          <div className="mt-10 text-center">
            <Link
              href={section.buttons[0].url ?? '/examples'}
              className={cn(
                'border-border hover:border-primary/40 hover:bg-accent',
                'rounded-full border px-6 py-2.5 text-sm transition-colors'
              )}
            >
              {section.buttons[0].title}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
