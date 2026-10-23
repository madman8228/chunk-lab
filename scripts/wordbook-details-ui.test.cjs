'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const html=fs.readFileSync('wordbook-details.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'');
  await page.route('**/wordbook-details.html*',r=>r.fulfill({body:html,contentType:'text/html'}));
  await page.route('**/assets/catalog/*.svg',r=>r.fulfill({body:fs.readFileSync(new URL(r.request().url()).pathname.slice(1)),contentType:'image/svg+xml'}));
  await page.goto('http://127.0.0.1:9979/wordbook-details.html?book=fixture');
  for(const file of ['landing/theme.css','assets/learning-workspace.css','assets/learning-sky.css','assets/wordbook-details.css'])await page.addStyleTag({path:file});
  await page.addStyleTag({path:'assets/lesson-card.css'});
  await page.addScriptTag({path:'js/course-covers.js'});
  await page.addScriptTag({path:'js/course-return.js'});
  await page.addScriptTag({path:'js/lesson-card.js'});
  await page.addScriptTag({path:'js/learning-sky.js'});
  await page.evaluate(()=>{
   window.requests=[];window.failDetails=false;window.ChunkAPI={request:async(url,options)=>{requests.push({url,options});
    if(url.endsWith('/details')){if(failDetails)throw Object.assign(Error('HTTP 404'),{status:404});return {title:'词书详情夹具',itemCount:6,features:{unitSessions:true},units:Array.from({length:6},(_,i)=>({unitId:'unit-'+(i+1),title:i===0?'Unit 1 How can we become good learners?':'Unit '+(i+1)+' A long sample title that can wrap naturally',itemCount:10+i})),catalog:{description:'整本教材词汇课程；原创例句。',facets:{grades:['三年级']}}};}
    if(url.includes('/items'))return {title:'旧版词书',itemCount:2,items:[{itemId:'fixture:borrow',contentRevision:'fixture'}],nextOffset:null};
    return {word:'borrow',meaning:'借入',translation:'我可以借你的充电器吗？'};
   }};
  });
  await page.addScriptTag({path:'landing/wordbook-details.js'});
  await page.getByRole('heading',{name:'单元目录',exact:true}).waitFor();
  assert.equal(await page.getByText('词汇课程，原创例句',{exact:true}).count(),1,'course description uses the shorter approved display copy');
  assert.equal(await page.getByRole('link',{name:'开始 / 继续练习',exact:true}).count(),0,'whole-book start is removed in favor of unit entry points');
  assert.equal(await page.locator('.book-progress').count(),0,'course-level progress status is removed from the header');
  assert.equal(await page.locator('.book-material-nav').count(),0,'books without materials have no empty dialogue/reading entries');
  assert.equal((await page.evaluate(()=>requests)).length,1,'details does not load every unit or start a session');
  await page.locator('.book-list li').first().getByRole('button',{name:'查看内容',exact:true}).click();await page.getByText('borrow · 借入',{exact:true}).waitFor();
  assert.ok((await page.evaluate(()=>requests)).some(x=>x.url.includes('/units/unit-1/items?offset=0&limit=20')));
  await page.getByRole('button',{name:'返回单元目录',exact:true}).click();await page.getByRole('heading',{name:'单元目录',exact:true}).waitFor();
  assert.equal(await page.locator('.book-list li').first().getByRole('link',{name:'练习本单元',exact:true}).count(),1,'unit practice remains available');
  fs.mkdirSync('output/playwright/wordbook-details',{recursive:true});
  fs.mkdirSync('output/playwright/wordbook-details-cards',{recursive:true});
  for(const width of [1440,1024,768,390,360]){await page.setViewportSize({width,height:932});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const columns=await page.locator('.book-list').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);assert.equal(columns,width>=900?3:width>=601?2:1,'unit cards reflow at '+width+'px');await page.screenshot({path:'output/playwright/wordbook-details-cards/details-'+width+'.png',fullPage:true});}
  await page.evaluate(()=>{failDetails=true;document.querySelector('#detailsRoot').replaceChildren();});
  await page.addScriptTag({path:'landing/wordbook-details.js'});await page.getByRole('heading',{name:'内容目录',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'单元目录',exact:true}).count(),0,'legacy books have no fake units');
  assert.ok((await page.evaluate(()=>requests)).every(x=>!x.options.method),'only reads, no session/save operations');
  assert.deepEqual(errors,[]);console.log('Wordbook details: read-only entry, lazy unit preview, return, legacy fallback and five responsive widths passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
