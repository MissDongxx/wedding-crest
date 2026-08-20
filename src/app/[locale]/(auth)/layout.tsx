import { envConfigs } from '@/config';
import {
  BrandLogo,
  LocaleSelector,
  ThemeToggler,
} from '@/shared/blocks/common';
import { getPublicConfigs } from '@/shared/models/config';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the admin-configured logo at request time so it shows here too.
  const publicConfigs = await getPublicConfigs();
  const appLogo = publicConfigs.app_logo;
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="absolute top-4 left-4">
        <BrandLogo
          brand={{
            title: envConfigs.app_name,
            logo: {
              src: appLogo || envConfigs.app_logo,
              alt: envConfigs.app_name,
            },
            url: '/',
            target: '_self',
            className: '',
          }}
          appLogo={appLogo}
        />
      </div>
      <div className="absolute top-4 right-4 flex items-center gap-4">
        <ThemeToggler />
        <LocaleSelector type="button" />
      </div>
      <div className="w-full px-4">{children}</div>
    </div>
  );
}
