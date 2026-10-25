'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.setContent('<main id="test"></main>');
  for(const file of ['js/learning-workspace.js','js/content-card.js','js/course-return.js','js/learning-workspace-view.js'])await page.addScriptTag({path:file});
  await page.evaluate(()=>{
   window.LearningNavigation={mount(){}};
   window.calls=[];
   const resource=LearningWorkspace.normalizeResource({resourceId:'course:expression-test',courseId:'expression-test',title:'测试组句课程',kind:'course',available:true,visibility:'public',activities:['expression'],sourceRefs:[{type:'expression-course',id:'expression-test'}]});
   LearningWorkspaceView.render(document.getElementById('test'),{view:'discover',resources:[resource],publicResources:[resource],preferences:{},memberships:{},selection:{category:'beginner'},status:''},{navigate(){},filter(){},select(){},open(r,options){calls.push({type:'open',join:!!options?.join});},join(){calls.push({type:'join'});return Promise.resolve();}});
  });
  const title=page.locator('.content-card-title').first();
  assert.equal(await page.locator('.discover-searchbar').evaluate(el=>el.tagName),'FORM');
  assert.equal(await page.locator('.discover-searchbar input').evaluate(el=>el.form===el.closest('form')&&el.autocomplete==='off'&&el.name==='course-search'),true);
  await title.click();
  assert.deepEqual(await page.evaluate(()=>calls),[{type:'open',join:false}],'title opens exactly once without enrollment');
  await page.evaluate(()=>{calls=[];document.querySelector('.content-card-kind').click();});
  assert.deepEqual(await page.evaluate(()=>calls),[{type:'open',join:false}],'cover/card opens without enrollment');
  await page.evaluate(()=>{calls=[];});
  await page.locator('.content-card-learn').first().click();
  assert.deepEqual(await page.evaluate(()=>calls),[{type:'join'}],'explicit join remains separate');
  console.log('Expression course title/card open exactly once without joining; explicit join is separate.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
