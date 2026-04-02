import { getThemeBlock } from '@/core/theme';
import type { DynamicPage as DynamicPageType } from '@/shared/types/blocks/landing';

export default async function DynamicPage({
  locale,
  page,
  data,
}: {
  locale?: string;
  page: DynamicPageType;
  data?: Record<string, any>;
}) {
  const sectionKeys = Object.keys(page.sections || {});

  const renderedSections = await Promise.all(
    sectionKeys.map(async (sectionKey: string) => {
      const section = page.sections?.[sectionKey];
      if (!section || section.disabled === true) {
        return null;
      }

      if (page.show_sections && !page.show_sections.includes(sectionKey)) {
        return null;
      }

      // block name
      const block = section.block || section.id || sectionKey;

      switch (block) {
        default:
          try {
            if (section.component) {
              return section.component;
            }

            const DynamicBlock = await getThemeBlock(block);
            return (
              <DynamicBlock
                key={sectionKey}
                section={section}
                {...(data || section.data || {})}
              />
            );
          } catch (error) {
            console.error(`Error loading block "${block}":`, error);
            return null;
          }
      }
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
