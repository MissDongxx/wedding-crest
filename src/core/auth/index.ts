import { betterAuth, BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { envConfigs } from '@/config';
import * as schema from '@/config/db/schema';
import { db } from '@/core/db';
import { getAllConfigs } from '@/shared/models/config';

import { getAuthOptions, getDatabaseProvider } from './config';

/**
 * Get auth instance.
 *
 * NOTE: On Cloudflare Workers, we avoid global caching to ensure 
 * D1 database connections are fresh.
 */
export const getAuth = async (request?: Request) => {
  const databaseResource = await db();
  const configs = await getAllConfigs();
  
  // Initialize adapter here to ensure it uses the shared databaseResource
  const adapter = drizzleAdapter(databaseResource, {
    provider: getDatabaseProvider(configs.database_provider || envConfigs.database_provider),
    schema: schema,
  });

  const options = await getAuthOptions(configs, request, adapter);

  return betterAuth(options as BetterAuthOptions);
};
