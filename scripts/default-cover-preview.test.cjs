'use strict';
const {chromium}=require('playwright-core'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const covers=require('../js/course-covers.js');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:900,height:400}});
 await page.route('http://cover-fixture.invalid/**',route=>{const file=new URL(route.request().url()).pathname.slice(1);return covers.variants.includes(file)||file==='assets/covers/oral-3000.webp'?route.fulfill({contentType:'image/webp',body:fs.readFileSync(file)}):route.abort();});
 await page.setContent('<html lang="zh-CN"><base href="http://cover-fixture.invalid/"><style>body{margin:0;padding:32px;background:linear-gradient(#cde6f6,#f0efe2);font-family:system-ui}*{box-sizing:border-box}</style><main id="pageMyLearning"><div id="preview"></div></main></html>');
 await page.addStyleTag({path:path.resolve('assets/learning-workspace.css')});await page.addStyleTag({path:path.resolve('assets/content-card.css')});
 for(const file of ['js/learning-workspace.js','js/course-covers.js'])await page.addScriptTag({path:path.resolve(file)});
 await page.evaluate(()=>window.LearningNavigation={create:()=>document.createElement('nav')});
 await page.addScriptTag({path:path.resolve('js/content-card.js')});await page.addScriptTag({path:path.resolve('js/course-return.js')});await page.addScriptTag({path:path.resolve('js/learning-workspace-view.js')});
 const ids=[];for(let i=0;ids.length<3;i++){const id='preview-'+i;if(!ids.some(other=>covers.fallback({courseId:other})===covers.fallback({courseId:id})))ids.push(id);}
 await page.evaluate(ids=>{const resources=ids.map((id,i)=>LearningWorkspace.normalizeResource({resourceId:'course:'+id,courseId:id,kind:'course',title:'默认封面 '+(i+1),visibility:'private',available:true,sourceRefs:[{type:'sentence-deck',id}],activities:['chunks']}));LearningWorkspaceView.render(document.getElementById('preview'),{view:'my-learning',resources,publicResources:[],preferences:{},memberships:{},status:''},{filter(){},navigate(){},open(){},select(){}});},ids);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.workspace-card>img')).length===3&&Array.from(document.querySelectorAll('.workspace-card>img')).every(img=>img.complete&&img.naturalWidth===640));
 assert.equal(await page.locator('.workspace-card>img').count(),3);
 for(const card of await page.locator('.workspace-card').all()){
  assert.equal(await card.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','default cover card lets the page background show through');
  assert.notEqual(await card.locator('.library-copy').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','title row keeps its paper background');
 }
 const output=path.resolve('output/playwright/default-cover-v2');fs.mkdirSync(output,{recursive:true});
 await page.screenshot({path:path.join(output,'cards.png')});
 await page.evaluate(()=>{const resource=LearningWorkspace.normalizeResource({resourceId:'course:custom',courseId:'custom',kind:'course',title:'专属封面',visibility:'private',available:true,coverUrl:'assets/covers/oral-3000.webp',sourceRefs:[{type:'sentence-deck',id:'custom'}],activities:['chunks']});LearningWorkspaceView.render(document.getElementById('preview'),{view:'my-learning',resources:[resource],publicResources:[],preferences:{},memberships:{},status:''},{filter(){},navigate(){},open(){},select(){}});});
 assert.equal(await page.locator('.has-default-cover').count(),0,'custom cover is not styled as a placeholder');
 assert.notEqual(await page.locator('.workspace-card').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','custom cover card keeps its original background');
 console.log('All three transparent fallback covers load in the actual library card renderer.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
