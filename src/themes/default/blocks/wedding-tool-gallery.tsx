import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import type { Section } from '@/shared/types/blocks/landing';

import styles from './wedding-tool-gallery.module.css';

const previewsPath = '/images/wedding/tool-previews';
const welcomePath = '/images/wedding/welcome-sign/cards';

const tools = [
  {
    id: 'monogram',
    title: 'Wedding Monogram Maker',
    href: '/wedding-monogram-maker',
    width: 360,
    height: 360,
    examples: [
      [`${previewsPath}/monogram-script.svg`, 'Script initials with ampersand'],
      [
        `${previewsPath}/monogram-laurel.svg`,
        'Serif initials in a laurel wreath',
      ],
      [`${previewsPath}/monogram-crest.svg`, 'Interlaced initials in a shield'],
    ],
  },
  {
    id: 'welcome',
    title: 'Wedding Welcome Sign Maker',
    href: '/wedding-welcome-sign-maker',
    width: 180,
    height: 270,
    examples: [
      [`${welcomePath}/chateau.webp`, 'Château crest welcome sign'],
      [`${welcomePath}/coast.webp`, 'Blue Coast welcome sign'],
      [`${welcomePath}/meadow.webp`, 'Watercolor meadow welcome sign'],
    ],
  },
  {
    id: 'table',
    title: 'Wedding Table Number Maker',
    href: '/table-number-maker',
    width: 288,
    height: 432,
    examples: [
      [`${previewsPath}/table-porcelain.svg`, 'Blue Porcelain table number'],
      [`${previewsPath}/table-scallop.svg`, 'Sage Scallop table number'],
      [`${previewsPath}/table-lace.svg`, 'Burgundy Lace table number'],
    ],
  },
] as const;

export function WeddingToolGallery({ section }: { section: Section }) {
  return (
    <section className={styles.section} aria-labelledby="wedding-tools-title">
      <div className="container">
        <h2 id="wedding-tools-title" className={styles.title}>
          {section.title}
        </h2>
        <div className={styles.grid}>
          {tools.map((tool) => (
            <Link
              className={styles.tool}
              href={tool.href}
              key={tool.id}
              aria-labelledby={`wedding-tool-${tool.id}`}
            >
              <div className={styles.art} data-tool={tool.id}>
                {tool.examples.map(([src, alt]) => (
                  <figure key={src}>
                    <Image
                      src={src}
                      alt={alt}
                      width={tool.width}
                      height={tool.height}
                      unoptimized
                    />
                  </figure>
                ))}
              </div>
              <h3 id={`wedding-tool-${tool.id}`} className={styles.name}>
                {tool.title}
                <ArrowUpRight size={17} aria-hidden="true" />
              </h3>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
