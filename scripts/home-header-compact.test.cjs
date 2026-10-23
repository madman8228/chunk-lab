'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage(),source=fs.readFileSync('main.html','utf8'),styles=[...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
 const start=source.indexOf('<div class="wrap">'),end=source.indexOf('<!-- 今日首页',start),topbar=source.slice(start,end);
 fs.mkdirSync('output/playwright/home-header-compact',{recursive:true});
 for(const width of [1440,847,390]){
  await page.setViewportSize({width,height:932});await page.setContent('<style>'+styles+'</style>'+topbar+'<div class="page home-page" id="pageHome"><div id="homeBody"></div></div><div class="page hidden" id="pagePractice"></div></div>');
  await page.addStyleTag({path:'assets/learning-workspace.css'});await page.addStyleTag({path:'assets/content-card.css'});await page.addStyleTag({path:'assets/learning-navigation.css'});await page.addScriptTag({path:'js/learning-workspace.js'});await page.addScriptTag({path:'js/content-card.js'});await page.addScriptTag({path:'js/course-return.js'});await page.addScriptTag({path:'js/learning-navigation.js'});await page.addScriptTag({path:'js/learning-workspace-view.js'});await page.addScriptTag({path:'js/icons.js'});await page.addScriptTag({path:'js/learning-sky.js'});await page.evaluate(()=>Icons.install());
  await page.evaluate(()=>{LearningWorkspaceView.render(document.getElementById('homeBody'),{view:'home',preferences:{},due:79,activeResources:[{title:'隔离测试课程',available:true,resourceId:'fixture'}],status:''},{navigate(){},resume(){},review(){},open(){},select(){}});});
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#pageHome .learning-workspace')).paddingTop),'4px');
  for(const id of ['btnStats','btnDecks'])assert.equal(await page.locator('#'+id).isVisible(),false,'duplicate '+id+' hidden');
  assert.equal(await page.locator('#workspaceNavHost .learning-global-nav a').count(),4);
  assert.equal(await page.getByRole('link',{name:'学习记录',exact:true}).getAttribute('href'),'main.html?view=stats');
  assert.equal(await page.getByRole('link',{name:'管理在学',exact:true}).count(),1);
  await page.evaluate(()=>{window.settingsClicks=0;document.getElementById('btnSettingsTop').onclick=()=>settingsClicks++;});await page.locator('#btnSettingsTop').click();assert.equal(await page.evaluate(()=>settingsClicks),1);
  await page.getByRole('link',{name:'学习记录',exact:true}).focus();
  await page.evaluate(()=>LearningWorkspaceView.render(document.getElementById('homeBody'),{view:'home',preferences:{},due:79,activeResources:[{title:'隔离测试课程',available:true,resourceId:'fixture'}],status:''},{navigate(){},resume(){},review(){},open(){},select(){}}));
  assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('href')),'main.html?view=stats','navigation focus survives refresh');
  const rows=await page.evaluate(()=>({nav:document.getElementById('workspaceNavHost').getBoundingClientRect().toJSON(),brand:document.querySelector('.brand').getBoundingClientRect().toJSON()}));
  if(width>=1000)assert.ok(Math.abs((rows.nav.top+rows.nav.height/2)-(rows.brand.top+rows.brand.height/2))<2,'one row on desktop');else assert.ok(rows.nav.top>=rows.brand.top&&rows.nav.top<rows.brand.bottom+44&&(rows.nav.right<=rows.brand.left||rows.nav.left>=rows.brand.right||rows.nav.top>=rows.brand.bottom),'navigation remains within two non-overlapping rows on narrow screens');
  assert.equal(await page.locator('#btnHomeTop').isVisible(),false,'duplicate icon hidden at home');
  assert.equal(await page.getByRole('link',{name:'jqka.top 学习首页'}).isVisible(),true,'brand entry kept');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'output/playwright/home-header-compact/home-'+width+'.png'});
  await page.evaluate(()=>{document.getElementById('pageHome').classList.add('hidden');document.getElementById('pagePractice').classList.remove('hidden');});
  assert.equal(await page.locator('#btnHomeTop').isVisible(),true,'icon retained outside home');
  for(const id of ['btnStats','btnDecks'])assert.equal(await page.locator('#'+id).isVisible(),true,'practice tool retained');
  assert.equal(await page.locator('#workspaceNavHost .learning-global-nav').isVisible(),false,'workspace navigation hidden during practice');
 }
 console.log('Unified header: four text links, settings click, retained navigation focus, desktop/mobile rows and practice tools passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
