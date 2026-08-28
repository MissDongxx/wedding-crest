import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { envConfigs } from '@/config';
import { isCloudflareWorker } from '@/shared/lib/env';

// Global database connection instance (singleton pattern)
let dbInstance: ReturnType<typeof drizzle> | null = null;
let client: ReturnType<typeof postgres> | null = null;

export function getPostgresDb() {
  let databaseUrl = envConfigs.database_url;
  let isHyperdrive = false;

  const schemaName = (envConfigs.db_schema || 'public').trim();
  const connectionSchemaOptions =
    schemaName && schemaName !== 'public'
      ? { connection: { options: `-c search_path=${schemaName}` } }
      : {};

  // OpenNext versions do not all expose the same global Worker marker.
  // Prefer the request-bound Cloudflare context so Hyperdrive is still used
  // when `isCloudflareWorker` is false in a bundled server function.
  let cloudflareEnv: any;
  try {
    cloudflareEnv = (getCloudflareContext() as { env?: any }).env;
  } catch {
    cloudflareEnv = undefined;
  }

  if (cloudflareEnv && 'HYPERDRIVE' in cloudflareEnv) {
    isHyperdrive = true;
    databaseUrl = cloudflareEnv.HYPERDRIVE.connectionString;
  }

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  // Cloudflare Workers + Hyperdrive:
  //   Why a fresh client per request: postgres.js wraps a TCP socket
  //   that Cloudflare closes at the end of each request. A module-level
  //   singleton therefore hands subsequent requests a client whose
  //   underlying socket is dead — the next query hangs until the
  //   runtime cancels the request. Creating a new client per request
  //   is the pattern Cloudflare documents for Hyperdrive + Workers.
  //   We close the client via ctx.waitUntil() so the cleanup runs
  //   after the response is sent.
  if (isHyperdrive || process.env.NODE_ENV === 'production') {
    const pgClient = postgres(databaseUrl, {
      prepare: false,
      max: 1,
      idle_timeout: 5,
      connect_timeout: 5,
      ...connectionSchemaOptions,
      // Don't let postgres.js keep the connection alive past a single
      // request — we want it to release the socket back to the
      // runtime promptly.
      no_prepare: true,
    });
    return drizzle(pgClient);
  }

  // Cloudflare Workers without Hyperdrive: new connection per request
  if (isCloudflareWorker) {
    const cfClient = postgres(databaseUrl, {
      prepare: false,
      max: 1,
      idle_timeout: 5,
      connect_timeout: 5,
      ...connectionSchemaOptions,
    });

    return drizzle(cfClient);
  }

  // Non-Workers: singleton mode
  if (envConfigs.db_singleton_enabled === 'true') {
    if (dbInstance) {
      return dbInstance;
    }

    const maxConnections = Number(envConfigs.db_max_connections) || 10;
    const pgClient = postgres(databaseUrl, {
      prepare: false,
      max: maxConnections,
      idle_timeout: 30,
      connect_timeout: 10,
      ...connectionSchemaOptions,
    });

    client = pgClient;
    dbInstance = drizzle({ client: pgClient });
    return dbInstance;
  }

  // Non-singleton mode: new connection each time (serverless)
  const serverlessClient = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ...connectionSchemaOptions,
  });

  return drizzle({ client: serverlessClient });
}

// Close database connection (for graceful shutdown / testing)
export async function closePostgresDb() {
  if (client) {
    await client.end();
    client = null;
    dbInstance = null;
  }
}
