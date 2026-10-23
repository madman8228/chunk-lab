'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const engine=require('../landing/sentence-cloze-engine.js');
const content=require('../landing/guided-sentence-content.js');
const items=['borrow','decide','advice','avoid','enough','explain'].map(word=>JSON.parse(fs.readFileSync('content/vocabulary/items/pilot-v1_'+word+'.json','utf8')));
for(const item of items){
 const before=JSON.stringify(item),steps=content.forItem(item);assert.ok(steps,'valid teaching plan '+item.itemId);
 assert.equal(engine.normalize(steps.map(s=>s.answer).join(' ')),engine.normalize(engine.sentence(item.exercise)));
 assert.equal(JSON.stringify(item),before,'original item untouched');
 assert.equal(content.forItem({...item,itemId:'unknown'}),null);
 assert.equal(content.forItem({...item,exercise:{...item.exercise,parts:[{text:'Changed '},...item.exercise.parts]}}),null,'changed revisions safely fall back');
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<main id="studyRoot"></main>');
  for(const file of ['landing/sentence-cloze-engine.js','js/vocabulary-course-contract.js','landing/guided-sentence-content.js','landing/guided-sentence-view.js'])await page.addScriptTag({path:file});
  const mount=async item=>page.evaluate(item=>{
   window.guided?.destroy();window.receipts=[];
   window.guided=GuidedSentenceView.create(item,GuidedSentenceContent.forItem(item),{onComplete:result=>receipts.push(result)});
   document.getElementById('studyRoot').replaceChildren(guided.element);guided.focus();
  },item);
  await mount(items[0]);
  const input=page.locator('.guided-form input'),prompt=page.locator('.guided-prompt');
  assert.equal(await prompt.textContent(),'我可以……吗？');
  assert.equal(await page.locator('.guided-built').isVisible(),false,'no future English revealed');
  await input.fill('can i');assert.equal(await prompt.textContent(),'借入');
  await input.fill('lend');await input.press('Enter');assert.match(await page.locator('.guided-feedback').textContent(),/borrow.*lend/);
  assert.equal(await prompt.textContent(),'借入');
  await input.fill('bor');await page.keyboard.press('Shift');
  assert.equal(await page.getByRole('button',{name:'意群选择',exact:true}).getAttribute('aria-pressed'),'true');
  await page.keyboard.press('Shift');assert.equal(await input.inputValue(),'bor');
  await page.keyboard.press('Shift+A');assert.equal(await input.isVisible(),true,'uppercase shortcut does not toggle');
  await input.fill('borrow');assert.equal(await prompt.textContent(),'你的');
  await page.keyboard.press('Shift');await page.locator('.guided-options').getByRole('button',{name:'my',exact:true}).click();
  assert.equal(await prompt.textContent(),'你的','wrong choice stays on current step');
  await page.locator('.guided-options').getByRole('button',{name:'your',exact:true}).click();assert.equal(await prompt.textContent(),'充电器');
  await page.keyboard.press('Shift');
  await page.evaluate(()=>document.getElementById('studyRoot').hidden=true);await page.keyboard.press('Shift');
  await page.evaluate(()=>document.getElementById('studyRoot').hidden=false);assert.equal(await input.isVisible(),true,'paused view ignores Shift');
  await input.fill('charger');
  assert.deepEqual(await page.evaluate(()=>receipts),[{values:{verb:'borrow'},sentence:'Can I borrow your charger?',inputMode:'typing'}]);
  await page.keyboard.press('Shift');assert.equal(await page.evaluate(()=>receipts.length),1,'completion emitted once');
  for(const item of items){
   await mount(item);
   for(const step of content.forItem(item))await input.fill(step.answer.toLowerCase());
   const result=(await page.evaluate(()=>receipts))[0];assert.equal(result.sentence,engine.sentence(item.exercise));
   assert.equal(engine.evaluate(item.exercise,result.values).correct,true);
   assert.deepEqual(Object.keys(result.values).sort(),engine.blanks(item.exercise).map(p=>p.id).sort(),'only original answer IDs saved');
  }
  const portable={...items[0],itemId:'new-book:borrow',learning:{schemaVersion:1,guidedExpression:{schemaVersion:1,revision:'a'.repeat(64),steps:content.forItem(items[0]).map(s=>{const copy={...s};if(copy.field===undefined)delete copy.field;return copy;})}}};
  await mount(portable);for(const step of portable.learning.guidedExpression.steps)await input.fill(step.answer);
  assert.equal((await page.evaluate(()=>receipts))[0].sentence,engine.sentence(portable.exercise),'browser supports authored content without pilot ID');
  // Real page controller, with isolated in-memory account/API fixtures: no live storage or service writes.
  const html=fs.readFileSync('wordbook.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'');
  await page.route('**/wordbook.html*',r=>r.fulfill({body:html,contentType:'text/html'}));
  await page.route('**/assets/vocabulary-*',r=>r.fulfill({status:204}));
  await page.goto('http://127.0.0.1:9979/wordbook.html?book=pilot-six-v1');
  await page.evaluate(items=>{
   window.saved=[];let position=0,rev=0,cursor=null;
   window.LearningSessionBootstrap={identity:()=> 'isolated-test',ready:async()=>({loggedIn:true})};
   window.ChunkAPI={getToken:()=> 'fixture-token',request:async url=>url.includes('/items')?{title:'六词练习',revision:'fixture',itemCount:6,items:items.map(item=>({itemId:item.itemId,contentRevision:item.contentRevision}))}:items.find(item=>url.includes(encodeURIComponent(item.itemId)))};
   window.VocabularyStudyStore={pending:async()=>[],state:async()=>({canPersist:true,resumePosition:position,resumeRev:rev,resume:cursor,features:{practiceTypes:true}}),submit:async(type,payload)=>{if(type==='vocabulary.complete'){saved.push({type,payload});position++;rev++;cursor={...cursor,itemId:items[position]?.itemId||null,status:position===6?'completed':'active'};}else{rev++;cursor={bookRevision:'fixture',itemId:payload.itemId,sessionId:payload.sessionId,practiceType:payload.practiceType,status:'active'};}return {};}};
  },items);
  for(const file of ['js/notice-banner.js','js/course-return.js','js/course-learning-header.js','landing/word-dictation-view.js','landing/word-choice-view.js','landing/chunk-order-view.js','landing/read-aloud-view.js','landing/vocabulary-course-audio.js','landing/sentence-cloze-engine.js','landing/sentence-cloze-view.js','landing/guided-sentence-content.js','landing/guided-sentence-view.js','landing/wordbook-study.js'])await page.addScriptTag({path:file});
  await page.locator('#studySkip').waitFor({state:'attached'});await page.evaluate(()=>{window.shortcutSkipCount=0;window.originalSkip=document.getElementById('studySkip').onclick;document.getElementById('studySkip').onclick=()=>shortcutSkipCount++;});
  await page.keyboard.press('Alt+s');assert.equal(await page.evaluate(()=>shortcutSkipCount),1,'skip works with the More menu closed');
  await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyS',key:'s',altKey:true,repeat:true,bubbles:true})));assert.equal(await page.evaluate(()=>shortcutSkipCount),1,'held shortcut does not repeat');
  await page.evaluate(()=>{document.getElementById('studySkip').onclick=originalSkip;});
  for(const item of items){
   await page.locator('.guided-form input').waitFor();assert.deepEqual(await page.locator('.study-shortcut-hint kbd').allTextContents(),['Shift','Alt + S']);assert.equal(await page.locator('#studySkip').getAttribute('aria-keyshortcuts'),'Alt+S');assert.equal(await page.locator('.study-shortcut-hint').evaluate(el=>el.nextElementSibling.classList.contains('wordbook-exercise')),true);assert.equal(await page.locator('.wordbook-scene-caption').textContent(),item.translation);assert.equal(await page.locator('.wordbook-translation').count(),0);
   for(const step of content.forItem(item))await page.locator('.guided-form input').fill(step.answer);
   await page.getByRole('button',{name:'下一词',exact:true}).click();
  }
  await page.getByRole('heading',{name:'本轮完成'}).waitFor();
  const saved=await page.evaluate(()=>saved);assert.equal(saved.length,6);
  for(let i=0;i<6;i++){assert.equal(saved[i].payload.itemId,items[i].itemId);assert.equal(engine.evaluate(items[i].exercise,saved[i].payload.answers).correct,true);assert.equal(saved[i].type,'vocabulary.complete');assert.equal(saved[i].payload.practiceType,'guided-expression');assert.equal(saved[i].payload.inputMode,'typing');}
  assert.deepEqual(errors,[]);
  console.log('Guided practice: six source-aligned sentences, Chinese prompts, auto advance, wrong-answer feedback, Shift cycles/drafts/combinations/pause, one completion, and isolated six-item save flow passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
