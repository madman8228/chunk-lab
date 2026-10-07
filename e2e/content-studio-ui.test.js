'use strict';
/* Synthetic API only: never publishes real assets or opens an application DB. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname,'..');
const server = http.createServer((req,res)=>{
  const file = req.url === '/content-studio.js' ? 'content-studio.js' : 'content-studio.html';
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');
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
  let releaseA, releaseSave, failSave=true, failPublish=true, drafts=0, publications=0;
  const gateA=new Promise(resolve=>{releaseA=resolve;});
  function course(id){return {course:{id,name:id.toUpperCase(),items:[{cid:id+'-1',sentence:'Hello.',translation:'你好。',chunks:['Hello.'],hints:['你好'],explanations:['问候']} ]},revision:0};}
  await page.route('**/api/**',async route=>{
    const request=route.request(),url=new URL(request.url()).pathname;
    let data={},status=200;
    if(url.endsWith('/me')) data={};
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
  for(const width of [1280,390]){
    await page.setViewportSize({width,height:850});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  assert.deepEqual(errors,[]);
  console.log('[content-studio-ui] stale reads, unsaved switch, failed save/publish, locks and responsive layout passed');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}})().catch(error=>{console.error(error);process.exitCode=1;});
