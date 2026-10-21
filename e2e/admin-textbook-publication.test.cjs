'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{chromium}=require('playwright-core');
(async()=>{
 const instance=await require('../scripts/serve-wordbook-acceptance.cjs').createAcceptance(0);let browser;
 const report=fs.mkdtempSync(path.join(os.tmpdir(),'admin-textbook-ui-'));
 try{
  const facets={publisherId:'隔离出版社',seriesId:'隔离英语',edition:'2026',volume:'全一册'};
  const drafts=[0,1].map(n=>{
   const d=structuredClone(instance.draft);d.book={bookId:'textbook-wordbook:test-unit-'+n,title:'测试单元',catalog:{facets},units:[{unitId:'unit-'+n,title:'Unit '+(n+1)}]};
   d.items=Array.from({length:21},(_,i)=>({...structuredClone(d.items[i%6]),itemId:'textbook-test:'+n+'-'+i,unitId:'unit-'+n}));return d;
  });
  const source={format:'textbook-wordbook-package',schemaVersion:1,book:{bookId:'textbook-wordbook:whole-ui',title:'整本教材隔离验收',catalog:{facets}},units:drafts.map(d=>({...d.book.units[0],itemIds:d.items.map(i=>i.itemId)})),drafts};
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(token=>localStorage.setItem('chunklab_admin_token',token),instance.adminToken);
  let rejectOneListRead=true;await page.route('**/api/admin/system-wordbooks/published',async route=>{if(rejectOneListRead){rejectOneListRead=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'隔离测试的一次性读取故障'})});}else await route.continue();});
  await page.goto(instance.base+'/content-studio.html');await page.getByRole('button',{name:'系统单词课程'}).click();await page.getByText('读取失败：隔离测试的一次性读取故障',{exact:true}).waitFor();await page.locator('#swRefresh').click();await page.locator('#swStatus').waitFor({state:'hidden'});await page.getByRole('button',{name:'导入整本教材',exact:true}).waitFor();
  await page.locator('#swFile').setInputFiles({name:'whole-textbook.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(source))});
  await page.getByRole('button',{name:'导入整本教材',exact:true}).click();await page.getByText('技术检查通过',{exact:true}).waitFor();
  assert.equal(await page.locator('#swUnit option').count(),2);
  await page.locator('#swUnit').selectOption('21');await page.waitForFunction(()=>document.querySelector('.sw-preview-nav>span')?.textContent==='22 / 42');
  await page.locator('#swIssueForm>summary').click();await page.getByRole('button',{name:'记录问题',exact:true}).click();await page.locator('.sw-pending').waitFor();assert.equal(await page.locator('#swPublish').isDisabled(),true);
  await page.locator('#swUnit').selectOption('0');await page.waitForFunction(()=>document.querySelector('.sw-preview-nav>span')?.textContent==='1 / 42');assert.equal(await page.locator('#swPublish').isDisabled(),true,'another unit issue still blocks the entire textbook');
  await page.locator('.sw-issue-link').click();await page.waitForFunction(()=>document.querySelector('#swUnit')?.value==='21');
  await page.locator('#swIssueForm>summary').click();await page.getByRole('button',{name:'撤销标记'}).click();await page.waitForFunction(()=>!document.querySelector('.sw-pending'));
  for(const width of [1440,390]){await page.setViewportSize({width,height:932});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(report,'review-'+width+'.png'),fullPage:true});}
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'发布整本教材',exact:true}).click();await page.getByText('已发布：整本教材隔离验收。',{exact:true}).waitFor();
   const replacementImage='assets/vocab-g7-lower-u1-africa-wide-v1.webp',replacementTarget=path.join(instance.appRoot,replacementImage);if(!fs.existsSync(replacementTarget))fs.copyFileSync(path.resolve(__dirname,'../'+replacementImage),replacementTarget);const correction=structuredClone(source);correction.drafts[0].items[0].meaning='隔离修订后的释义';correction.drafts[0].items[0].images={wide:[replacementImage],mobile:[replacementImage]};await page.goto(instance.base+'/content-studio.html');await page.getByRole('button',{name:'系统单词课程'}).click();
   await page.locator(`[data-revise="${source.book.bookId}"]`).click();await page.locator(`[data-revision-file="${source.book.bookId}"]`).setInputFiles({name:'whole-textbook-correction.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(correction))});
   await page.locator('.sw-change-summary').waitFor();assert.equal(await page.locator('.sw-change-summary li').count(),1);assert.equal(await page.locator('.sw-item-diff del').count(),1,'the update review shows the before/after text');await page.locator('.sw-image-diff img').nth(1).waitFor();assert.equal(await page.locator('.sw-image-diff img').count(),2,'the update review lets an administrator compare old and new images');assert.equal(await page.getByRole('button',{name:'确认更新整本教材',exact:true}).isEnabled(),true);
   page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'确认更新整本教材',exact:true}).click();await page.getByText('已发布：整本教材隔离验收。',{exact:true}).waitFor();
  await page.goto(instance.base+'/wordbook-details.html?book='+encodeURIComponent(source.book.bookId));await page.getByRole('heading',{name:source.book.title}).waitFor();
  assert.match(await page.locator('body').innerText(),/Unit 1/);assert.match(await page.locator('body').innerText(),/Unit 2/);
   assert.deepEqual(errors,[]);console.log('Whole textbook import, cross-page unit navigation, cross-unit issue gate, correction preview/update, and two learner units passed. Screenshots: '+report);
 }finally{await browser?.close();await instance.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
