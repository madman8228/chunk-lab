'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
 await page.route('http://127.0.0.1:9978/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));await page.goto('http://127.0.0.1:9978/');
 await page.evaluate(()=>{window.AccountStorage={assertCurrent(){}};window.LearningSessionBootstrap={identity:()=> 'isolated-boundary'};window.ChunkAPI={getBase:()=>'',request:async()=>structuredClone(window.nextUnit)};});
 await page.addScriptTag({path:'js/vocabulary-unit-cache.js'});
 const result=await page.evaluate(async()=>{
  const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(v=>v.toString(16).padStart(2,'0')).join('');
  async function pack(label){const body={itemId:'test-word',word:'book',meaning:label,scene:'fixture',images:{wide:['assets/never-downloaded.webp']},exercise:{parts:[{text:'a '},{id:'blank1',answers:['book']}]}};const item={...body,contentRevision:await hash(body)},bundle={schemaVersion:1,bookId:'boundary-book',unitId:'one',structureRevision:'structure',revision:await hash([item.contentRevision]),title:'Boundary unit',items:[item],features:{}};return {...bundle,fingerprint:await hash(bundle)};}
  const old=await pack('old'),newer=await pack('new'),options={bookId:'boundary-book',unitId:'one',structureRevision:'structure'},status=[];
  const open=()=>VocabularyUnitCache.create({...options,onStatus:text=>status.push(text)});
  async function until(predicate){for(let i=0;i<100;i++){if(await predicate())return;await new Promise(r=>setTimeout(r,10));}throw Error('background operation did not settle');}
  window.nextUnit=old;const first=await open();if(first.item('test-word',old.items[0].contentRevision).meaning!=='old')throw Error('initial content missing');
  const connection=await new Promise(resolve=>{const r=indexedDB.open('chunklab-vocabulary-content-v1',1);r.onsuccess=()=>resolve(r.result);});
  const read=()=>new Promise(resolve=>{const r=connection.transaction('units').objectStore('units').get(JSON.stringify(['','boundary-book','one','structure']));r.onsuccess=()=>resolve(r.result);});
  window.nextUnit=newer;const pinned=await open();await until(async()=>(await read()).revision===newer.revision);
  if(pinned.revision!==old.revision||pinned.items[0].meaning!=='old')throw Error('background update changed current lesson');
  const reentered=await open();if(reentered.revision!==newer.revision)throw Error('next entry did not switch versions');
  await until(()=>status.filter(text=>text.includes('已保存')).length>=3);
  const originalRequest=ChunkAPI.request;let interrupted=false;ChunkAPI.request=async()=>{interrupted=true;throw new TypeError('Failed to fetch');};const retained=await open();await until(()=>interrupted);if(retained.revision!==newer.revision||(await read()).revision!==newer.revision)throw Error('interrupted download lost previous content');
  ChunkAPI.request=originalRequest;window.nextUnit=old;const originalPut=IDBObjectStore.prototype.put;let quota=false;
  IDBObjectStore.prototype.put=function(...args){if(this.transaction.db.name==='chunklab-vocabulary-content-v1'){quota=true;throw new DOMException('synthetic quota exhausted','QuotaExceededError');}return originalPut.apply(this,args);};
  await open();await until(()=>status.some(text=>text.includes('本机保存失败')));IDBObjectStore.prototype.put=originalPut;
  if(!quota||(await read()).revision!==newer.revision)throw Error('quota failure replaced the old unit');
  const {fingerprint:unused,...renamedBody}=newer;Object.assign(renamedBody,{bookId:'title-alias-test',structureRevision:'renamed-structure',priorStructureRevision:'original-structure',title:'Unit 1 Animal Friends'});
  window.nextUnit={...renamedBody,fingerprint:await hash(renamedBody)};
  const renamed=await VocabularyUnitCache.create({bookId:'title-alias-test',unitId:'one',structureRevision:'original-structure'});
  if(renamed.page().title!=='Unit 1 Animal Friends'||renamed.priorStructureRevision!=='original-structure')throw Error('verified title-only update rejected');
  let rejected=false;try{await VocabularyUnitCache.create({bookId:'title-alias-test',unitId:'one',structureRevision:'unknown-structure'});}catch{rejected=true;}if(!rejected)throw Error('unknown historical structure accepted');
  connection.close();return {versionPinned:true,nextEntrySwitchesVersion:true,interruptedUpdateRetainsOld:true,quotaFailureRetainsOld:true,quotaFailureVisible:true,titleOnlyAlias:true,unknownAliasRejected:true};
 });
 assert.ok(Object.values(result).every(Boolean));
 await page.addScriptTag({path:'landing/vocabulary-course-audio.js'});await page.addScriptTag({path:'landing/listen-word-view.js'});
 await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});const view=VocabularyListenWordView.create({word:'book',meaning:'书',scene:'test',images:{wide:['assets/not-cached.webp']},exercise:{parts:[{text:'a '},{id:'blank1',answers:['book']}]},learning:{sentenceAudio:{audio:{url:'assets/not-cached.ogg',sha256:'0'.repeat(64),bytes:12,mimeType:'audio/ogg'}}}},{autoplay:false});document.body.append(view.element);window.fetch=async()=>{throw new TypeError('Failed to fetch');};});
 await page.getByRole('button',{name:'book，查看图片和释义'}).click();await page.locator('.listen-word-picture img').evaluate(img=>img.dispatchEvent(new Event('error')));
 await page.getByText('图片尚未缓存，联网后可加载。',{exact:true}).waitFor();await page.getByRole('button',{name:'重播整句'}).click();await page.getByText('音频尚未缓存，联网后可播放；可继续文字学习。',{exact:true}).waitFor();assert.ok(await page.locator('.listen-word-sentence').isVisible());
 const report={...result,missingImageExplicit:true,missingAudioExplicit:true,textRemainsUsable:true,isolatedBrowser:true};fs.mkdirSync('output/playwright',{recursive:true});fs.writeFileSync(path.resolve('output/playwright/vocabulary-unit-boundaries-'+Date.now()+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
