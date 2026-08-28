import Image from 'next/image';

import { Link } from '@/core/i18n/navigation';
import { Brand as BrandType } from '@/shared/types/blocks/common';

/**
 * Renders the marketing header brand.
 *
 * The only image source is `appLogo`, resolved from the Admin settings by
 * the parent server layout. The template brand object still supplies the
 * title, alt text, dimensions, and link, but never supplies an image.
 */
export function BrandLogo({
  brand,
  appLogo,
}: {
  brand: BrandType;
  appLogo?: string;
}) {
  const configured = appLogo?.trim();
  return (
    <Link
      href={brand.url || ''}
      target={brand.target || '_self'}
      className={`flex items-center space-x-3 ${brand.className}`}
    >
      {configured && (
        <Image
          src={configured}
          alt={brand.logo?.alt || brand.title || ''}
          width={brand.logo?.width || 80}
          height={brand.logo?.height || 80}
          className="h-8 w-auto rounded-lg"
          unoptimized={configured.startsWith('http')}
        />
      )}
      {brand.title && (
        <span
          className="text-xl font-medium italic"
          style={{ fontFamily: "'Fraunces', Georgia, serif" }}
        >
          {brand.title}
        </span>
      )}
    </Link>
  );
}
