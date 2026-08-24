import { sql } from 'drizzle-orm';
import { getPostgresDb, closePostgresDb } from '../src/core/db/postgres';

(async () => {
  const db = getPostgresDb() as any;
  try {
    // 1. Check current schema (search_path)
    const schemaRes = await db.execute(sql`SHOW search_path`);
    console.log('search_path:', JSON.stringify(schemaRes, null, 2));

    // 2. List schemas
    const schemas = await db.execute(
      sql`SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast') ORDER BY schema_name`
    );
    console.log('schemas:', JSON.stringify(schemas, null, 2));

    // 3. List tables in wedding-crest schema
    const tables = await db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'wedding-crest' ORDER BY table_name`
    );
    console.log('wedding-crest tables:', JSON.stringify(tables, null, 2));

    // 4. Try direct query on wedding_example
    const direct = await db.execute(
      sql`SELECT to_regclass('wedding-crest.wedding_example') AS regclass`
    );
    console.log('wedding-crest.wedding_example regclass:', JSON.stringify(direct, null, 2));

    // 5. Try plain SELECT
    try {
      const rows = await db.execute(sql`SELECT * FROM "wedding-crest"."wedding_example" LIMIT 1`);
      console.log('rows count:', (rows as any)?.length ?? 'n/a');
    } catch (e: any) {
      console.log('plain select error:', e?.message);
    }
  } catch (e: any) {
    console.error('FATAL:', e?.message);
  } finally {
    await closePostgresDb();
  }
})();
