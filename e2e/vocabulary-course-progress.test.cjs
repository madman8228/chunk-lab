'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright-core');

(async()=>{
 const instance=await require('../scripts/serve-wordbook-acceptance.cjs').createAcceptance(0);let browser;
 try{
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:925,height:932}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const enter=async account=>{await page.goto(instance.base+'/acceptance');await page.getByRole('button',{name:account==='reviewer'?'进入验收账号':'进入对照账号',exact:true}).click();await page.getByText(account==='reviewer'?'已进入验收账号。请重新打开产品页面，开始操作。':'已进入对照账号。请重新打开产品页面，开始操作。',{exact:true}).waitFor();};
  const saveCourse=async()=>{
   await page.goto(instance.base+'/wordbook-create.html');await page.waitForFunction(()=>document.querySelector('#bookAIWorkbench')?.getAttribute('aria-busy')==='false');
   const draft=structuredClone(instance.draft);draft.book.units=[{unitId:'adult-u1',title:'成人英语·第一单元'},{unitId:'adult-u2',title:'成人英语·第二单元'}];draft.items.forEach((item,index)=>{item.unitId=index<3?'adult-u1':'adult-u2';});
   page.once('dialog',dialog=>dialog.accept());await page.locator('#bookAIFile').setInputFiles({name:'adult-six-two-unit-acceptance.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(draft))});
   await page.getByText(/已打开单词本/).waitFor();await page.getByRole('button',{name:'保存当前单词本',exact:true}).click();await page.locator('#studyPersonalWordbook').waitFor({state:'visible'});
   const id=new URL(await page.locator('#studyPersonalWordbook').getAttribute('href'),instance.base).searchParams.get('book');return id;
  };
  const completeUnit=async(unitIndex)=>{
   await page.goto(instance.base+'/wordbook-details.html?book='+encodeURIComponent(bookId));
   const unitLink=page.getByRole('link',{name:'练习本单元',exact:true}).nth(unitIndex);await unitLink.click();
   await page.locator('#studyRoot input').waitFor();
   for(let index=unitIndex*3;index<unitIndex*3+3;index++){
    const item=instance.draft.items[index];for(const step of item.guidedSteps){await page.locator('#studyRoot input').fill(step.answer);await page.locator('#studyRoot input').press('Enter');}
    await page.getByText('辅助练习与下一词位置已保存。',{exact:true}).waitFor();
    if(index<unitIndex*3+2){await page.getByRole('button',{name:'下一词',exact:true}).click();await page.waitForFunction((n)=>document.getElementById('bookPosition')?.textContent.startsWith((n+2)+' / 3'),index-unitIndex*3);}
   }
  };
  await enter('reviewer');var bookId=await saveCourse();
  await completeUnit(0);
  let result=await page.evaluate(async id=>(await fetch('/api/learning-archive/vocabulary/courses?bookId='+encodeURIComponent(id),{headers:{authorization:'Bearer '+localStorage.getItem('chunklab_token')}})).json(),bookId);
  assert.equal(result.course.state,'in-progress');assert.equal(result.course.completedItems,3);assert.deepEqual(result.course.units.map(unit=>unit.completedItems),[3,0]);
  await page.goto(instance.base+'/wordbook-details.html?book='+encodeURIComponent(bookId));await page.locator('.book-progress:not([hidden])').waitFor();assert.match(await page.locator('.book-progress').innerText(),/3 \/ 6 词/);
  await page.route('**/api/learning-archive/vocabulary/courses*',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));await page.reload();await page.getByRole('status').filter({hasText:'进度暂不可读'}).waitFor();await page.unroute('**/api/learning-archive/vocabulary/courses*');await page.locator('.book-progress').getByRole('button',{name:'重试',exact:true}).click();await page.locator('.book-progress').getByText(/3 \/ 6 词/).waitFor();
  await completeUnit(1);
  result=await page.evaluate(async id=>(await fetch('/api/learning-archive/vocabulary/courses?bookId='+encodeURIComponent(id),{headers:{authorization:'Bearer '+localStorage.getItem('chunklab_token')}})).json(),bookId);
  assert.equal(result.course.state,'completed');assert.equal(result.course.completedItems,6);assert.deepEqual(result.course.units.map(unit=>unit.completedItems),[3,3]);
  await page.goto(instance.base+'/wordbook-details.html?book='+encodeURIComponent(bookId));await page.locator('.book-progress').getByText('已完成版本 1 个',{exact:true}).waitFor();
  await page.goto(instance.base+'/main.html?view=stats');const stats=page.locator('#statsPageHost'),archive=stats.locator('#statsVocabulary');await archive.getByRole('link',{name:/成人六词.*完成/}).waitFor();await archive.getByText(/当前已完成练习 1 门/).waitFor();
  await stats.locator('[data-tab="sent"]').click();await archive.getByRole('link',{name:/我的课程 · .*成人六词/}).first().waitFor();
  await enter('other');const otherBook=await saveCourse();await page.goto(instance.base+'/wordbook.html?book='+encodeURIComponent(otherBook));await page.locator('#studySkip').waitFor();
  for(let index=0;index<6;index++){
   await page.locator('#studySkip').click();
   if(index<5)await page.waitForFunction(n=>document.getElementById('bookPosition')?.textContent.startsWith((n+2)+' / 6'),index);
  }
  const skipped=await page.evaluate(async id=>(await fetch('/api/learning-archive/vocabulary/courses?bookId='+encodeURIComponent(id),{headers:{authorization:'Bearer '+localStorage.getItem('chunklab_token')}})).json(),otherBook);
  assert.equal(skipped.course.completedItems,0);assert.notEqual(skipped.course.state,'completed');assert.equal(skipped.course.completedVersions.length,0);
  for(const width of [925,390]){await page.setViewportSize({width,height:932});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  assert.deepEqual(errors,[]);console.log('Vocabulary course progress E2E passed: two-unit add/detail/study/stats, unit aggregation, completed practice and skip exclusion. Isolated instance: '+instance.temp);
 }finally{await browser?.close();await instance.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
