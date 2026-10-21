'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage();
 const source=fs.readFileSync('decks.html','utf8'),html=source.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'');
 const main=fs.readFileSync('main.html','utf8'),homeStyles=[...main.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
 fs.mkdirSync('output/playwright/decks-theme',{recursive:true});
 for(const width of [1440,774,390]){
  await page.setViewportSize({width,height:932});await page.setContent('<style>'+homeStyles+'</style><div id="pageHome"></div><div class="home-sky-deco"><svg class="sky-sun"></svg></div>');
  const expected=await page.evaluate(()=>({background:getComputedStyle(document.body).backgroundImage,sun:document.querySelector('.sky-sun').getBoundingClientRect().toJSON()}));
  await page.setContent(html);for(const file of ['assets/learning-sky.css','assets/decks-theme.css'])await page.addStyleTag({path:file});await page.addScriptTag({path:'js/learning-sky.js'});
  await page.evaluate(()=>{
   for(const id of ['courseMembershipNav','courseTypeNav','marketSection'])document.getElementById(id).classList.add('hidden');
   const title=document.getElementById('deckPageTitle');title.classList.remove('hidden');title.textContent='打扰一下！—手提包对话 · 1 个课节';
   document.getElementById('deckList').innerHTML='<div class="catalog-lessons"><div class="catalog-lesson" role="button" tabindex="0" aria-label="开始测试课节"><div class="catalog-lesson-media"><div class="catalog-lesson-caption"><span class="lesson-index">1</span><span class="lesson-name">隔离测试课节</span></div></div><div class="catalog-lesson-footer"><span class="lesson-meta">图文课节</span></div></div></div>';
   window.activations=0;const card=document.querySelector('.catalog-lesson');card.onclick=()=>activations++;card.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();card.click();}};
  });
  await page.evaluate(async scene=>{const image=document.createElement('img');image.alt='隔离测试故事封面';image.src='data:image/webp;base64,'+scene;document.querySelector('.catalog-lesson-media').prepend(image);await image.decode();},fs.readFileSync('assets/catalog/story-garden-v1.webp').toString('base64'));
  assert.deepEqual(await page.evaluate(()=>({background:getComputedStyle(document.body).backgroundImage,sun:document.querySelector('.sky-sun').getBoundingClientRect().toJSON()})),expected,'same background and sun '+width);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow '+width);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.catalog-lesson')).backgroundColor),'rgb(255, 253, 245)');
  assert.equal(await page.evaluate(()=>document.querySelector('.page-head').getBoundingClientRect().top-document.querySelector('.decks-global-nav').getBoundingClientRect().bottom),4,'compact navigation-to-header gap');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.wrap')).paddingTop),'8px','no decorative 104px spacer');
  assert.equal(await page.getByRole('navigation',{name:'主导航'}).getByRole('link').count(),4);
  assert.equal(await page.getByRole('link',{name:'我的内容',exact:true}).getAttribute('href'),'main.html?view=my-learning');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('deckList')).overflowY),'auto','internal list scrolling retained');
  await page.getByRole('button',{name:'开始测试课节'}).focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>activations),1);
  await page.screenshot({path:'output/playwright/decks-theme/decks-'+width+'.png'});
  await page.evaluate(()=>{document.getElementById('deckPageTitle').classList.add('hidden');document.getElementById('courseMembershipNav').classList.remove('hidden');document.getElementById('courseTypeNav').classList.remove('hidden');});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'course list navigation no horizontal overflow '+width);
  assert.equal(await page.evaluate(()=>document.querySelector('.page-head').getBoundingClientRect().top-document.querySelector('.decks-global-nav').getBoundingClientRect().bottom),4,'course list also has compact navigation');
  await page.screenshot({path:'output/playwright/decks-theme/list-'+width+'.png'});
 }
 console.log('Decks theme: homepage scenery, cream cards, compact global navigation, course list/detail layouts and keyboard fixture passed at three widths.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
