import Image from 'next/image';

import { Link } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import { Brand as BrandType } from '@/shared/types/blocks/common';

/**
 * Renders the marketing header brand. Falls back to the admin-configured
 * `app_logo` (resolved by the parent layout from the merged env+DB public
 * configs) when the i18n brand block doesn't supply one, so the studio
 * admin's uploaded logo is what shows in the public site nav.
 *
 * The parent layout (e.g. themes/default/layouts/landing.tsx) computes the
 * merged `appLogo` once per render and passes it as a prop. This keeps
 * `BrandLogo` itself a thin client-safe component, since the public header
 * (`themes/default/blocks/header.tsx`) is a client component and cannot
 * directly call `getPublicConfigs()`.
 *
 * `envConfigs.app_logo` is the env-var fallback used when the parent
 * doesn't supply `appLogo` (e.g. when this component is used outside the
 * landing layout — error boundary, not-found, etc.).
 */
export function BrandLogo({
  brand,
  appLogo,
}: {
  brand: BrandType;
  appLogo?: string;
}) {
  const configured = brand.logo?.src || appLogo || envConfigs.app_logo;
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
        <span className="text-lg font-medium">{brand.title}</span>
      )}
    </Link>
  );
}
