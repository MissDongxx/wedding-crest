import Image from 'next/image';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

import { i18n } from '@/core/docs/source';
import { envConfigs } from '@/config';

export function baseOptions(locale: string, appLogo?: string): BaseLayoutProps {
  return {
    links: [],
    nav: {
      title: (
        <>
          {appLogo ? (
            <Image
              src={appLogo}
              alt={envConfigs.app_name}
              width={28}
              height={28}
              className=""
              unoptimized={appLogo.startsWith('http')}
            />
          ) : null}
          <span className="text-primary text-lg font-bold">
            {envConfigs.app_name}
          </span>
        </>
      ),
      transparentMode: 'top',
    },
    i18n,
  };
}
