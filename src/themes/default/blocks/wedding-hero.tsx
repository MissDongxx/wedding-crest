import { Link } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import {
  CrestPreview,
  weddingShowcaseCrests,
} from '@/shared/components/wedding/crest-preview';
import { Section } from '@/shared/types/blocks/landing';

/**
 * Editorial wedding hero: headline, primary CTA into the wizard and four
 * deterministic crest previews (one per signature style).
 */
export function WeddingHero({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  return (
    <section
      id={section.id}
      className={`pt-12 pb-4 md:pt-20 ${className ?? ''}`}
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
            {weddingShowcaseCrests.map((crest) => (
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
