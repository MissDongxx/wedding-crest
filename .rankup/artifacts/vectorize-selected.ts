import fs from 'node:fs';
import JSZip from 'jszip';
import { vectorizeWeddingArtwork, cropExtractedVector } from '../../src/shared/wedding/vectorizer';
async function main(){
 const source=fs.readFileSync('/tmp/selected-ai-crest.png');
 const started=Date.now();
 const v=vectorizeWeddingArtwork(source);
 const monogram=cropExtractedVector(v.master,v,v.focus,.48);
 const simplified=cropExtractedVector(v.monochrome,v,v.focus,.38);
 fs.writeFileSync('/tmp/selected-primary.svg',v.master);fs.writeFileSync('/tmp/selected-black.svg',v.monochrome);fs.writeFileSync('/tmp/selected-monogram.svg',monogram);fs.writeFileSync('/tmp/selected-simplified.svg',simplified);
 const z=new JSZip();z.file('primary.svg',v.master);z.file('black.svg',v.monochrome);z.file('monogram.svg',monogram);z.file('simplified.svg',simplified);const archive=await z.generateAsync({type:'nodebuffer',compression:'DEFLATE'});fs.writeFileSync('/tmp/selected-vector-pack.zip',archive);
 console.log(JSON.stringify({width:v.width,height:v.height,paths:(v.master.match(/<path\b/g)||[]).length,images:(v.master.match(/<image\b/g)||[]).length,masterBytes:v.master.length,blackBytes:v.monochrome.length,zipBytes:archive.length,ms:Date.now()-started}));
}
main().catch(e=>{console.error(e);process.exit(1)});
