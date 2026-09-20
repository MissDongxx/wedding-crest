import fs from 'node:fs';
import postgres from '../../../node_modules/postgres/src/index.js';
const apply = process.argv.includes('--apply');
const root = new URL('../../../', import.meta.url);
const artifactDir = new URL('./', import.meta.url);
const toml = fs.readFileSync(new URL('wrangler.toml', root), 'utf8');
const databaseUrl = toml.match(/localConnectionString\s*=\s*"([^"]+)"/)?.[1];
const sql = postgres(databaseUrl, { max: 1, connect_timeout: 20, prepare: false, ssl: 'require' });
try {
  const rows = await sql`select p.id, p.status, p.created_at, p.updated_at from "wedding-crest".wedding_project p where p.status='generating' and p.updated_at < now()-interval '15 minutes' and not exists (select 1 from "wedding-crest".wedding_generation g where g.project_id=p.id) order by p.created_at`;
  fs.writeFileSync(new URL('stuck-projects-before.json', artifactDir), `${JSON.stringify(rows, null, 2)}\n`);
  if (apply && rows.length) {
    const ids = rows.map((row) => row.id);
    await sql`update "wedding-crest".wedding_project set status='failed', updated_at=now() where id in ${sql(ids)} and status='generating'`;
  }
  console.log(JSON.stringify({ apply, count: rows.length, ids: rows.map((row) => row.id) }, null, 2));
} finally { await sql.end({ timeout: 2 }); }
