'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'main.html'),'utf8');
const source=html.slice(html.indexOf('var BATCH_OPTIONS ='),html.indexOf('function updatePracticeOptions(){'))+html.slice(html.indexOf('function updatePracticeBatchSize(deck){'),html.indexOf('/* 每日目标（产品层设置'));
const markup=html.match(/<label class="practice-batch-size"[\s\S]*?<\/label>/)[0];
const styles=Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g),m=>m[1]).join('\n');
assert.ok(!html.includes('id="setBatchSize"'),'personal center no longer owns batch size');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [925,390]){
   const page=await browser.newPage({viewport:{width,height:932}});
   await page.setContent('<style>'+styles+'</style><div class="wrap"><div class="practice-context">到期复习</div>'+markup+'<p>当前组：10 句</p></div>');
   await page.evaluate(()=>{
    window.$=id=>document.getElementById(id);window.mem={settings:{batchSize:10}};
    window.S={items:Array(10).fill('current'),tempEnd:10};window.AccountStorage={owner:'isolated-test'};
    window.ContentRepo={shouldBatch:deck=>!!deck.large};window.isTempQueueDeck=id=>id.startsWith('srs-');
    window.calls=[];window.fail=false;window.serverPersistenceEnabled=()=>true;
    window.newPracticeSessionId=()=> 'fixture-request';window.saveStore=async mode=>{calls.push({mode});return true;};
    window.ServerStore={submit:async(type,data)=>{calls.push({type,data});if(fail)throw Error('offline');}};
    window.showSysToast=message=>{window.lastToast=message;};
   });
   await page.addScriptTag({content:source});
   for(const deck of [{id:'ordinary'},{id:'srs-native',_platformSession:{}},{id:'ordinary',builtin:true}]){
    await page.evaluate(deck=>updatePracticeBatchSize(deck),deck);
    assert.equal(await page.locator('#practiceBatchSizeRow').isVisible(),false);
   }
   for(const deck of [{id:'srs-test'},{id:'large',builtin:true,large:true},{id:'large',_contentBatch:{}}]){
    await page.evaluate(deck=>updatePracticeBatchSize(deck),deck);
    assert.equal(await page.locator('#practiceBatchSizeRow').isVisible(),true);
   }
   const control=page.getByRole('combobox',{name:'每组练习句数'});
   await control.selectOption('20');await page.waitForFunction(()=>!document.getElementById('practiceBatchSize').disabled);
   assert.deepEqual(await page.evaluate(()=>({size:mem.settings.batchSize,count:S.items.length,end:S.tempEnd,calls})),{
    size:20,count:10,end:10,calls:[{type:'settings.patch',data:{patch:{batchSize:20}}},{mode:'local'}]
   });
   await page.evaluate(()=>{fail=true;});await control.selectOption('30');
   await page.waitForFunction(()=>!document.getElementById('practiceBatchSize').disabled);
   assert.equal(await control.inputValue(),'20');assert.equal(await page.evaluate(()=>mem.settings.batchSize),20);
   await page.evaluate(()=>updatePracticeBatchSize({id:'srs-reopen'}));assert.equal(await control.inputValue(),'20');
   await control.focus();assert.equal(await control.evaluate(el=>el===document.activeElement),true);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const out=path.join(root,'output/playwright/practice-batch-setting');fs.mkdirSync(out,{recursive:true});
   await page.screenshot({path:path.join(out,'batch-'+width+'.png'),animations:'disabled'});
   await page.close();
  }
  console.log('PASS: batch-setting visibility, narrow durable patch, failure recovery, retained preference, unchanged active queue and desktop/mobile layout (isolated fixture).');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
