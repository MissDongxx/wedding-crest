import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';

import { db } from '@/core/db';
import { routing } from '@/core/i18n/config';
import { envConfigs } from '@/config';
import { config } from '@/config/db/schema';
import { isCloudflareWorker } from '@/shared/lib/env';
import {
  getAllSettingNames,
  publicSettingNames,
} from '@/shared/services/settings';

export type Config = typeof config.$inferSelect;
export type NewConfig = typeof config.$inferInsert;
export type UpdateConfig = Partial<Omit<NewConfig, 'name'>>;

export type Configs = Record<string, string>;

export const CACHE_TAG_CONFIGS = 'configs';

// Revalidate the marketing site so admin uploads (logo, name, description,
// etc.) become visible without waiting for the 1-hour ISR window. Only
// called when a public-facing key was actually changed — internal config
// edits don't need to bust the public page cache.
function revalidatePublicSiteForChangedConfigs(
  configs: Record<string, string>
) {
  const touchedPublicKey = Object.keys(configs).some((key) =>
    publicSettingNames.includes(key)
  );
  if (!touchedPublicKey) return;

  // Invalidate every locale-prefixed page that consumes publicConfigs.
  // The public marketing pages have `revalidate = 3600`, so without this
  // an admin logo change would not appear on the live site for up to an
  // hour. Using `layout` scope covers the header/footer shared chrome
  // where the brand logo is rendered.
  for (const locale of routing.locales) {
    revalidatePath(`/${locale}`, 'layout');
  }
  revalidatePath('/', 'layout');
}

export async function saveConfigs(configs: Record<string, string>) {
  const database = db();
  const configEntries = Object.entries(configs);

  // D1: use batch() to send all upserts in a single round-trip
  if (envConfigs.database_provider === 'd1') {
    const queries = configEntries.map(([name, configValue]) =>
      database
        .insert(config)
        .values({ name, value: configValue })
        .onConflictDoUpdate({
          target: config.name,
          set: { value: configValue },
        })
        .returning()
    );

    const batchResults =
      queries.length > 0 ? await database.batch(queries) : [];
    revalidateTag(CACHE_TAG_CONFIGS);
    revalidatePublicSiteForChangedConfigs(configs);
    return batchResults.flat();
  }

  // Other databases: use transaction for atomicity
  const result = await database.transaction(async (tx: any) => {
    const results: any[] = [];

    for (const [name, configValue] of configEntries) {
      const [upsertResult] = await tx
        .insert(config)
        .values({ name, value: configValue })
        .onConflictDoUpdate({
          target: config.name,
          set: { value: configValue },
        })
        .returning();

      results.push(upsertResult);
    }

    return results;
  });

  revalidateTag(CACHE_TAG_CONFIGS);
  invalidateConfigsCache();
  revalidatePublicSiteForChangedConfigs(configs);

  return result;
}

export async function addConfig(newConfig: NewConfig) {
  const [result] = await db().insert(config).values(newConfig).returning();
  revalidateTag(CACHE_TAG_CONFIGS);
  invalidateConfigsCache();
  revalidatePublicSiteForChangedConfigs({ [newConfig.name]: newConfig.value ?? '' });

  return result;
}

// Invalidate the in-memory cache so the next getAllConfigs() call re-reads
// from the database. Called from saveConfigs() and any other code path that
// mutates the config table.
export function invalidateConfigsCache() {
  cachedAllConfigs = null;
  // Also clear any module-level AI service cache so a freshly-saved key
  // (e.g. runware_api_key) takes effect on the very next request.
  // The import is lazy to avoid a circular dep at module load.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { invalidateAIService } = require('@/shared/services/ai');
    invalidateAIService();
  } catch {
    /* ai service not available in this context; safe to ignore */
  }
}

