'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({serviceWorkers:'block'});let failData=false,wrongIdentity=false,activeFormat='legacy-v1',serverSeq=32,serverUid='27';
  await page.route('**/*',route=>{
   assert.equal(route.request().method(),'GET','partition repair must not mutate server data');
   const pathname=new URL(route.request().url()).pathname;
   if(pathname==='/api/data'&&failData)return route.fulfill({status:503,body:'{}'});
   const body=pathname==='/api/learning-data/format'?JSON.stringify({format:activeFormat}):pathname==='/api/learning-data'?JSON.stringify({format:'references-v1',seq:12,mem:{decks:[],logicalCourses:{courseX:{courseId:'courseX'}},stats:{}},courseProgress:{}}):pathname==='/api/data'?JSON.stringify({seq:serverSeq,mem:{decks:[{id:'server-course',name:'confirmed course',items:[]}],stats:{}},courseProgress:{}}):pathname==='/api/config'?JSON.stringify({persistenceMode:'server-authoritative',writeProtocol:3}):pathname.startsWith('/js/')?fs.readFileSync('.'+pathname,'utf8'):'<html></html>';
   const headers={};if(pathname.startsWith('/api/'))headers['X-ChunkLab-Account-Id']=wrongIdentity?'28':serverUid;if(pathname==='/api/learning-data')headers['X-Learning-Data-Format']='references-v1';
   return route.fulfill({status:200,headers,contentType:pathname.startsWith('/js/')?'application/javascript; charset=utf-8':pathname.startsWith('/api/')?'application/json':'text/html; charset=utf-8',body});
  });
  await page.goto('http://127.0.0.1:9879/blank');
  await page.evaluate(async()=>{
   const token='test.'+btoa(JSON.stringify({uid:27}))+'.test',owner=JSON.stringify([location.origin,'27']);
   localStorage.setItem('chunklab_token',token);localStorage.setItem('chunklab.storage-owner.v1',owner);localStorage.setItem('chunklab.v1','original private courses');
   await new Promise(resolve=>{const req=indexedDB.open('chunklab-idb',9);req.onupgradeneeded=()=>{for(const [name,keyPath] of Object.entries({courses:'courseId',progress:'cid',sentenceStats:'key',events:'id',syncIntents:'key',syncMeta:'key',pendingOperations:'requestId'}))req.result.createObjectStore(name,{keyPath});};req.onsuccess=()=>{const db=req.result,tx=db.transaction(['courses','progress','sentenceStats','events','syncIntents','syncMeta','pendingOperations'],'readwrite');tx.objectStore('courses').put({courseId:'original-local-course',items:[{id:'original-course-item'}]});tx.objectStore('progress').put({cid:'original-local-course:sentence-1',idx:4});tx.objectStore('sentenceStats').put({key:'original-local-course#sentence-1',data:{times:7}});tx.objectStore('events').put({id:'original-learning-event',outcome:'answer-correct'});tx.objectStore('syncIntents').put({key:JSON.stringify([owner,'events','original-learning-event']),scope:owner,entity:'events',id:'original-learning-event',operationId:'original-learning-intent',value:{id:'original-learning-event',outcome:'answer-correct'},deleted:false});tx.objectStore('syncMeta').put({key:'server-cache-v3',owner,scope:JSON.stringify([location.origin,owner,3]),appliedSeq:261,snapshot:{mem:{decks:[{id:'irreplaceable-original'}]}}});tx.objectStore('pendingOperations').put({requestId:'original-pending',operation:{type:'deck.put'}});tx.oncomplete=()=>{db.close();resolve();};};});
   window.showSaveFilePicker=async()=>({name:'verified-backup.json',createWritable:async()=>({write:async text=>{window.__backupText=text;},close:async()=>{}}),getFile:async()=>({name:'verified-backup.json',text:async()=>window.__backupText})});
  });
  await page.addScriptTag({url:'/js/server-cache.js'});await page.addScriptTag({url:'/js/browser-confirmation-repair.js'});
  const first=await page.evaluate(()=>BrowserConfirmationRepair.preview());assert.equal(first.uid,'27');assert.equal(first.pendingOperations,2);assert.equal(first.pendingTransportOperations,1);assert.equal(first.pendingLearningIntents,1);assert.equal(first.storeCounts.courses,1);assert.equal(first.storeCounts.progress,1);assert.equal(first.storeCounts.sentenceStats,1);assert.equal(first.storeCounts.events,1);assert.equal(first.canApply,false);
  assert.match(await page.evaluate(id=>BrowserConfirmationRepair.apply(id).then(()=>'',e=>e.message),first.id),/待提交学习操作/);
  assert.equal(await page.evaluate(()=>new Promise(resolve=>{const req=indexedDB.open('chunklab-idb');req.onsuccess=()=>{const db=req.result,tx=db.transaction('pendingOperations','readonly'),count=tx.objectStore('pendingOperations').count();count.onsuccess=()=>resolve(count.result);};})),1,'refused repair leaves pending operations intact');
  wrongIdentity=true;assert.match(await page.evaluate(()=>BrowserConfirmationRepair.preview().then(()=>'',e=>e.message)),/账号与当前登录账号不一致/);wrongIdentity=false;
  failData=true;assert.match(await page.evaluate(()=>BrowserConfirmationRepair.preview().then(()=>'',e=>e.message)),/HTTP 503/);failData=false;
  await page.evaluate(()=>new Promise((resolve,reject)=>{const req=indexedDB.open('chunklab-idb');req.onsuccess=()=>{const db=req.result,tx=db.transaction('pendingOperations','readwrite');tx.objectStore('pendingOperations').clear();tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};req.onerror=()=>reject(req.error);}));
  let preview=await page.evaluate(()=>BrowserConfirmationRepair.preview());assert.equal(preview.pendingOperations,1);assert.equal(preview.pendingLearningIntents,1);assert.equal(preview.canApply,false);assert.equal(preview.format,'legacy-v1');
  assert.match(await page.evaluate(id=>BrowserConfirmationRepair.apply(id).then(()=>'',e=>e.message),preview.id),/学习变更 1/,'unacknowledged learning intents also block partition switching');
  await page.evaluate(()=>new Promise((resolve,reject)=>{const req=indexedDB.open('chunklab-idb');req.onsuccess=()=>{const db=req.result,tx=db.transaction('syncIntents','readwrite');tx.objectStore('syncIntents').clear();tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};req.onerror=()=>reject(req.error);}));
  preview=await page.evaluate(()=>BrowserConfirmationRepair.preview());assert.equal(preview.pendingOperations,0);assert.equal(preview.format,'legacy-v1');
  await page.evaluate(()=>localStorage.setItem('chunklab.v1','changed after preview'));
  assert.match(await page.evaluate(id=>BrowserConfirmationRepair.exportAndVerify(id).then(()=>'',e=>e.message),preview.id),/分区发生变化/);
  await page.evaluate(()=>localStorage.setItem('chunklab.v1','original private courses'));
  preview=await page.evaluate(()=>BrowserConfirmationRepair.preview());
  const backup=await page.evaluate(id=>BrowserConfirmationRepair.exportAndVerify(id),preview.id);assert.equal(backup.name,'verified-backup.json');assert.match(await page.evaluate(()=>window.__backupText),/original-local-course|original-learning-event|original-pending/,'verified full-partition backup must contain original course and learning records');
  serverSeq=31;assert.match(await page.evaluate(id=>BrowserConfirmationRepair.apply(id).then(()=>'',e=>e.message),preview.id),/服务端数据在预览后发生变化/);serverSeq=32;
  preview=await page.evaluate(()=>BrowserConfirmationRepair.preview());await page.evaluate(id=>BrowserConfirmationRepair.exportAndVerify(id),preview.id);
  await page.evaluate(()=>localStorage.setItem('chunklab.restore.pending.'+encodeURIComponent(JSON.stringify([location.origin,'27'])),'another-recovery'));
  assert.match(await page.evaluate(id=>BrowserConfirmationRepair.apply(id).then(()=>'',e=>e.message),preview.id),/未完成的恢复操作/);
  await page.evaluate(()=>localStorage.removeItem('chunklab.restore.pending.'+encodeURIComponent(JSON.stringify([location.origin,'27']))));
  const result=await page.evaluate(id=>BrowserConfirmationRepair.apply(id),preview.id);
  assert.equal(result.previousSeq,261);assert.equal(result.confirmedSeq,32);
  const preserved=await page.evaluate(()=>new Promise(resolve=>{const req=indexedDB.open('chunklab-idb');req.onsuccess=()=>{const db=req.result,tx=db.transaction(['courses','progress','sentenceStats','events','syncMeta','pendingOperations'],'readonly');let cache;tx.objectStore('syncMeta').get('server-cache-v3').onsuccess=e=>{cache=e.target.result;};const values={};for(const name of ['courses','progress','sentenceStats','events','pendingOperations'])tx.objectStore(name).getAll().onsuccess=e=>{values[name]=e.target.result;};tx.oncomplete=()=>{db.close();resolve({seq:cache.appliedSeq,course:cache.snapshot.mem.decks[0].id,localCourse:values.courses[0].courseId,progress:values.progress[0].cid,stat:values.sentenceStats[0].data.times,event:values.events[0].id,pending:values.pendingOperations.length,small:localStorage.getItem('chunklab.v1')});};};}));
  assert.deepEqual(preserved,{seq:261,course:'irreplaceable-original',localCourse:'original-local-course',progress:'original-local-course:sentence-1',stat:7,event:'original-learning-event',pending:0,small:'original private courses'});
  assert.equal(await page.evaluate(key=>localStorage.getItem(key), 'chunklab.restore.pending.'+encodeURIComponent(JSON.stringify(['http://127.0.0.1:9879','27']))),null,'repair lock is released after switching');
  await page.addScriptTag({url:'/js/account-storage.js'});
  const active=await page.evaluate(()=>({database:AccountStorage.databaseName,small:AccountStorage.storage.getItem('chunklab.v1')}));
  assert.ok(active.database.endsWith('-restore-'+result.revision));assert.equal(active.small,null,'original business data is not silently copied');
  const fresh=await page.evaluate(name=>new Promise(resolve=>{const req=indexedDB.open(name);req.onsuccess=()=>{const db=req.result,tx=db.transaction(['courses','progress','sentenceStats','events','syncMeta','pendingOperations'],'readonly');const counts={};let seq,pending;tx.objectStore('syncMeta').get('server-cache-v3').onsuccess=e=>{seq=e.target.result.appliedSeq;};tx.objectStore('pendingOperations').count().onsuccess=e=>{pending=e.target.result;};for(const store of ['courses','progress','sentenceStats','events'])tx.objectStore(store).count().onsuccess=e=>{counts[store]=e.target.result;};tx.oncomplete=()=>{db.close();resolve({seq,pending,counts});};};}),active.database);
  assert.deepEqual(fresh,{seq:32,pending:0,counts:{courses:0,progress:0,sentenceStats:0,events:0}},'new active partition contains only confirmed server snapshot metadata; old local learning rows are not silently merged');
  await page.evaluate(async()=>{const owner=JSON.stringify([location.origin,'27']),database='chunklab-idb-restore-refs-fixture';localStorage.setItem('chunklab.restore.active.'+encodeURIComponent(owner),'refs-fixture');await new Promise((resolve,reject)=>{const req=indexedDB.open(database,9);req.onupgradeneeded=()=>{req.result.createObjectStore('syncMeta',{keyPath:'key'});req.result.createObjectStore('pendingOperations',{keyPath:'requestId'});};req.onsuccess=()=>{const db=req.result,tx=db.transaction('syncMeta','readwrite'),scope=JSON.stringify([location.origin,owner,3]);tx.objectStore('syncMeta').put({key:'learning-cache-v1',owner,scope,appliedSeq:19,snapshot:{mem:{decks:[]}}});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};req.onerror=()=>reject(req.error);});});
  activeFormat='references-v1';
  const refsPreview=await page.evaluate(()=>BrowserConfirmationRepair.preview());assert.equal(refsPreview.format,'references-v1');assert.equal(refsPreview.localSeq,19);const refsBackup=await page.evaluate(id=>BrowserConfirmationRepair.exportAndVerify(id),refsPreview.id);assert.equal(refsBackup.name,'verified-backup.json');const refsResult=await page.evaluate(id=>BrowserConfirmationRepair.apply(id),refsPreview.id);assert.equal(refsResult.format,'references-v1');
  const refsFresh=await page.evaluate(name=>new Promise((resolve,reject)=>{const req=indexedDB.open(name);req.onsuccess=()=>{const db=req.result;let tx;try{tx=db.transaction('syncMeta','readonly');}catch(error){db.close();reject(error.message);return;}const all=tx.objectStore('syncMeta').getAll();let keys;all.onsuccess=()=>{keys=all.result.map(row=>row.key).sort();};tx.oncomplete=()=>{db.close();resolve(keys);};tx.onerror=()=>reject(tx.error);};req.onerror=()=>reject(req.error);}), 'chunklab-idb-restore-'+refsResult.revision);
  assert.deepEqual(refsFresh,['learning-cache-v1','learning-format-v1:'+encodeURIComponent(JSON.stringify(['http://127.0.0.1:9879',JSON.stringify(['http://127.0.0.1:9879','27']),3]))].sort());
  serverUid='2';serverSeq=2;
  await page.evaluate(async()=>{
   const owner=JSON.stringify([location.origin,'2']),token='test.'+btoa(JSON.stringify({uid:2}))+'.test';
   localStorage.setItem('chunklab_token',token);localStorage.setItem('chunklab.storage-owner.v1',owner);
   await new Promise((resolve,reject)=>{const req=indexedDB.open('chunklab-idb');req.onsuccess=()=>{const db=req.result,tx=db.transaction(['syncMeta','pendingOperations'],'readwrite');
    tx.objectStore('pendingOperations').put({requestId:'account-2-pending',operation:{type:'course.put'}});
    tx.oncomplete=()=>{db.close();resolve();};tx.onabort=tx.onerror=()=>reject(tx.error||Error('fixture seed failed'));};req.onerror=()=>reject(req.error);});
  });
  assert.match(await page.evaluate(()=>BrowserConfirmationRepair.preview().then(()=>'',e=>e.message)),/没有找到与当前账号及服务地址对应的已确认缓存/,
   'account 2 must not adopt account 27 cache rows even when the local high-water mark is 261');
  const wrongOwnerPreserved=await page.evaluate(()=>new Promise((resolve,reject)=>{const req=indexedDB.open('chunklab-idb');req.onsuccess=()=>{const db=req.result,tx=db.transaction(['syncMeta','pendingOperations'],'readonly');let cache,pending;
   tx.objectStore('syncMeta').get('server-cache-v3').onsuccess=e=>{cache=e.target.result;};tx.objectStore('pendingOperations').getAll().onsuccess=e=>{pending=e.target.result;};
   tx.oncomplete=()=>{db.close();resolve({owner:cache.owner,seq:cache.appliedSeq,course:cache.snapshot.mem.decks[0].id,pending:pending.map(row=>row.requestId)});};tx.onerror=()=>reject(tx.error);};req.onerror=()=>reject(req.error);}));
  assert.deepEqual(wrongOwnerPreserved,{owner:JSON.stringify(['http://127.0.0.1:9879','27']),seq:261,course:'irreplaceable-original',pending:['account-2-pending']},
   'wrong-owner cache and pending operation remain untouched after refusal');
  activeFormat='legacy-v1';
  await page.evaluate(async()=>{
   const owner=JSON.stringify([location.origin,'2']),encoded=encodeURIComponent(owner),database='chunklab-idb-'+encoded;
   localStorage.setItem('chunklab.storage-owner.v1',JSON.stringify([location.origin,'27']));
   localStorage.setItem('chunklab.account.'+encoded+'.chunklab.v1',JSON.stringify({mem:{decks:[{id:'account-2-local-course'}]}}));
   await new Promise((resolve,reject)=>{const req=indexedDB.open(database,9);req.onupgradeneeded=()=>{for(const [name,keyPath] of Object.entries({courses:'courseId',progress:'cid',sentenceStats:'key',events:'id',syncIntents:'key',syncMeta:'key',pendingOperations:'requestId',assessmentDrafts:'sessionId',navigationHandoffs:'id'}))req.result.createObjectStore(name,{keyPath});};req.onsuccess=()=>{const db=req.result,tx=db.transaction(['progress','syncMeta','pendingOperations'],'readwrite');tx.objectStore('progress').put({cid:'account-2-course:sentence-1',idx:1});tx.objectStore('syncMeta').put({key:'server-cache-v3',owner,scope:JSON.stringify([location.origin,owner,3]),appliedSeq:3,snapshot:{mem:{decks:[{id:'account-2-local-course'}],stats:{}},courseProgress:{}}});tx.oncomplete=()=>{db.close();resolve();};tx.onabort=tx.onerror=()=>reject(tx.error||Error('account 2 cache fixture failed'));};req.onerror=()=>reject(req.error);});
  });
  const account2=await page.evaluate(()=>BrowserConfirmationRepair.preview());
  assert.equal(account2.uid,'2');assert.equal(account2.localSeq,3);assert.equal(account2.serverSeq,2);assert.equal(account2.format,'legacy-v1');assert.equal(account2.canApply,true);
  const account2Backup=await page.evaluate(id=>BrowserConfirmationRepair.exportAndVerify(id),account2.id);
  assert.equal(account2Backup.name,'verified-backup.json');
  const account2Result=await page.evaluate(id=>BrowserConfirmationRepair.apply(id),account2.id);
  assert.equal(account2Result.previousSeq,3);assert.equal(account2Result.confirmedSeq,2);
  const account2After=await page.evaluate(()=>new Promise((resolve,reject)=>{
   const owner=JSON.stringify([location.origin,'2']),encoded=encodeURIComponent(owner),revision=localStorage.getItem('chunklab.restore.active.'+encoded),
    newName='chunklab-idb-'+encoded+'-restore-'+revision,oldName='chunklab-idb-'+encoded;
   const read=(name,stores)=>new Promise((done,fail)=>{const req=indexedDB.open(name);req.onsuccess=()=>{const db=req.result,tx=db.transaction(stores,'readonly'),result={};for(const store of stores){if(store==='syncMeta'){tx.objectStore(store).get('server-cache-v3').onsuccess=e=>{result.cache=e.target.result;};}else tx.objectStore(store).count().onsuccess=e=>{result[store]=e.target.result;};}tx.oncomplete=()=>{db.close();done(result);};tx.onerror=()=>fail(tx.error);};req.onerror=()=>fail(req.error);});
   Promise.all([read(newName,['syncMeta','courses','progress']),read(oldName,['syncMeta','progress'])]).then(([active,old])=>resolve({revision,activeSeq:active.cache.appliedSeq,activeCourse:active.cache.snapshot.mem.decks[0].id,activeCourses:active.courses,activeProgress:active.progress,oldSeq:old.cache.appliedSeq,oldProgress:old.progress,oldLocal:localStorage.getItem('chunklab.account.'+encoded+'.chunklab.v1')}),reject);
  }));
  assert.ok(account2After.revision);assert.equal(account2After.activeSeq,2);assert.equal(account2After.activeCourse,'server-course');
  assert.equal(account2After.activeCourses,0);assert.equal(account2After.activeProgress,0);
  assert.equal(account2After.oldSeq,3);assert.equal(account2After.oldProgress,1);assert.match(account2After.oldLocal,/account-2-local-course/);
  const account27StillIntact=await page.evaluate(()=>new Promise((resolve,reject)=>{const req=indexedDB.open('chunklab-idb');req.onsuccess=()=>{const db=req.result,tx=db.transaction('syncMeta','readonly');tx.objectStore('syncMeta').get('server-cache-v3').onsuccess=e=>resolve({owner:e.target.result.owner,seq:e.target.result.appliedSeq,course:e.target.result.snapshot.mem.decks[0].id});tx.oncomplete=()=>db.close();tx.onerror=()=>reject(tx.error);};req.onerror=()=>reject(req.error);}));
  assert.deepEqual(account27StillIntact,{owner:JSON.stringify(['http://127.0.0.1:9879','27']),seq:261,course:'irreplaceable-original'},'account 2 recovery must not mutate account 27 partition');
  console.log('Partition repair passes: legacy and references caches, explicit preview, response identity, verified backup, queue guard, concurrency fingerprint and old partition preservation.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
