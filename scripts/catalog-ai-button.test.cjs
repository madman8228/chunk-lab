'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright-core');
const source=fs.readFileSync('decks.html','utf8'),styles=[...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match=>match[1]).join('\n');
const button=source.match(/<a class="btn sm secondary catalog-ai-create"[\s\S]*?<\/a>/)?.[0];
assert.ok(button,'AI course creation link exists');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage();
 await page.setContent('<style>'+fs.readFileSync('assets/ui-tokens.css','utf8')+'\n'+fs.readFileSync('assets/course-directory.css','utf8')+'\n'+styles+'</style><div id="pageDecks"><div class="page-head"><div class="course-header-actions">'+button+'</div></div></div>');
 for(const width of [937,390]){
  await page.setViewportSize({width,height:932});
  const box=await page.locator('.catalog-ai-create').boundingBox();
  assert.equal(box.width,84,'AI course creation button should stay compact at '+width+'px');
  assert.equal(box.height,40,'button height remains comfortable at '+width+'px');
 }
 console.log('AI course creation button dimensions passed at desktop and mobile widths.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
