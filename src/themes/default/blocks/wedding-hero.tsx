import { Link } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { Section } from '@/shared/types/blocks/landing';

import { WeddingHeroGallery } from './wedding-hero-gallery';

/**
 * Editorial wedding hero: headline, primary CTA into the wizard, then a
 * strip of real product photos pulled at random from the active
 * `wedding_example` library. Each photo deep-links into the wizard with
 * the example pre-filled. The strip is omitted until real AI examples exist.
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
      className={`pt-24 pb-4 md:pt-48 lg:pt-56 ${className ?? ''}`}
    >
      <div className="mx-auto max-w-full px-4 text-center md:max-w-5xl">
        <div>
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
        </div>

        <div>
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
        </div>
      </div>

      <ScrollAnimation delay={0.2}>
        <WeddingHeroGallery />
      </ScrollAnimation>
    </section>
  );
}
