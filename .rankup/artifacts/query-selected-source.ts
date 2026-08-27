import dotenv from 'dotenv';
async function main(){
 dotenv.config({ path: '.env.local' });
 const { getWeddingProject } = await import('../../src/shared/models/wedding');
 const p = await getWeddingProject('1a40be02-ef20-4f21-a0d7-76cefe4fbe7d');
 console.log(JSON.stringify(p?.generations.map((g:any)=>({id:g.id,status:g.status,url:g.sourceImageUrl})),null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
