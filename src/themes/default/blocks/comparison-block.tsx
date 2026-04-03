'use client';

import { BeforeAfter } from '@/shared/components/watermark/BeforeAfter';
import { Section } from '@/shared/types/blocks/landing';
import { cn } from '@/shared/lib/utils';

export function ComparisonBlock({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  if (!section.before_after) return null;

  return (
    <section
      id={section.id}
      className={cn('py-8 md:py-12', section.className, className)}
    >
      <div className="container max-w-4xl px-4">
        {section.title && (
          <div className="mx-auto mb-8 max-w-3xl text-center">
            {section.label && (
              <div className="bg-primary/10 text-primary mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium">
                <span>✦</span>
                <span>{section.label}</span>
              </div>
            )}
            <h2 className="text-foreground mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
              {section.title}
            </h2>
            {section.description && (
              <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
                {section.description}
              </p>
            )}
          </div>
        )}
        <BeforeAfter
          beforeImage={section.before_after.before_image}
          afterImage={section.before_after.after_image}
          beforeLabel={section.before_after.before_label}
          afterLabel={section.before_after.after_label}
          layout={section.before_after.layout}
        />
      </div>
    </section>
  );
}
