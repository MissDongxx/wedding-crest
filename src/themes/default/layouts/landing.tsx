import { ReactNode } from 'react';

import { getThemeBlock } from '@/core/theme';
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

  return (
    <div className="h-screen w-screen">
      <Header header={header} />
      {children}
      <Footer footer={footer} />
      <Partners section={{ id: 'partners' } as Section} />
    </div>
  );
}
