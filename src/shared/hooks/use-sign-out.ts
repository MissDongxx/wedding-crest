'use client';

import { useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';

import { signOut } from '@/core/auth/client';
import { getPathname } from '@/core/i18n/navigation';
import { useAppContext } from '@/shared/contexts/app';

export function useSignOut(callbackUrl = '/') {
  const locale = useLocale();
  const { setUser } = useAppContext();
  const inFlight = useRef(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsSigningOut(true);

    try {
      // Better Auth returns HTTP failures as { error }; they do not throw.
      const result = await signOut();
      if (result.error) throw new Error(result.error.message);

      setUser(null);
      // Reset client session/context and server-rendered account data together,
      // even when signing out on the callback route itself (usually home).
      window.location.assign(getPathname({ href: callbackUrl, locale }));
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : 'Sign out failed. Please try again.'
      );
      inFlight.current = false;
      setIsSigningOut(false);
    }
  };

  return { handleSignOut, isSigningOut };
}
