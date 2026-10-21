'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright-core'),model=require('./lib/vocabulary-materials.cjs');
(async()=>{const library=require('./prepare-borrow-material-library.cjs').build(JSON.parse(fs.readFileSync('drafts/scene-wordbooks/borrow-things-v1/review.json','utf8'))),before=JSON.stringify(library),browser=await chromium.launch();try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>材料协议隔离验证</title>'}));await page.goto('http://127.0.0.1:9979/material-contract');
 await page.addScriptTag({path:'js/vocabulary-material-library.js'});
 assert.deepEqual(await page.evaluate(value=>VocabularyMaterialLibrary.validate(value),library),library);
 for(const course of library.courses){const actual=await page.evaluate(({library,id})=>VocabularyMaterialLibrary.previewCourse(library,id),{library,id:course.courseId});assert.deepEqual(actual,await model.previewCourse(library,course.courseId),'browser and server produce exactly the same course projection');}
 const bad=structuredClone(library);bad.sources[0].entries[0].rawText='tampered';
 assert.equal(await page.evaluate(async value=>{try{await VocabularyMaterialLibrary.validate(value);return false;}catch(error){return /版本/.test(error.message);}},bad),true,'browser rejects content with stale version');
 const orphan=structuredClone(library);orphan.courses[0].units[0].materialRefs[0].revision='f'.repeat(64);orphan.courses[0]=model.versioned(orphan.courses[0]);
 assert.equal(await page.evaluate(async value=>{try{await VocabularyMaterialLibrary.validate(value);return false;}catch(error){return /版本/.test(error.message);}},orphan),true,'browser rejects broken pinned references');
 const race=await page.evaluate(async value=>{const pending=VocabularyMaterialLibrary.validate(value);value.sources[0].title='changed while hashing';return pending;},library);assert.deepEqual(race,library,'in-flight caller edits do not change the checked snapshot');
 assert.equal(JSON.stringify(library),before);assert.deepEqual(errors,[]);
 console.log('Browser material library: WebCrypto/server exact projections for two courses, full provenance, tamper/reference rejection and immutable async snapshot passed; no account writes.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
