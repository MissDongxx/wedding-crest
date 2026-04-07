/**
 * Client-side gating logic for watermark processing.
 *
 * Provides permission checks and usage reporting via API.
 * Falls back to localStorage-based limiting for anonymous users
 * when the API is unavailable.
 */

export interface GatingStatus {
  allowed: boolean;
  mode: 'anonymous' | 'authenticated' | 'authenticated_free';
  remaining: number;
  plan: 'anonymous' | 'free' | 'pro';
  reason?: string;
}

const DAILY_FREE_LIMIT = 5;

// ============ localStorage helpers (anonymous fallback) ============

function getStorageKey(): string {
  return `wm_usage_${new Date().toISOString().slice(0, 10)}`;
}

function getLocalUsageCount(): number {
  try {
    return parseInt(localStorage.getItem(getStorageKey()) || '0', 10);
  } catch {
    return 0;
  }
}

function incrementLocalUsage(): void {
  try {
    localStorage.setItem(getStorageKey(), String(getLocalUsageCount() + 1));
  } catch {
    /* silent */
  }
}

function canProcessLocally(): boolean {
  return getLocalUsageCount() < DAILY_FREE_LIMIT;
}

// ============ API-based gating ============

export async function checkPermission(): Promise<GatingStatus> {
  try {
    const response = await fetch('/api/watermark/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      // API failed — fall back to local check
      return getLocalFallback();
    }

    const result = await response.json();
    if (result.code !== 0) {
      return getLocalFallback();
    }

    const data = result.data;

    // For anonymous users, also check localStorage for accurate remaining count
    if (data.mode === 'anonymous') {
      const localRemaining = DAILY_FREE_LIMIT - getLocalUsageCount();
      return {
        ...data,
        remaining: Math.max(0, localRemaining),
        allowed: localRemaining > 0,
      };
    }

    return data;
  } catch {
    // Network error — fall back to local check
    return getLocalFallback();
  }
}

function getLocalFallback(): GatingStatus {
  const remaining = DAILY_FREE_LIMIT - getLocalUsageCount();
  return {
    allowed: remaining > 0,
    mode: 'anonymous',
    remaining: Math.max(0, remaining),
    plan: 'anonymous',
  };
}

export async function reportUsage(
  imageCount: number,
  processingTimeMs: number
): Promise<void> {
  // Always increment local counter for display
  for (let i = 0; i < imageCount; i++) {
    incrementLocalUsage();
  }

  // Try to report to server for authenticated users
  try {
    await fetch('/api/watermark/report-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageCount,
        processingTimeMs,
      }),
    });
  } catch {
    // Silent fail — local tracking is sufficient
  }
}

export { getLocalUsageCount, DAILY_FREE_LIMIT };
