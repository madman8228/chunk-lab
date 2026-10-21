'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{chromium}=require('playwright');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'stats-two-columns-')),port=require('./lib/free-port').freePort(9690,100);
const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,CHUNKLAB_DATA_DIR:temp,PORT:String(port),HOST:'127.0.0.1'},stdio:'ignore'});
(async()=>{let browser;try{
 for(let n=0;n<60;n++){try{if((await fetch('http://127.0.0.1:'+port+'/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,150));}
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:925,height:932}});
 await page.goto('http://127.0.0.1:'+port+'/main.html?view=stats');await page.locator('#statsGrowth h3').first().waitFor();
 const left=await page.locator('#statsGrowth').boundingBox(),right=await page.locator('#statsVocabulary').boundingBox();
 assert.ok(left&&right&&Math.abs(left.y-right.y)<2&&right.x>left.x);
 assert.equal(await page.locator('#statsDomains').isVisible(),false);
 assert.match(await page.locator('#statsVocabulary h3').textContent(),/学习进展 · 单词/);
 const sentenceReview=await page.locator('.review-sentence-group').boundingBox(),wordReview=await page.locator('.review-word-group').boundingBox();
 assert.ok(sentenceReview&&wordReview&&Math.abs(sentenceReview.y-wordReview.y)<2&&wordReview.x>sentenceReview.x,'复习统计左右分开');
 fs.mkdirSync('output/playwright/stats-two-columns',{recursive:true});await page.screenshot({path:'output/playwright/stats-two-columns/desktop.png'});
 await page.setViewportSize({width:390,height:844});
 const a=await page.locator('#statsGrowth').boundingBox(),b=await page.locator('#statsVocabulary').boundingBox();
 assert.ok(b.y>=a.y+a.height);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const sr=await page.locator('.review-sentence-group').boundingBox(),wr=await page.locator('.review-word-group').boundingBox();assert.ok(wr.y>=sr.y+sr.height,'手机复习分区上下排列');
 await page.screenshot({path:'output/playwright/stats-two-columns/mobile.png'});
 console.log('PASS: desktop side-by-side, mobile stacked, overview domains hidden; isolated data '+temp);
 }finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
