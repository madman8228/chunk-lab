'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');

module.exports=async function verifyResolution({browser,url,token,bookId,plan}){
 let historyChecks;
 for(const choice of ['cloud','local']){
  const contexts=[];
  async function device(){
   const context=await browser.newContext({serviceWorkers:'block'});contexts.push(context);
   await context.addInitScript(token=>localStorage.setItem('chunklab_token',token),token);
   const page=await context.newPage();await page.goto(url);
   await page.waitForFunction(()=>window.VocabularyBrowseStore&&window.ServerStore);
   await page.evaluate(async({bookId,planRevision})=>{await LearningSessionBootstrap.ready();window.resolutionStore=VocabularyBrowseStore.create({bookId,planRevision});await resolutionStore.open();},{bookId,planRevision:plan.revision});
   return {page,context};
  }
  async function waitForQueue(page,predicate){
   const deadline=Date.now()+15000;
   while(Date.now()<deadline){const rows=await page.evaluate(()=>ServerStore.pending());if(predicate(rows))return rows;await new Promise(resolve=>setTimeout(resolve,75));}
   throw Error('Queue condition timed out: '+JSON.stringify(await page.evaluate(()=>ServerStore.pending())));
  }
  const drained=page=>waitForQueue(page,rows=>rows.length===0);
  try{
   const local=await device();
   await local.page.evaluate(async target=>resolutionStore.enqueue('jump',target),plan.steps[0].stepId);await drained(local.page);
   await local.context.setOffline(true);
   await local.page.evaluate(async target=>resolutionStore.enqueue('continue',target),plan.steps[1].stepId);
   const rival=await device();
   await rival.page.evaluate(async target=>resolutionStore.enqueue('jump',target),plan.steps.at(-1).stepId);await drained(rival.page);
   await local.context.setOffline(false);
   await waitForQueue(local.page,rows=>rows[0]?.status==='blocked'&&rows[0].lastError==='RESUME_CONFLICT');
   await local.page.reload();await local.page.locator('.intro-conflict').getByRole('button',{name:'核对浏览位置',exact:true}).waitFor();
   await waitForQueue(local.page,rows=>rows[0]?.status==='blocked'&&rows[0].lastError==='RESUME_CONFLICT');
   const original=await local.page.evaluate(()=>ServerStore.pending());
   const panel=local.page.locator('.intro-conflict');
   const practice=local.page.locator('.intro-practice summary');
   if(await practice.count()){await practice.click();await local.page.locator('.intro-practice input[type=radio]').first().check();await local.page.evaluate(()=>window.retainedPractice=document.querySelector('.intro-practice input:checked'));}
   await panel.getByRole('button',{name:'核对浏览位置',exact:true}).click();
   await panel.getByRole('radio',{name:'使用云端位置',exact:true}).waitFor();
   assert.equal(await panel.locator('input:checked').count(),0);assert.equal(await panel.getByRole('button',{name:'请先选择位置'}).isDisabled(),true);
   assert.match(await panel.innerText(),new RegExp(plan.steps[1].presentation.text));
   if(process.env.BROWSE_CONFLICT_CAPTURE&&choice==='cloud'){
    const directory=path.resolve(__dirname,'../../.impeccable/review/wordbook-intro-conflict');fs.mkdirSync(directory,{recursive:true});
    for(const width of [1440,925,390,320]){await local.page.setViewportSize({width,height:932});await local.page.evaluate(()=>scrollTo(0,0));assert.ok(await local.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await local.page.screenshot({path:path.join(directory,'conflict-'+width+'.png'),fullPage:true});}
   }
   await panel.getByRole('radio',{name:'使用云端位置',exact:true}).focus();await local.page.keyboard.press('Space');assert.equal(await panel.getByRole('radio',{name:'使用云端位置',exact:true}).isChecked(),true);
   await local.page.evaluate(()=>{window.retainedConflict=document.querySelector('.intro-conflict input:checked');window.dispatchEvent(new Event('online'));});
   assert.ok(await local.page.evaluate(()=>retainedConflict.isConnected&&retainedConflict.checked));
   await panel.getByRole('button',{name:'暂不处理',exact:true}).click();assert.deepEqual(await local.page.evaluate(()=>ServerStore.pending()),original);assert.ok(await local.page.evaluate(()=>!window.retainedPractice||retainedPractice.isConnected&&retainedPractice.checked));
   if(choice==='cloud'){
    await local.context.setOffline(true);await panel.getByRole('button',{name:'核对浏览位置',exact:true}).click();await panel.getByRole('button',{name:'重新核对位置',exact:true}).waitFor();assert.match(await panel.getByRole('alert').innerText(),/原记录保留/);assert.equal(await panel.getByRole('radio').count(),0);
    await panel.getByRole('button',{name:'暂不处理',exact:true}).click();await local.context.setOffline(false);assert.deepEqual(await local.page.evaluate(()=>ServerStore.pending()),original);
   }
   await panel.getByRole('button',{name:'核对浏览位置',exact:true}).click();await panel.getByRole('radio',{name:'使用云端位置',exact:true}).waitFor();
   await rival.page.evaluate(async target=>resolutionStore.enqueue('jump',target),plan.steps[0].stepId);await drained(rival.page);
   const radioName=choice==='cloud'?'使用云端位置':'使用本机位置',confirmName=choice==='cloud'?'确认使用云端位置':'确认保存本机位置';
   await panel.getByRole('radio',{name:radioName,exact:true}).check();await panel.getByRole('button',{name:confirmName,exact:true}).click();
   await panel.getByText(/云端浏览位置已变化/).waitFor();
   assert.deepEqual(await local.page.evaluate(()=>ServerStore.pending()),original);
   const current=await rival.page.evaluate(()=>resolutionStore.open());
   await panel.getByRole('button',{name:'重新核对位置',exact:true}).click();await panel.getByRole('radio',{name:radioName,exact:true}).waitFor();
   assert.equal(await panel.locator('input:checked').count(),0);await panel.getByRole('radio',{name:radioName,exact:true}).check();await panel.getByRole('button',{name:confirmName,exact:true}).click();
   const downloadButton=local.page.getByRole('button',{name:'下载本次归档',exact:true});await downloadButton.waitFor();
   await drained(local.page);
   const downloadReady=local.page.waitForEvent('download');await downloadButton.click();const download=await downloadReady,stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const archive=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   assert.deepEqual(archive.rows,original);assert.equal(archive.choice,choice);
   assert.deepEqual(await local.page.evaluate(key=>ServerStore.readVocabularyBrowseConflictArchive(key),archive.key),archive);
   await rival.page.evaluate(()=>resolutionStore.open());
   const cloud=await rival.page.evaluate(()=>resolutionStore.reconcile());
   assert.equal(cloud.cursor.stepId,choice==='local'?plan.steps[1].stepId:plan.steps[0].stepId);
   if(choice==='cloud'){assert.equal(cloud.confirmed.resumeRev,current.confirmed.resumeRev);assert.equal(archive.replacementRequestId,undefined);}
   else {assert.ok(!original.some(row=>row.requestId===archive.replacementRequestId));assert.equal(cloud.confirmed.resume.requestId,archive.replacementRequestId);assert.equal(cloud.cursor.status,'active');}
   if(choice==='cloud'){
    await rival.page.locator('.intro-history summary').click();await rival.page.getByText('此浏览器还没有本课程的冲突归档。',{exact:true}).waitFor();
    historyChecks=await require('./vocabulary-browse-history.cjs')(local.page,archive);
    await local.page.evaluate(()=>{localStorage.setItem('chunklab_token','different-test-token');window.dispatchEvent(new StorageEvent('storage',{key:'chunklab_token'}));});
    assert.equal(await panel.isVisible(),false);assert.equal(await panel.innerText(),'');assert.equal(await downloadButton.count(),0);assert.equal(await local.page.locator('.intro-history').isVisible(),false);assert.equal(await local.page.locator('.intro-history li').count(),0);await local.page.getByText('账号或服务已变化，原待保存记录保留。',{exact:true}).waitFor();
   }
  }finally{for(const context of contexts)await context.close();}
 }
 return {history:historyChecks};
};
