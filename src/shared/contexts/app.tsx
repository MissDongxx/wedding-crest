'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getAuthClient } from '@/core/auth/client';
import { isOneTapOriginAllowed } from '@/core/auth/one-tap';
import { envConfigs } from '@/config';
import { User } from '@/shared/models/user';

export interface ContextValue {
  user: User | null;
  setUser: (user: User | null) => void;
  isCheckSign: boolean;
  setIsCheckSign: (isCheckSign: boolean) => void;
  signInCallbackUrl: string | undefined;
  setSignInCallbackUrl: (url: string | undefined) => void;
  isShowSignModal: boolean;
  setIsShowSignModal: (show: boolean) => void;
  isShowPaymentModal: boolean;
  setIsShowPaymentModal: (show: boolean) => void;
  configs: Record<string, string>;
  fetchConfigs: () => Promise<void>;
  fetchUserCredits: () => Promise<void>;
  fetchUserInfo: () => Promise<void>;
  showOneTap: (configs: Record<string, string>) => Promise<void>;
}

const AppContext = createContext({} as ContextValue);

export const useAppContext = () => useContext(AppContext);

export const AppContextProvider = ({ children }: { children: ReactNode }) => {
  const [configs, setConfigs] = useState<Record<string, string>>({});

  // sign user
  const [user, setUser] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);
  const oneTapAttemptedRef = useRef(false);

  // is check sign (true during SSR and initial render to avoid hydration mismatch when auth is enabled)
  const [isCheckSign, setIsCheckSign] = useState(!!envConfigs.auth_secret);

  // show sign modal
  const [isShowSignModal, setIsShowSignModalState] = useState(false);
  const [signInCallbackUrl, setSignInCallbackUrl] = useState<string>();
  const setIsShowSignModal = useCallback((show: boolean) => {
    setIsShowSignModalState(show);
    // Clear flow-specific routing on every close, including form success.
    if (!show) setSignInCallbackUrl(undefined);
  }, []);

  // show payment modal
  const [isShowPaymentModal, setIsShowPaymentModal] = useState(false);

  const fetchConfigs = useCallback(async () => {
    try {
      const resp = await fetch('/api/config/get-configs', {
        method: 'POST',
      });
      if (!resp.ok) {
        throw new Error(`fetch failed with status: ${resp.status}`);
      }
      const { code, message, data } = await resp.json();
      if (code !== 0) {
        throw new Error(message);
      }

      setConfigs(data);
    } catch {}
  }, []);

  const fetchUserCredits = useCallback(async () => {
    try {
      if (!userRef.current) {
        return;
      }

      const resp = await fetch('/api/user/get-user-credits', {
        method: 'POST',
      });
      if (!resp.ok) {
        throw new Error(`fetch failed with status: ${resp.status}`);
      }
      const { code, message, data } = await resp.json();
      if (code !== 0) {
        throw new Error(message);
      }

      setUser((prev) => (prev ? { ...prev, credits: data } : prev));
    } catch {}
  }, []);

  const fetchUserInfo = useCallback(async () => {
    try {
      const resp = await fetch('/api/user/get-user-info', {
        method: 'POST',
      });
      if (!resp.ok) {
        throw new Error(`fetch failed with status: ${resp.status}`);
      }
      const { code, message, data } = await resp.json();
      if (code !== 0) {
        throw new Error(message);
      }

      setUser(data);
    } catch {}
  }, []);

  const showOneTap = useCallback(async (configs: Record<string, string>) => {
    if (
      typeof window === 'undefined' ||
      !configs.google_client_id ||
      configs.google_one_tap_enabled !== 'true' ||
      !isOneTapOriginAllowed(window.location.origin, envConfigs.app_url) ||
      userRef.current ||
      oneTapAttemptedRef.current
    ) {
      return;
    }
    // Header and sidebar may both request the prompt. Share one attempt for
    // this provider lifetime, including failed/cancelled requests and routes.
    oneTapAttemptedRef.current = true;
    try {
      const authClient = getAuthClient(configs);
      await authClient.oneTap({
        callbackURL: '/',
        autoSelect: false,
        cancelOnTapOutside: true,
        onPromptNotification: (notification: any) => {
          // Handle prompt dismissal silently
          // This callback is triggered when the prompt is dismissed or skipped
        },
        // fetchOptions: {
        //   onSuccess: () => {
        //     router.push('/');
        //   },
        // },
      });
    } catch (error) {
      // Silently handle One Tap cancellation errors
      // These errors occur when users close the prompt or decline to sign in
      // Common errors: FedCM NetworkError, AbortError, etc.
    }
  }, []);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      setUser,
      isCheckSign,
      setIsCheckSign,
      signInCallbackUrl,
      setSignInCallbackUrl,
      isShowSignModal,
      setIsShowSignModal,
      isShowPaymentModal,
      setIsShowPaymentModal,
      configs,
      fetchConfigs,
      fetchUserCredits,
      fetchUserInfo,
      showOneTap,
    }),
    [
      user,
      isCheckSign,
      signInCallbackUrl,
      setSignInCallbackUrl,
      isShowSignModal,
      setIsShowSignModal,
      isShowPaymentModal,
      configs,
      fetchConfigs,
      fetchUserCredits,
      fetchUserInfo,
      showOneTap,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
