import { betterAuth, BetterAuthOptions } from 'better-auth';

import { getAllConfigs } from '@/shared/models/config';
import { isCloudflareWorker } from '@/shared/lib/env';

import { getAuthOptions } from './config';

let authInstance: ReturnType<typeof betterAuth> | null = null;
let authInitializationPromise: Promise<ReturnType<typeof betterAuth>> | null = null;

// get auth instance in server side
export async function getAuth() {
  // On Cloudflare Workers, globals persist across requests within the same
  // isolate, but the underlying TCP connections may be recycled by the
  // runtime. A cached authInstance holding a stale database connection will
  // cause queries to hang indefinitely. Skip the cache on Workers so each
  // request gets a fresh auth instance with a live connection.
  if (!isCloudflareWorker && authInstance) {
    return authInstance;
  }

  if (authInitializationPromise) {
    return authInitializationPromise;
  }

  authInitializationPromise = (async () => {
    try {
      const configs = await getAllConfigs();
      const authOptions = await getAuthOptions(configs);
      const instance = betterAuth(authOptions as BetterAuthOptions);

      if (!isCloudflareWorker) {
        authInstance = instance;
      }
      return instance;
    } catch (error) {
      authInitializationPromise = null;
      throw error;
    } finally {
      authInitializationPromise = null;
    }
  })();

  return authInitializationPromise;
}
