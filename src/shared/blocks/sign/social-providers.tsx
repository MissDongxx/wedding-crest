'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { RiGithubFill, RiGoogleFill } from 'react-icons/ri';
import { toast } from 'sonner';

import { authClient, signIn } from '@/core/auth/client';
import { defaultLocale } from '@/config/locale';
import { Button } from '@/shared/components/ui/button';
import { useAppContext } from '@/shared/contexts/app';
import { cn } from '@/shared/lib/utils';
import { Button as ButtonType } from '@/shared/types/blocks/common';

export function SocialProviders({
  configs,
  callbackUrl,
  loading,
  setLoading,
}: {
  configs: Record<string, string>;
  callbackUrl: string;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}) {
  const t = useTranslations('common.sign');
  const locale = useLocale();

  const { setIsShowSignModal } = useAppContext();
  const popupRef = useRef<Window | null>(null);
  const popupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const signInPendingRef = useRef(false);
  const checkingSessionRef = useRef(false);
  const completedRef = useRef(false);

  if (callbackUrl) {
    if (
      locale !== defaultLocale &&
      callbackUrl.startsWith('/') &&
      !callbackUrl.startsWith(`/${locale}`)
    ) {
      callbackUrl = `/${locale}${callbackUrl}`;
    }
  }

  const cleanupPopup = useCallback(() => {
    if (popupTimerRef.current) {
      clearInterval(popupTimerRef.current);
      popupTimerRef.current = null;
    }
    popupRef.current = null;
  }, []);

  const handleAuthCallback = useCallback(() => {
    if (completedRef.current || !signInPendingRef.current) return;
    completedRef.current = true;
    signInPendingRef.current = false;
    cleanupPopup();
    setIsShowSignModal(false);
    // Hard reload the page so the browser picks up the new session cookie
    window.location.reload();
  }, [cleanupPopup, setIsShowSignModal]);

  const checkSession = useCallback(async () => {
    if (!signInPendingRef.current || checkingSessionRef.current) return;
    checkingSessionRef.current = true;
    try {
      const result = await authClient.getSession({
        query: { disableCookieCache: true },
        fetchOptions: { cache: 'no-store' },
      });
      if (result.data?.user?.id && signInPendingRef.current) {
        handleAuthCallback();
      }
    } catch {
      // A transient check failure is not an OAuth failure; a later signal or
      // bounded poll can confirm the session without restarting Google login.
    } finally {
      checkingSessionRef.current = false;
    }
  }, [handleAuthCallback]);

  // The storage signal is only an optimization. COOP/browser storage policy
  // can lose it, so also verify the cookie-backed session on return/focus.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'auth-callback-success' && event.newValue) {
        void checkSession();
      }
    };
    const onFocus = () => void checkSession();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void checkSession();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      signInPendingRef.current = false;
      cleanupPopup();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [checkSession, cleanupPopup]);

  const handleSignIn = async ({ provider }: { provider: string }) => {
    cleanupPopup();
    completedRef.current = false;
    signInPendingRef.current = true;
    setLoading(true);

    // Open popup to the intermediate page that triggers signIn.social()
    const popupPath =
      locale !== defaultLocale
        ? `/${locale}/auth-popup?provider=${provider}`
        : `/auth-popup?provider=${provider}`;
    const popupUrl = `${window.location.origin}${popupPath}`;

    // Open centered popup window
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      popupUrl,
      'oauth-popup',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
    );

    if (!popup) {
      signInPendingRef.current = false;
      // Popup blocked - fall back to redirect
      toast.error('Popup blocked. Trying redirect...');
      setLoading(false);
      await signIn.social(
        { provider, callbackURL: callbackUrl },
        {
          onRequest: () => setLoading(true),
          onSuccess: () => setIsShowSignModal(false),
          onError: (e: any) => {
            toast.error(e?.error?.message || 'Sign in failed');
            setLoading(false);
          },
        }
      );
      return;
    }

    popupRef.current = popup;

    // Window.closed is unreliable after a cross-origin COOP navigation. Do
    // not stop session synchronization merely because it reports true.
    const deadline = Date.now() + 120_000;
    popupTimerRef.current = setInterval(() => {
      void checkSession();
      try {
        if (popup.closed) setLoading(false);
      } catch {
        // Keep checking the same-origin session even if COOP hides the popup.
      }
      if (Date.now() >= deadline) {
        cleanupPopup();
        setLoading(false);
        // A late focus/storage signal may still confirm a slow Google flow.
      }
    }, 2000);
  };

  const providers: ButtonType[] = [];

  if (configs.google_auth_enabled === 'true') {
    providers.push({
      name: 'google',
      title: t('google_sign_in_title'),
      icon: <RiGoogleFill />,
      onClick: () => handleSignIn({ provider: 'google' }),
    });
  }

  if (configs.github_auth_enabled === 'true') {
    providers.push({
      name: 'github',
      title: t('github_sign_in_title'),
      icon: <RiGithubFill />,
      onClick: () => handleSignIn({ provider: 'github' }),
    });
  }

  return (
    <div
      className={cn(
        'flex w-full items-center gap-2',
        'flex-col justify-between'
      )}
    >
      {providers.map((provider) => (
        <Button
          key={provider.name}
          type="button"
          variant="outline"
          className={cn('w-full gap-2')}
          disabled={loading}
          onClick={provider.onClick}
        >
          {provider.icon}
          <h3>{provider.title}</h3>
        </Button>
      ))}
    </div>
  );
}
