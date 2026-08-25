import Image from 'next/image';

import { Link } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import { Brand as BrandType } from '@/shared/types/blocks/common';

/**
 * Renders the marketing header brand.
 *
 * Resolution order (highest priority first):
 *   1. `appLogo` from the admin (DB) settings, passed in by the parent
 *      layout from `getPublicConfigs()`. This is what the studio admin
 *      uploads and what should be visible on the public site.
 *   2. `brand.logo?.src` from the i18n landing file, used only as a
 *      static fallback for marketing assets (e.g. when the admin has
 *      not configured a logo yet, or for auth/docs layouts that do not
 *      pass `appLogo`).
 *   3. `envConfigs.app_logo` — the env-var default, last resort.
 *
 * Putting `appLogo` first is what makes admin logo changes take effect
 * on the live site. The previous order (`brand.logo?.src || appLogo || …`)
 * always won on the i18n hard-coded `"/logo.webp"`, so the admin upload
 * was silently ignored.
 */
export function BrandLogo({
  brand,
  appLogo,
}: {
  brand: BrandType;
  appLogo?: string;
}) {
  const configured = appLogo || brand.logo?.src || envConfigs.app_logo;
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
