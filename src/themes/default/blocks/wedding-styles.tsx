import { Link } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { CrestPreview } from '@/shared/components/wedding/crest-preview';
import { Section } from '@/shared/types/blocks/landing';
import { getWeddingStyle, layoutsForStyle } from '@/shared/wedding/config';
import { weddingPalettes, weddingStyles } from '@/shared/wedding/types';

const STYLE_PALETTE: Record<string, string[]> = {
  botanical_watercolor: weddingPalettes[0].colors,
  minimal_line_art: weddingPalettes[6].colors,
  vintage_engraving: weddingPalettes[4].colors,
  italian_romance: weddingPalettes[3].colors,
  coastal: weddingPalettes[1].colors,
  classic_luxury: weddingPalettes[5].colors,
};

/**
 * Six signature wedding styles with deterministic crest previews and a
 * deep link that pre-selects the style in the wizard.
 */
export function WeddingStyles({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
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
          {weddingStyles.map((style, idx) => {
            const layout = layoutsForStyle(style.id)[0];
            const palette =
              STYLE_PALETTE[style.id] ?? weddingPalettes[0].colors;
            const styleConfig = getWeddingStyle(style.id);
            return (
              <ScrollAnimation key={style.id} delay={idx * 0.05}>
                <Link
                  href={`/create?style=${style.id}`}
                  className="group border-border/60 bg-card hover:border-primary/40 flex h-full flex-col rounded-2xl border p-6 shadow-sm transition-colors"
                >
                  <CrestPreview
                    config={{
                      partner1: 'Emma',
                      partner2: 'James',
                      style: style.id,
                      layout: layout.id,
                      typography: styleConfig.typography[0],
                      palette,
                      weddingDate: '2027-06-12',
                    }}
                    className="mx-auto w-3/4 [&>svg]:h-auto [&>svg]:w-full"
                  />
                  <div className="mt-6 flex flex-1 flex-col items-center text-center">
                    <h3 className="font-serif text-xl font-medium">
                      {style.name}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-xs tracking-widest uppercase">
                      {style.tagline}
                    </p>
                    <p className="text-muted-foreground mt-3 flex-1 text-sm leading-relaxed">
                      {style.description}
                    </p>
                  </div>
                </Link>
              </ScrollAnimation>
            );
          })}
        </div>

        {section.buttons?.[0] && (
          <div className="mt-10 flex justify-center">
            <Button asChild variant="outline" size="lg">
              <Link href={section.buttons[0].url ?? '/create'}>
                {section.buttons[0].title}
              </Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
