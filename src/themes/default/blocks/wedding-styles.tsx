import { Link } from '@/core/i18n/navigation';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import {
  listWeddingExamples,
  type WeddingExampleRow,
} from '@/shared/models/wedding';
import { Section } from '@/shared/types/blocks/landing';
import {
  weddingExampleStyleIds,
  weddingExampleStyles,
  weddingStyles,
} from '@/shared/wedding/types';

const EXAMPLES_PER_STYLE = 3;

/**
 * The style grid is driven by `weddingExampleStyles` - the exact same list
 * the admin Examples library categorizes with - so the number of cards
 * always matches the admin-managed style count. Card copy (tagline,
 * description) is enriched from the generator style config when the ids
 * line up. Each card stacks up to 3 admin-uploaded real product photos
 * (one per row); clicking a photo jumps straight into the wizard with
 * names + style + example pre-filled.
 */
export async function WeddingStyles({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  // One DB read; group by style and cap at EXAMPLES_PER_STYLE per style.
  const allowedStyles = new Set<string>(weddingExampleStyleIds);
  const examples = (
    (await listWeddingExamples({ activeOnly: true })) as WeddingExampleRow[]
  ).filter((example) =>
    allowedStyles.has(example.style as (typeof weddingExampleStyleIds)[number])
  );
  const examplesByStyle = new Map<string, WeddingExampleRow[]>();
  for (const example of examples) {
    const list = examplesByStyle.get(example.style) ?? [];
    if (list.length < EXAMPLES_PER_STYLE) {
      list.push(example);
      examplesByStyle.set(example.style, list);
    }
  }

  // Only render a card for a style that actually has at least one
  // admin-uploaded example. Showing the style name + tagline with no
  // photos underneath ("ghost cards") used to leave empty grid slots
  // like "Botanical Watercolor" visible when admin hadn't uploaded an
  // example for that style. If no style has an example, hide the whole
  // section so the home page doesn't present a row of empty boxes.
  const stylesWithExamples = weddingExampleStyles.filter((style) =>
    (examplesByStyle.get(style.id) ?? []).length > 0
  );
  if (stylesWithExamples.length === 0) return null;

  return (
    <section id={section.id} className={`py-16 md:py-24 ${className ?? ''}`}>
      <div className="mx-auto max-w-full px-4 md:max-w-6xl">
        <ScrollAnimation>
          <div className="mx-auto mb-12 max-w-2xl text-center text-balance">
            <h2 className="mb-4 font-serif text-3xl font-medium tracking-tight md:text-4xl">
              {section.title}
            </h2>
            <p className="text-muted-foreground">{section.description}</p>
          </div>
        </ScrollAnimation>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {stylesWithExamples.map((style, idx) => {
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

                  {styleExamples.length > 0 && (
                    <div className="border-border/60 space-y-2 border-t p-4">
                      {styleExamples.map((example) => (
                        <Link
                          key={example.id}
                          href={`/create?style=${encodeURIComponent(style.id)}&exampleId=${encodeURIComponent(example.id)}`}
                          className="border-border/40 hover:border-primary/40 block overflow-hidden rounded-lg border transition-colors"
                          title={example.altText ?? example.name}
                          aria-label={example.altText ?? example.name}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={example.imageUrl}
                            alt={example.altText ?? example.name}
                            className="aspect-square w-full object-cover"
                            loading="lazy"
                          />
                        </Link>
                      ))}
                    </div>
                  )}
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
