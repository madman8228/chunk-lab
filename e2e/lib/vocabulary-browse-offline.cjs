'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{chromium}=require('playwright-core');
module.exports=async function verifyOffline({browser,url,token,root,appRoot,plan}){
 const source=fs.readFileSync(path.join(root,'sw.js'),'utf8'),atomic=source.match(/const PRECACHE = \[([\s\S]*?)\];/);
 assert.ok(atomic,'use the real atomic service worker bundle');
 for(const relative of ['sw.js',...Array.from(atomic[1].matchAll(/'([^']+)'/g),match=>match[1].replace(/^\//,''))]){
  const input=path.resolve(root,relative),output=path.resolve(appRoot,relative);assert.ok(input.startsWith(root+path.sep)&&output.startsWith(appRoot+path.sep));
  if(!fs.existsSync(output)){fs.mkdirSync(path.dirname(output),{recursive:true});fs.copyFileSync(input,output,fs.constants.COPYFILE_EXCL);}
 }
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'browse-offline-profile-'));
 let context=await chromium.launchPersistentContext(profile,{headless:true,serviceWorkers:'allow'});
 async function instrument(){await context.addInitScript(()=>{window.offlineAudioPlays=0;const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){this.addEventListener('playing',()=>{offlineAudioPlays++;},{once:true});return play.apply(this,args);};speechSynthesis.speak=()=>{throw Error('No synthetic voice fallback');};});}
 try{
  await instrument();
  await context.addInitScript(token=>{if(!localStorage.getItem('offline-fixture-seeded')){localStorage.setItem('chunklab_token',token);localStorage.setItem('offline-fixture-seeded','yes');}},token);
  let page=await context.newPage();await page.goto(url);await page.locator('.intro-target').waitFor();
  await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await page.reload();await page.locator('.intro-target').waitFor();
  async function drained(){const end=Date.now()+15000;while(Date.now()<end){if(!(await page.evaluate(()=>ServerStore.pending())).length)return;await new Promise(resolve=>setTimeout(resolve,75));}throw Error('offline setup queue did not drain');}
  async function playSample(){const before=await page.evaluate(()=>offlineAudioPlays);await page.getByRole('button',{name:'听示范',exact:true}).click();await page.waitForFunction(before=>offlineAudioPlays>before,before);}
  await page.locator('.intro-directory summary').click();await page.getByRole('button',{name:'pen · 认识词',exact:true}).click();await page.getByRole('heading',{name:'认识词',exact:true}).waitFor();await drained();
  await playSample();
  await page.getByRole('button',{name:'继续',exact:true}).click();await page.getByRole('heading',{name:'理解短语',exact:true}).waitFor();await drained();
  await playSample();
  await page.getByRole('button',{name:'上一步',exact:true}).click();await page.getByRole('heading',{name:'认识词',exact:true}).waitFor();await drained();
  await page.locator('.wordbook-exercise img').evaluate(image=>image.decode());const deliveredImageUrl=await page.locator('.wordbook-exercise img').evaluate(async image=>(await fetch(image.src)).url);
  assert.match(new URL(deliveredImageUrl).pathname,/^\/_vocab-images\/[a-f0-9]{64}\.webp$/);
  const projected=await page.evaluate(plan=>ChunkAPI.request('/api/wordbooks/'+encodeURIComponent(plan.bookId)+'/teaching-step?planRevision='+plan.revision+'&stepId='+encodeURIComponent(plan.steps[0].stepId)),plan),{contentRevision,...itemBody}=projected.item;
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(itemBody)).digest('hex'),contentRevision);assert.match(projected.item.images.wide[0],/^assets\//);assert.equal(projected.deliveryImages.wide[0],projected.deliveryImages.mobile[0]);
  await context.setOffline(true);await page.getByRole('button',{name:'继续',exact:true}).click();await page.getByRole('heading',{name:'理解短语',exact:true}).waitFor();
  const before=await page.evaluate(()=>ServerStore.pending());assert.equal(before.length,1);
  await context.close();context=await chromium.launchPersistentContext(profile,{headless:true,serviceWorkers:'allow',offline:true});await instrument();page=await context.newPage();await page.goto(url,{waitUntil:'domcontentloaded'});
  try{await page.waitForFunction(()=>document.querySelector('.intro-target')?.textContent==='a pen',null,{timeout:8000});}
  catch(error){const evidence=await page.evaluate(async()=>({online:navigator.onLine,config:CL.getCloudConfig(),state:CL.getPersistenceState?.(),cache:await ServerCache.read().then(row=>row&&({appliedSeq:row.appliedSeq,seq:row.snapshot?.seq,mem:!!row.snapshot?.mem})),bootstrap:LearningSessionBootstrap.ready.toString().includes('allowConfirmedOffline')}));throw Error('OFFLINE_REOPEN_FAILED: '+JSON.stringify(evidence)+' '+await page.locator('body').innerText());}
  assert.deepEqual((await page.evaluate(()=>ServerStore.pending())).map(row=>row.operation),before.map(row=>row.operation));
  await page.locator('.wordbook-exercise img').evaluate(image=>image.decode());const cachedImageDecoded=true;assert.equal(await page.evaluate(()=>offlineAudioPlays),0);await playSample();
  assert.equal(await page.evaluate(()=>CL.serverPersistenceReady()),false,'offline cached read must not open network sending');
  await page.locator('.intro-directory summary').click();await page.getByRole('button',{name:'book · 认识词',exact:true}).click();await page.locator('#introError').getByText(/当前步骤尚未离线缓存/).waitFor();assert.equal(await page.locator('.intro-target').innerText(),'a pen');
  assert.deepEqual((await page.evaluate(()=>ServerStore.pending())).map(row=>row.operation),before.map(row=>row.operation),'missing content must not enqueue a jump');
  await context.setOffline(false);await drained();
  const confirmed=await page.evaluate(async()=>{const params=new URLSearchParams(location.search);return ChunkAPI.request('/api/wordbooks/'+encodeURIComponent(params.get('book'))+'/browse-state?planRevision='+params.get('plan'));});
  assert.equal(confirmed.resume.requestId,before[0].requestId);assert.equal(confirmed.resume.stepId,before[0].operation.payload.targetStepId);
  async function visit(step){if(!(await page.locator('.intro-directory').evaluate(menu=>menu.open)))await page.locator('.intro-directory summary').click();await page.getByRole('button',{name:step.presentation.text+' · '+step.presentation.title,exact:true}).click();await page.waitForFunction(text=>document.querySelector('.intro-target')?.textContent===text,step.presentation.text);await page.locator('.wordbook-exercise img').evaluate(image=>image.decode());await playSample();}
  // Explicit user-like visits, never a whole-library preload.
  for(const step of plan.steps){await visit(step);await drained();}
  await context.close();context=await chromium.launchPersistentContext(profile,{headless:true,serviceWorkers:'allow',offline:true});await instrument();page=await context.newPage();await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('.intro-target').waitFor();assert.equal(await page.evaluate(()=>offlineAudioPlays),0);
  for(const step of plan.steps)await visit(step);
  const fullPlanPending=await page.evaluate(()=>ServerStore.pending());assert.equal(fullPlanPending.length,plan.steps.length);assert.equal(await page.evaluate(()=>CL.serverPersistenceReady()),false);
  await context.setOffline(false);await drained();const finalResume=await page.evaluate(async()=>{const params=new URLSearchParams(location.search);return ChunkAPI.request('/api/wordbooks/'+encodeURIComponent(params.get('book'))+'/browse-state?planRevision='+params.get('plan'));});assert.equal(finalResume.resume.requestId,fullPlanPending.at(-1).requestId);
  for(const status of [403,503]){
   await page.route('**/api/config',route=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({error:'isolated explicit HTTP rejection'})}));await page.reload();await page.locator('#introError').getByText(/学习记录尚未确认/).waitFor();assert.equal(await page.evaluate(()=>CL.serverPersistenceReady()),false);assert.equal(await page.locator('.intro-target').count(),0);await page.unroute('**/api/config');
  }
  await page.route('**/api/config',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'isolated expired session'})}));await page.reload();await page.waitForFunction(()=>!localStorage.getItem('chunklab_token'));assert.equal(await page.locator('.intro-target').count(),0);
  return {realServiceWorker:true,closedDocument:true,cachedStepReopened:true,originalPendingRetained:true,missingStepNoEnqueue:true,networkGateStayedClosed:true,reconnectedExactRequest:true,httpRejectionNotOffline:true,cachedImageDecoded,visitedAudioOfflinePlayed:true,noAutomaticPlayback:true,itemRevisionUnchanged:true,fullMediaOfflineVerified:true,verifiedVisitedPlanSteps:plan.steps.length,mediaScope:'explicitly visited pilot plan only',fullBrowserRestartVerified:true};
 }finally{await context.close();assert.equal(path.dirname(fs.realpathSync(profile)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(profile).startsWith('browse-offline-profile-'));fs.rmSync(profile,{recursive:true,force:true});}
};
