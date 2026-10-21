'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {verifyDependencies}=require('./verify-server-dependencies.cjs');
// Every case owns a fresh temporary package tree, never live node_modules/data.
function fixture({installed='1.0.0',locked='1.0.0',source='module.exports={};',missing=false,rootMismatch=false}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'chunklab-dependency-contract-'));
  const deps={'isolated-fixture':'^1.0.0'};
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({dependencies:deps}));
  fs.writeFileSync(path.join(root,'package-lock.json'),JSON.stringify({packages:{
    '':{dependencies:rootMismatch?{}:deps},'node_modules/isolated-fixture':{version:locked}
  }}));
  if(!missing){
    const directory=path.join(root,'node_modules/isolated-fixture');
    fs.mkdirSync(directory,{recursive:true});
    fs.writeFileSync(path.join(directory,'package.json'),JSON.stringify({name:'isolated-fixture',version:installed,main:'index.js'}));
    fs.writeFileSync(path.join(directory,'index.js'),source);
  }
  return root;
}
assert.deepEqual(verifyDependencies(fixture()),[{name:'isolated-fixture',version:'1.0.0'}]);
assert.throws(()=>verifyDependencies(fixture({missing:true})),/ENOENT/);
assert.throws(()=>verifyDependencies(fixture({installed:'2.0.0'})),/differs from lock/);
assert.throws(()=>verifyDependencies(fixture({locked:null})),/Missing locked/);
assert.throws(()=>verifyDependencies(fixture({rootMismatch:true})),/declarations differ/);
assert.throws(()=>verifyDependencies(fixture({source:'throw new Error("unloadable dependency")'})),/unloadable dependency/);
console.log('dependency verifier: 6 isolated positive/negative cases passed');
