'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright-core');
const {prepare}=require('./lib/scene-wordbook-review.cjs'),engine=require('../landing/sentence-cloze-engine');
(async()=>{
 const review=JSON.parse(fs.readFileSync('drafts/scene-wordbooks/borrow-things-v1/review.json','utf8')),{wordbookPackage}=await prepare(review);
 const library=JSON.parse(fs.readFileSync('drafts/scene-wordbooks/borrow-things-v1/material-library-v1.json','utf8')),{previewCourse}=require('./lib/vocabulary-materials.cjs');
 const projected=await Promise.all(library.courses.map(course=>previewCourse(library,course.courseId)));
 const cases=[...wordbookPackage.items,...projected.flatMap(preview=>preview.wordbookPackage.items)];
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
  await context.route('**/*',route=>route.abort());
  await page.setContent('<main><p id="translation"></p><div id="studyRoot"></div></main>');
  for(const file of ['landing/sentence-cloze-engine.js','js/vocabulary-course-contract.js','landing/guided-sentence-content.js','landing/guided-sentence-view.js'])await page.addScriptTag({path:file});
  await page.evaluate(()=>{window.fetch=()=>{throw Error('Preview must not use an API');};});
  for(const width of [1024,390]){
   await page.setViewportSize({width,height:932});
   for(const item of cases){
    await page.evaluate(item=>{
     window.guided?.destroy();window.results=[];document.getElementById('translation').textContent=item.translation;
     window.guided=GuidedSentenceView.create(item,GuidedSentenceContent.forItem(item),{onComplete:result=>results.push(result)});
     document.getElementById('studyRoot').replaceChildren(guided.element);guided.focus();
    },item);
    const input=page.locator('.guided-form input'),steps=item.learning.guidedExpression.steps;
    assert.equal(await page.locator('.guided-built').isVisible(),false,'no future answer shown');
    await input.fill('not an answer');await input.press('Enter');assert.equal(await page.locator('.guided-prompt').textContent(),steps[0].prompt,'wrong answer stays');
    await input.fill('draft');await page.keyboard.press('Shift');assert.equal(await input.isVisible(),false);await page.keyboard.press('Shift');assert.equal(await input.inputValue(),'draft','Shift loop preserves unfinished text');
    for(let index=0;index<steps.length;index++){
     const step=steps[index];assert.equal(await page.locator('.guided-prompt').textContent(),step.prompt);assert.equal(await page.locator('#translation').textContent(),item.translation,'full Chinese remains');
     if(index%2===0)await input.fill(step.answer);
     else{await page.keyboard.press('Shift');await page.locator('.guided-options').getByRole('button',{name:step.answer,exact:true}).click();if(index<steps.length-1)await page.keyboard.press('Shift');}
    }
    const results=await page.evaluate(()=>results);assert.equal(results.length,1);assert.equal(engine.evaluate(item.exercise,results[0].values).correct,true);assert.equal(results[0].sentence,engine.sentence(item.exercise));
    assert.equal(results[0].inputMode,(steps.length-1)%2===0?'typing':'chunks');await page.keyboard.press('Shift');assert.equal(await page.evaluate(()=>results.length),1,'no duplicate completion');
   }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[],'no content, image, account or save requests');
  console.log('Scene vocabulary UI: original six plus two material-library course projections at two widths, Chinese prompts, typing/chunks, Shift, wrong answers and single completion passed without API requests.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
