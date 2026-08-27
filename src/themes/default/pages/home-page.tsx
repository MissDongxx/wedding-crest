import type { ComponentType } from 'react';

import { Benefits } from '../blocks/benefits';
import { Cta } from '../blocks/cta';
import { Faq } from '../blocks/faq';
import { Introduce } from '../blocks/introduce';
import { Pricing } from '../blocks/pricing';
import { WeddingHero } from '../blocks/wedding-hero';
import { WeddingStyles } from '../blocks/wedding-styles';
import type { DynamicPage as DynamicPageType } from '@/shared/types/blocks/landing';

// The home page has a fixed, small set of blocks. Keeping this registry local
// avoids making the generic theme block import context part of the home-page
// client graph (which otherwise pulls blog/admin/editor blocks into first load).
const homeBlocks: Record<string, ComponentType<any>> = {
  'wedding-hero': WeddingHero,
  'wedding-styles': WeddingStyles,
  introduce: Introduce,
  benefits: Benefits,
  pricing: Pricing,
  faq: Faq,
  cta: Cta,
};

export default async function HomePage({
  page,
}: {
  page: DynamicPageType;
}) {
  const sectionKeys = Object.keys(page.sections || {});
  const renderedSections = await Promise.all(
    sectionKeys.map(async (sectionKey) => {
      const section = page.sections?.[sectionKey];
      if (!section || section.disabled === true) return null;
      if (page.show_sections && !page.show_sections.includes(sectionKey)) {
        return null;
      }

      const blockName = section.block || section.id || sectionKey;
      const Block = homeBlocks[blockName];
      if (!Block) return null;

      return (
        <Block
          key={sectionKey}
          section={section}
          {...(section.data || {})}
        />
      );
    })
  );

  return (
    <>
      {page.title && !page.sections?.hero && (
        <h1 className="sr-only">{page.title}</h1>
      )}
      {renderedSections}
    </>
  );
}
