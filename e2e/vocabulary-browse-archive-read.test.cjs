'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright-core');

(async()=>{
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated archive read test</title>'}));
  const page=await context.newPage();
  await page.goto('http://archive-read.invalid/');
  await page.evaluate(()=>{
   window.AccountStorage={owner:'test-owner',databaseName:'disposable-archive-read',assertCurrent(){}};
  });
  await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../js/idb.js'),'utf8')});
  const result=await page.evaluate(async()=>{
   const prefix='vocabulary-browse-conflict:test-owner:';
   const row={key:prefix+'one',format:'vocabulary-browse-conflict-archive',schemaVersion:1,owner:'test-owner',scope:'test-server',bookId:'test-book',rows:[{requestId:'original',operation:{payload:{stepId:'pen:phrase'}}}]};
   const variants=[row,{...row,key:prefix+'other-owner',owner:'other-owner'},{...row,key:prefix+'other-server',scope:'other-server'},{...row,key:prefix+'future-version',schemaVersion:2},{...row,key:prefix+'wrong-format',format:'unrelated'}];
   const db=await IDBStore.open();
   async function writeRows(){await new Promise((resolve,reject)=>{const tx=db.transaction('syncMeta','readwrite');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);variants.forEach(value=>tx.objectStore('syncMeta').put(value));});}
   async function allRows(){return new Promise((resolve,reject)=>{const tx=db.transaction('syncMeta','readonly'),request=tx.objectStore('syncMeta').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
   await writeRows();const before=await allRows();
   const read=key=>IDBStore.readVocabularyBrowseConflictArchive({owner:'test-owner',scope:'test-server',key});
   const actual=await read(row.key);
   const hidden=[];for(const suffix of ['other-owner','other-server','future-version','wrong-format','missing'])hidden.push(await read(prefix+suffix));
   let wrongKey=false;try{await read('vocabulary-browse-conflict:other-owner:one');}catch{wrongKey=true;}
   let changedBefore=false;AccountStorage.owner='other-owner';try{await read(row.key);}catch{changedBefore=true;}AccountStorage.owner='test-owner';
   const originalGet=IDBObjectStore.prototype.get;
   IDBObjectStore.prototype.get=function(...args){const request=originalGet.apply(this,args);if(this.name==='syncMeta')request.addEventListener('success',()=>{AccountStorage.owner='other-owner';},{once:true});return request;};
   let changedDuring=false;try{await read(row.key);}catch{changedDuring=true;}finally{IDBObjectStore.prototype.get=originalGet;AccountStorage.owner='test-owner';}
   return {row,actual,hidden,wrongKey,changedBefore,changedDuring,before,after:await allRows()};
  });
  assert.deepEqual(result.actual,result.row);
  assert.deepEqual(result.hidden,[null,null,null,null,null]);
  assert.equal(result.wrongKey,true);assert.equal(result.changedBefore,true);assert.equal(result.changedDuring,true);
  assert.deepEqual(result.after,result.before,'archive reads must not mutate any stored row');
  const recovery=await page.evaluate(async()=>{
   const db=await IDBStore.open(),revision='a'.repeat(64),scope='test-server',owner='test-owner';
   const first={requestId:'conflict-first',owner,scope,ordinal:1,status:'blocked',lastError:'RESUME_CONFLICT',operation:{type:'vocabulary.browse',payload:{bookId:'test-book',planRevision:revision,stepId:'one'}}};
   const second={requestId:'conflict-second',owner,scope,ordinal:2,status:'pending',operation:{type:'vocabulary.browse',payload:{bookId:'test-book',planRevision:revision,stepId:'two',afterRequestId:first.requestId}}};
   await new Promise((resolve,reject)=>{const tx=db.transaction('pendingOperations','readwrite');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);for(const row of [first,second])tx.objectStore('pendingOperations').add(row);});
   const selection={confirmed:true,owner,scope,bookId:'test-book',planRevision:revision,requestIds:[first.requestId,second.requestId],choice:'local'};
   const operation={protocol:3,requestId:'new-recovery-request',type:'vocabulary.browse',payload:{bookId:'test-book',bookRevision:'b'.repeat(64),planRevision:revision,action:'jump',stepId:'cloud-step',targetStepId:'local-step',expectedResumeRev:9}};
   const replacement={requestId:operation.requestId,operation,owner,scope,status:'pending',createdAt:Date.now(),bytes:700};
   const original=IDBObjectStore.prototype.add;let rolledBack=false;
   IDBObjectStore.prototype.add=function(row,...args){if(this.name==='pendingOperations'&&row.requestId===replacement.requestId)throw Error('injected replacement failure');return original.call(this,row,...args);};
   try{await IDBStore.archiveVocabularyBrowseConflict(selection,replacement);}catch{rolledBack=true;}finally{IDBObjectStore.prototype.add=original;}
   const pendingAfterFailure=await IDBStore.listPendingOperations(),archiveAfterFailure=await IDBStore.readSyncMeta('vocabulary-browse-conflict:'+owner+':'+first.requestId);
   const archive=await IDBStore.archiveVocabularyBrowseConflict(selection,replacement);
   return {first,second,replacement,archive,rolledBack,pendingAfterFailure,archiveAfterFailure,pendingAfterSuccess:await IDBStore.listPendingOperations()};
  });
  assert.equal(recovery.rolledBack,true);assert.equal(recovery.archiveAfterFailure,null);
  assert.deepEqual(recovery.pendingAfterFailure,[recovery.first,recovery.second]);
  assert.deepEqual(recovery.archive.rows,[recovery.first,recovery.second]);
  assert.equal(recovery.archive.replacementRequestId,recovery.replacement.requestId);
  assert.equal(recovery.pendingAfterSuccess.length,1);assert.deepEqual(recovery.pendingAfterSuccess[0],recovery.replacement);
  assert.equal(recovery.replacement.ordinal,3);
  const history=await page.evaluate(async()=>{
   const db=await IDBStore.open(),prefix='vocabulary-browse-conflict:test-owner:',revision='a'.repeat(64);
   const template={format:'vocabulary-browse-conflict-archive',schemaVersion:1,owner:'test-owner',scope:'test-server',bookId:'history-book',unitId:null,planRevision:revision,choice:'cloud',createdAt:1,rows:[{requestId:'original'}]};
   const added=Array.from({length:5},(_,i)=>({...template,key:prefix+'history-'+i,createdAt:i}));
   for(let i=0;i<201;i++)added.push({...template,key:prefix+'000-scan-'+String(i).padStart(3,'0'),bookId:'unrelated-book'});
   for(const [suffix,changes] of [['owner',{owner:'another-owner'}],['server',{scope:'another-server'}],['book',{bookId:'another-book'}],['unit',{unitId:'unit-two'}],['version',{schemaVersion:2}],['format',{format:'other'}]])added.push({...template,key:prefix+'hidden-'+suffix,...changes});
   await new Promise((resolve,reject)=>{const tx=db.transaction('syncMeta','readwrite');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);for(const row of added)tx.objectStore('syncMeta').add(row);});
   async function all(){return new Promise((resolve,reject)=>{const request=db.transaction('syncMeta','readonly').objectStore('syncMeta').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
   const before=await all(),selection={owner:'test-owner',scope:'test-server',bookId:'history-book',limit:2};
   const found=[],pages=[];let after=null;
   do{const page=await IDBStore.listVocabularyBrowseConflictArchives({...selection,after});pages.push(page);found.push(...page.entries);after=page.nextAfter;}while(after&&pages.length<10);
   let invalidCursor=false;try{await IDBStore.listVocabularyBrowseConflictArchives({...selection,after:'vocabulary-browse-conflict:another-owner:any'});}catch{invalidCursor=true;}
   let invalidLimit=false;try{await IDBStore.listVocabularyBrowseConflictArchives({...selection,limit:51});}catch{invalidLimit=true;}
   let unitPage=await IDBStore.listVocabularyBrowseConflictArchives({...selection,unitId:'unit-two'});
   while(!unitPage.entries.length&&unitPage.nextAfter)unitPage=await IDBStore.listVocabularyBrowseConflictArchives({...selection,unitId:'unit-two',after:unitPage.nextAfter});
   const original=IDBObjectStore.prototype.openCursor;
   IDBObjectStore.prototype.openCursor=function(...args){const request=original.apply(this,args);request.addEventListener('success',()=>{AccountStorage.owner='another-owner';},{once:true});return request;};
   let changedDuring=false;try{await IDBStore.listVocabularyBrowseConflictArchives(selection);}catch{changedDuring=true;}finally{IDBObjectStore.prototype.openCursor=original;AccountStorage.owner='test-owner';}
   return {found,pages,invalidCursor,invalidLimit,unitPage,changedDuring,before,after:await all()};
  });
  assert.equal(history.found.length,5);assert.equal(new Set(history.found.map(row=>row.key)).size,5);assert.ok(history.pages.every(page=>page.entries.length<=2));assert.ok(history.pages.some(page=>page.entries.length===0&&page.nextAfter),'bounded scan can yield an empty continuation page');assert.ok(history.found.every(row=>!Object.hasOwn(row,'rows')&&row.rowCount===1));
  assert.equal(history.invalidCursor,true);assert.equal(history.invalidLimit,true);assert.equal(history.changedDuring,true);assert.equal(history.unitPage.entries.length,1);assert.equal(history.unitPage.entries[0].unitId,'unit-two');assert.deepEqual(history.after,history.before);
  await page.reload();await page.evaluate(()=>{window.AccountStorage={owner:'test-owner',databaseName:'disposable-archive-read',assertCurrent(){}};});
  await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../js/idb.js'),'utf8')});
  const reopened=await page.evaluate(async()=>{
   const entries=[];let after=null;
   do{const result=await IDBStore.listVocabularyBrowseConflictArchives({owner:'test-owner',scope:'test-server',bookId:'history-book',limit:2,after});entries.push(...result.entries);after=result.nextAfter;}while(after);
   const archive=await IDBStore.readVocabularyBrowseConflictArchive({owner:'test-owner',scope:'test-server',key:entries[0].key});
   return {entries,archive};
  });
  assert.deepEqual(reopened.entries,history.found);assert.equal(reopened.archive.rows[0].requestId,'original');
  await context.close();
  console.log('Vocabulary browse archive passed: scoped paged history across reload, identity races, atomic replacement and rollback');
 }finally{if(browser)await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
