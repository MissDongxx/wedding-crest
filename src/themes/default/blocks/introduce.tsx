'use client';

import { SmartIcon } from '@/shared/blocks/common';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { Section } from '@/shared/types/blocks/landing';

import { FeaturesList } from './features-list';

/**
 * "How it works" block — same shape as FeaturesList but with a
 * centered "label" eyebrow above the title.
 */
export function Introduce({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  const composedSection: Section = {
    ...section,
    title: section.title ?? 'How it works',
    description: section.description ?? '',
  };

  return (
    <div className={className}>
      {section.label && (
        <div className="pt-16 text-center md:pt-24">
          <ScrollAnimation>
            <p className="text-muted-foreground text-sm tracking-[0.2em] uppercase">
              {section.label}
            </p>
          </ScrollAnimation>
        </div>
      )}
      <FeaturesList section={composedSection} />
    </div>
  );
}
