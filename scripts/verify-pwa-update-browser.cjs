'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const express=require('../server/node_modules/express'),{chromium}=require('playwright-core');
(async()=>{
 const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));assert.ok(path.isAbsolute(root));
 const current=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 // A synthetic earlier release keeps this test independent of local Git history.
 let worker=current.replace(/const CACHE = '[^']+'/,"const CACHE = 'chunklab-update-test-old'");
 const app=express();app.get('/sw.js',(_,res)=>res.set('Cache-Control','no-store').type('js').send(worker));
 app.get('/verify.html',(_,res)=>res.type('html').send('<!doctype html><title>Update verification</title><img src="/assets/covers/oral-3000.webp"><img src="/assets/covers/idioms.webp">'));
 app.use(express.static(root));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 let browser;
 try{
  browser=await chromium.launch({headless:true});const context=await browser.newContext({serviceWorkers:'allow'});let page=await context.newPage();const base='http://127.0.0.1:'+server.address().port;
  await page.goto(base+'/verify.html');await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await page.reload();await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
  const old=await page.evaluate(()=>caches.keys());worker=current;
  await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
  await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();if(r.waiting)return;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('update did not become ready')),15000);function check(){if(r.waiting){clearTimeout(timer);resolve();}}if(r.installing)r.installing.addEventListener('statechange',check);r.addEventListener('updatefound',()=>r.installing?.addEventListener('statechange',check));check();});});
  assert.deepEqual(await page.evaluate(()=>navigator.serviceWorker.controller.state),'activated');
  // Legacy pages only reload: prove that this does not activate a waiting update.
  await page.reload();
  assert.ok(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting),'legacy reload leaves the update waiting');
  // Closing every controlled tab is the browser-native legacy upgrade path.
  await page.close();
  const reopened=await context.newPage();await reopened.goto(base+'/verify.html');
  await reopened.waitForFunction(async()=>!(await navigator.serviceWorker.getRegistration()).waiting);
  assert.ok(!(await reopened.evaluate(()=>caches.keys())).includes('chunklab-update-test-old'),'closing old tabs activates the complete new bundle');
  await reopened.close();
  // A later release exercises the explicit activation protocol used by new pages.
  const replacement=await context.newPage();await replacement.goto(base+'/verify.html');
  worker=current.replace(/const CACHE = '[^']+'/,"const CACHE = 'chunklab-update-test-next'");
  await replacement.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
  await replacement.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();if(r.waiting)return;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('next update did not become ready')),15000);function check(){if(r.waiting){clearTimeout(timer);resolve();}}if(r.installing)r.installing.addEventListener('statechange',check);r.addEventListener('updatefound',()=>r.installing?.addEventListener('statechange',check));check();});});
  // Continue the existing assertions on the replacement tab.
  page=replacement;
  await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await new Promise(resolve=>{navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true});r.waiting.postMessage({type:'ACTIVATE_UPDATE'});});});
  await page.reload();await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
  await page.goto(base+'/decks.html?courseView=discover&course=builtin%3Aoral');assert.match(await page.title(),/课程管理/);
  await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});assert.match(await page.title(),/课程管理/);
  await page.goto(base+'/verify.html');await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
  assert.equal(await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>i.naturalWidth>0).length),2);
  console.log(JSON.stringify({isolated:true,oldVersion:old,updateWaited:true,activatedOnRequest:true,offlineCoursePageReload:true,bothOriginalCoversOffline:true}));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
