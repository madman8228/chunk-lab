'use strict';
const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1041,height:700}});
 await page.setContent('<main id="pageMyLearning"><div id="test"></div></main><button id="outside">Outside</button>');
 await page.addStyleTag({path:path.resolve('assets/learning-workspace.css')});await page.addStyleTag({path:path.resolve('assets/content-card.css')});
 await page.addScriptTag({path:path.resolve('js/learning-workspace.js')});
 await page.evaluate(()=>window.LearningNavigation={create:()=>document.createElement('nav')});
 await page.addScriptTag({path:path.resolve('js/content-card.js')});await page.addScriptTag({path:path.resolve('js/learning-workspace-view.js')});
 await page.evaluate(()=>{
  const resources=['one','two'].map(id=>LearningWorkspace.normalizeResource({resourceId:'course:'+id,courseId:id,kind:'course',title:'课程 '+id,visibility:'private',available:true,sourceRefs:[{type:'sentence-deck',id}],activities:['chunks']}));
  LearningWorkspaceView.render(document.getElementById('test'),{view:'my-learning',resources,publicResources:[],preferences:{},memberships:{},status:''},{filter(){},navigate(){},open(){},select(){}});
 });
 const triggers=page.locator('.library-more>summary');assert.equal(await triggers.count(),2);
 await triggers.nth(0).click();await triggers.nth(1).click();assert.equal(await page.locator('.library-more[open]').count(),1);
 assert.equal(await page.locator('.library-more').first().getAttribute('open'),null);
 const panel=page.locator('.library-more[open] .library-more-actions');
 assert.ok((await panel.boundingBox()).width<=150,'compact menu width');
 assert.ok(await panel.locator('a,button').first().evaluate(el=>el.getBoundingClientRect().height<=36),'compact desktop rows');
 await page.keyboard.press('Escape');assert.equal(await page.locator('.library-more[open]').count(),0);assert.equal(await triggers.nth(1).evaluate(el=>el===document.activeElement),true);
 await triggers.first().focus();await page.keyboard.press('ArrowDown');assert.equal(await page.locator('.library-more[open] a,.library-more[open] button').first().evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('End');await page.keyboard.press('Escape');
 await triggers.first().click();await page.locator('#outside').click();assert.equal(await page.locator('.library-more[open]').count(),0);
 const output=path.resolve('output/playwright/workspace-menu');fs.mkdirSync(output,{recursive:true});await triggers.first().click();await page.screenshot({path:path.join(output,'compact-desktop.png')});
 console.log('Workspace menu: exclusivity, outside dismissal, Escape/focus, arrow navigation and compact dimensions passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
