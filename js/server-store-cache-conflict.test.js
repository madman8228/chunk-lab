'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
  const owner='synthetic-owner',base='http://isolated.invalid';
  const scope=JSON.stringify([base,owner,3]);
  const rows=[{requestId:'already-confirmed',owner,scope,base,sessionEpoch:'',status:'acked-awaiting-apply',lastError:'SERVER_SEQ_ROLLBACK'}];
  const window={location:{origin:base},AccountStorage:{owner,assertCurrent(){}},
    CL:{getCloudConfig:()=>({persistenceMode:'server-authoritative',writeProtocol:3}),serverPersistenceReady:()=>false},
    IDBStore:{listPendingOperations:async()=>rows},ChunkAPI:{getBase:()=>base},
    addEventListener(){},setTimeout(){return 1;},clearTimeout(){},navigator:{}};
  vm.runInNewContext(fs.readFileSync(require.resolve('./server-store.js'),'utf8'),{window,URL,Promise,Blob,Date,JSON,Object,Number,Math,Error});
  await window.ServerStore.refreshState();
  assert.equal(window.ServerStore.state().error,'SERVER_SEQ_ROLLBACK','state refresh must not erase durable cache conflict');
  await window.ServerStore.retryPending();
  assert.equal(window.ServerStore.state().error,'SERVER_SEQ_ROLLBACK','paused drain must preserve conflict reason');
  assert.equal(rows.length,1,'confirmed request must not be removed or replayed');
  rows.length=0;await window.ServerStore.refreshState();
  assert.equal(window.ServerStore.state().error,null,'resolved conflict must not remain stale');
  console.log('cache conflict state: refresh and paused drain preserve reason without replay or deletion');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
