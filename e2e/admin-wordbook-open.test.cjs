'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright-core');
(async()=>{
 const instance=await require('../scripts/serve-wordbook-acceptance.cjs').createAcceptance(0);let browser;
 try{
  const source=structuredClone(instance.draft);source.book.bookId='open-review-fixture';for(const item of source.items)item.itemId=source.book.bookId+':'+item.word;
  const created=await instance.request('/api/admin/system-wordbooks',instance.adminToken,source);
  await instance.request('/api/admin/system-wordbooks/'+created.importId+'/validate',instance.adminToken,{revision:created.revision});
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});const page=await browser.newPage({viewport:{width:1100,height:932}}),requests=[];
  await page.addInitScript(token=>localStorage.setItem('chunklab_admin_token',token),instance.adminToken);
  await page.goto(instance.base+'/content-studio.html?view=system-wordbooks');await page.locator('#swTab-pending').click();
  page.on('request',request=>{const url=new URL(request.url());if(url.pathname.includes(created.importId))requests.push({method:request.method(),path:url.pathname,search:url.search});});
  let release,failNext=false;const gate=new Promise(resolve=>{release=resolve;});await page.route('**/api/admin/system-wordbooks/'+created.importId,async route=>{await gate;if(failNext){failNext=false;await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'隔离网络失败'})});}else await route.continue();});
  const before=await page.locator('#swDrafts').boundingBox(),button=page.locator('[data-open="'+created.importId+'"]'),start=Date.now();await button.click();
  assert.equal(await button.isDisabled(),true);assert.match(await button.innerText(),/打开中/);await button.evaluate(node=>node.dispatchEvent(new Event('click')));
  const during=await page.locator('#swDrafts').boundingBox();assert.equal(during.y,before.y,'a top notice does not push the list down');
  const fs=require('node:fs'),path=require('node:path'),out=path.resolve(__dirname,'../output/playwright/admin-wordbook-open');fs.mkdirSync(out,{recursive:true});
  for(const width of [1100,390]){await page.setViewportSize({width,height:932});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const box=await page.locator('#swStatus').boundingBox();assert.ok(box.y>=0&&box.x>=0&&box.x+box.width<=width);await page.screenshot({path:path.join(out,'opening-'+width+'.png'),fullPage:true});}
  release();await page.locator('#swDetail').waitFor({state:'visible'});await page.locator('.sw-word-row h3').waitFor();await page.waitForLoadState('networkidle');
  console.log(JSON.stringify({openMs:Date.now()-start,requests},null,2));
  assert.equal(requests.filter(r=>r.path==='/api/admin/system-wordbooks/'+created.importId).length,1,'opening review must not fetch the same full detail twice');
  assert.equal(requests.filter(r=>r.method==='POST'&&r.path.endsWith('/validate')).length,0,'an unchanged validated draft must not be fully revalidated on every reopen');
  const notice=await page.locator('#swStatus').evaluate(node=>({position:getComputedStyle(node).position,height:node.getBoundingClientRect().height}));assert.equal(notice.position,'fixed','messages must float at the viewport top without moving course content');
  await page.getByRole('button',{name:'返回课程列表',exact:true}).click();failNext=true;await page.getByRole('button',{name:'继续审核',exact:true}).click();await page.getByText('读取草稿失败：隔离网络失败',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'继续审核',exact:true}).isEnabled(),true);
  await page.getByRole('button',{name:'关闭提示',exact:true}).click();assert.equal(await page.locator('#swStatus').isHidden(),true);await page.getByRole('button',{name:'继续审核',exact:true}).click();await page.locator('#swDetail').waitFor({state:'visible'});
 }finally{await browser?.close();await instance.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
