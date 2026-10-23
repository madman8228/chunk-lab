'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),path=require('node:path');
const fs=require('node:fs'),os=require('node:os');
const express=require('../server/node_modules/express'),{chromium}=require('playwright-core');
const {createOfflineLicense}=require('../server/services/membership/offline-license');
(async()=>{
 const keys=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1',publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 const now=1792700000000,body=Buffer.from('synthetic complete sentence lesson');
 const scope={accountId:'fixture-a',service:'fixture-server',courseId:'course',unitId:'unit',contentVersion:'v1'};
 const signer=createOfflineLicense({...keys,now:()=>now});
 const license=signer.issue({...scope,sha256:crypto.createHash('sha256').update(body).digest('hex')},{allowed:true,mode:'member',endsAt:now+86400000});
 const app=express();app.get('/test',(_,res)=>res.type('html').send('<title>Isolated offline storage test</title>'));app.use('/src',express.static(path.resolve(__dirname,'../src')));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let browser;
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sentence-offline-profile-'));
 try{
  browser=await chromium.launchPersistentContext(profile,{headless:true});let page=await browser.newPage();const base='http://127.0.0.1:'+server.address().port;
  const input={scope,license,publicKey:signer.publicJwk(),now,bytes:[...body]};
  await page.goto(base+'/test');
  await page.evaluate(async input=>{const {createOfflineUnitStore}=await import('/src/learning/offline-unit-store.mjs');const store=createOfflineUnitStore({indexedDB});await store.save({...input,body:new Uint8Array(input.bytes)});},input);
  await browser.close();browser=await chromium.launchPersistentContext(profile,{headless:true});page=await browser.newPage();await page.goto(base+'/test');
  const result=await page.evaluate(async input=>{
   const {createOfflineUnitStore}=await import('/src/learning/offline-unit-store.mjs');const store=createOfflineUnitStore({indexedDB});
   const read=()=>store.read(input);const first=await read();let tamper=false,isolated=false,expired=false;
   try{await store.save({...input,body:new Uint8Array([1])});}catch(_){tamper=true;}
   const originalTransaction=IDBDatabase.prototype.transaction;
   let storageFailure=false;
   IDBDatabase.prototype.transaction=function(...args){const transaction=originalTransaction.apply(this,args);if(args[1]==='readwrite')queueMicrotask(()=>transaction.abort());return transaction;};
   try{await store.save({...input,body:new Uint8Array(input.bytes)});}catch(_){storageFailure=true;}
   finally{IDBDatabase.prototype.transaction=originalTransaction;}
   const preserved=await read();
   try{await store.read({...input,scope:{...input.scope,accountId:'fixture-b'}});}catch(e){isolated=e.code==='UNIT_NOT_CACHED';}
   try{await store.read({...input,now:input.now+86400000});}catch(e){expired=e.code==='INVALID_OFFLINE_LICENSE';}
   return {reopened:new TextDecoder().decode(first.body),preserved:new TextDecoder().decode(preserved.body),tamper,storageFailure,isolated,expired};
  },input);
  assert.equal(result.reopened,body.toString());assert.equal(result.preserved,body.toString());assert.ok(result.tamper&&result.storageFailure&&result.isolated&&result.expired);
  console.log('Real browser IndexedDB: full browser restart, account isolation, expiration and failed replacement preserving original passed');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
