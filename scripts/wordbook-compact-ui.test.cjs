'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();const errors=[],imageRequests=[];page.on('pageerror',e=>errors.push(e.message));
  const item=JSON.parse(fs.readFileSync('content/vocabulary/items/pilot-v1_decide.json','utf8'));
  const html=fs.readFileSync('wordbook.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'');
  const out='output/playwright/wordbook-compact';fs.mkdirSync(out,{recursive:true});
  await page.route('**/assets/vocabulary-*',route=>{const file=new URL(route.request().url()).pathname.slice(1);imageRequests.push(file);assert.ok(fs.statSync(file).size<20000,'vocabulary asset size budget');return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.avif')?'image/avif':'image/webp'});});
  await page.route('**/wordbook.html*',route=>route.fulfill({body:html,contentType:'text/html; charset=utf-8'}));
  await page.goto('http://127.0.0.1:9979/wordbook.html?book=pilot-six-v1');
  for(const file of ['landing/theme.css','landing/practice-page.css','assets/learning-workspace.css','assets/learning-sky.css','assets/wordbook-study.css'])await page.addStyleTag({path:file});
  await page.addScriptTag({path:'js/learning-sky.js'});
  await page.addScriptTag({path:'js/notice-banner.js'});
  await page.addStyleTag({path:'assets/learning-navigation.css'});await page.addStyleTag({path:'assets/course-learning-header.css'});
  await page.addScriptTag({path:'js/course-learning-header.js'});await page.addScriptTag({path:'js/learning-navigation.js'});
  await page.evaluate(()=>document.getElementById('wordbookNavigation').replaceWith(LearningNavigation.create()));
  await page.evaluate(item=>{
   window.wordbookImageFixture=item;
   window.LearningSessionBootstrap={identity:()=> 'fixture',ready:async()=>({loggedIn:false})};
   window.ChunkAPI={request:async url=>url.includes('/items')?{title:'人教版英语 九年级全一册（2013） · Unit 1 How can we become good learners?',revision:'fixture',itemCount:6,items:Array.from({length:6},()=>({itemId:item.itemId,contentRevision:item.revision}))}:window.wordbookImageFixture};
  },item);
  for(const file of ['landing/word-dictation-view.js','landing/word-choice-view.js','landing/chunk-order-view.js','landing/read-aloud-view.js','landing/vocabulary-course-audio.js','landing/sentence-cloze-engine.js','landing/sentence-cloze-view.js','landing/guided-sentence-content.js','landing/guided-sentence-view.js','landing/wordbook-study.js'])await page.addScriptTag({path:file});
  await page.locator('#studyRoot input').first().waitFor();
  assert.equal(await page.locator('#bookTitle').textContent(),'人教版英语 九年级全一册（2013）');
  assert.equal(await page.locator('#bookSubtitle').textContent(),'Unit 1 How can we become good learners?');
  assert.equal(await page.getByRole('navigation',{name:'学习导航'}).getByRole('link').count(),4);
  for(const width of [1440,918,390,360]){
   await page.setViewportSize({width,height:932});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no overflow '+width);
   const check=await page.getByRole('button',{name:'确认',exact:true}).boundingBox();
   await page.screenshot({path:path.join(out,'wordbook-'+width+'.png'),fullPage:true});
   assert.ok(check.y+check.height<=932,'confirm visible within first viewport '+width+' '+JSON.stringify(await page.evaluate(()=>({main:getComputedStyle(document.querySelector('main')).cssText,top:document.querySelector('main').getBoundingClientRect().top,bodyMargin:getComputedStyle(document.body).margin,panel:document.querySelector('#studyRoot').getBoundingClientRect().toJSON()}))));
   const image=await page.locator('.wordbook-study img').boundingBox();assert.ok(image.width<=560+1&&image.height<=316,'complete responsive illustration '+width);
   const header=await page.locator('#bookHeader').boundingBox();assert.ok(Math.abs(header.x-image.x)<1,'header and image share a left edge at '+width);
   assert.equal(await page.locator('.wordbook-exercise').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','exercise has no outer card surface');
   await page.screenshot({path:path.join(out,'wordbook-'+width+'.png'),fullPage:true});
  }
  await page.locator('#studyRoot input').first().fill('draft');assert.equal(await page.getByRole('button',{name:'暂停',exact:true}).count(),0);assert.equal(await page.locator('.study-more').count(),0);await page.keyboard.press('Shift');await page.keyboard.press('Shift');assert.equal(await page.locator('#studyRoot input').first().inputValue(),'draft');
  await page.getByRole('button',{name:'确认',exact:true}).click();assert.equal(await page.locator('#studyRoot input').first().getAttribute('aria-invalid'),'true');
  const answers=await page.evaluate(item=>GuidedSentenceContent.forItem(item).map(step=>step.answer),item);
  for(const answer of answers)await page.locator('.guided-form input').fill(answer);
  await page.getByRole('button',{name:'下一词',exact:true}).click();assert.equal(await page.locator('#bookPosition').textContent(),'2 / 6');
  const shared=item.images.wide.find(url=>url.endsWith('.webp'));
  imageRequests.length=0;
  await page.evaluate(shared=>{window.wordbookImageFixture.images={wide:[shared],mobile:[shared]};},shared);
  for(const answer of answers)await page.locator('.guided-form input').fill(answer);
  await page.getByRole('button',{name:'下一词',exact:true}).click();
  await page.waitForFunction(shared=>{const img=document.querySelector('.wordbook-exercise img');return img?.complete&&img.naturalWidth>0&&img.currentSrc===new URL(shared,location.href).href;},shared);
  for(const width of [360,390,918,1440]){
   await page.setViewportSize({width,height:932});
   const image=await page.locator('.wordbook-exercise img').evaluate(img=>({src:new URL(img.currentSrc).pathname.slice(1),fit:getComputedStyle(img).objectFit,ratio:img.naturalWidth/img.naturalHeight,overflow:document.documentElement.scrollWidth>innerWidth}));
   assert.equal(image.src,shared,'same WebP at '+width);assert.equal(image.fit,'contain');assert.ok(Math.abs(image.ratio-16/9)<0.01);assert.equal(image.overflow,false);
   if(width===360||width===1440)await page.screenshot({path:path.join(out,'wordbook-shared-webp-'+width+'.png'),fullPage:true});
  }
  assert.ok(imageRequests.every(url=>url===shared),'shared mode requests no AVIF or mobile-specific alternative');
  await page.evaluate(()=>{
   window.persistenceCalls=0;
   const read=ChunkAPI.request;ChunkAPI.request=async url=>url.endsWith('/details')?{features:{}}:read(url);
   LearningSessionBootstrap.ready=async()=>{throw Object.assign(Error('cache conflict'),{code:'SERVER_SEQ_ROLLBACK'});};
   window.VocabularyStudyStore={state:async()=>{persistenceCalls++;throw Error('must not read resume in temporary practice');},pending:async()=>{persistenceCalls++;return [];},submit:async()=>{persistenceCalls++;throw Error('must not save temporary practice');}};
  });
  await page.addScriptTag({path:'landing/wordbook-study.js'});
  await page.getByRole('button',{name:'本次不保存练习',exact:true}).waitFor();
  assert.equal(await page.locator('.wordbook-exercise img').count(),1,'course remains visible during cache conflict');
  assert.equal(await page.locator('#studyRoot input').count(),0,'temporary answering requires an explicit choice');
  await page.getByRole('button',{name:'本次不保存练习',exact:true}).click();
  await page.locator('.guided-form input').waitFor();
  for(const answer of answers)await page.locator('.guided-form input').fill(answer);
  await page.getByRole('button',{name:'下一词',exact:true}).click();
  assert.equal(await page.locator('#bookPosition').textContent(),'2 / 6');
  assert.equal(await page.evaluate(()=>persistenceCalls),0,'preview and temporary answering never read or mutate resume, queue or saved records');
  assert.deepEqual(errors,[]);console.log('Wordbook compact UI: legacy and shared WebP at four widths, complete 16:9 image, assets <20 KB, menu draft preservation, wrong/correct answers and next passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
