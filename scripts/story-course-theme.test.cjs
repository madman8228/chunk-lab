'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const source=fs.readFileSync('courses.html','utf8'),html=source.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'');
 const main=fs.readFileSync('main.html','utf8'),homeStyles=[...main.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
 const scene=fs.readFileSync('assets/vocabulary-borrow-wide-v2.webp').toString('base64');fs.mkdirSync('output/playwright/story-course-theme',{recursive:true});
 for(const width of [1440,774,390]){
  await page.setViewportSize({width,height:932});await page.setContent('<style>'+homeStyles+'</style><div id="pageHome"></div><div class="home-sky-deco"><svg class="sky-sun"></svg></div>');
  const expected=await page.evaluate(()=>({background:getComputedStyle(document.body).backgroundImage,sun:document.querySelector('.sky-sun').getBoundingClientRect().toJSON()}));
  await page.setContent(html);for(const file of ['assets/learning-sky.css','assets/story-course-theme.css'])await page.addStyleTag({path:file});await page.addScriptTag({path:'js/learning-sky.js'});
  await page.evaluate(scene=>{
   document.getElementById('coursePlayer').classList.remove('hidden');document.getElementById('playerTitle').textContent='Excuse Me! | A Handbag Conversation';document.getElementById('playerTitleTranslation').textContent='打扰一下！—手提包对话';document.getElementById('playerTitleTranslation').hidden=false;document.getElementById('playerCourseTag').textContent='A1';document.getElementById('playerTotal').textContent='7';
   document.getElementById('playerImage').innerHTML='<img alt="隔离测试场景素材" src="data:image/webp;base64,'+scene+'">';
   document.getElementById('playerContent').innerHTML='<div class="v2-chat-turn"><div class="v2-speaker-row"><span class="v2-speaker-label">旁白</span><button class="v2-audio-icon" aria-label="播放音频">音频</button></div><div class="v2-chat-bubble"><div class="v2-chat-line">听音频，在你的气泡中输入听到的句子。</div></div></div><div class="v2-typing-exercise"><div class="v2-chat-turn right legacy-answer-turn"><div class="v2-chat-message-row"><div class="v2-chat-bubble"><form class="v2-answer-form"><input aria-label="英文答案"><button class="action-button primary">确认</button></form></div></div></div></div>';
   window.submits=0;document.querySelector('.v2-answer-form').onsubmit=e=>{e.preventDefault();submits++;};
  },scene);
  const actual=await page.evaluate(()=>({background:getComputedStyle(document.body).backgroundImage,sun:document.querySelector('.sky-sun').getBoundingClientRect().toJSON()}));assert.deepEqual(actual,expected,'scenery matches home '+width);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow '+width);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.stage-content')).backgroundColor),'rgb(255, 253, 245)');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.stage-image img')).objectFit),'contain','no course-image cropping');
  await page.getByRole('textbox',{name:'英文答案'}).fill('test');await page.getByRole('button',{name:'确认',exact:true}).click();assert.equal(await page.evaluate(()=>submits),1);
  const compact=await page.evaluate(()=>({top:document.querySelector('.player-head').getBoundingClientRect().top,height:document.querySelector('.player-head').getBoundingClientRect().height,border:getComputedStyle(document.querySelector('.legacy-answer-turn .v2-chat-bubble')).borderTopWidth,inputBorder:getComputedStyle(document.querySelector('.v2-answer-form input')).borderTopWidth}));
  assert.equal(await page.evaluate(()=>document.querySelector('.player-head').getBoundingClientRect().top-document.querySelector('.shell>nav').getBoundingClientRect().bottom),4,'navigation-to-title gap stays compact at every width');if(width===774)assert.ok(compact.height<90,'header compressed below original 110px');assert.equal(compact.border,'0px');assert.equal(compact.inputBorder,'0px');
  await page.getByRole('textbox',{name:'英文答案'}).press('Enter');assert.equal(await page.evaluate(()=>submits),2,'keyboard submission retained');
  await page.screenshot({path:'output/playwright/story-course-theme/story-'+width+'.png',fullPage:true});
 }
 assert.deepEqual(errors,[]);console.log('Story course theme: shared home background/sun, cream surfaces, unaltered image fit, controls and three widths passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
