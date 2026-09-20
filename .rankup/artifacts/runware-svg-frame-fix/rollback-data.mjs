import fs from 'node:fs';
import postgres from '../../../node_modules/postgres/src/index.js';
const apply = process.argv.includes('--apply');
const verifyTransaction = process.argv.includes('--verify-transaction');
const root = new URL('../../../', import.meta.url);
const backup = JSON.parse(fs.readFileSync(new URL('frames-before.json', import.meta.url), 'utf8'));
const stuckProjects = JSON.parse(fs.readFileSync(new URL('stuck-projects-before.json', import.meta.url), 'utf8'));
const toml = fs.readFileSync(new URL('wrangler.toml', root), 'utf8');
const databaseUrl = toml.match(/localConnectionString\s*=\s*"([^"]+)"/)?.[1];
const sql = postgres(databaseUrl, { max: 1, connect_timeout: 20, prepare: false, ssl: 'require' });
async function restore(client) {
  for (const frame of backup) {
    await client`update "wedding-crest".wedding_frame set url=${frame.url}, updated_at=${frame.updated_at} where id=${frame.id}`;
  }
  const [row] = await client`select count(*)::int count from "wedding-crest".wedding_frame where lower(url) ~ '\\.svg(?:\\?.*)?$'`;
  if (row.count !== backup.length) throw new Error(`rollback verification expected ${backup.length} SVG frames, found ${row.count}`);
  for (const project of stuckProjects) {
    await client`update "wedding-crest".wedding_project set status=${project.status}, updated_at=${project.updated_at} where id=${project.id}`;
  }
  const ids = stuckProjects.map((project) => project.id);
  const [projectRow] = ids.length
    ? await client`select count(*)::int count from "wedding-crest".wedding_project where id in ${client(ids)} and status='generating'`
    : [{ count: 0 }];
  if (projectRow.count !== stuckProjects.length) throw new Error(`rollback verification expected ${stuckProjects.length} generating projects, found ${projectRow.count}`);
  return { frames: row.count, projects: projectRow.count };
}
try {
  if (verifyTransaction) {
    let verified = { frames: 0, projects: 0 };
    try {
      await sql.begin(async (tx) => { verified = await restore(tx); throw new Error('__ROLLBACK_TEST__'); });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== '__ROLLBACK_TEST__') throw error;
    }
    const [live] = await sql`select count(*)::int count from "wedding-crest".wedding_frame where lower(url) ~ '\\.svg(?:\\?.*)?$'`;
    const ids = stuckProjects.map((project) => project.id);
    const [liveProjects] = ids.length ? await sql`select count(*)::int count from "wedding-crest".wedding_project where id in ${sql(ids)} and status='generating'` : [{ count: 0 }];
    console.log(JSON.stringify({ transactionRollbackVerified: verified, liveSvgFramesAfterRollback: live.count, liveGeneratingProjectsAfterRollback: liveProjects.count }, null, 2));
  } else if (apply) {
    const restored = await sql.begin((tx) => restore(tx));
    console.log(JSON.stringify({ restored }, null, 2));
  } else {
    console.log(JSON.stringify({ dryRun: true, frames: backup.length }, null, 2));
  }
} finally { await sql.end({ timeout: 2 }); }
