import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { envConfigs } from '@/config';
import { isCloudflareWorker } from '@/shared/lib/env';

// Global database connection instance (singleton pattern)
let dbInstance: ReturnType<typeof drizzle> | null = null;
let client: ReturnType<typeof postgres> | null = null;

/**
 * One connection per *request*, reused by every query in that request.
 *
 * `getCloudflareContext()` returns the object OpenNext stores in an
 * AsyncLocalStorage and re-creates for every request
 * (`runWithCloudflareRequestContext` builds a fresh `{ env, ctx, cf }`), so
 * it is a safe cache key: entries can never leak into another request and
 * never outlive the socket Cloudflare tears down at the end of this one.
 *
 * Before this cache existed each `db()` call opened its own client, so a
 * single page render or generate request opened 5-8 TCP connections to
 * Hyperdrive — every one of them another chance to hit a transient failure.
 */
const requestConnections = new WeakMap<
  object,
  { client: ReturnType<typeof postgres>; db: ReturnType<typeof drizzle> }
>();

/** The per-request context object, or null when there is no request scope. */
function currentRequestKey(): object | null {
  try {
    return (getCloudflareContext() as unknown as object) ?? null;
  } catch {
    return null;
  }
}

/**
 * Drop the cached connection for the current request so the next `db()` call
 * opens a fresh one. Used before retrying a query that failed because the
 * connection went away — retrying on the same dead socket cannot succeed.
 */
export function invalidatePostgresConnection() {
  const key = currentRequestKey();
  if (key) requestConnections.delete(key);
}

/**
 * Resolve the connection string, preferring the request-bound Hyperdrive
 * binding when the Worker exposes one. Exported so transactional helpers can
 * open their own short-lived client with the exact same settings.
 */
export function resolvePostgresConnection(): {
  databaseUrl: string;
  isHyperdrive: boolean;
  connectionSchemaOptions: Record<string, unknown>;
} {
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

  return { databaseUrl, isHyperdrive, connectionSchemaOptions };
}

/**
 * A dedicated client for a single unit of work. Callers own it and must
 * close it (`client.end()`); `runInPostgresTransaction` does that for them.
 *
 * Settings mirror the per-request branch of `getPostgresDb`: one connection,
 * short timeouts, no prepared statements (Hyperdrive does not support them).
 */
export function createPostgresClient() {
  const { databaseUrl, isHyperdrive, connectionSchemaOptions } =
    resolvePostgresConnection();

  return postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ...connectionSchemaOptions,
    ...(isHyperdrive || process.env.NODE_ENV === 'production'
      ? { no_prepare: true }
      : {}),
  });
}

export function getPostgresDb() {
  const { databaseUrl, isHyperdrive, connectionSchemaOptions } =
    resolvePostgresConnection();

  // Cloudflare Workers + Hyperdrive:
  //   Why a fresh client per request: postgres.js wraps a TCP socket
  //   that Cloudflare closes at the end of each request. A module-level
  //   singleton therefore hands subsequent requests a client whose
  //   underlying socket is dead — the next query hangs until the
  //   runtime cancels the request.
  //
  //   That said the socket lives for the whole request, so everything in
  //   one request shares a single client (`requestConnections`). The old
  //   code opened a new client per `db()` call, which meant one request
  //   could burn 5-8 connections — and each new connection is another
  //   chance to hit the transient "Failed query" failures we keep seeing.
  //   `idle_timeout` releases the socket once the request goes quiet;
  //   `invalidatePostgresConnection()` drops it earlier when a retry needs
  //   a clean one.
  if (isHyperdrive || process.env.NODE_ENV === 'production') {
    const requestKey = currentRequestKey();
    const cached = requestKey ? requestConnections.get(requestKey) : undefined;
    if (cached) return cached.db;

    const pgClient = postgres(databaseUrl, {
      prepare: false,
      max: 1,
      idle_timeout: 20,
      // Hyperdrive is fronted by the Supabase pooler; a cold pool can take
      // longer than the original 5s to hand back a connection, and every
      // timeout surfaced as a failed request.
      connect_timeout: 10,
      ...connectionSchemaOptions,
      no_prepare: true,
    });
    const instance = drizzle(pgClient);
    if (requestKey) {
      requestConnections.set(requestKey, { client: pgClient, db: instance });
    }
    return instance;
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
