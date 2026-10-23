'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
(async()=>{
 const instance=await require('../scripts/serve-wordbook-acceptance.cjs').createAcceptance(0),profile=fs.mkdtempSync(path.join(os.tmpdir(),'vocabulary-unit-offline-'));let context;
 try{
  const draft=structuredClone(instance.draft);draft.book.bookId='offline-unit-test';draft.book.units=[{unitId:'offline-unit-one',title:'第一单元'},{unitId:'offline-unit-two',title:'第二单元'}];
  draft.items.forEach((item,index)=>{item.unitId=draft.book.units[index<3?0:1].unitId;delete item.guidedSteps;});
  const candidate=await require('../js/wordbook-draft').compile(draft),book=candidate.index.books[0];
  const vocabulary=path.join(instance.appRoot,'content/vocabulary');fs.mkdirSync(path.join(vocabulary,'items'),{recursive:true});fs.writeFileSync(path.join(vocabulary,'index.json'),JSON.stringify(candidate.index));
  for(const item of candidate.items)fs.writeFileSync(path.join(vocabulary,'items',item.itemId.replace(/:/g,'_')+'.json'),JSON.stringify(item));
  const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8'),precache=worker.match(/const PRECACHE = \[([\s\S]*?)\];/);assert.ok(precache);
  for(const relative of ['sw.js',...Array.from(precache[1].matchAll(/'([^']+)'/g),match=>match[1].replace(/^\//,''))]){const to=path.resolve(instance.appRoot,relative);assert.ok(to.startsWith(instance.appRoot+path.sep));if(!fs.existsSync(to)){fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(root,relative),to,fs.constants.COPYFILE_EXCL);}}
  await instance.restartBackend();
  const url=instance.base+'/wordbook.html?book='+book.bookId+'&unit='+book.units[0].unitId+'&structureRevision='+book.structureRevision;
  const route='/api/wordbooks/'+book.bookId+'/state?unitId='+book.units[0].unitId+'&structureRevision='+book.structureRevision;
  context=await chromium.launchPersistentContext(profile,{headless:true,serviceWorkers:'allow'});
  await context.addInitScript(token=>localStorage.setItem('chunklab_token',token),instance.learnerToken);
  let page=await context.newPage();await page.goto(url);await page.locator('.cloze-blank').first().waitFor();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await page.reload();await page.locator('.cloze-blank').first().waitFor();
  await page.locator('.wordbook-exercise img').evaluate(image=>image.decode());
  const clip=candidate.items[0].learning.sentenceAudio.audio;
  const audioDigest=async()=>page.evaluate(async clip=>{const response=await fetch(clip.url);if(!response.ok)throw Error('audio unavailable');const bytes=await response.arrayBuffer();return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(byte=>byte.toString(16).padStart(2,'0')).join('');},clip);
  assert.equal(await audioDigest(),clip.sha256);
  await page.evaluate(async({bookId,itemId,clip})=>{
   await LearningWorkspaceStore.word(bookId,itemId,true);
   const original=HTMLMediaElement.prototype.play;let played;HTMLMediaElement.prototype.play=function(){played=this;return Promise.resolve();};
   const voice=VocabularyCourseAudio.create(()=>{});try{voice.setRate(1.5);await voice.play(clip);if(played?.playbackRate!==1.5)throw Error('playback speed was not applied');voice.setRate(0.75);if(played.playbackRate!==0.75)throw Error('current audio speed was not updated');}finally{voice.destroy();HTMLMediaElement.prototype.play=original;}
  },{bookId:book.bookId,itemId:candidate.items[0].itemId,clip});
  let rejectedUpdate=false;await page.route('**/offline-unit*',async intercepted=>{const response=await intercepted.fetch(),value=await response.json();value.items[0].meaning='corrupted update';rejectedUpdate=true;await intercepted.fulfill({response,json:value});});
  await page.reload();await page.locator('.cloze-blank').first().waitFor();await page.waitForFunction(()=>document.getElementById('unitOfflineStatus').textContent.includes('本机'));
  await page.unroute('**/offline-unit*');
  await page.waitForFunction(async()=>(await ServerStore.pending()).length===0);
  await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.locator('.cloze-blank').first().waitFor();
  assert.equal(await page.evaluate(async({bookId,itemId})=>{if(!await LearningWorkspaceStore.word(bookId,itemId))throw Error('favorite did not survive refresh');return LearningWorkspaceStore.word(bookId,itemId,true);},{bookId:book.bookId,itemId:candidate.items[0].itemId}),false);
  await page.locator('.wordbook-exercise img').evaluate(image=>image.decode());assert.equal(await page.getByText('corrupted update',{exact:true}).count(),0);
  const answer=async index=>{const blanks=candidate.items[index].exercise.parts.filter(part=>part.answers);for(let i=0;i<blanks.length;i++)await page.locator('.cloze-blank').nth(i).fill(blanks[i].answers[0]);await page.getByRole('button',{name:'确认',exact:true}).click();await page.locator('.study-next:not([disabled])').waitFor({state:'visible'});};
  await answer(0);const pendingFirst=await page.evaluate(()=>ServerStore.pending());assert.ok(pendingFirst.some(row=>row.operation.type==='vocabulary.complete'));
  await page.locator('.study-next').click();await page.waitForFunction(()=>document.getElementById('bookPosition').textContent==='2 / 3');await answer(1);
  const queued=await page.evaluate(()=>ServerStore.pending());assert.equal(queued.filter(row=>row.operation.type==='vocabulary.complete').length,2);
  const clearedQueue=await page.evaluate(async()=>{
   const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('chunklab-vocabulary-content-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
   const rows=await new Promise(resolve=>{const request=db.transaction('units').objectStore('units').getAll();request.onsuccess=()=>resolve(request.result);});
   const keys=await new Promise(resolve=>{const request=db.transaction('units').objectStore('units').getAllKeys();request.onsuccess=()=>resolve(request.result);});
   await new Promise((resolve,reject)=>{const tx=db.transaction('units','readwrite');tx.objectStore('units').clear();tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
   const pending=await ServerStore.pending();
   await new Promise((resolve,reject)=>{const tx=db.transaction('units','readwrite');rows.forEach((row,index)=>tx.objectStore('units').put(row,keys[index]));tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();return pending;
  });assert.deepEqual(clearedQueue.map(row=>row.operation),queued.map(row=>row.operation),'clearing the disposable course cache preserves exact unsynchronized answers');
  assert.equal((await instance.request(route,instance.learnerToken)).resume.itemId,candidate.items[0].itemId,'offline answers have not reached the server');
  await context.close();context=await chromium.launchPersistentContext(profile,{headless:true,serviceWorkers:'allow',offline:true});page=await context.newPage();await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('.cloze-blank').first().waitFor();
  assert.equal(await page.locator('#bookPosition').innerText(),'3 / 3');assert.deepEqual((await page.evaluate(()=>ServerStore.pending())).map(row=>row.requestId),queued.map(row=>row.requestId));
  assert.equal(await audioDigest(),clip.sha256,'visited audio survives an offline browser restart');
  const otherUnit=url.replace(book.units[0].unitId,book.units[1].unitId);await page.goto(otherUnit,{waitUntil:'domcontentloaded'});try{await page.getByText(/本单元尚未离线保存/).first().waitFor({timeout:5000});}catch(error){throw Error(JSON.stringify({body:await page.locator('body').innerText(),url:page.url(),online:await page.evaluate(()=>navigator.onLine)})+error.message);}assert.equal(await page.locator('.cloze-blank').count(),0);
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('.cloze-blank').first().waitFor();await context.setOffline(false);
  await page.waitForFunction(async()=>(await ServerStore.pending()).length===0,{},{timeout:30000});
  await page.waitForFunction(async route=>{const response=await fetch(route,{headers:{authorization:'Bearer '+localStorage.getItem('chunklab_token')}});if(!response.ok)return false;const value=await response.json();return Object.keys(value.progress).length===2;},route,{timeout:30000});
  let saved;for(let tries=0;tries<100;tries++){saved=await instance.request(route,instance.learnerToken);if(Object.keys(saved.progress).length===2)break;await new Promise(resolve=>setTimeout(resolve,100));}
  assert.equal(saved.resume.itemId,candidate.items[2].itemId,JSON.stringify({saved,queue:await page.evaluate(()=>ServerStore.pending()),persistence:await page.evaluate(()=>({phase:CL.getPersistenceState(),ready:CL.serverPersistenceReady(),body:document.body.innerText}))}));assert.equal(Object.keys(saved.progress).length,2);
  const other=await instance.request(route,instance.otherToken);assert.equal(other.resume,null);assert.deepEqual(other.progress,{});
  await page.reload();await page.locator('.cloze-blank').first().waitFor();assert.equal(await page.locator('#bookPosition').innerText(),'3 / 3');
  const data=await instance.request('/api/data',instance.learnerToken);assert.equal(JSON.stringify(data).includes(candidate.items[0].scene),false);
  const favoriteKey='vocabulary-item:'+JSON.stringify([book.bookId,candidate.items[0].itemId]);assert.equal(data.mem.learningWorkspace[favoriteKey].selected,false);
  const otherData=await instance.request('/api/data',instance.otherToken);assert.equal(otherData.mem.learningWorkspace[favoriteKey],undefined);
  assert.ok(rejectedUpdate);assert.equal(saved.progress[candidate.items[0].itemId].assistedCompletions,1);assert.equal(saved.progress[candidate.items[1].itemId].assistedCompletions,1);
  const report={isolated:true,realServiceWorker:true,automaticWorkerRegistration:true,wholeUnitText:true,offlineRefresh:true,twoOfflineAnswers:true,browserRestart:true,queueRetained:true,courseCacheClearPreservesPendingAnswers:true,uncachedUnitExplicit:true,automaticReconnect:true,accountIsolation:true,learningDataContainsNoCourseBody:true,cachedImageDecoded:true,cachedAudioHashAfterRestart:true,corruptUpdatePreservesPrevious:true,noDuplicateCompletions:true};
  fs.mkdirSync(path.join(root,'output/playwright'),{recursive:true});fs.writeFileSync(path.join(root,'output/playwright/vocabulary-unit-offline-'+Date.now()+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await context?.close();await instance.close();assert.equal(path.dirname(profile),os.tmpdir());assert.ok(path.basename(profile).startsWith('vocabulary-unit-offline-'));fs.rmSync(profile,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
