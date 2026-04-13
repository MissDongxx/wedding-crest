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
      className={cn('py-4 border-t border-border/40', section.className, className)}
    >
      <div className="mx-auto max-w-7xl px-6">
        <ScrollAnimation>
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="flex flex-wrap items-center justify-center gap-8 opacity-[0.05]">              <a
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
              <a
                href="https://www.toolpilot.ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative transition-all duration-300 hover:scale-105"
              >
                <div className="absolute -inset-2 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 opacity-0 blur-xl transition-opacity group-hover:opacity-100" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://www.toolpilot.ai/cdn/shop/files/f-w_690x151_crop_center.png"
                  alt="Featured on ToolPilot"
                  style={{ height: '54px', width: 'auto' }}
                  className="relative dark:brightness-110"
                />
              </a>
              <a
                href="https://websitelaunches.com/site/removegeminiwatermark.org"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative transition-all duration-300 hover:scale-105"
              >
                <div className="absolute -inset-2 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 opacity-0 blur-xl transition-opacity group-hover:opacity-100" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://websitelaunches.com/badge/removegeminiwatermark.org.svg"
                  alt="Established online - Public launch record"
                  style={{ height: '55px', width: '255px' }}
                  className="relative dark:brightness-110"
                />
              </a>
              <a
                href="https://www.shipit.buzz/products/removegeminiwatermark?ref=badge"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative transition-all duration-300 hover:scale-105"
              >
                <div className="absolute -inset-2 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 opacity-0 blur-xl transition-opacity group-hover:opacity-100" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://www.shipit.buzz/api/products/removegeminiwatermark/badge?theme=light"
                  alt="Featured on Shipit"
                  style={{ height: '54px', width: 'auto' }}
                  className="relative dark:brightness-110"
                />
              </a>
              <a
                href="https://z-image.net/"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative transition-all duration-300 hover:scale-105"
              >
                <div className="absolute -inset-2 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 opacity-0 blur-xl transition-opacity group-hover:opacity-100" />
                <span
                  className="relative block text-2xl font-semibold text-foreground dark:brightness-110"
                  style={{ height: '54px', lineHeight: '54px' }}
                >
                  Z-Image
                </span>
              </a>
              <a
                href="https://auraplusplus.com/projects/removegeminiwatermark"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative transition-all duration-300 hover:scale-105"
              >
                <div className="absolute -inset-2 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 opacity-0 blur-xl transition-opacity group-hover:opacity-100" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://auraplusplus.com/images/badges/featured-on-light.svg"
                  alt="Featured on Aura++"
                  style={{ height: '58px', width: '265px' }}
                  className="relative dark:brightness-110"
                />
              </a>
              <a
                href="https://dang.ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative transition-all duration-300 hover:scale-105"
              >
                <div className="absolute -inset-2 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 opacity-0 blur-xl transition-opacity group-hover:opacity-100" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://cdn.prod.website-files.com/63d8afd87da01fb58ea3fbcb/6487e2868c6c8f93b4828827_dang-badge.png"
                  alt="Dang.ai"
                  style={{ height: '54px', width: '150px' }}
                  className="relative dark:brightness-110"
                />
              </a>
              <a
                href="https://trylaunch.ai/launch/removegeminiwatermark"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative transition-all duration-300 hover:scale-105"
              >
                <div className="absolute -inset-2 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 opacity-0 blur-xl transition-opacity group-hover:opacity-100" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://trylaunch.ai/badges/badge-color.png"
                  alt="Featured on Launch"
                  style={{ height: '53px', width: 'auto' }}
                  className="relative dark:brightness-110"
                />
              </a>
              <a
                href="https://startupfa.me/s/remove-gemini?utm_source=removegeminiwatermark.org"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative transition-all duration-300 hover:scale-105"
              >
                <div className="absolute -inset-2 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 opacity-0 blur-xl transition-opacity group-hover:opacity-100" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://startupfa.me/badges/featured-badge-small.webp"
                  alt="Featured on Startup Fame"
                  style={{ height: '36px', width: '224px' }}
                  className="relative dark:brightness-110"
                />
              </a>
              <a
                href="https://findly.tools/removegeminiwatermark?utm_source=removegeminiwatermark"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative transition-all duration-300 hover:scale-105"
              >
                <div className="absolute -inset-2 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 opacity-0 blur-xl transition-opacity group-hover:opacity-100" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://findly.tools/badges/findly-tools-badge-light.svg"
                  alt="Featured on Findly.tools"
                  style={{ height: '55px', width: '175px' }}
                  className="relative dark:brightness-110"
                />
              </a>
              <a
                href="https://fazier.com/launches/removegeminiwatermark.org"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative transition-all duration-300 hover:scale-105"
              >
                <div className="absolute -inset-2 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 opacity-0 blur-xl transition-opacity group-hover:opacity-100" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://fazier.com/api/v1//public/badges/launch_badges.svg?badge_type=featured&theme=neutral"
                  alt="Fazier badge"
                  style={{ height: '54px', width: '250px' }}
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
