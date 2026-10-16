'use strict';
const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const covers=require('../js/course-covers.js');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('http://card-fixture.invalid/**',route=>{const file=new URL(route.request().url()).pathname.slice(1);return covers.variants.includes(file)||file==='assets/covers/oral-3000.webp'?route.fulfill({contentType:'image/webp',body:fs.readFileSync(file)}):route.abort();});
 await page.setContent('<html lang="zh-CN"><base href="http://card-fixture.invalid/"><style>body{margin:0;padding:24px;font-family:system-ui;background:linear-gradient(#cde6f6,#f0efe2);min-height:100vh}*{box-sizing:border-box}h2{font-size:16px}</style><h2>我的内容</h2><main id="personal"></main><h2>发现</h2><main id="discovery"></main><button id="outside">测试外部点击</button></html>');
 for(const file of ['assets/learning-workspace.css','assets/content-card.css'])await page.addStyleTag({path:path.resolve(file)});
 for(const file of ['js/learning-workspace.js','js/course-covers.js','js/content-card.js'])await page.addScriptTag({path:path.resolve(file)});
 await page.evaluate(()=>window.LearningNavigation={create:()=>document.createElement('nav')});
 await page.addScriptTag({path:path.resolve('js/learning-workspace-view.js')});
 await page.evaluate(()=>{
  window.calls=[];
  const specifications=[
   {id:'default',title:'默认封面与一个非常长的标题，用于检查截断而不是挤出菜单'},
   {id:'custom',title:'专属封面',coverUrl:'assets/covers/oral-3000.webp'},
   {id:'book',title:'单词本',kind:'wordbook',activities:['vocabulary'],sourceRefs:[{type:'vocabulary-book',id:'test-book'}]},
   {id:'unavailable',title:'暂不可用',available:false}
  ];
  window.resources=specifications.map(spec=>LearningWorkspace.normalizeResource({resourceId:'course:'+spec.id,courseId:spec.id,kind:'course',visibility:'private',available:true,activities:['chunks'],sourceRefs:[{type:'sentence-deck',id:spec.id}],...spec}));
  window.drawBoth=()=>['my-learning','discover'].forEach(view=>LearningWorkspaceView.render(document.getElementById(view==='my-learning'?'personal':'discovery'),{view,resources,publicResources:resources,preferences:{},memberships:{default:{joined:true},custom:{joined:true}},vocabularyResumes:{'test-book':{status:'active'}}},{navigate(){},filter(){},select:(...args)=>calls.push(['select',view,...args]),open:r=>calls.push(['open',view,r.resourceId]),leave:id=>{calls.push(['leave',view,id]);return Promise.resolve();}}));drawBoth();
 });
 const output=path.resolve('output/playwright/content-card');fs.mkdirSync(output,{recursive:true});
 for(const dark of [false,true])for(const width of [902,390]){
  await page.setViewportSize({width,height:1000});await page.evaluate(dark=>{document.documentElement.classList.toggle('dark',dark);drawBoth();},dark);
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.content-card-cover')).every(img=>img.complete&&img.naturalWidth>0));
  assert.equal(await page.locator('.content-card').count(),8);
  const metrics=await page.evaluate(()=>{
   const fields=['display','flexDirection','backgroundColor','borderRadius','padding','gap','fontSize','lineHeight','aspectRatio','objectFit'];
   const read=el=>{const style=getComputedStyle(el);return Object.fromEntries(fields.map(key=>[key,style[key]]));};
   return ['personal','discovery'].map(id=>Array.from(document.querySelectorAll('#'+id+' .content-card')).map(card=>({card:read(card),cover:read(card.querySelector('img')),copy:read(card.querySelector('.content-card-copy')),title:read(card.querySelector('h3')),tag:read(card.querySelector('.content-card-kind'))})));
  });
  assert.deepEqual(metrics[0],metrics[1],'the same resource has identical presentation across pages');
  assert.equal(metrics[0][0].card.backgroundColor,'rgba(0, 0, 0, 0)');
  assert.notEqual(metrics[0][1].card.backgroundColor,'rgba(0, 0, 0, 0)');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(output,(dark?'dark':'light')+'-'+width+'.png'),fullPage:true});
 }
 const library=page.locator('#personal .content-card').first(),discovery=page.locator('#discovery .content-card').first();
 assert.match(await library.locator('.content-card-title').getAttribute('href'),/courseView=joined.*returnView=my-learning/);
 assert.match(await discovery.locator('.content-card-title').getAttribute('href'),/courseView=discover.*returnView=discover/);
 await library.locator('summary').click();await discovery.locator('summary').click();assert.equal(await page.locator('.content-card-menu[open]').count(),1,'menu coordination works across both contexts');
 await discovery.getByRole('button',{name:'收藏',exact:true}).click();
 await discovery.locator('summary').click();await discovery.getByRole('button',{name:'继续学习',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>calls.map(call=>call.slice(0,2))),[['select','discover'],['open','discover']],'business callbacks stay supplied by the page');
 const book=page.locator('#personal .content-card').nth(2);assert.match(await book.locator('.content-card-title').getAttribute('href'),/wordbook-details\.html\?book=test-book/);
 await book.locator('summary').click();assert.equal(await book.getByRole('button',{name:'继续练习',exact:true}).count(),1);
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#discovery .content-card').last().locator('a.content-card-title').count(),0,'unavailable content is not a launch link');
 assert.deepEqual(errors,[]);
 const touch=await browser.newPage({hasTouch:true,viewport:{width:390,height:700}});
 await touch.setContent('<main class="learning-workspace workspace-library" id="library"></main><main class="learning-workspace workspace-discover" id="discover"></main>');
 for(const file of ['assets/learning-workspace.css','assets/content-card.css'])await touch.addStyleTag({path:path.resolve(file)});
 await touch.addScriptTag({path:path.resolve('js/content-card.js')});
 await touch.evaluate(()=>['library','discover'].forEach(variant=>{const action=document.createElement('button');action.textContent='测试操作';document.getElementById(variant).append(ContentCard.create({resource:{resourceId:'touch-'+variant,title:'触屏卡片'},variant,kindLabel:'句子',items:[action]}));}));
 for(const trigger of await touch.locator('summary').all()){assert.equal((await trigger.boundingBox()).height,44);await trigger.click();assert.ok((await touch.locator('.content-card-menu[open] button').boundingBox()).height>=44);}
 await touch.close();
 console.log('Shared content card: identical cross-page presentation at 902/390 in light/dark; transparent/custom covers, links, availability, callbacks, menus, wordbook resume and 44px touch targets passed.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
