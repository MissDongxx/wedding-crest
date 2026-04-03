'use client';

import { UploadZone } from '@/shared/components/watermark/UploadZone';
import { Section } from '@/shared/types/blocks/landing';
import { cn } from '@/shared/lib/utils';

export function UploadZoneBlock({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  return (
    <section
      id={section.id}
      className={cn('py-16 md:py-24', section.className, className)}
    >
      <div className="container">
        {section.title && (
          <div className="mx-auto mb-12 max-w-3xl text-center">
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
        <UploadZone />
      </div>
    </section>
  );
}
