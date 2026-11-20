'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { recordCheckoutReturned } from '@/shared/wedding/checkout-telemetry-client';

/** Our own return pages only; hosted card input and bank decisions stay private. */
export function CheckoutReturnTelemetry() {
  const pathname = usePathname();
  const params = useSearchParams();
  useEffect(() => {
    recordCheckoutReturned(params);
    const onPageShow = () =>
      recordCheckoutReturned(new URLSearchParams(window.location.search));
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [pathname, params]);
  return null;
}
