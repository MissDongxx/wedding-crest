import { ReactNode } from 'react';

import { getPublicConfigs } from '@/shared/models/config';
import {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';
import { Footer } from '@/themes/default/blocks/footer';
import { Header } from '@/themes/default/blocks/header';

export default async function LandingLayout({
  children,
  header,
  footer,
}: {
  children: ReactNode;
  header: HeaderType;
  footer: FooterType;
}) {
  // Read merged env+DB public configs once per layout render so the header
  // and footer can show the admin-configured logo without each child having
  // to be a server component. The Header is a client component, so the
  // resolved value is passed down as a plain prop.
  const publicConfigs = await getPublicConfigs();
  const appLogo = publicConfigs.app_logo;

  // The Partners block used to render 9 third-party "featured on" badges at
  // 5% opacity in every page's footer. Next.js auto-preloads any <img> in
  // the SSR'd viewport, so each badge was fetched cross-origin with a
  // high-priority preload on every page load. It is no longer rendered, and
  // the block itself was removed along with the rest of the legacy product
  // (see the cleanup of the watermark-remover line).
  return (
    <div className="h-screen w-screen">
      <Header header={header} appLogo={appLogo} />
      {children}
      <Footer footer={footer} appLogo={appLogo} />
    </div>
  );
}
