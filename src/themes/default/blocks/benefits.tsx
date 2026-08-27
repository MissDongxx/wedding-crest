'use client';

import { Section } from '@/shared/types/blocks/landing';

import { FeaturesList } from './features-list';

/**
 * "Why it matters" block — the same layout as FeaturesList, used
 * for the "one crest, everywhere" benefits section.
 */
export function Benefits({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  return (
    <div className={className}>
      <FeaturesList section={section} />
    </div>
  );
}
