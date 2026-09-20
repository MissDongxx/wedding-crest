import fs from 'node:fs';
import postgres from '../../../node_modules/postgres/src/index.js';
const projectId = 'c0f68e43-5a77-4782-9722-8a4e2d0fc02b';
const root = new URL('../../../', import.meta.url);
const toml = fs.readFileSync(new URL('wrangler.toml', root), 'utf8');
const databaseUrl = toml.match(/localConnectionString\s*=\s*"([^"]+)"/)?.[1];
const sql = postgres(databaseUrl, { max: 1, connect_timeout: 20, prepare: false, ssl: 'require' });
try {
  const [frames] = await sql`select count(*)::int total, count(*) filter(where lower(url) ~ '\\.png(?:\\?.*)?$')::int png, count(*) filter(where lower(url) ~ '\\.svg(?:\\?.*)?$')::int svg from "wedding-crest".wedding_frame`;
  const [stuck] = await sql`select count(*)::int count from "wedding-crest".wedding_project p where p.status='generating' and p.updated_at < now()-interval '15 minutes' and not exists(select 1 from "wedding-crest".wedding_generation g where g.project_id=p.id)`;
  const [generation] = await sql`select p.status project_status,g.status generation_status,g.model,g.provider_task_id,g.source_image_url is not null has_image from "wedding-crest".wedding_project p join "wedding-crest".wedding_generation g on g.project_id=p.id where p.id=${projectId} order by g.created_at desc limit 1`;
  const [keyRow] = await sql`select value from "wedding-crest".config where name='runware_api_key'`;
  const response = await fetch('https://api.runware.ai/v1',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${keyRow.value}`},body:JSON.stringify([{taskType:'getResponse',taskUUID:generation.provider_task_id}])});
  const provider = await response.json();
  const task = provider?.data?.[0] ?? {};
  const result = { frames, stuckProjects: stuck.count, e2e: { projectStatus:generation.project_status,generationStatus:generation.generation_status,model:generation.model,hasImage:generation.has_image,providerHttp:response.status,providerStatus:task.status,providerHasImage:Boolean(task.imageURL) } };
  console.log(JSON.stringify(result,null,2));
  if(frames.total!==7||frames.png!==7||frames.svg!==0||stuck.count!==0||generation.project_status!=='complete'||generation.generation_status!=='complete'||!generation.has_image||response.status!==200||task.status!=='success'||!task.imageURL) process.exitCode=1;
} finally { await sql.end({timeout:2}); }
