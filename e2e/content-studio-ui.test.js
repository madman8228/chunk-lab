'use strict';
/* Synthetic API only: never publishes real assets or opens an application DB. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname,'..');
const server = http.createServer((req,res)=>{
  const file = (req.url || '').split('?')[0].slice(1);
  if (!['content-studio.html','content-studio.js','assets/content-studio.css','js/membership.js','js/learning-workspace.js','js/library-metadata-editor.js'].includes(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
  res.end(fs.readFileSync(path.join(root,file)));
});
let browser;
(async()=>{try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});
  const page=await browser.newPage({viewport:{width:1280,height:850}}), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>localStorage.setItem('chunklab_admin_token','synthetic-token'));
  let releaseA, releaseSave, releaseMetadataA, releaseMetadataSave, metadataDrafts=0, failSave=true, failPublish=true, drafts=0, publications=0;
  const gateA=new Promise(resolve=>{releaseA=resolve;});
  function course(id){return {course:{id,name:id.toUpperCase(),items:[{cid:id+'-1',sentence:'Hello.',translation:'你好。',chunks:['Hello.'],hints:['你好'],explanations:['问候']} ]},revision:0};}
  await page.route('**/api/**',async route=>{
    const request=route.request(),url=new URL(request.url()).pathname;
    let data={},status=200;
    if(url.endsWith('/me')) data={};
    else if(url==='/api/admin/library/resources') data={resources:['a','b'].map(id=>({resourceId:'catalog:'+id,title:'目录 '+id,sourceRefs:[]}))};
    else if(url.startsWith('/api/admin/library/resources/')) {
      const isDraft=url.endsWith('/draft');
      const id=decodeURIComponent(url.split('/').at(isDraft?-2:-1));
      if(isDraft){metadataDrafts++;assert.equal(request.postDataJSON().resource.resourceId,'catalog:b');await new Promise(resolve=>{releaseMetadataSave=resolve;});data={revision:2};}
      else {if(id==='catalog:a')await new Promise(resolve=>{releaseMetadataA=resolve;});data={revision:1,status:'draft',resource:{resourceId:id,kind:'course',title:'已加载 '+id,sourceRefs:[]}};}
    }
    else if(url==='/api/admin/membership/course-publications') data={publications:[]};
    else if(url==='/api/admin/content/courses') data={courses:['a','b'].map(id=>({id,name:id.toUpperCase(),itemCount:1}))};
    else if(url.endsWith('/a')) {await gateA;data=course('a');}
    else if(url.endsWith('/b')) data=course('b');
    else if(url.endsWith('/validate')) data={valid:true,errors:[],warnings:[]};
    else if(url.endsWith('/draft')) {
      drafts++;const body=request.postDataJSON();assert.equal(body.course.id,'b');
      if(failSave){failSave=false;status=409;data={error:'模拟草稿版本冲突'};}
      else {if(drafts===2)await new Promise(resolve=>{releaseSave=resolve;});data={revision:drafts};}
    } else if(url.endsWith('/publish')) {
      publications++;assert.equal(request.postDataJSON().revision,drafts);
      if(failPublish){failPublish=false;status=500;data={error:'模拟发布失败，原件保留'};}
      else data={revision:drafts,cacheVersion:'synthetic-cache'};
    } else throw new Error('unexpected fixture request '+url);
    await route.fulfill({status,json:data});
  });
  await page.goto(base+'/content-studio.html',{waitUntil:'domcontentloaded'});
  await page.locator('[data-course="b"]').click();
  await page.waitForFunction(()=>document.getElementById('activeCourse').textContent==='B');
  releaseA();await page.waitForTimeout(100);
  assert.equal(await page.locator('#activeCourse').innerText(),'B');
  await page.locator('#sentence').fill('Hello again.');
  assert.equal(await page.locator('.item-option.active .item-en').innerText(),'Hello again.','list summary follows edits');
  await page.locator('#itemSearch').fill('again');
  await page.locator('#sentence').fill('Changed.');
  assert.equal(await page.locator('.item-option').count(),0,'search follows the edited model');
  assert.equal(await page.locator('#sentence').evaluate(el=>el===document.activeElement),true,'summary updates preserve editor focus');
  await page.locator('#sentence').fill('Hello again.');
  await page.locator('#itemSearch').fill('');
  await page.locator('.hint-text').fill('你好，朋友');
  await page.locator('.explanation-text').fill('熟人之间再次见面时的问候。');
  await page.locator('#libraryMetadataOpen').click();
  await page.locator('#libraryMetadataPanel').waitFor({state:'visible'});
  await page.locator('[name="title"]').fill('暂未保存的目录标题');
  await page.locator('#protectedPublicationOpen').click();
  assert.equal(await page.locator('#libraryMetadataPanel').isVisible(),false,'utility tasks do not stack');
  assert.equal(await page.locator('.top').isVisible(),true,'navigation remains available in publication mode');
  await page.locator('#libraryMetadataOpen').click();
  assert.equal(await page.locator('[name="title"]').inputValue(),'暂未保存的目录标题','switching views retains unsaved metadata');
  await page.locator('#editorOpen').click();
  assert.equal(await page.locator('#sentence').inputValue(),'Hello again.');
  assert.equal(await page.locator('.explanation-text').inputValue(),'熟人之间再次见面时的问候。');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.locator('[data-course="a"]').click();
  assert.equal(await page.locator('#sentence').inputValue(),'Hello again.');
  await page.locator('#save').click();
  await page.waitForFunction(()=>document.getElementById('state').textContent.includes('模拟草稿'));
  assert.equal(await page.locator('#sentence').inputValue(),'Hello again.');
  await page.locator('#save').click();
  await page.waitForFunction(()=>document.getElementById('save').disabled);
  await page.locator('[data-course="a"]').click();
  assert.equal(await page.locator('#activeCourse').innerText(),'B');
  assert.equal(await page.locator('#editor').evaluate(el=>el.inert),true);
  await page.waitForTimeout(50);assert.equal(drafts,2);releaseSave();
  await page.waitForFunction(()=>!document.getElementById('save').disabled);
  await page.locator('#publish').click();
  await page.waitForFunction(()=>document.getElementById('state').textContent.includes('模拟发布失败'));
  assert.equal(await page.locator('#sentence').inputValue(),'Hello again.');
  await page.locator('#publish').click();
  await page.waitForFunction(()=>document.getElementById('state').textContent.includes('发布成功'));
  assert.equal(publications,2);
  await page.locator('#libraryMetadataOpen').click();
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByLabel('已有目录内容').selectOption('catalog:a');
  assert.equal(await page.locator('[name="title"]').inputValue(),'暂未保存的目录标题','declined switch retains unsaved metadata');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByLabel('已有目录内容').selectOption('catalog:a');
  await page.waitForFunction(()=>document.querySelector('.library-metadata-form').inert);
  page.once('dialog',dialog=>dialog.accept());
  await page.getByLabel('已有目录内容').selectOption('catalog:b');
  await page.waitForFunction(()=>document.querySelector('[name="title"]').value==='已加载 catalog:b');
  releaseMetadataA();await page.waitForTimeout(50);
  assert.equal(await page.getByLabel('已有目录内容').inputValue(),'catalog:b');
  assert.equal(await page.locator('[name="resourceId"]').inputValue(),'catalog:b','late directory responses cannot overwrite selection');
  await page.locator('[name="title"]').fill('目录 B 修改');
  assert.equal(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}),true,'metadata participates in leave protection');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'新建引用集合',exact:true}).click();
  assert.equal(await page.locator('[name="resourceId"]').inputValue(),'catalog:b','new collection requires discarding dirty input');
  await page.getByRole('button',{name:'保存目录草稿',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('select[aria-label="已有目录内容"]').disabled);
  assert.equal(await page.getByRole('button',{name:'新建引用集合',exact:true}).isDisabled(),true,'saving locks directory identity');
  await page.waitForFunction(()=>!!document.querySelector('.library-metadata-form').inert);
  releaseMetadataSave();
  await page.waitForFunction(()=>!document.querySelector('.library-metadata-form').inert);
  assert.equal(metadataDrafts,1);
  assert.equal(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}),false,'saved metadata leaves normally');
  await page.locator('#editorOpen').click();
  const captures=path.join(root,'.impeccable/review/content-studio');fs.mkdirSync(captures,{recursive:true});
  for(const width of [1440,953,390]){
    await page.setViewportSize({width,height:850});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.ok(await page.locator('#sentence').evaluate(el=>el.getBoundingClientRect().height)<=44,'one-line default');
    await page.screenshot({path:path.join(captures,width===1440?'desktop.png':width===390?'mobile.png':'user-953.png'),fullPage:true});
  }
  await page.locator('#showCourses').click();
  await page.locator('#hideCourses').click();
  assert.equal(await page.locator('.course-pane').isVisible(),false);
  await page.locator('#showCourses').click();
  assert.equal(await page.locator('.course-pane').isVisible(),true);
  await page.locator('summary').click();
  assert.equal(await page.locator('#previewSentence').isVisible(),true);
  assert.deepEqual(errors,[]);
  console.log('[content-studio-ui] stale reads, unsaved switch, failed save/publish, locks and responsive layout passed');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}})().catch(error=>{console.error(error);process.exitCode=1;});
