'use strict';
const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage();await page.setContent('<html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><body></body></html>');
 await page.addScriptTag({path:path.resolve('auth-ui.js')});
 await page.evaluate(()=>{ChunkAuthUI.phoneMode=true;ChunkAuthUI.showLogin(null,{dismissible:true});});
 const output=path.resolve('output/playwright/auth-single-border');fs.mkdirSync(output,{recursive:true});
 for(const width of [1041,390]){
  await page.setViewportSize({width,height:932});
  assert.equal(await page.locator('.jqka-phone-dialog').evaluate(el=>Array.from(el.querySelectorAll('*')).some(node=>getComputedStyle(node).backgroundImage.includes('jqka-learning-garden'))),false,'login dialog has no decorative banner');
  assert.equal(await page.locator('.jqka-phone-dialog').evaluate(el=>el.firstElementChild.tagName),'H2','title starts the form without an empty image slot');
  for(const field of await page.locator('.jqka-phone-dialog input').all()){
   const before=await field.boundingBox();await field.focus();
   const style=await field.evaluate(el=>{const s=getComputedStyle(el);return {outline:s.outlineStyle,shadow:s.boxShadow,border:s.borderTopWidth,color:s.borderTopColor};});
   assert.equal(style.outline,'none');assert.equal(style.shadow,'none');assert.equal(style.border,'2px');assert.equal(style.color,'rgb(112, 69, 30)');
   assert.deepEqual(await field.boundingBox(),before,'focus does not resize input');
  }
  await page.locator('.jqka-phone-dialog input').first().focus();
  await page.screenshot({path:path.join(output,'focused-'+width+'.png')});
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'solid','keyboard focus on buttons remains visible');
 }
 console.log('Auth single-border focus: phone/code/password, stable geometry and keyboard focus passed at 1041/390.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
