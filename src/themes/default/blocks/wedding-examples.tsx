import Link from 'next/link';

import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { CrestPreview } from '@/shared/components/wedding/crest-preview';
import { cn } from '@/shared/lib/utils';
import {
  listWeddingExamples,
  type WeddingExampleRow,
} from '@/shared/models/wedding';
import { Section } from '@/shared/types/blocks/landing';
import {
  weddingExampleStyleIds,
  weddingPalettes,
} from '@/shared/wedding/types';

const DEFAULT_PALETTE = weddingPalettes[0].colors;

export async function WeddingExamples({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  const allowedStyles = new Set(weddingExampleStyleIds);
  const examples = (await listWeddingExamples({ activeOnly: true }) as WeddingExampleRow[]).filter(
    (example) => allowedStyles.has(example.style as (typeof weddingExampleStyleIds)[number])
  );

  // Only render the section when we have at least one active example
  // with a real product photo. A grid of curated SVG placeholders used
  // to fill the empty state, but those weren't "examples" — the
  // product spec is to show only admin-uploaded crests here, so we hide
  // the whole section until the studio adds one.
  if (examples.length === 0) return null;

  const tiles = examples.map((example) => {
    const names = example.name.split('&').map((n) => n.trim());
    const [p1, p2] =
      names.length === 2 ? [names[0], names[1]] : [example.name, ''];
    return {
      key: example.id,
      href: `/create?style=${encodeURIComponent(example.style)}&exampleId=${example.id}`,
      partner1: p1,
      partner2: p2,
      style: example.style,
      palette: DEFAULT_PALETTE,
      imageUrl: example.imageUrl,
      location: example.altText ?? example.style,
    };
  });

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
          {tiles.map((tile: (typeof tiles)[number], idx: number) => (
            <ScrollAnimation key={tile.key} delay={idx * 0.05}>
              <Link
                href={tile.href}
                className={cn(
                  'group border-border/60 bg-card hover:border-primary/40',
                  'flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm transition-all',
                  'hover:-translate-y-1 hover:shadow-md'
                )}
              >
                <div className="bg-wedding-ivory flex aspect-square items-center justify-center p-4">
                  <CrestPreview
                    config={{
                      partner1: tile.partner1,
                      partner2: tile.partner2 || '·',
                      style: tile.style,
                      // Pull a default layout compatible with the style; the
                      // user's wizard run will pick from the real list.
                      layout: 'BOTANICAL_OVAL_01',
                      typography: 'editorial_rose',
                      palette: tile.palette,
                      nameDisplay: idx % 2 === 0 ? 'initials_amp' : 'full_names',
                      illustrationUrl: tile.imageUrl ?? undefined,
                    }}
                    className="w-full"
                  />
                </div>
                <div className="p-4">
                  <p className="text-foreground font-serif text-base">
                    {tile.partner2
                      ? `${tile.partner1} & ${tile.partner2}`
                      : tile.partner1}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {tile.location}
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
                'inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm transition-colors'
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
