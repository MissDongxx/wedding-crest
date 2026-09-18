'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  isWeddingExampleStyle,
  type WeddingExamplePreview,
} from '@/shared/wedding/types';

type WeddingExamplesState = {
  status: 'loading' | 'ready' | 'error';
  examples: WeddingExamplePreview[];
};

const WeddingExamplesContext = createContext<WeddingExamplesState | null>(
  null
);

export function WeddingExamplesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WeddingExamplesState>({
    status: 'loading',
    examples: [],
  });

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/wedding/examples?surface=home', {
      signal: controller.signal,
      // 'no-cache' revalidates with the server on every load (304 keeps it
      // cheap). 'force-cache' here would serve stale examples indefinitely,
      // so admin edits never showed up without a hard reload.
      cache: 'no-cache',
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          code?: number;
          data?: { items?: unknown };
        } | null;

        if (!response.ok || payload?.code !== 0) {
          throw new Error('failed to load wedding examples');
        }

        const rows = Array.isArray(payload.data?.items)
          ? payload.data.items
          : [];
        const examples = rows.flatMap((row) => {
          if (!row || typeof row !== 'object') return [];
          const item = row as Partial<WeddingExamplePreview>;
          if (
            typeof item.id !== 'string' ||
            typeof item.name !== 'string' ||
            typeof item.style !== 'string' ||
            !isWeddingExampleStyle(item.style) ||
            typeof item.imageUrl !== 'string' ||
            !item.imageUrl
          ) {
            return [];
          }
          return [
            {
              id: item.id,
              name: item.name,
              style: item.style,
              imageUrl: item.imageUrl,
              altText: typeof item.altText === 'string' ? item.altText : null,
            },
          ];
        });

        setState({ status: 'ready', examples });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setState({ status: 'error', examples: [] });
      });

    return () => controller.abort();
  }, []);

  const value = useMemo(() => state, [state]);
  return (
    <WeddingExamplesContext.Provider value={value}>
      {children}
    </WeddingExamplesContext.Provider>
  );
}

export function useWeddingExamples() {
  const state = useContext(WeddingExamplesContext);
  if (!state) {
    throw new Error(
      'useWeddingExamples must be used inside WeddingExamplesProvider'
    );
  }
  return state;
}
