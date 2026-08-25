import { Link } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import {
  CrestPreview,
  weddingShowcaseCrests,
} from '@/shared/components/wedding/crest-preview';
import {
  listWeddingExamples,
  type WeddingExampleRow,
} from '@/shared/models/wedding';
import { Section } from '@/shared/types/blocks/landing';
import { weddingExampleStyleIds } from '@/shared/wedding/types';

const HERO_EXAMPLES = 4;

/**
 * In-place Fisher–Yates shuffle. Used to pick a random sample of
 * admin-uploaded examples for the hero on each request — with the home
 * page ISR-cached at 3600s, the selection changes at most once an hour.
 */
function shuffle<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Editorial wedding hero: headline, primary CTA into the wizard, then a
 * strip of real product photos pulled at random from the active
 * `wedding_example` library. Each photo deep-links into the wizard with
 * the example pre-filled. Falls back to the deterministic SVG showcase
 * when no examples exist yet (fresh install / dev with empty DB).
 */
export async function WeddingHero({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  const allowedStyles = new Set<string>(weddingExampleStyleIds);
  const allExamples = (
    (await listWeddingExamples({ activeOnly: true })) as WeddingExampleRow[]
  ).filter((example) =>
    allowedStyles.has(
      example.style as (typeof weddingExampleStyleIds)[number]
    )
  );
  const heroExamples = shuffle(allExamples).slice(0, HERO_EXAMPLES);
  const useExamples = heroExamples.length > 0;

  return (
    <section
      id={section.id}
      className={`pt-24 pb-4 md:pt-48 lg:pt-56 ${className ?? ''}`}
    >
      <div className="mx-auto max-w-full px-4 text-center md:max-w-5xl">
        <ScrollAnimation>
          {section.announcement?.title && (
            <Link
              href={section.announcement.url || '/create'}
              target={section.announcement.target || '_self'}
              className="bg-muted hover:bg-background mb-8 inline-flex items-center gap-3 rounded-full border px-4 py-1.5 text-sm shadow-sm transition-colors"
            >
              <span className="text-muted-foreground">
                {section.announcement.title}
              </span>
              <span className="bg-primary size-1.5 rounded-full" />
            </Link>
          )}
          <h1 className="font-serif text-4xl leading-tight font-medium text-balance sm:text-5xl md:text-6xl">
            {section.title}
          </h1>
          <p
            className="text-muted-foreground mx-auto mt-6 mb-10 max-w-2xl text-lg text-balance"
            dangerouslySetInnerHTML={{ __html: section.description ?? '' }}
          />
        </ScrollAnimation>

        <ScrollAnimation delay={0.15}>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {section.buttons?.map((button, idx) => (
              <Button
                asChild
                key={idx}
                size={button.size || 'default'}
                variant={button.variant || 'default'}
                className="px-6 text-sm"
              >
                <Link
                  href={button.url ?? '/create'}
                  target={button.target ?? '_self'}
                >
                  <span>{button.title}</span>
                </Link>
              </Button>
            ))}
          </div>
          {section.tip && (
            <p
              className="text-muted-foreground mt-5 text-sm"
              dangerouslySetInnerHTML={{ __html: section.tip ?? '' }}
            />
          )}
        </ScrollAnimation>
      </div>

      <div className="mx-auto mt-12 max-w-6xl px-4 md:mt-16">
        <ScrollAnimation delay={0.2}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {useExamples
              ? heroExamples.map((example) => (
                  <Link
                    key={example.id}
                    href={`/create?style=${encodeURIComponent(example.style)}&exampleId=${encodeURIComponent(example.id)}`}
                    className="group border-border/60 bg-card hover:border-primary/40 relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-colors md:p-6"
                    title={example.altText ?? example.name}
                    aria-label={example.altText ?? example.name}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={example.imageUrl}
                      alt={example.altText ?? example.name}
                      className="aspect-square w-full object-cover"
                    />
                  </Link>
                ))
              : weddingShowcaseCrests.map((crest) => (
                  <Link
                    key={`${crest.partner1}-${crest.partner2}`}
                    href="/create"
                    className="group border-border/60 bg-card hover:border-primary/40 relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-colors md:p-6"
                  >
                    <CrestPreview
                      config={crest}
                      className="w-full [&>svg]:h-auto [&>svg]:w-full"
                    />
                  </Link>
                ))}
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
