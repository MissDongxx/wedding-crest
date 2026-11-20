#!/usr/bin/env node
/** Explicit additive PostgreSQL migration, never the repository-wide migration chain. */
import fs from 'node:fs';
import dotenv from 'dotenv';
import postgres from 'postgres';

const args = process.argv.slice(2);
const migrationPath =
  'src/config/db/migrations_postgres/0007_payment_diagnostic_events.sql';
const rollback =
  'DROP TABLE IF EXISTS "wedding-crest"."payment_diagnostic_event";';
if (args.includes('--rollback-dry-run')) {
  console.log(
    '-- Dry run only: removes diagnostic events; does not modify orders, users or payments.\n' +
      rollback
  );
  process.exit(0);
}
if (
  args.includes('--help') ||
  !args.some((arg) => ['--verify', '--apply'].includes(arg))
) {
  console.log(
    'Usage: node scripts/migrate-payment-diagnostics.mjs --verify | --apply | --rollback-dry-run\nDefault/help performs no database access. --apply creates only the new payment_diagnostic_event table and four indexes.'
  );
  process.exit(0);
}
const fileEnv = (path) =>
  fs.existsSync(path) ? dotenv.parse(fs.readFileSync(path)) : {};
const env = {
  ...fileEnv('.env.local'),
  ...fileEnv('.dev.vars'),
  ...process.env,
};
if ((env.DB_SCHEMA || 'wedding-crest') !== 'wedding-crest') {
  console.error('This migration is restricted to the wedding-crest schema.');
  process.exit(1);
}
const migration = fs.readFileSync(migrationPath, 'utf8');
const statements = migration
  .replace(/--[^\n]*/g, '')
  .split(';')
  .map((value) => value.trim())
  .filter(Boolean);
if (
  statements.length !== 5 ||
  statements.some(
    (statement) => !/^CREATE (?:TABLE|INDEX) IF NOT EXISTS /i.test(statement)
  ) ||
  statements.some((statement) => !statement.includes('payment_diag'))
) {
  console.error('Migration guard rejected unexpected SQL.');
  process.exit(1);
}
const sql = postgres(env.DATABASE_URL, {
  max: 1,
  connect_timeout: 15,
  prepare: false,
});
try {
  if (args.includes('--apply')) {
    await sql.begin(async (tx) => {
      await tx`set local lock_timeout='1000'`;
      await tx`set local statement_timeout='15000'`;
      await tx.unsafe(migration);
    });
  }
  const result = await sql.begin('read only', async (tx) => {
    await tx`set local statement_timeout='15000'`;
    const columns =
      await tx`select column_name,data_type from information_schema.columns where table_schema='wedding-crest' and table_name='payment_diagnostic_event' order by ordinal_position`;
    const indexes =
      await tx`select indexname from pg_indexes where schemaname='wedding-crest' and tablename='payment_diagnostic_event' order by indexname`;
    const expected = [
      'id',
      'source',
      'stage',
      'reason',
      'request_id',
      'attempt_id',
      'order_no',
      'provider',
      'owner_id',
      'project_id',
      'entry',
      'http_status',
      'latency_ms',
      'details',
      'created_at',
    ];
    const valid =
      expected.every((name) =>
        columns.some((column) => column.column_name === name)
      ) &&
      indexes.filter((index) => index.indexname.startsWith('idx_payment_diag_'))
        .length === 4;
    return {
      table: 'wedding-crest.payment_diagnostic_event',
      verified: valid,
      columns,
      indexes,
      migrationPath,
      mutation: args.includes('--apply')
        ? 'additive table/index creation only'
        : 'none',
    };
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.verified) process.exitCode = 1;
} catch (error) {
  console.error(
    JSON.stringify({
      outcome: 'migration_or_verification_error',
      errorType: /^[A-Za-z]+Error$/.test(error.name || '')
        ? error.name
        : 'Error',
      errorCode: /^[A-Z0-9_]{2,35}$/.test(error.code || '')
        ? error.code
        : undefined,
    })
  );
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 2 });
}
