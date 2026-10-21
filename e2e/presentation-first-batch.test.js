'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'chunk-presentation-'));
const port=require('./lib/free-port').freePort(15600,150),base='http://127.0.0.1:'+port;
const child=spawn(process.execPath,['server/index.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:String(port),CHUNKLAB_DATA_DIR:dir,REQUIRE_AUTH:'true',PHONE_AUTH_ENABLED:'false',NODE_ENV:'test',JWT_SECRET:'isolated-presentation-fixture-key-123456789'},stdio:'ignore'});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){let browser;
 try{
  let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/health')).ok;if(ready)break;}catch(_){}await delay(100);}assert.ok(ready);
  const response=await fetch(base+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'presentation-fixture',password:'Presentation123!'})});assert.equal(response.status,200);
  const session=await response.json();browser=await chromium.launch({headless:true});
  const output=path.join(root,'output/playwright/presentation-first-batch');fs.mkdirSync(output,{recursive:true});
  for(const width of [1041,390]){
   const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:932}}),page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));await context.addInitScript(token=>localStorage.setItem('chunklab_token',token),session.token);
   await page.goto(base+'/main.html?view=home');await page.waitForFunction(()=>document.querySelector('#homeBody .learning-workspace:not([aria-busy])'));
   const facetResource=await page.evaluate(()=>LearningWorkspace.resourcesFromCatalog(createHomeCourseLookup().getCatalog())[0]);assert.ok(facetResource);
   let releaseDirectory;const directoryGate=new Promise(resolve=>releaseDirectory=resolve);
   await page.route('**/api/library',async route=>{await directoryGate;const response=await route.fetch(),data=await response.json();data.resources=[{...facetResource,visibility:'public',facets:{...facetResource.facets,levels:['A1']}}];await route.fulfill({response,json:data});});
   await page.getByRole('link',{name:'发现',exact:true}).click();await page.locator('#discoverBody .workspace-loading').waitFor();
   assert.equal(await page.locator('#discoverBody .workspace-card,#discoverBody .discover-empty').count(),0);
   await page.screenshot({path:path.join(output,'discovery-loading-'+width+'.png')});
   // Switch routes before a slow response returns: stale discovery must not win.
   await page.getByRole('link',{name:'我的内容',exact:true}).click();releaseDirectory();
   await page.waitForFunction(()=>document.querySelector('#myLearningBody .learning-workspace:not([aria-busy])'));
   assert.match(page.url(),/view=my-learning/);
   await page.getByRole('link',{name:'发现',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#discoverBody .learning-workspace:not([aria-busy])'));
   const search=page.getByRole('searchbox',{name:'搜索内容',exact:true});await search.fill('English');
   await search.evaluate(el=>{el.focus();el.setSelectionRange(2,5);window.originalSearch=el;el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));});
   await page.evaluate(()=>workspace().refresh());
   assert.equal(await search.evaluate(el=>el===window.originalSearch),true,'IME target survives asynchronous refresh '+JSON.stringify(await page.evaluate(()=>({route:location.search,painted:document.querySelector('#discoverBody .learning-workspace').dataset.route,connected:originalSearch.isConnected}))));
   await search.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));
   await page.waitForFunction(()=>document.querySelector('[data-focus-key="discover-search"]').value==='English');
   assert.deepEqual(await search.evaluate(el=>[el.selectionStart,el.selectionEnd]),[2,5]);
   if(width===390){
    await search.fill('');
    const filters=page.getByRole('button',{name:'筛选内容',exact:true});
    assert.equal(await filters.count(),1,'fixture exercises the real mobile filter dialog');
     await filters.click();await page.evaluate(()=>workspace().refresh());
     assert.equal(await page.getByRole('dialog').isVisible(),true,'background refresh does not close filter dialog');
     await page.keyboard.press('Escape');
     await page.waitForFunction(()=>document.activeElement?.dataset.focusKey==='discover-filters');
   }
   let releaseArchive;const archiveGate=new Promise(resolve=>releaseArchive=resolve);
   await page.route('**/api/learning-archive/vocabulary/**',async route=>{await archiveGate;await route.continue();});
   await page.goto(base+'/stats.html');await page.locator('.archive-initial-loading').waitFor();
   assert.equal(await page.locator('#statsVocabulary').isVisible(),false,'initial sentence and vocabulary sections publish together');
   await page.screenshot({path:path.join(output,'archive-loading-'+width+'.png')});
   releaseArchive();await page.waitForFunction(()=>document.querySelector('#statsContent[aria-busy="false"]')&&!document.querySelector('.archive-initial-loading'));
   await page.getByText('单词本学习',{exact:true}).waitFor();
   await page.screenshot({path:path.join(output,'archive-ready-'+width+'.png'),fullPage:true});
   await page.getByRole('button',{name:'明细',exact:true}).click();
   const archiveSearch=page.getByRole('searchbox',{name:'搜索句子或翻译',exact:true});await archiveSearch.fill('borrow');
   await archiveSearch.evaluate(el=>{el.focus();el.setSelectionRange(1,3);el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));});
   await page.evaluate(()=>renderStats());
   await archiveSearch.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));
   assert.deepEqual(await archiveSearch.evaluate(el=>[el.value,el.selectionStart,el.selectionEnd]),['borrow',1,3]);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.deepEqual(errors,[]);await context.close();
   console.log('presentation '+width+': route race, slow loading, IME/caret, filter dialog, archive ready passed');
  }
 }finally{if(browser)await browser.close();child.kill();await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));if(path.dirname(dir)===os.tmpdir()&&path.basename(dir).startsWith('chunk-presentation-'))fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
