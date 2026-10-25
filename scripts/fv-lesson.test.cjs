'use strict';
const {chromium}=require('playwright-core');const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{
 const {makeTrials,recordFirst}=await import('../src/pronunciation-fv/model.mjs');
 const trials=makeTrials(['fan','van'],'jenny',()=>.3);assert.equal(trials.filter(t=>t.word==='fan').length,2);assert.equal(trials.filter(t=>t.word==='van').length,2);
 const results={};recordFirst(results,'one','fan','van');recordFirst(results,'one','fan','fan');assert.equal(results.one.correct,false);
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});const writes=[],errors=[];
  page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8787/pronunciation-fv-preview.html');
  fs.mkdirSync('output/playwright/fv-lesson',{recursive:true});
  await page.screenshot({path:'output/playwright/fv-lesson/intro-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'开始听辨',exact:true}).click();
  const media=await page.evaluate(()=>window.FvLessonMedia);
  const counts=[0,0];
  for(let group=0;group<2;group++){
   for(let i=0;i<4;i++){
    assert.equal(await page.locator('.choice:disabled').count(),2);
    assert.equal(await page.locator('.replay').count(),0,'No reference recording before answer');
    let id;
    await page.exposeFunction(`audioProbe${group}${i}`,src=>{id=Object.keys(media).find(key=>media[key]===src);});
    await page.evaluate(name=>{const Original=window.Audio;window.Audio=function(src){window[name](src);return new Original(src);};},`audioProbe${group}${i}`);
    await page.getByRole('button',{name:'播放录音',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.choice:disabled').length===0);
    const word=id.split('-')[0];const options=await page.locator('.choice strong').allTextContents();
    const selected=i===0?options.find(w=>w!==word):word;
    if(selected===word)counts[group]++;
    await page.locator('.choice').filter({hasText:selected}).click();
    assert.equal(await page.locator('.choice:disabled').count(),2);
    assert.equal(await page.locator('.replay button').count(),2);
    await page.getByRole('button',{name:i===3?'本组完成':'下一题',exact:true}).click();
   }
   if(group===0)await page.getByRole('button',{name:'开始第二组',exact:true}).click();
  }
  assert.equal(await page.locator('.sample:visible').count(),0);
  await page.getByRole('button',{name:'我试过了，听范音'}).click();
  assert.equal(await page.locator('.sample:visible').count(),2);
  await page.getByRole('button',{name:'查看本次结果'}).click();
  const text=await page.locator('.results').innerText();assert.match(text,/fan \/ van：首次听辨 3 \/ 4/);assert.match(text,/fine \/ vine：首次听辨 3 \/ 4/);assert.match(text,/未验证发音/);
  assert.equal(writes.length,0);assert.deepEqual(errors,[]);
  fs.mkdirSync('output/playwright/fv-lesson',{recursive:true});
  await page.screenshot({path:'output/playwright/fv-lesson/desktop.png',fullPage:true});
  await page.setViewportSize({width:360,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'output/playwright/fv-lesson/mobile.png',fullPage:true});
  console.log('Eight actual-playback questions, hidden target, answer gating, contrast feedback, immutable first results, self-practice separation, mobile overflow and zero account writes passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
