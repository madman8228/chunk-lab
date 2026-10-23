'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
const html=fs.readFileSync('main.html','utf8'),styles=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(row=>row[1]).join('\n');
const markup=html.slice(html.indexOf('<div class="wrap">'),html.indexOf('<!-- 详解弹窗'));
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage();
 await page.route('http://practice-fixture.invalid/**',route=>{const file=new URL(route.request().url()).pathname.slice(1);return file.startsWith('assets/')&&fs.existsSync(file)?route.fulfill({body:fs.readFileSync(file)}):route.abort();});
 await page.setContent('<html><head><base href="http://practice-fixture.invalid/"><style>'+styles+'</style></head><body>'+markup+'</body></html>');
 for(const file of ['assets/learning-navigation.css','assets/learning-background.css','assets/course-learning-header.css','assets/practice-reference-layout.css'])await page.addStyleTag({path:file});
 await page.addScriptTag({path:'js/main-practice-markup.js'});await page.addScriptTag({path:'js/practice-layout.js'});await page.addScriptTag({path:'js/icons.js'});await page.evaluate(()=>Icons.install());
 await page.evaluate(()=>{
  window.originalContext=document.querySelector('.practice-context');window.exitClicks=0;document.getElementById('btnExitPractice').onclick=()=>exitClicks++;
  document.getElementById('pagePractice').classList.remove('hidden');document.getElementById('practiceOptions').hidden=false;
  document.getElementById('deckName').textContent='万能表达';document.getElementById('mProgress').textContent='1/4';document.getElementById('progFill').style.width='25%';
  document.getElementById('zh').textContent='给我竖个大拇指（点个赞）吧。';document.getElementById('ringWrap').classList.remove('hidden');document.getElementById('ringNum').textContent='1';
  document.getElementById('btnExplain').classList.remove('hidden');
  document.getElementById('track').classList.add('compact-chunks');
  const escapeHtml=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  ['Give me','a thumbs up.'].forEach((chunk,index)=>{const box=document.createElement('div');box.className='chunk wait';box.innerHTML=MainPracticeMarkup.buildChunkMarkup({chunk,index,hint:index?'一个大拇指（赞成）':'给我',grammar:{role:index?'宾语':'谓语 + 宾语',color:index?'#3358e0':'#e74c7a'},mode:'choose',escapeHtml});document.getElementById('track').append(box);});
 });
 await page.waitForFunction(()=>document.querySelector('.topbar-row>.practice-context'));
 fs.mkdirSync('output/playwright/practice-reference',{recursive:true});
 for(const width of [1043,390,320]){
  await page.setViewportSize({width,height:932});
  const head=await page.locator('.topbar').boundingBox(),stage=await page.locator('#stage').boundingBox(),question=await page.locator('#zh').boundingBox(),track=await page.locator('.track-line').boundingBox(),actions=await page.locator('.stage-head-right').boundingBox();
  await page.screenshot({path:path.resolve('output/playwright/practice-reference/'+width+'.png'),fullPage:true});
  assert.ok(head.height<(width>760?80:140),'header height at '+width+': '+head.height);assert.ok(stage.y>head.y+head.height);assert.ok(question.y>=actions.y+actions.height);assert.ok(track.y>=question.y+question.height);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.evaluate(()=>document.querySelector('.topbar-row>.practice-context')===originalContext),true);
  assert.equal(await page.locator('#btnExitPractice svg').count(),1);assert.equal(await page.locator('#mComboBox svg').count(),1);
  const progressLabel=await page.locator('.practice-progress-labels').boundingBox(),progressBar=await page.locator('.pc-progress').boundingBox();
  assert.ok(progressLabel.y+progressLabel.height<=progressBar.y,'labels are above progress bar at '+width);
  assert.equal(await page.locator('.practice-progress-labels #mProgress').innerText(),'1/4');
  await page.screenshot({path:path.resolve('output/playwright/practice-reference/'+width+'.png'),fullPage:true});
 }
 await page.getByRole('button',{name:'退出当前学习课程'}).click();assert.equal(await page.evaluate(()=>exitClicks),1,'relocation retains handlers');
 await page.evaluate(()=>{document.getElementById('btnSpeak').classList.remove('hidden');document.getElementById('zh').textContent='这是一条更长的中文练习题，用来确认中文换行后不会压住动作按钮，也不会覆盖意群提示与输入区域。';});
 const long=await page.locator('#zh').boundingBox(),trackAfter=await page.locator('.track-line').boundingBox();assert.ok(trackAfter.y>=long.y+long.height);
 assert.equal(await page.locator('.stage-foot #btnSpeak').count(),1);
 await page.evaluate(()=>document.getElementById('pagePractice').classList.add('hidden'));await page.waitForFunction(()=>!document.documentElement.classList.contains('practice-reference-layout'));
 assert.equal(await page.evaluate(()=>document.querySelector('#pagePractice>.practice-context')===originalContext),true);
 await page.evaluate(()=>{document.getElementById('pagePractice').classList.remove('hidden');document.getElementById('stage').classList.add('hidden');const error=document.createElement('section');error.className='course-access-panel';error.textContent='课程不可用';document.getElementById('pagePractice').append(error);});
 await page.waitForFunction(()=>!document.querySelector('.topbar-row>.practice-context'));
 assert.equal(await page.locator('.practice-toolbar').isVisible(),false);
 console.log('Practice reference layout: desktop/390/320, compact header, native control identity/handlers, task ordering, long text, footer audio, navigation restoration and unloaded-course state passed; no app/account storage loaded.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
