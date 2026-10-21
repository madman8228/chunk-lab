'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();const html=fs.readFileSync('main.html','utf8');
  const styles=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
  await page.setContent('<html><style>'+styles+'</style><body><div class="home-sky-deco"></div><div class="home-garden"></div><div class="wrap"><div id="pageHome">首页</div><div id="pageMyLearning" class="hidden"></div><div id="pageDiscover" class="hidden"></div><div id="pagePractice" class="hidden"><div class="card">早上好！</div></div></div></body></html>');
  for(const dark of [false,true])for(const width of [1853,946,390]){
   await page.setViewportSize({width,height:932});await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);
   await page.evaluate(()=>{pageHome.classList.remove('hidden');pagePractice.classList.add('hidden');});
   const home=await page.evaluate(()=>getComputedStyle(document.body).backgroundImage);
   await page.evaluate(()=>{pageHome.classList.add('hidden');pagePractice.classList.remove('hidden');});
   const practice=await page.evaluate(()=>({bg:getComputedStyle(document.body).backgroundImage,sky:getComputedStyle(document.querySelector('.home-sky-deco')).display,garden:getComputedStyle(document.querySelector('.home-garden')).display}));
   assert.equal(practice.bg,home,'practice must retain home background');assert.equal(practice.sky,'block');assert.equal(practice.garden,'block');
   assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.wrap')).maxWidth),'1020px','practice keeps its existing width');
   assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.home-garden')).pointerEvents),'none','decorations must not intercept answers');
  }
  // Render the real decorations and practice markup without booting the app or touching account data.
  const decorations=html.slice(html.indexOf('<div class="home-sky-deco"'),html.indexOf('<div class="wrap">'));
  const practiceMarkup=html.slice(html.indexOf('<div class="page hidden" id="pagePractice">'),html.indexOf('</div><!-- /pagePractice -->')+'</div><!-- /pagePractice -->'.length);
  const topbar=html.slice(html.indexOf('<div class="wrap">')+'<div class="wrap">'.length,html.indexOf('  <!-- 练习页专属上下文'));
  fs.mkdirSync('output/playwright/practice-theme',{recursive:true});
  for(const dark of [false,true])for(const width of [1853,946,390]){
   await page.setViewportSize({width,height:932});
   await page.setContent('<html class="'+(dark?'dark':'')+'"><style>'+styles+'</style><body>'+decorations+'<div class="wrap">'+topbar+practiceMarkup+'</div></body></html>');
   await page.evaluate(()=>{pagePractice.classList.remove('hidden');deckName.textContent='零基础开口 · 1 第一次见面';zh.textContent='早上好！';mProgress.textContent='1/10';});
   const answerStyle=await page.evaluate(()=>{
    const chunk=document.createElement('div');chunk.className='chunk ok';
    const answer=document.createElement('div');answer.className='chunk-answer';answer.textContent='Can you show me';chunk.append(answer);document.querySelector('#track').append(chunk);
    const style=getComputedStyle(answer),result={fontSize:style.fontSize,color:style.color};chunk.remove();return result;
   });
   assert.equal(answerStyle.fontSize,width<=840?'16px':'20px','completed chunk answer scale at '+width);
   assert.equal(answerStyle.color,dark?'rgb(232, 228, 221)':'rgb(17, 17, 17)','completed chunk answer contrast in '+(dark?'dark':'light')+' theme');
   const sun=await page.locator('.sky-sun').boundingBox();
   await page.evaluate(()=>{pagePractice.classList.add('hidden');const home=document.createElement('div');home.id='pageHome';document.querySelector('.wrap').append(home);});
   assert.deepEqual(await page.locator('.sky-sun').boundingBox(),sun,'home and practice sun coordinates must match at '+width);
   await page.evaluate(()=>{document.querySelector('#pageHome').remove();pagePractice.classList.remove('hidden');});
   await page.screenshot({path:'output/playwright/practice-theme/practice-'+width+'-'+(dark?'dark':'light')+'.png'});
  }
  console.log('practice theme: home/practice continuity on desktop/mobile light/dark passed');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
