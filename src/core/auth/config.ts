import { BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { oneTap } from 'better-auth/plugins';
import { getLocale } from 'next-intl/server';

import { db } from '@/core/db';
import { envConfigs } from '@/config';
import * as schema from '@/config/db/schema';
import { VerifyEmail } from '@/shared/blocks/email/verify-email';
import {
  getCookieFromCtx,
  getHeaderValue,
  guessLocaleFromAcceptLanguage,
} from '@/shared/lib/cookie';
import { isCloudflareWorker } from '@/shared/lib/env';
import { getNonceStr, getUuid } from '@/shared/lib/hash';
import { getClientIp } from '@/shared/lib/ip';
import { ApikeyStatus, createApikey } from '@/shared/models/apikey';
import { grantCreditsForNewUser } from '@/shared/models/credit';
import { getEmailService } from '@/shared/services/email';
import { grantRoleForNewUser } from '@/shared/services/rbac';

// Best-effort dedupe to prevent sending verification emails too frequently.
// This is especially helpful in dev/hot reload, transient network conditions,
// and to add a server-side throttle beyond any client-side cooldown.
const recentVerificationEmailSentAt = new Map<string, number>();
const VERIFICATION_EMAIL_MIN_INTERVAL_MS = 60_000;
// Temporary switch for the admin login flow. Set back to false to restore
// the configured email-verification behavior.
const TEMPORARILY_DISABLE_EMAIL_VERIFICATION = true;

// Static auth options - NO database connection
// This ensures zero database calls during build time
const authOptions = {
  appName: envConfigs.app_name,
  baseURL: envConfigs.auth_url,
  secret: envConfigs.auth_secret,
  trustedOrigins: envConfigs.app_url ? [envConfigs.app_url] : [],
  user: {
    // Allow persisting custom columns on user table.
    // Without this, better-auth may ignore extra properties during create/update.
    additionalFields: {
      utmSource: {
        type: 'string',
        // Not user-editable input; we set it internally.
        input: false,
        required: false,
        defaultValue: '',
      },
      ip: {
        type: 'string',
        input: false,
        required: false,
        defaultValue: '',
      },
      locale: {
        type: 'string',
        input: false,
        required: false,
        defaultValue: '',
      },
    },
  },
  advanced: {
    database: {
      generateId: () => getUuid(),
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  logger: {
    verboseLogging: true,
    // Disable all logs during production
    disabled: process.env.NODE_ENV === 'production',
  },
};

// get auth options with configs
export async function getAuthOptions(
  configs: Record<string, string>,
  request?: Request,
  database?: any
) {
  const emailVerificationEnabled =
    !TEMPORARILY_DISABLE_EMAIL_VERIFICATION &&
    configs.email_verification_enabled === 'true' &&
    !!(configs.resend_api_key || configs.brevo_api_key);

  // Use runtime configs to override static authOptions.
  // envConfigs is evaluated at module load time; on Cloudflare Workers,
  // process.env secrets may not be available then but are accessible
  // at runtime through getAllConfigs().
  const runtimeSecret =
    configs.auth_secret || configs.AUTH_SECRET || envConfigs.auth_secret;

  let runtimeBaseURL =
    configs.auth_url ||
    configs.AUTH_URL ||
    configs.app_url ||
    configs.NEXT_PUBLIC_APP_URL;

  // If no explicit config, try to infer from the current request
  if (!runtimeBaseURL && request) {
    try {
      const url = new URL(request.url);
      runtimeBaseURL = url.origin;
    } catch {
      // ignore
    }
  }

  // Fallback to static env config
  runtimeBaseURL = runtimeBaseURL || envConfigs.auth_url || envConfigs.app_url;

  // Final safeguard: Never allow localhost in production if we have any other hint.
  if (
    process.env.NODE_ENV === 'production' &&
    runtimeBaseURL?.includes('localhost')
  ) {
    // If we're on Cloudflare but getting localhost, it means the default envConfig was used.
    // We should fallback to the known production domain as a last resort.
    runtimeBaseURL = 'https://weddingcrestdesign.com';
  }

  if (process.env.NODE_ENV !== 'production' || configs.debug === 'true') {
    console.log('[auth] Initialization with baseURL:', runtimeBaseURL);
  }

  return {
    ...authOptions,
    baseURL: runtimeBaseURL,
    trustedOrigins: runtimeBaseURL ? [runtimeBaseURL] : [],
    ...(runtimeSecret ? { secret: runtimeSecret } : {}),
    // Add database connection only when actually needed (runtime)
    // D1 is only available inside Cloudflare Workers runtime (not during build)
    database:
      database ||
      (envConfigs.database_url ||
      (envConfigs.database_provider === 'd1' && isCloudflareWorker)
        ? drizzleAdapter(db(), {
            provider: getDatabaseProvider(envConfigs.database_provider),
            schema: schema,
          })
        : null),
    databaseHooks: {
      user: {
        create: {
          before: async (user: any, ctx: any) => {
            try {
              const ip = await getClientIp();
              if (ip) {
                user.ip = ip;
              }

              // Prefer NEXT_LOCALE cookie (next-intl). Fallback to accept-language.
              const localeFromCookie = getCookieFromCtx(ctx, 'NEXT_LOCALE');

              const localeFromHeader = guessLocaleFromAcceptLanguage(
                getHeaderValue(ctx, 'accept-language')
              );

              const locale =
                (localeFromCookie || localeFromHeader || (await getLocale())) ??
                '';

              if (locale && typeof locale === 'string') {
                user.locale = locale.slice(0, 20);
              }

              // Only set on first creation; never overwrite later.
              if (user?.utmSource) return user;

              const raw = getCookieFromCtx(ctx, 'utm_source');
              if (!raw || typeof raw !== 'string') return user;

              // Keep it small & safe.
              const decoded = decodeURIComponent(raw).trim();
              const sanitized = decoded
                .replace(/[^\w\-.:]/g, '') // allow a-zA-Z0-9_ - . :
                .slice(0, 100);

              if (sanitized) {
                user.utmSource = sanitized;
              }
            } catch {
              // best-effort only
            }
            return user;
          },
          after: async (user: any) => {
            try {
              if (!user.id) {
                throw new Error('user id is required');
              }

              // grant credits for new user
              await grantCreditsForNewUser(user);

              // grant role for new user
              await grantRoleForNewUser(user);

              // auto-generate api key for new user
              await createApikey({
                id: getUuid(),
                userId: user.id,
                title: 'Default API Key',
                key: `sk-${getNonceStr(32)}`,
                status: ApikeyStatus.ACTIVE,
              });
            } catch {
              // grant credits/role/apikey failed, non-critical
            }
          },
        },
      },
    },
    emailAndPassword: {
      enabled: configs.email_auth_enabled !== 'false',
      requireEmailVerification: emailVerificationEnabled,
      // Avoid creating a session immediately after sign up when verification is required.
      autoSignIn: emailVerificationEnabled ? false : true,
    },
    ...(emailVerificationEnabled
      ? {
          emailVerification: {
            sendOnSignUp: true,
            sendOnSignIn: false,
            // After user clicks the verification link, create session automatically.
            autoSignInAfterVerification: true,
            // 24 hours
            expiresIn: 60 * 60 * 24,
            sendVerificationEmail: async (
              { user, url }: { user: any; url: string; token: string },
              _request: Request
            ) => {
              try {
                const key = String(user?.email || '').toLowerCase();
                const now = Date.now();
                const last = recentVerificationEmailSentAt.get(key) || 0;
                if (key && now - last < VERIFICATION_EMAIL_MIN_INTERVAL_MS) {
                  return;
                }
                if (key) {
                  recentVerificationEmailSentAt.set(key, now);
                }

                const emailService = await getEmailService(configs as any);
                const logoUrl = envConfigs.app_logo
                  ? envConfigs.app_logo.startsWith('http')
                    ? envConfigs.app_logo
                    : `${runtimeBaseURL || envConfigs.app_url}${envConfigs.app_logo.startsWith('/') ? '' : '/'}${envConfigs.app_logo}`
                  : undefined;
                const result = await emailService.sendEmail({
                  to: user.email,
                  subject: `Verify your email - ${envConfigs.app_name}`,
                  react: VerifyEmail({
                    appName: envConfigs.app_name,
                    logoUrl,
                    url,
                  }),
                });

                if (!result.success) {
                  console.error(
                    '[sendVerificationEmail] provider failed to send email:',
                    result.error,
                    'provider:',
                    result.provider
                  );
                } else {
                  console.log(
                    '[sendVerificationEmail] email sent successfully to:',
                    user.email,
                    'messageId:',
                    result.messageId
                  );
                }
              } catch (err) {
                console.error('[sendVerificationEmail] crashed:', err);
              }
            },
          },
        }
      : {}),
    socialProviders: await getSocialProviders(configs),
    plugins:
      configs.google_client_id && configs.google_one_tap_enabled === 'true'
        ? [oneTap()]
        : [],
  };
}

// get social providers with configs
export async function getSocialProviders(configs: Record<string, string>) {
  const providers: any = {};

  // google auth
  if (configs.google_client_id && configs.google_client_secret) {
    providers.google = {
      clientId: configs.google_client_id,
      clientSecret: configs.google_client_secret,
    };
  }

  // github auth
  if (configs.github_client_id && configs.github_client_secret) {
    providers.github = {
      clientId: configs.github_client_id,
      clientSecret: configs.github_client_secret,
    };
  }

  return providers;
}

// convert database provider to better-auth database provider
export function getDatabaseProvider(
  provider: string
): 'sqlite' | 'pg' | 'mysql' {
  switch (provider) {
    case 'sqlite':
      return 'sqlite';
    case 'turso':
      return 'sqlite';
    case 'd1':
      return 'sqlite';
    case 'postgresql':
      return 'pg';
    case 'mysql':
      return 'mysql';
    default:
      throw new Error(
        `Unsupported database provider for auth: ${envConfigs.database_provider}`
      );
  }
}
