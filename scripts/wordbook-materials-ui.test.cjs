'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
const library=JSON.parse(fs.readFileSync('drafts/scene-wordbooks/borrow-things-v1/material-library-v1.json','utf8'));
const course=library.courses[0],senses=new Map(library.senses.map(sense=>[sense.senseId,sense]));
const fixture={bookId:'fixture',revision:'v1',units:[{unitId:course.units[0].unitId,materials:library.applications.map(material=>({...material,lines:material.lines.map(line=>({...line,targets:line.senseRefs.map(ref=>senses.get(ref.senseId))}))}))}]};
(async()=>{const browser=await chromium.launch({headless:true});try{
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const html=fs.readFileSync('wordbook-details.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'');
 await page.route('**/*',route=>route.request().isNavigationRequest()?route.fulfill({body:html,contentType:'text/html'}):route.abort());
 await page.goto('http://127.0.0.1:9979/wordbook-details.html?book=fixture');
 for(const file of ['landing/theme.css','assets/learning-workspace.css','assets/learning-sky.css','assets/wordbook-details.css'])await page.addStyleTag({path:file});await page.addScriptTag({path:'js/learning-sky.js'});
 await page.evaluate(fixture=>{
  window.fixture=fixture;window.requests=[];window.failMaterials=true;window.stale=false;window.currentRevision='v1';
  window.ChunkAPI={request:async(url,options)=>{requests.push({url,options});if(url.endsWith('/details'))return {bookId:'fixture',revision:currentRevision,title:'借东西 · 隔离阅读夹具',itemCount:6,materialKinds:['dialogue','reading'],units:[{unitId:fixture.units[0].unitId,title:'借用日常物品',itemCount:6}]};if(failMaterials)throw Error('隔离读取失败');return {...fixture,revision:stale?'old':currentRevision};}};
 },fixture);
 await page.addScriptTag({path:'landing/wordbook-details.js'});await page.getByRole('heading',{name:'单元目录',exact:true}).waitFor();assert.equal((await page.evaluate(()=>requests)).length,1);
 await page.getByRole('button',{name:'对话',exact:true}).click();await page.getByRole('button',{name:'重试读取材料'}).waitFor();
 await page.evaluate(()=>{failMaterials=false;stale=true;});await page.getByRole('button',{name:'重试读取材料'}).click();await page.getByText(/课程材料版本已变化/).waitFor();
 await page.getByRole('button',{name:'重新读取单词本',exact:true}).waitFor();
 await page.evaluate(()=>{stale=false;currentRevision='v2';});await page.getByRole('button',{name:'重新读取单词本',exact:true}).click();await page.getByRole('heading',{name:'单元目录',exact:true}).waitFor();
 await page.getByRole('button',{name:'对话',exact:true}).click();await page.getByRole('heading',{name:'对话',exact:true}).waitFor();assert.equal(await page.evaluate(()=>currentRevision),'v2','recover after a permanent revision upgrade');
 assert.equal(await page.locator('.book-material').count(),2);assert.ok(await page.locator('mark').count()>0);assert.equal(await page.locator('.book-material details[open]').count(),0);
 const translation=page.locator('.book-material summary').first();await translation.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.book-material details[open]').count(),1,'native translation works by keyboard');
 const count=(await page.evaluate(()=>requests)).length;await page.getByRole('button',{name:'短文',exact:true}).click();await page.getByRole('heading',{name:'短文',exact:true}).waitFor();assert.equal(await page.locator('.book-material').count(),1);assert.equal((await page.evaluate(()=>requests)).length,count,'reuse only confirmed versioned material cache');
 fs.mkdirSync('output/playwright/wordbook-materials',{recursive:true});
 for(const width of [1440,390]){await page.setViewportSize({width,height:932});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join('output/playwright/wordbook-materials','reading-'+width+'.png'),fullPage:true});}
 await page.getByRole('button',{name:'单元目录',exact:true}).click();await page.getByRole('heading',{name:'单元目录',exact:true}).waitFor();
 assert.ok((await page.evaluate(()=>requests)).every(request=>!request.options.method),'reading never writes completion/session events');
 await page.evaluate(()=>dispatchEvent(new StorageEvent('storage',{key:'chunklab_token'})));await page.getByRole('button',{name:'重新读取',exact:true}).waitFor();assert.equal(await page.locator('.book-material').count(),0);
 assert.deepEqual(errors,[]);await context.close();console.log('Wordbook material UI: lazy reads, failure/retry, version rejection, cached forms, bilingual keyboard reading, responsive layouts and account invalidation passed.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
