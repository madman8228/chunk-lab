'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({serviceWorkers:'block'});
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   assert.equal(route.request().method(),'GET','diagnostics never sends writes');
   const body=url.pathname==='/api/data'?JSON.stringify({seq:32,mem:{}}):url.pathname==='/api/config'?'{}':url.pathname==='/browser-diagnostics.html'?fs.readFileSync('browser-diagnostics.html','utf8'):'<html></html>';
   return route.fulfill({status:200,contentType:url.pathname.startsWith('/api/')?'application/json':'text/html',body});
  });
  await page.goto('http://127.0.0.1:9879/blank');
  await page.evaluate(async()=>{
   const token='test.'+btoa(JSON.stringify({uid:'diagnostic-test'}))+'.test';
   const owner=JSON.stringify([location.origin,'diagnostic-test']);
   localStorage.setItem('chunklab_token',token);localStorage.setItem('chunklab.storage-owner.v1',owner);
   await new Promise((resolve,reject)=>{const req=indexedDB.open('chunklab-idb',9);req.onupgradeneeded=()=>{req.result.createObjectStore('syncMeta',{keyPath:'key'});req.result.createObjectStore('pendingOperations',{keyPath:'requestId'});};req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('syncMeta','readwrite');tx.objectStore('syncMeta').put({key:'server-cache-v3',owner,scope:JSON.stringify([location.origin,owner,3]),appliedSeq:100,snapshot:{mem:{}}});tx.oncomplete=()=>{db.close();resolve();};};});
  });
  await page.goto('http://127.0.0.1:9879/browser-diagnostics.html');
  await page.waitForFunction(()=>document.querySelector('#result').textContent.includes('检查完成'));
  assert.match(await page.locator('#result').textContent(),/SERVER_SEQ_ROLLBACK/);
  const seq=await page.evaluate(()=>new Promise(resolve=>{const req=indexedDB.open('chunklab-idb');req.onsuccess=()=>{const db=req.result,get=db.transaction('syncMeta','readonly').objectStore('syncMeta').get('server-cache-v3');get.onsuccess=()=>{resolve(get.result.appliedSeq);db.close();};};}));
  assert.equal(seq,100,'diagnostics preserves original cache');
  console.log('Read-only diagnostics detects rollback without changing cache or sending writes.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
