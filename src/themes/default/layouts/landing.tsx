import { ReactNode } from 'react';

import { getThemeBlock } from '@/core/theme';
import { getPublicConfigs } from '@/shared/models/config';
import {
  Footer as FooterType,
  Header as HeaderType,
  Section,
} from '@/shared/types/blocks/landing';

export default async function LandingLayout({
  children,
  header,
  footer,
}: {
  children: ReactNode;
  header: HeaderType;
  footer: FooterType;
}) {
  const Header = await getThemeBlock('header');
  const Footer = await getThemeBlock('footer');
  const Partners = await getThemeBlock('partners');

  // Read merged env+DB public configs once per layout render so the header
  // and footer can show the admin-configured logo without each child having
  // to be a server component. The Header is a client component, so the
  // resolved value is passed down as a plain prop.
  const publicConfigs = await getPublicConfigs();
  const appLogo = publicConfigs.app_logo;

  return (
    <div className="h-screen w-screen">
      <Header header={header} appLogo={appLogo} />
      {children}
      <Footer footer={footer} appLogo={appLogo} />
      <Partners section={{ id: 'partners' } as Section} />
    </div>
  );
}
