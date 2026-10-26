'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright-core');
const source=fs.readFileSync('decks.html','utf8'),styles=[...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match=>match[1]).join('\n');
const fixture=Array.from({length:4},(_,index)=>'<section class="catalog-group"><div class="catalog-group-title"><button class="catalog-group-toggle"><span class="catalog-group-caret">›</span><span>分组 '+index+'</span><small>1 个课节</small></button></div><div class="catalog-lessons" hidden></div></section>').join('');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage();
 await page.setContent('<style>'+fs.readFileSync('assets/ui-tokens.css','utf8')+'\n'+fs.readFileSync('assets/course-directory.css','utf8')+'\n'+styles+'</style><div id="deckList" class="catalog-directory">'+fixture+'</div>');
 for(const width of [937,390]){
  await page.setViewportSize({width,height:932});
  const spacing=await page.locator('#deckList').evaluate(root=>{const titles=[...root.querySelectorAll('.catalog-group-title')].map(el=>el.getBoundingClientRect());return titles.slice(1).map((rect,index)=>rect.top-titles[index].bottom)});
  assert.equal(spacing.length,3);assert.ok(spacing.every(gap=>gap<=10.8),'vertical whitespace between group rows should be reduced by 60% at '+width+': '+JSON.stringify(spacing));
 }
 console.log('Course directory grouped-row spacing passed at desktop and mobile widths.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
