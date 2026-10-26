'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'main.html'),'utf8');
const markup=html.slice(html.indexOf('<div class="practice-options"'),html.indexOf('<label class="practice-batch-size"'));
const source=html.slice(html.indexOf('function updatePracticeOptions(){'),html.indexOf('function updatePracticeBatchSize(deck){'));
const styles=Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g),m=>m[1]).join('\n');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [925,390]){
   const page=await browser.newPage({viewport:{width,height:932}});
   await page.setContent('<style>'+styles+'</style><main class="wrap"><h3>句子练习</h3>'+markup+'<section class="card">当前题组保持不变</section></main>');
   await page.evaluate(()=>{
    window.$=id=>document.getElementById(id);window.mem={settings:{mode:'choose',shuffle:false}};
    window.S={deck:{id:'srs-test'},items:['one','two'],answers:['draft'],tempEnd:2};
    window.AccountStorage={owner:'isolated-test'};window.calls=[];window.fail=false;
    window.serverPersistenceEnabled=()=>true;window.newPracticeSessionId=()=> 'fixture';
    window.ServerStore={submit:async(type,payload)=>{calls.push(payload.patch);if(fail)throw Error('offline');}};
    window.saveStore=async()=>true;window.effectivePracticeMode=()=>S.spellingOverride||mem.settings.mode;
    window.switchToSpelling=()=>{S.spellingOverride=effectivePracticeMode()==='choose'?'type':'choose';};
    window.showSysToast=message=>{window.lastToast=message;};
   });
   await page.addScriptTag({content:source});await page.evaluate(()=>updatePracticeOptions());
   const mode=page.getByRole('combobox',{name:'答题模式'}),shuffle=page.getByRole('checkbox');
   assert.equal(await shuffle.evaluate(el=>el.closest('label').textContent.trim()),'乱序出题');
   await mode.selectOption('type');await page.waitForFunction(()=>!document.getElementById('practiceMode').disabled);
   assert.equal(await mode.inputValue(),'type');
   await shuffle.check();await page.waitForFunction(()=>!document.getElementById('practiceShuffle').disabled);
   assert.deepEqual(await page.evaluate(()=>({settings:mem.settings,items:S.items,answers:S.answers,end:S.tempEnd,calls})),{
    settings:{mode:'type',shuffle:true},items:['one','two'],answers:['draft'],end:2,calls:[{mode:'type'},{shuffle:true}]
   });
   await page.evaluate(()=>{fail=true;});await mode.selectOption('choose');
   await page.waitForFunction(()=>!document.getElementById('practiceMode').disabled);assert.equal(await mode.inputValue(),'type');
   await shuffle.click();await page.waitForFunction(()=>!document.getElementById('practiceShuffle').disabled);assert.equal(await shuffle.isChecked(),true);
   await page.evaluate(()=>{S.courseLearning={enabled:true,preserveOrder:true};updatePracticeOptions();});
   assert.equal(await page.locator('#practiceOptions').isVisible(),false,'course-specific fixed-order controls are not duplicated');
   await page.evaluate(()=>{S.courseLearning=null;S.deck._platformSession={};updatePracticeOptions();});
   assert.equal(await page.locator('#practiceOptions').isVisible(),false);
   await page.evaluate(()=>{delete S.deck._platformSession;S.assessment={};updatePracticeOptions();});assert.equal(await page.locator('#practiceOptions').isVisible(),false);
   await page.evaluate(()=>{S.assessment=null;updatePracticeOptions();});
   await mode.focus();assert.ok(await mode.evaluate(el=>el===document.activeElement));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const output=path.join(root,'output/playwright/practice-preferences');fs.mkdirSync(output,{recursive:true});
   await page.screenshot({path:path.join(output,'preferences-'+width+'.png'),animations:'disabled'});await page.close();
  }
  console.log('PASS: contextual practice controls, narrow preference patches, retained answers/queue, save failure recovery, course/assessment boundaries and desktop/mobile layout.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
