import { betterAuth, BetterAuthOptions } from 'better-auth';

import { getAllConfigs } from '@/shared/models/config';

import { getAuthOptions } from './config';

let authInstance: ReturnType<typeof betterAuth> | null = null;
let authInitializationPromise: Promise<ReturnType<typeof betterAuth>> | null = null;

// get auth instance in server side
export async function getAuth() {
  if (authInstance) {
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

      authInstance = instance;
      return instance;
    } catch (error) {
      authInitializationPromise = null;
      throw error;
    }
  })();

  return authInitializationPromise;
}
