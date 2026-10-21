'use strict';
const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage();await page.setContent('<html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><body></body></html>');
 await page.addScriptTag({path:path.resolve('auth-ui.js')});
 await page.evaluate(()=>{ChunkAuthUI.phoneMode=true;ChunkAuthUI.showLogin(null,{dismissible:true,onCancel:function(){document.body.dataset.cancelled='yes';}});});
 const output=path.resolve('output/playwright/auth-single-border');fs.mkdirSync(output,{recursive:true});
 for(const width of [1041,390]){
  await page.setViewportSize({width,height:932});
  assert.equal(await page.locator('.jqka-phone-dialog').evaluate(el=>Array.from(el.querySelectorAll('*')).some(node=>getComputedStyle(node).backgroundImage.includes('jqka-learning-garden'))),false,'login dialog has no decorative banner');
  assert.equal(await page.locator('.jqka-phone-dialog').evaluate(el=>el.firstElementChild.tagName),'H2','title starts the form without an empty image slot');
  for(const field of await page.locator('.jqka-phone-dialog input:visible').all()){
   const before=await field.boundingBox();await field.focus();
   const style=await field.evaluate(el=>{const s=getComputedStyle(el);return {outline:s.outlineStyle,shadow:s.boxShadow,border:s.borderTopWidth,color:s.borderTopColor};});
   assert.equal(style.outline,'none');assert.equal(style.shadow,'none');assert.equal(style.border,'2px');assert.equal(style.color,'rgb(112, 69, 30)');
   assert.deepEqual(await field.boundingBox(),before,'focus does not resize input');
  }
  await page.locator('.jqka-phone-dialog input').first().focus();
  const actionLinks=await page.locator('.jqka-phone-dialog > div:has(button:text-is("注册账号"))').boundingBox();
  assert.ok(actionLinks,'account actions share a row');
  assert.ok(await page.getByRole('button',{name:'关闭登录窗口'}).isVisible(),'dismissible login shows a close button');
  await page.screenshot({path:path.join(output,'focused-'+width+'.png')});
  await page.locator('.jqka-phone-dialog input:visible').last().focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'solid','keyboard focus on buttons remains visible');
 }
 await page.getByRole('button',{name:'关闭登录窗口'}).click();
 assert.equal(await page.locator('#chunkauth-mask').count(),0,'close button dismisses the login dialog');
 assert.equal(await page.locator('body').getAttribute('data-cancelled'),'yes','dismiss invokes the startup cancellation callback');
 console.log('Auth single-border focus: visible login fields, stable geometry and keyboard focus passed at 1041/390.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
