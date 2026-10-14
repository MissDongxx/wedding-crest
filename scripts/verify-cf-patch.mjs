import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const script=path.resolve(process.env.PATCH_SCRIPT || 'scripts/patch-cf-canvas.mjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'cf-patch-regression-'));
const failures=[];
const original='const cp = require("node:child_process");\n';
function run(cwd,args=[]){return spawnSync(process.execPath,[script,...args],{cwd,encoding:'utf8',timeout:10000});}
function test(name,fn){try{fn();console.log('PASS: '+name)}catch(e){failures.push(name);console.log('FAIL: '+name+' ('+e.message.split('\n')[0]+')')}}
function fixture(name){const dir=path.join(root,name);fs.mkdirSync(path.join(dir,'.open-next'),{recursive:true});return dir}
test('missing build blocks release check',()=>{const dir=path.join(root,'missing');fs.mkdirSync(dir);assert.notEqual(run(dir,['--check']).status,0)});
test('check is readonly and rejects unsupported imports',()=>{const dir=fixture('check');const file=path.join(dir,'.open-next/worker.js');fs.writeFileSync(file,original);const r=run(dir,['--check']);assert.notEqual(r.status,0);assert.equal(fs.readFileSync(file,'utf8'),original)});
test('directory and file symlinks leave external dependencies unchanged',()=>{const dir=fixture('links');const external=path.join(root,'external');fs.mkdirSync(external);const victim=path.join(external,'dependency.js');fs.writeFileSync(victim,original);fs.symlinkSync(external,path.join(dir,'.open-next/node_modules'),'dir');fs.symlinkSync(victim,path.join(dir,'.open-next/file.js'));fs.writeFileSync(path.join(dir,'.open-next/worker.js'),original);assert.equal(run(dir).status,0);assert.equal(fs.readFileSync(victim,'utf8'),original);assert.equal(run(dir,['--check']).status,0)});
test('atomic patch preserves hardlinked external dependency',()=>{const dir=fixture('hardlink');const external=path.join(root,'hardlinked-original.js');fs.writeFileSync(external,original);const worker=path.join(dir,'.open-next/worker.js');fs.linkSync(external,worker);assert.equal(run(dir).status,0);assert.equal(fs.readFileSync(external,'utf8'),original);assert.notEqual(fs.readFileSync(worker,'utf8'),original)});
test('symlinked build root rejected without mutation',()=>{const dir=path.join(root,'root-link');const external=path.join(root,'external-root');fs.mkdirSync(dir);fs.mkdirSync(external);const file=path.join(external,'worker.js');fs.writeFileSync(file,original);fs.symlinkSync(external,path.join(dir,'.open-next'),'dir');assert.notEqual(run(dir).status,0);assert.equal(fs.readFileSync(file,'utf8'),original)});
test('patch removes three unsupported requires and is idempotent',()=>{const dir=fixture('normal');const file=path.join(dir,'.open-next/worker.mjs');fs.writeFileSync(file,'const a=require("canvas");const b=require("child_process");const c=require("node:child_process");');assert.equal(run(dir).status,0);const patched=fs.readFileSync(file,'utf8');assert(!/require\(["'](?:canvas|(?:node:)?child_process)["']\)/.test(patched));assert.equal(run(dir,['--check']).status,0);assert.equal(run(dir).status,0);assert.equal(fs.readFileSync(file,'utf8'),patched)});
test('official OpenNext middleware manifest fallback is enforced',()=>{const dir=fixture('manifest');const file=path.join(dir,'.open-next/handler.mjs');fs.writeFileSync(file,'class Server{getMiddlewareManifest(){return this.minimalMode?null:require(this.middlewareManifestPath)}}');assert.notEqual(run(dir,['--check']).status,0);assert.equal(run(dir).status,0);assert(fs.readFileSync(file,'utf8').includes('getMiddlewareManifest(){return null}'));assert.equal(run(dir,['--check']).status,0)});
test('unknown manifest loader blocks patch instead of guessing',()=>{const dir=fixture('manifest-unknown');fs.writeFileSync(path.join(dir,'.open-next/handler.js'),'class Server{getMiddlewareManifest(){try{return require(this.middlewareManifestPath)}catch{}}}');assert.notEqual(run(dir).status,0)});
fs.rmSync(root,{recursive:true,force:true});
if(failures.length){console.log('FAILED: '+failures.length+' cases');process.exitCode=1}else console.log('PASS: all 8 compatibility patch gates');
