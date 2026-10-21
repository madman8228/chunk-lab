'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({serviceWorkers:'block'});let failData=false;
  await page.route('**/*',route=>{
   assert.equal(route.request().method(),'GET','no server mutation during partition repair');
   const pathname=new URL(route.request().url()).pathname;
   if(pathname==='/api/data'&&failData)return route.fulfill({status:503,body:'{}'});
   const body=pathname==='/api/data'?JSON.stringify({seq:32,mem:{decks:[{id:'server-course',name:'confirmed course',items:[]}],stats:{}},courseProgress:{}}):pathname==='/api/config'?JSON.stringify({persistenceMode:'server-authoritative',writeProtocol:3}):pathname.startsWith('/js/')?fs.readFileSync('.'+pathname,'utf8'):'<html></html>';
   return route.fulfill({status:200,contentType:pathname.startsWith('/js/')?'application/javascript; charset=utf-8':pathname.startsWith('/api/')?'application/json':'text/html; charset=utf-8',body});
  });
  await page.goto('http://127.0.0.1:9879/blank');
  await page.evaluate(async()=>{
   const token='test.'+btoa(JSON.stringify({uid:27}))+'.test',owner=JSON.stringify([location.origin,'27']);
   localStorage.setItem('chunklab_token',token);localStorage.setItem('chunklab.storage-owner.v1',owner);localStorage.setItem('chunklab.v1','original private courses');
   await new Promise(resolve=>{const req=indexedDB.open('chunklab-idb',9);req.onupgradeneeded=()=>{req.result.createObjectStore('syncMeta',{keyPath:'key'});req.result.createObjectStore('pendingOperations',{keyPath:'requestId'});};req.onsuccess=()=>{const db=req.result,tx=db.transaction(['syncMeta','pendingOperations'],'readwrite');tx.objectStore('syncMeta').put({key:'server-cache-v3',owner,scope:JSON.stringify([location.origin,owner,3]),appliedSeq:261,snapshot:{mem:{decks:[{id:'irreplaceable-original'}]}}});tx.objectStore('pendingOperations').put({requestId:'original-pending',operation:{type:'deck.put'}});tx.oncomplete=()=>{db.close();resolve();};};});
  });
  await page.addScriptTag({url:'/js/server-cache.js'});await page.addScriptTag({url:'/js/browser-confirmation-repair.js'});
  const options={expectedUid:'27',expectedCachedSeq:261};
  const rejection=opts=>page.evaluate(async opts=>{try{await BrowserConfirmationRepair.repair(opts);return null;}catch(e){return e.message;}},opts);
  assert.match(await rejection({...options,expectedUid:'1'}),/指定修复账号/);
  failData=true;assert.match(await rejection(options),/HTTP 503/);failData=false;
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('chunklab.restore.active.')).length),0,'failed checks never switch the active pointer');
  const result=await page.evaluate(opts=>BrowserConfirmationRepair.repair(opts),options);
  assert.equal(result.previousSeq,261);assert.equal(result.confirmedSeq,32);
  const preserved=await page.evaluate(()=>new Promise(resolve=>{const req=indexedDB.open('chunklab-idb');req.onsuccess=()=>{const db=req.result,tx=db.transaction(['syncMeta','pendingOperations'],'readonly');let cache,pending;tx.objectStore('syncMeta').get('server-cache-v3').onsuccess=e=>{cache=e.target.result;};tx.objectStore('pendingOperations').getAll().onsuccess=e=>{pending=e.target.result;};tx.oncomplete=()=>{db.close();resolve({seq:cache.appliedSeq,course:cache.snapshot.mem.decks[0].id,pending:pending.length,small:localStorage.getItem('chunklab.v1')});};};}));
  assert.deepEqual(preserved,{seq:261,course:'irreplaceable-original',pending:1,small:'original private courses'});
  await page.addScriptTag({url:'/js/account-storage.js'});
  const active=await page.evaluate(()=>({database:AccountStorage.databaseName,small:AccountStorage.storage.getItem('chunklab.v1')}));
  assert.ok(active.database.endsWith('-restore-'+result.revision));assert.equal(active.small,null,'original business data is not silently copied to the new partition');
  const fresh=await page.evaluate(name=>new Promise(resolve=>{const req=indexedDB.open(name);req.onsuccess=()=>{const db=req.result,tx=db.transaction(['syncMeta','pendingOperations'],'readonly');let seq,pending;tx.objectStore('syncMeta').get('server-cache-v3').onsuccess=e=>{seq=e.target.result.appliedSeq;};tx.objectStore('pendingOperations').count().onsuccess=e=>{pending=e.target.result;};tx.oncomplete=()=>{db.close();resolve({seq,pending});};};}),active.database);
  assert.deepEqual(fresh,{seq:32,pending:0});
  console.log('Partition repair passes: original courses/cache/queue preserved; verified fresh cache selected; no server writes.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