async function getConfigsFromDb(): Promise<Configs> {
  const configs: Record<string, string> = {};

  // D1 is only available inside Cloudflare Workers runtime (not during build)
  if (envConfigs.database_provider === 'd1' && !isCloudflareWorker) {
    return configs;
  }
  if (!envConfigs.database_url && envConfigs.database_provider !== 'd1') {
    return configs;
  }

  const result = await db().select().from(config);
  if (!result) {
    return configs;
  }

  for (const config of result) {
    configs[config.name] = config.value ?? '';
  }

  return configs;
}

// Cloudflare Workers doesn't fully support Next.js unstable_cache and it can
// cause requests to hang indefinitely. Since getAllConfigs() already has an
// in-memory cache with 1-minute TTL, we skip unstable_cache on Workers.
export const getConfigs = isCloudflareWorker
  ? getConfigsFromDb
  : unstable_cache(getConfigsFromDb, ['configs'], {
      revalidate: 3600,
      tags: [CACHE_TAG_CONFIGS],
    });

// In-memory cache for configurations to avoid repeated unstable_cache/DB overHead.
// 5 minutes is safe because:
//  - every admin write goes through `invalidateConfigsCache()` which clears
//    `cachedAllConfigs` immediately, AND
//  - `unstable_cache` (the underlying cache used off-Workers) is revalidated
//    by `CACHE_TAG_CONFIGS`.
// So a saved config value still propagates on the next request. A 1-minute
// TTL was hammering the config table on every anonymous page load on
// Cloudflare Workers (no `unstable_cache` support there).
let cachedAllConfigs: { data: Configs; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getAllConfigs(): Promise<Configs> {
  const now = Date.now();
  if (cachedAllConfigs && now - cachedAllConfigs.timestamp < CACHE_TTL_MS) {
    return cachedAllConfigs.data;
  }

  let dbConfigs: Configs = {};

  // only get configs from db in server side
  const hasDb =
    envConfigs.database_url ||
    (envConfigs.database_provider === 'd1' && isCloudflareWorker);
  if (typeof window === 'undefined' && hasDb) {
    try {
      dbConfigs = await getConfigs();
    } catch {
      dbConfigs = {};
    }
  }

  const settingNames = await getAllSettingNames();
  settingNames.forEach((key) => {
    const upperKey = key.toUpperCase();
    // use env configs if available
    if (process.env[upperKey]) {
      dbConfigs[key] = process.env[upperKey] ?? '';
    } else if (process.env[key]) {
      dbConfigs[key] = process.env[key] ?? '';
    }
  });

  // Explicitly pick up Workers secrets that are not in settingNames.
  // envConfigs captures these at module-load time; on Cloudflare Workers,
  // process.env may be populated later by @opennextjs/cloudflare.
  if (!dbConfigs.auth_secret && process.env.AUTH_SECRET) {
    dbConfigs.auth_secret = process.env.AUTH_SECRET;
  }
  if (!dbConfigs.database_url && process.env.DATABASE_URL) {
    dbConfigs.database_url = process.env.DATABASE_URL;
  }

  const configs = {
    ...envConfigs,
    ...dbConfigs,
  };

  // A stale admin value must not publish localhost or the former product
  // domain into canonical URLs, Open Graph metadata, or auth redirects.
  if (
    process.env.NODE_ENV === 'production' &&
    (!configs.app_url ||
      configs.app_url.includes('localhost') ||
      configs.app_url.includes('removegeminiwatermark.org'))
  ) {
    configs.app_url = envConfigs.app_url;
  }

  // Update in-memory cache
  cachedAllConfigs = {
    data: configs,
    timestamp: Date.now(),
  };

  return configs;
}

export async function getPublicConfigs(): Promise<Configs> {
  let allConfigs = await getAllConfigs();

  const publicConfigs: Record<string, string> = {};

  // get public configs
  for (const key in allConfigs) {
    if (publicSettingNames.includes(key)) {
      publicConfigs[key] = String(allConfigs[key]);
    }
  }

  const configs = {
    ...publicConfigs,
  };

  return configs;
}
