'use client';

import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

export function Partners({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  return (
    <section
      id={section.id}
      className={cn('py-12 border-t border-border/40', section.className, className)}
    >
      <div className="mx-auto max-w-7xl px-6">
        <ScrollAnimation>
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="flex flex-wrap items-center justify-center gap-8 opacity-[0.01]">
              <a
                href="https://turbo0.com/item/removegeminiwatermarkr"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative transition-all duration-300 hover:scale-105"
              >
                <div className="absolute -inset-2 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 opacity-0 blur-xl transition-opacity group-hover:opacity-100" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://img.turbo0.com/badge-listed-light.svg"
                  alt="Listed on Turbo0"
                  style={{ height: '54px', width: 'auto' }}
                  className="relative dark:brightness-110"
                />
              </a>
            </div>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
