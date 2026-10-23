'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const handlers={};let activated=0,downloadFails=false;
 vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{URL,Response,self:{location:{origin:'https://update.test'},addEventListener:(n,f)=>handlers[n]=f,skipWaiting:async()=>{activated++;}},caches:{open:async()=>({addAll:async()=>{if(downloadFails)throw Error('network interrupted');}})}});
 let pending;handlers.install({waitUntil:p=>pending=p});await pending;
 assert.equal(activated,0,'completed download must wait rather than replace an active lesson');
 handlers.message({data:{type:'ACTIVATE_UPDATE'},waitUntil:p=>pending=p});await pending;
 assert.equal(activated,1,'existing refresh action can activate the ready update');
 downloadFails=true;handlers.install({waitUntil:p=>pending=p});await assert.rejects(pending,/network interrupted/);
 assert.equal(activated,1,'failed installation must not activate');
 console.log('Update lifecycle passed: complete download waits; explicit activation; interrupted installation rejects');
})().catch(e=>{console.error(e);process.exitCode=1;});
