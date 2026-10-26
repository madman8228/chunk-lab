'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:932}}),errors=[],images=[];
  page.on('pageerror',error=>errors.push(error.message));
  const html=fs.readFileSync('wordbook.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'');
  await page.route('**/wordbook.html*',route=>route.fulfill({body:html,contentType:'text/html'}));
  await page.route('**/assets/vocab-u1-textbook-wide-v2.webp',route=>{const file=new URL(route.request().url()).pathname.slice(1);images.push(file);assert.ok(fs.statSync(file).size<20000);return route.fulfill({body:fs.readFileSync(file),contentType:'image/webp'});});
  await page.goto('http://127.0.0.1:9979/wordbook.html?book=textbook-wordbook%3Afixture');
  for(const file of ['landing/theme.css','landing/practice-page.css','assets/learning-workspace.css','assets/learning-sky.css','assets/wordbook-study.css','assets/learning-navigation.css','assets/course-learning-header.css','assets/listen-word.css'])await page.addStyleTag({path:file});
  for(const file of ['js/learning-sky.js','js/course-return.js','js/course-learning-header.js','js/learning-navigation.js','js/notice-banner.js','js/vocabulary-course-contract.js','landing/listen-word-view.js'])await page.addScriptTag({path:file});
  await page.evaluate(()=>{
   document.getElementById('wordbookNavigation').replaceWith(LearningNavigation.create());
   window.persistenceCalls=0;window.played=[];window.stopped=0;window.rates=[];window.wordSaved=false;window.LearningWorkspaceStore={word:async(book,id,toggle)=>toggle?(wordSaved=!wordSaved):wordSaved};
   window.VocabularyCourseAudio={create:()=>({setRate:value=>rates.push(value),play:clip=>played.push(clip),stop:()=>stopped++,destroy:()=>stopped++})};
   for(const name of ['VocabularyWordDictationView','VocabularyWordChoiceView','VocabularyChunkOrderView','VocabularyReadAloudView'])window[name]={};
   window.GuidedSentenceContent={forItem:()=>null};
   window.LearningSessionBootstrap={identity:()=> 'fixture',ready:async()=>{persistenceCalls++;throw Error('cache must not gate read-only recognition');}};
   window.VocabularyStudyStore={state:async()=>{persistenceCalls++;},submit:async()=>{persistenceCalls++;},pending:async()=>{persistenceCalls++;return [];}};
   window.VocabularyUnitCache={create:async()=>null};VocabularyStudyStore.useUnit=()=>{};
   window.fixture={word:'textbook',meaning:'教科书；课本',phonetic:'fixture British phonetic',phonetics:{'en-US':'fixture American phonetic','en-GB':'fixture British phonetic'},scene:'上学前整理书包',translation:'我把课本放在书包里。',images:{wide:['assets/vocab-u1-textbook-wide-v2.webp'],mobile:['assets/vocab-u1-textbook-wide-v2.webp']},exercise:{version:1,parts:[{text:'I keep my '},{id:'blank1',label:'textbook',answers:['textbook']},{text:' in my schoolbag.'}]},learning:{sentenceAudio:{audio:{url:'fixture-us-audio',sha256:'fixture-us'},audioByAccent:{'en-GB':{url:'fixture-gb-audio',sha256:'fixture-gb'}}}}};
   window.fixtureWithoutBritishAudio={...structuredClone(fixture),learning:{sentenceAudio:{audio:fixture.learning.sentenceAudio.audio}}};
   window.ChunkAPI={getToken:()=> 'fixture-token',request:async url=>url.includes('/items')?{title:'人教版英语 九年级全一册（2013） · Unit 1 How can we become good learners?',revision:'fixture',itemCount:2,items:[{itemId:'one',contentRevision:'fixture'},{itemId:'two',contentRevision:'fixture'}]}:structuredClone(url.includes('/two')?fixtureWithoutBritishAudio:fixture)};
  });
  await page.addScriptTag({path:'landing/wordbook-study.js'});
  const word=page.getByRole('button',{name:'textbook，查看图片和释义',exact:true});try{await word.waitFor({timeout:5000});}catch(error){throw Error((await page.locator('body').innerText())+'\n'+errors.join('\n')+'\n'+error.message);}
  await page.getByRole('button',{name:'收藏当前单词',exact:true}).click();assert.equal(await page.getByRole('button',{name:'取消收藏当前单词',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'取消收藏当前单词',exact:true}).click();
  await page.getByLabel('语音播放速度',{exact:true}).selectOption('0.75');assert.equal(await page.evaluate(()=>rates.at(-1)),0.75);
  const accent=page.getByLabel('发音口音',{exact:true});assert.equal(await accent.inputValue(),'en-US');assert.equal(await page.locator('.listen-word-pronunciation').textContent(),'fixture American phonetic');
  await accent.selectOption('en-GB');assert.equal(await page.locator('.listen-word-pronunciation').textContent(),'fixture British phonetic');
  await page.getByRole('button',{name:'重播整句',exact:true}).click();assert.deepEqual(await page.evaluate(()=>played.at(-1)),{url:'fixture-gb-audio',sha256:'fixture-gb'});
  await accent.selectOption('en-US');await page.getByRole('button',{name:'重播整句',exact:true}).click();assert.deepEqual(await page.evaluate(()=>played.at(-1)),{url:'fixture-us-audio',sha256:'fixture-us'});
  assert.equal(await page.locator('#bookPosition').isVisible(),true);
  assert.equal(await page.locator('.listen-word-pronunciation').isVisible(),true);
  assert.equal(await page.getByRole('button',{name:'← 上一词',exact:true}).isEnabled(),false);
  await page.getByRole('button',{name:'显示翻译',exact:true}).click();assert.equal(await page.locator('.listen-word-translation').isVisible(),true);
  await page.getByRole('button',{name:'收起翻译',exact:true}).click();
  assert.equal(await page.locator('.listen-word-controls .listen-word-position').textContent(),'1 / 2');
  assert.equal(await page.locator('#studyRoot input').count(),0);assert.equal(await page.getByRole('button',{name:'确认',exact:true}).count(),0);
  assert.equal(await page.locator('#studyRoot img').count(),0);assert.equal(images.length,0,'image is neither created nor fetched before target click');
  for(const width of [1024,390]){
   await page.setViewportSize({width,height:932});
   const before=await page.locator('.listen-word-sentence').boundingBox();
   await word.click();await page.waitForFunction(()=>document.querySelector('.listen-word-picture img')?.naturalWidth>0);
   const opened=await page.locator('.listen-word-sentence').boundingBox();assert.equal(opened.y,before.y,'opening image keeps sentence position at '+width);
   await word.click();const closed=await page.locator('.listen-word-sentence').boundingBox();assert.equal(closed.y,before.y,'closing image keeps sentence position at '+width);
  }
  await page.setViewportSize({width:1024,height:932});
  assert.equal(await page.evaluate(()=>played.length),3,'sentence autoplays in the selected accent');
  await word.click();await page.waitForFunction(()=>document.querySelector('.listen-word-picture img')?.naturalWidth>0);
  assert.equal(await page.locator('.listen-word-pronunciation').textContent(),'fixture American phonetic');
  assert.equal(await page.locator('.listen-word-picture .listen-word-meaning').textContent(),'教科书；课本');
  const pictureBox=await page.locator('.listen-word-picture').boundingBox(),meaningBox=await page.locator('.listen-word-definition').boundingBox();
  assert.ok(meaningBox.y-pictureBox.y<12,'meaning stays at image top');
  assert.ok(Math.abs(meaningBox.x+meaningBox.width/2-pictureBox.x-pictureBox.width/2)<1,'meaning is horizontally centered');
  assert.equal(await page.locator('.listen-word-dialogue').textContent(),'我把课本放在书包里。');
  assert.equal(await page.evaluate(()=>Boolean(document.querySelector('.listen-word-picture').compareDocumentPosition(document.querySelector('.listen-word-sentence'))&Node.DOCUMENT_POSITION_FOLLOWING)),true,'picture precedes sentence');
  const token=await word.boundingBox(),definition=await page.locator('.listen-word-pronunciation').boundingBox();
  assert.ok(definition.y>=token.y+token.height,'phonetic sits in the assistance row below the sentence');
  assert.equal(images.length,1);await word.click();assert.equal(await page.locator('.listen-word-picture').isVisible(),false);
  await word.click();assert.equal(images.length,1,'reopening reuses the existing image');
  await page.getByRole('button',{name:'重播整句',exact:true}).click();assert.equal(await page.evaluate(()=>played.length),4);
  fs.mkdirSync('output/playwright/listen-word',{recursive:true});
  for(const width of [1024,390]){await page.setViewportSize({width,height:932});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'output/playwright/listen-word/revealed-'+width+'.png'});}
  assert.equal(await page.locator('#studyTools details').count(),0,'autoplay is directly visible without a menu');
  assert.equal(await page.getByLabel('自动播放整句',{exact:true}).isVisible(),true);
  await page.getByLabel('自动播放整句',{exact:true}).uncheck();
  await page.getByRole('button',{name:'下一词 →',exact:true}).click();await page.waitForFunction(()=>document.getElementById('bookPosition').textContent==='2 / 2');
  assert.equal(await accent.inputValue(),'en-US');await accent.selectOption('en-GB');assert.equal(await page.locator('.listen-word-pronunciation').textContent(),'fixture British phonetic');
  await page.getByRole('button',{name:'重播整句',exact:true}).click();assert.equal(await page.evaluate(()=>played.length),4,'missing British audio never falls back to American');assert.match(await page.locator('.listen-word-audio-status').textContent(),/暂无英式音频/);
  assert.equal(await page.getByLabel('语音播放速度',{exact:true}).inputValue(),'0.75');
  assert.equal(await page.getByRole('button',{name:'← 上一词',exact:true}).isEnabled(),true);
  assert.equal(await page.locator('#studyRoot img').count(),0,'next word starts with hidden image');assert.equal(await page.evaluate(()=>played.length),4,'autoplay preference is kept without playing a different accent');
  await page.getByRole('button',{name:'← 上一词',exact:true}).click();await page.waitForFunction(()=>document.getElementById('bookPosition').textContent==='1 / 2');
  assert.equal(await page.getByRole('button',{name:'← 上一词',exact:true}).isEnabled(),false);
  assert.equal(await page.evaluate(()=>persistenceCalls),0,'recognition never touches existing progress or pending operations');
  await page.evaluate(()=>{delete fixture.learning;delete fixture.phonetic;});
  await page.addScriptTag({path:'landing/wordbook-study.js'});assert.equal(await page.getByText('整句语音未配置',{exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'重播整句',exact:true}).isEnabled(),false);
  await word.click();assert.equal(await page.locator('.listen-word-phonetic').count(),0,'missing phonetics are not fabricated');
  assert.deepEqual(errors,[]);console.log('Listen-word UI: lazy image, centered definition, sentence playback, autoplay preference, next word, missing assets, two widths and zero persistence calls passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
