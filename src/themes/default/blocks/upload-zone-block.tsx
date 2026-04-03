'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';

import { UploadZone } from '@/shared/components/watermark/UploadZone';
import type { ProcessingState } from '@/shared/lib/watermark';
import { Section } from '@/shared/types/blocks/landing';
import { cn } from '@/shared/lib/utils';

export function UploadZoneBlock({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  const [showAfter, setShowAfter] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const handlePointerDown = useCallback(() => setShowAfter(true), []);
  const handlePointerUp = useCallback(() => setShowAfter(false), []);
  const handleUploadStateChange = useCallback((state: ProcessingState) => {
    if (state !== 'idle') setUploaded(true);
  }, []);

  return (
    <section
      id={section.id}
      className={cn('pt-16 pb-8 md:pt-24 md:pb-12', section.className, className)}
    >
      <div className="container">
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
        <div className={cn(
          'grid gap-8 items-start transition-all duration-300',
          uploaded ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'
        )}>
          <UploadZone onStateChange={handleUploadStateChange} />
          {/* Comparison toggle area — hidden after upload */}
          {!uploaded && (
            <div className="flex flex-col items-center gap-3">
              <div
                className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl border border-border/40 bg-muted/20 shadow-lg cursor-pointer select-none"
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                <Image
                  src={showAfter ? '/images/examples/after.jpg' : '/images/examples/before.jpg'}
                  alt={showAfter ? 'After watermark removal' : 'Before watermark removal'}
                  fill
                  className="object-cover transition-opacity duration-200"
                  priority
                />
                {/* Label badge */}
                <div className={cn(
                  'absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md transition-colors duration-200',
                  showAfter
                    ? 'bg-green-500/80 text-white'
                    : 'bg-red-500/80 text-white'
                )}>
                  {showAfter ? 'After' : 'Before'}
                </div>
              </div>
              <p className="text-muted-foreground text-sm text-center">
                {(section as Record<string, unknown>).comparison_tip as string || 'Press & hold to see the result'}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
