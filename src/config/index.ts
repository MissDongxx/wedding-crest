import packageJson from '../../package.json';

export const WEDDING_DB_SCHEMA = 'wedding-crest';

// Canonical production domain. Single source of truth for canonical /
// hreflang / Open Graph / Twitter / JSON-LD / sitemap / robots URLs so a
// build can never leak a development host (e.g. localhost) into SEO output.
export const PRODUCTION_APP_URL = 'https://weddingcrestdesign.com';
const DEFAULT_APP_URL = PRODUCTION_APP_URL;

const databaseProvider = process.env.DATABASE_PROVIDER ?? 'postgresql';

// Note: Environment variables are loaded via dotenv-cli in package.json scripts.
// Next.js automatically loads .env files in the runtime, so no manual loading is needed here.

export type ConfigMap = Record<string, string>;

/**
 * Resolve the public site URL.
 *
 * `.env.local` sets `NEXT_PUBLIC_APP_URL=http://localhost:3000` so local
 * auth redirects / payment callbacks work during development. Because
 * `NEXT_PUBLIC_*` values are inlined at build time, that value must never
 * leak into a production build's canonical / hreflang / Open Graph /
 * JSON-LD output. In production we always resolve to the real domain,
 * only honouring an explicit non-localhost override (e.g. a future custom
 * domain).
 */
function resolveAppUrl(raw?: string): string {
  const value = raw?.trim();
  if (!value) return DEFAULT_APP_URL;
  const isDevHost = /localhost|127\.0\.0\.1/i.test(value);
  if (process.env.NODE_ENV === 'production' && isDevHost) {
    return DEFAULT_APP_URL;
  }
  return value;
}

export const envConfigs: ConfigMap = {
  app_url: resolveAppUrl(process.env.NEXT_PUBLIC_APP_URL),
  app_name: process.env.NEXT_PUBLIC_APP_NAME ?? 'Wedding Crest Design',
  app_description: process.env.NEXT_PUBLIC_APP_DESCRIPTION ?? '',
  // The logo is managed in Admin > General. An empty default prevents the
  // template asset from resurfacing when the Admin value is absent.
  app_logo: process.env.NEXT_PUBLIC_APP_LOGO ?? '',
  app_favicon: process.env.NEXT_PUBLIC_APP_FAVICON ?? '/favicon.webp',
  app_preview_image:
    process.env.NEXT_PUBLIC_APP_PREVIEW_IMAGE ?? '/preview.webp',
  theme: process.env.NEXT_PUBLIC_THEME ?? 'default',
  appearance: process.env.NEXT_PUBLIC_APPEARANCE ?? 'system',
  locale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? 'en',
  database_url: process.env.DATABASE_URL ?? '',
  database_auth_token: process.env.DATABASE_AUTH_TOKEN ?? '',
  database_provider: databaseProvider,
  db_schema_file:
    process.env.DB_SCHEMA_FILE ??
    (databaseProvider === 'postgresql'
      ? './src/config/db/schema.postgres.ts'
      : './src/config/db/schema.ts'),
  // Wedding Crest Studio is isolated to this PostgreSQL schema.
  db_schema: WEDDING_DB_SCHEMA,
  // Drizzle migrations journal table name (avoid conflicts across projects)
  db_migrations_table:
    process.env.DB_MIGRATIONS_TABLE ?? '__drizzle_migrations',
  // Keep the migration journal inside the same isolated schema.
  db_migrations_schema: WEDDING_DB_SCHEMA,
  // Output folder for drizzle-kit generated migrations
  db_migrations_out:
    process.env.DB_MIGRATIONS_OUT ?? './src/config/db/migrations',
  db_singleton_enabled: process.env.DB_SINGLETON_ENABLED || 'false',
  db_max_connections: process.env.DB_MAX_CONNECTIONS || '1',
  auth_url: resolveAppUrl(process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL),
  auth_secret: process.env.AUTH_SECRET ?? '', // openssl rand -base64 32
  version: packageJson.version,
  locale_detect_enabled:
    process.env.NEXT_PUBLIC_LOCALE_DETECT_ENABLED ?? 'false',
};
