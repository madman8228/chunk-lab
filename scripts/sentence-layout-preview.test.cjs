'use strict';
const {chromium}=require('playwright-core'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch();try{
 const page=await browser.newPage(),item=JSON.parse(fs.readFileSync('content/vocabulary/items/pilot-v1_borrow.json','utf8'));
 await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><body class="learning-page"><main class="learning-workspace wordbook-study"><section class="wordbook-exercise wordbook-sentence-exercise"><figure><img><figcaption class="wordbook-scene-caption"></figcaption></figure><div class="wordbook-answer"><div class="wordbook-target"><h2>借用；借入</h2><button class="study-listen">听单词</button></div><div id="mount"></div></div></section></main>');
 await page.locator('img').evaluate((el,data)=>{el.src='data:image/webp;base64,'+data;},fs.readFileSync('test/fixtures/synthetic-vocabulary-16x9.webp').toString('base64'));
 await page.locator('figcaption').evaluate((el,text)=>{el.textContent=text;},item.translation);
 for(const file of ['landing/theme.css','assets/learning-workspace.css','assets/learning-sky.css','assets/wordbook-study.css'])await page.addStyleTag({path:file});
 for(const file of ['landing/sentence-cloze-engine.js','js/vocabulary-course-contract.js','landing/guided-sentence-content.js','landing/guided-sentence-view.js'])await page.addScriptTag({path:file});
 await page.evaluate(item=>{const view=GuidedSentenceView.create(item,GuidedSentenceContent.forItem(item));document.getElementById('mount').append(view.element);view.focus();},item);
 await page.locator('img').evaluate(el=>el.decode());fs.mkdirSync('output/playwright',{recursive:true});
 for(const width of [925,390,320]){await page.setViewportSize({width,height:932});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'output/playwright/sentence-refine-'+width+'.png'});}
 console.log('Sentence layout: three widths, complete image and native guided input rendered without overflow; no account writes.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
