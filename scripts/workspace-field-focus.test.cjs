'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright-core');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage();
    await page.setContent('<html><meta name="viewport" content="width=device-width,initial-scale=1"><body><main class="learning-workspace workspace-library"><form class="library-toolbar"><input aria-label="搜索我的内容" placeholder="搜索我的内容"><select aria-label="类型"><option>全部类型</option></select><button type="button">查找</button></form></main></body></html>');
    await page.addStyleTag({path:path.resolve('assets/learning-workspace.css')});
    const output=path.resolve('output/playwright/field-focus');fs.mkdirSync(output,{recursive:true});
    for(const dark of [false,true])for(const width of [946,390]){
      await page.setViewportSize({width,height:300});
      await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);
      const input=page.getByRole('textbox');
      const before=await input.boundingBox();await input.click();
      const state=await input.evaluate(el=>{const s=getComputedStyle(el);return {outline:s.outlineStyle,shadow:s.boxShadow,border:s.borderColor,ink:s.getPropertyValue('--workspace-ink').trim()};});
      assert.equal(state.outline,'none');assert.match(state.shadow,/inset/);
      assert.deepEqual(await input.boundingBox(),before,'focus must not move or resize field');
      await page.screenshot({path:path.join(output,(dark?'dark':'light')+'-'+width+'.png')});
      await page.keyboard.press('Tab');
      assert.equal(await page.getByRole('combobox').evaluate(el=>getComputedStyle(el).outlineStyle),'none');
      await page.keyboard.press('Tab');
      assert.equal(await page.getByRole('button').evaluate(el=>getComputedStyle(el).outlineStyle),'solid','button keyboard focus retained');
    }
    console.log('field focus: single inset edge, stable layout, keyboard and light/dark mobile passed');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
