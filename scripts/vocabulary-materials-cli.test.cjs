'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'chunk-material-cli-'));
try{
 const source=path.resolve('drafts/scene-wordbooks/borrow-things-v1/review.json'),original=fs.readFileSync(source),output=path.join(directory,'materials.json');
 const run=(script,args)=>spawnSync(process.execPath,[script,...args],{encoding:'utf8'});
 const created=run('scripts/prepare-borrow-material-library.cjs',[source,output]);assert.equal(created.status,0,created.stderr);
 const first=fs.readFileSync(output),again=run('scripts/prepare-borrow-material-library.cjs',[source,output]);assert.notEqual(again.status,0,'existing draft never overwritten');assert.deepEqual(fs.readFileSync(output),first);
 const checked=run('scripts/validate-vocabulary-materials.cjs',[output]);assert.equal(checked.status,0,checked.stderr);assert.match(checked.stdout,/"publishable": false/);assert.deepEqual(fs.readFileSync(output),first,'validation is read-only');
 fs.writeFileSync(path.join(directory,'invalid.json'),JSON.stringify({format:'wrong'}),{flag:'wx'});
 const invalid=run('scripts/prepare-borrow-material-library.cjs',[path.join(directory,'invalid.json'),path.join(directory,'must-not-exist.json')]);assert.notEqual(invalid.status,0);assert.equal(fs.existsSync(path.join(directory,'must-not-exist.json')),false,'invalid input creates nothing');
 assert.deepEqual(fs.readFileSync(source),original);
 console.log('Material CLI: isolated output, exclusive create, no overwrite, invalid-input rejection and read-only verification passed.');
}finally{
 const target=fs.realpathSync(directory),relative=path.relative(fs.realpathSync(os.tmpdir()),target);
 if(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&path.basename(target).startsWith('chunk-material-cli-'))fs.rmSync(target,{recursive:true,force:true});
}
