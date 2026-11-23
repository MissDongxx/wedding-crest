import Image from 'next/image';
import Link from 'next/link';

import type { Section } from '@/shared/types/blocks/landing';
import {
  libraryEditorHref,
  libraryThumbnail,
  monogramLibrary,
} from '@/shared/wedding/monogram-library';
import { tableTemplates } from '@/shared/wedding/table-number-maker';
import { signTemplates } from '@/shared/wedding/welcome-sign';

import styles from './wedding-tool-gallery.module.css';

const monogram = ['01-01', '01-02', '01-03', '08-02'].map((id) => {
  const item = monogramLibrary.find((entry) => entry.id === id)!;
  return {
    name: item.name,
    src: libraryThumbnail(id),
    href: libraryEditorHref(id),
  };
});
const welcome = ['chateau', 'coast', 'meadow', 'gallery'].map((id) => ({
  name: signTemplates.find((entry) => entry.id === id)!.name,
  src: `/images/wedding/welcome-sign/cards/${id}.webp`,
  href: `/wedding-welcome-sign-maker?style=${id}#welcome-sign-editor`,
}));
const table = (
  [
    ['porcelain', 'porcelain'],
    ['scallop', 'scallop'],
    ['lace', 'lace'],
    ['goldArch', 'gold-arch'],
  ] as const
).map(([id, asset]) => ({
  name: tableTemplates[id].label,
  src: `/images/wedding/tool-previews/table-${asset}.svg`,
  href: `/table-number-maker?style=${id}#table-number-controls`,
}));

const tools = [
  { id: 'monogram', title: 'Wedding Monogram Maker', examples: monogram },
  { id: 'welcome', title: 'Wedding Welcome Sign Maker', examples: welcome },
  { id: 'table', title: 'Wedding Table Number Maker', examples: table },
];

export function WeddingToolGallery({ section }: { section: Section }) {
  return (
    <section
      className="bg-muted/40 py-16 md:py-24"
      aria-labelledby="wedding-tools-title"
    >
      <div className="mx-auto max-w-full px-4 md:max-w-6xl">
        <h2
          id="wedding-tools-title"
          className="mx-auto mb-12 max-w-2xl scroll-mt-24 text-center font-serif text-3xl font-medium tracking-tight text-balance md:text-4xl"
        >
          {section.title}
        </h2>
        <div className={styles.groups}>
          {tools.map((tool) => (
            <section key={tool.id} aria-labelledby={`wedding-tool-${tool.id}`}>
              <h3
                id={`wedding-tool-${tool.id}`}
                className="mb-5 font-serif text-2xl md:text-3xl"
              >
                {tool.title}
              </h3>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
                {tool.examples.map(({ src, name, href }) => (
                  <Link
                    key={href}
                    href={href}
                    className="group border-border/60 bg-card hover:border-primary/40 flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="bg-wedding-ivory relative aspect-square overflow-hidden">
                      <Image
                        src={src}
                        alt=""
                        fill
                        sizes="(min-width: 768px) 25vw, 50vw"
                        className={
                          tool.id === 'monogram'
                            ? 'object-cover'
                            : 'object-contain p-3 sm:p-4'
                        }
                        unoptimized={src.endsWith('.svg')}
                      />
                    </div>
                    <p className="text-foreground p-4 font-serif text-base">
                      {name}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
