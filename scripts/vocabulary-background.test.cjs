'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  const main=fs.readFileSync('main.html','utf8'),homeStyles=[...main.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
  const vocabulary=fs.readFileSync('vocabulary-practice.html','utf8');
  const markup=vocabulary.slice(vocabulary.indexOf('<body'),vocabulary.indexOf('<script src="landing/deck.js">')).replace(/<script[\s\S]*?<\/script>/g,'');
  fs.mkdirSync('output/playwright/vocabulary-background',{recursive:true});
  for(const width of [1853,918,390]){
   await page.setViewportSize({width,height:932});
   await page.setContent('<style>'+homeStyles+'</style><div id="pageHome"></div><div class="home-sky-deco"><svg class="sky-sun"></svg></div>');
   const expected=await page.evaluate(()=>({background:getComputedStyle(document.body).backgroundImage,sun:document.querySelector('.sky-sun').getBoundingClientRect().toJSON()}));
   await page.setContent('<html><meta charset="utf-8">'+markup+'</body></html>');
   for(const path of ['landing/theme.css','landing/practice-page.css','assets/learning-sky.css'])await page.addStyleTag({path});
   await page.addScriptTag({path:'js/learning-sky.js'});
   const actual=await page.evaluate(()=>({background:getComputedStyle(document.body).backgroundImage,sun:document.querySelector('.sky-sun').getBoundingClientRect().toJSON()}));
   assert.deepEqual(actual,expected,'vocabulary background and sun match home at '+width);
   assert.equal(await page.locator('.home-garden').count(),1);
   assert.equal(await page.locator('#btnPracticeSix').isVisible(),true,'practice entry stays available');
   await page.screenshot({path:'output/playwright/vocabulary-background/vocabulary-'+width+'.png'});
  }
  console.log('Vocabulary scenery: home background/sun match at desktop, intermediate and mobile sizes.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
