'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
(async()=>{const preview=await require('../scripts/serve-borrow-preview.cjs').createPreview();let browser;try{
 browser=await chromium.launch({headless:true});const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.speechSynthesis.speak=()=>{throw Error('Authored audio must not use browser TTS');};window.played=[];window.audios=[];const NativeAudio=Audio;window.Audio=class extends NativeAudio{constructor(...args){super(...args);audios.push(this);this.addEventListener('playing',()=>played.push(this.src));}};});
 await context.route('**/*',route=>new URL(route.request().url()).origin===preview.base?route.continue():route.abort());
 const requestCount=()=>preview.requests.filter(r=>r.path.endsWith('.ogg')).length;
 await page.goto(preview.base+'/');await page.getByRole('heading',{name:'单元目录',exact:true}).waitFor();await page.getByText('目标水平 A2（待审核）',{exact:true}).waitFor();
 await page.getByRole('button',{name:'对话',exact:true}).click();await page.getByRole('heading',{name:'对话',exact:true}).waitFor();assert.equal(await page.locator('.book-material').count(),2);
 await page.getByRole('button',{name:'短文',exact:true}).click();await page.getByRole('heading',{name:'短文',exact:true}).waitFor();assert.equal(requestCount(),0);
 await page.getByRole('link',{name:'开始 / 继续练习'}).click();await page.locator('#studyRoot input').waitFor();
 for(const item of preview.prepared.items){
  assert.equal(requestCount(),preview.prepared.items.indexOf(item)*2,'No future audio precache');
  await page.getByRole('button',{name:'听单词',exact:true}).click();await page.waitForFunction(()=>played.length>0);await page.getByText('正在播放课程音频。',{exact:true}).waitFor();
  assert.equal(preview.requests.filter(r=>r.path==='/'+item.learning.wordDictation.audio.url).length,1);
  if(item===preview.prepared.items[0]){await page.getByRole('button',{name:'暂停',exact:true}).click();assert.equal(await page.evaluate(()=>audios.every(a=>a.paused)),true);await page.getByRole('button',{name:'继续',exact:true}).click();assert.equal(await page.getByText('正在播放课程音频。',{exact:true}).count(),0);}
  for(const step of item.learning.guidedExpression.steps){await page.locator('#studyRoot input').fill(step.answer);await page.locator('#studyRoot input').press('Enter');}
  if(item===preview.prepared.items[0]){const pattern='**/'+item.learning.sentenceAudio.audio.url;await page.route(pattern,route=>route.fulfill({status:503,body:'isolated unavailable'}));await page.getByRole('button',{name:'听句子',exact:true}).click();await page.getByText(/不会切换为浏览器合成声音/).waitFor();await page.unroute(pattern);}
  await page.getByRole('button',{name:'听句子',exact:true}).click();await page.getByText('正在播放课程音频。',{exact:true}).waitFor();
  await page.waitForFunction(n=>played.length>=n,(preview.prepared.items.indexOf(item)+1)*2);
  assert.equal(preview.requests.filter(r=>r.path==='/'+item.learning.sentenceAudio.audio.url).length,1);
  const before=requestCount();await page.getByRole('button',{name:'听句子',exact:true}).click();await page.waitForTimeout(40);assert.equal(requestCount(),before,'Repeat reuses verified clip');
  for(const width of [1440,390]){await page.setViewportSize({width,height:932});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  await page.getByRole('button',{name:'下一词',exact:true}).click();
 }
 await page.getByRole('heading',{name:'本轮完成',exact:true}).waitFor();assert.ok(preview.requests.every(r=>r.method==='GET'));
 const rejected=await fetch(preview.base+'/api/operations',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(rejected.status,405);
 assert.equal(fs.existsSync(path.join(preview.appRoot,'chunklab.db')),false);assert.deepEqual(errors,[]);await context.close();
 console.log('Actual six-word pilot preview: two dialogues/reading, authored A word+sentence playback (never browser TTS), complete guided practice, lazy/repeat cache, two widths and read-only API passed. No production approval or account write.');
 }finally{if(browser)await browser.close();await preview.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
