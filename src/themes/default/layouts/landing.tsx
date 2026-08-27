import { ReactNode } from 'react';

import { getThemeBlock } from '@/core/theme';
import { getPublicConfigs } from '@/shared/models/config';
import {
  Footer as FooterType,
  Header as HeaderType,
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

  // Read merged env+DB public configs once per layout render so the header
  // and footer can show the admin-configured logo without each child having
  // to be a server component. The Header is a client component, so the
  // resolved value is passed down as a plain prop.
  const publicConfigs = await getPublicConfigs();
  const appLogo = publicConfigs.app_logo;

  // The Partners block previously rendered 9 third-party "featured on"
  // badges for the old removegeminiwatermark.org product at 5% opacity in
  // every page's footer. Next.js auto-preloads any <img> in the SSR'd
  // viewport, so each of those badges was being fetched cross-origin with
  // a high-priority preload on every page load. Removed here — the
  // Partners theme block is preserved on disk for the day this app ships
  // a real partner list, but it's not rendered until then.
  return (
    <div className="h-screen w-screen">
      <Header header={header} appLogo={appLogo} />
      {children}
      <Footer footer={footer} appLogo={appLogo} />
    </div>
  );
}
