import fs from 'node:fs';
import { buildWeddingTypographyPaths } from '../../src/shared/wedding/vector-typography';
import { appendSvgLayer } from '../../src/shared/wedding/vectorizer';
async function main(){
 const svg=fs.readFileSync('/tmp/selected-primary.svg','utf8');
 const input:any={partner1:'Dmma',partner2:'James',initials:['D','J'],weddingDate:'2026-08-24',style:'italian_romance',layout:'ITALIAN_ARCH_01',typography:'editorial_italic',palette:['#A3AA91','#F9F4F0'],flowers:[],personalElements:[],complexity:'rich',nameDisplay:'full_names',showDate:true};
 const paths=await buildWeddingTypographyPaths(input,'http://localhost:3003','#A3AA91');
 const out=appendSvgLayer(svg,`<g transform="scale(0.64 0.64)">${paths}</g>`);fs.writeFileSync('/tmp/final-typography-current.svg',out);console.log({paths:(out.match(/<path\\b/g)||[]).length,images:(out.match(/<image\\b/g)||[]).length});
}
main().catch(e=>{console.error(e);process.exit(1)});
