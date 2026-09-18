import { drizzle } from 'drizzle-orm/postgres-js';

import { envConfigs } from '@/config';

import { db } from './index';
import { createPostgresClient, invalidatePostgresConnection } from './postgres';

/**
 * Transactional helpers for multi-statement writes.
 *
 * Why this exists: every `db()` call in the Cloudflare/Hyperdrive runtime
 * opens its *own* postgres.js client (see `getPostgresDb`). A write that
 * spans several statements therefore opens several TCP connections, and if
 * one of them fails midway the earlier statements stay committed — which is
 * how projects ended up persisted with none of their element rows.
 *
 * `runInDbTransaction` runs every statement of a unit of work on one
 * connection inside one transaction, so it either all lands or none does.
 */

/** Anything Drizzle/postgres.js can execute queries through. */
export type DbExecutor = any;

/** SQLSTATEs that mean "the data was rejected" — retrying cannot help. */
const PERMANENT_SQLSTATE = new Set([
  '23505', // unique_violation
  '23503', // foreign_key_violation
  '23502', // not_null_violation
  '23514', // check_violation
  '22P02', // invalid_text_representation
  '22001', // string_data_right_truncation
  '42P01', // undefined_table
  '42703', // undefined_column
  '42701', // duplicate_column
  '28000', // invalid_authorization
  '28P01', // invalid_password
  '3D000', // invalid_catalog_name
]);

/** SQLSTATEs for connection loss, server restarts, or resource pressure. */
const TRANSIENT_SQLSTATE = new Set([
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '08007',
  '08P01', // connection_exception family
  '40001', // serialization_failure
  '40P01', // deadlock_detected
  '53300', // too_many_connections
  '53400', // configuration_limit_exceeded
  '55000',
  '55006',
  '57P01',
  '57P02',
  '57P03',
  '57P04',
  '57P05', // admin shutdown / crash recovery
  '55P03', // lock_not_available
]);

const TRANSIENT_NODE_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'EHOSTUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'UND_ERR_SOCKET',
  'CONNECT_TIMEOUT',
  'CONNECTION_CLOSED',
  'CONNECTION_DESTROYED',
]);

function underlyingCause(error: unknown): any {
  const anyError = error as any;
  return anyError?.cause ?? anyError?.originalError ?? anyError ?? {};
}

/**
 * Drizzle wraps driver failures as `Failed query: <sql>` and keeps the real
 * Postgres error in `cause`, so both layers have to be inspected — otherwise
 * a dropped connection looks identical to a constraint violation.
 */
export function isTransientDbError(error: unknown): boolean {
  const cause = underlyingCause(error);
  const code = String(cause?.code ?? (error as any)?.code ?? '')
    .trim()
    .toUpperCase();

  if (PERMANENT_SQLSTATE.has(code)) return false;
  if (TRANSIENT_SQLSTATE.has(code) || TRANSIENT_NODE_CODES.has(code))
    return true;

  const message = [
    (error as any)?.message,
    cause?.message,
    (error as any)?.name,
  ]
    .filter(Boolean)
    .join(' ');

  if (
    /duplicate key|violates|does not exist|syntax error|permission denied/i.test(
      message
    )
  )
    return false;
  return /failed query|connection|socket|timeout|timed out|closed|econn|eai_again|hyperdrive/i.test(
    message
  );
}

/** Log the driver-level reason, which Drizzle otherwise swallows. */
export function describeDbError(error: unknown): string {
  const cause = underlyingCause(error);
  return [
    (error as any)?.message,
    cause?.code ? `sqlstate=${cause.code}` : '',
    cause?.detail ?? '',
    cause?.constraint ? `constraint=${cause.constraint}` : '',
    cause?.hint ?? '',
  ]
    .filter(Boolean)
    .join(' | ');
}

/**
 * Run `operation`, retrying once when the failure looks transient (dropped
 * Hyperdrive connection, server restart, connection cap). Permanent errors
 * such as constraint violations propagate on the first attempt.
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  options: { attempts?: number; label?: string } = {}
): Promise<T> {
  const attempts = options.attempts ?? 2;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1 || !isTransientDbError(error)) break;
      // The failure was connection-level, so the per-request client may be
      // holding a dead socket. Drop it before retrying or the retry simply
      // replays the query on the same broken connection.
      invalidatePostgresConnection();
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }
  // Drizzle reports every driver failure as "Failed query: <sql>". Logging
  // the unwrapped SQLSTATE/detail here means any retried write leaves a
  // diagnosable trace instead of a bare "Failed query" in the logs.
  console.error(
    `[db] ${options.label ?? 'operation'} failed after ${attempts} attempts:`,
    describeDbError(lastError)
  );
  throw lastError;
}

/**
 * Run a read (or any single-statement write) with the same transient-failure
 * retry the transactional path gets.
 *
 * Reads are the more common victim of a flaky connection: `getWeddingProject`
 * alone used to open two clients, and a failure in either surfaced as a bare
 * "Failed query" that killed the whole request. Every query now shares the
 * per-request connection, and a dropped connection is retried once.
 */
export async function withDb<T>(
  work: (exec: DbExecutor) => Promise<T>,
  options: { label?: string; attempts?: number } = {}
): Promise<T> {
  return withDbRetry(() => work(db()), {
    label: options.label,
    attempts: options.attempts,
  });
}

/**
 * Run a unit of work inside a transaction on a single connection.
 *
 * On PostgreSQL this opens a dedicated client, wraps the callback in
 * BEGIN/COMMIT/ROLLBACK and always closes the client afterwards — so the
 * connection is released instead of lingering until the runtime reaps it.
 * On the other providers the callback simply receives `db()`; those runtimes
 * keep a long-lived handle, so there is no per-statement connection churn to
 * avoid.
 */
export async function runInDbTransaction<T>(
  work: (tx: DbExecutor) => Promise<T>,
  options: { retry?: boolean; label?: string } = {}
): Promise<T> {
  const run = async () => {
    if (envConfigs.database_provider !== 'postgresql') {
      return work(db());
    }

    const client = createPostgresClient();
    try {
      const result = await drizzle(client).transaction(
        work as (tx: DbExecutor) => Promise<T>
      );
      return result as T;
    } finally {
      // Resolves immediately on an already-closed socket; guarded so a
      // failed teardown can never mask the original error.
      await client.end().catch(() => undefined);
    }
  };

  return options.retry ? withDbRetry(run, { label: options.label }) : run();
}
