'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage();
 for(const file of ['decks.html','courses.html','wordbook.html','wordbook-details.html','wordbook-create.html','stats.html']){
  const source=fs.readFileSync(file,'utf8'),html=source.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'');
  for(const width of [1440,847,390,360]){
   await page.setViewportSize({width,height:932});await page.setContent(html);
   for(const match of source.matchAll(/<link[^>]+href="([^"]+\.css(?:\?[^"]*)?)"/g))await page.addStyleTag({path:match[1].split('?')[0]});
   if(file==='wordbook.html'){assert.equal(await page.locator('nav').count(),0,'focused study uses the approved course-return header');assert.equal(await page.locator('#bookBack').textContent(),'返回课程');const header=await page.locator('.workspace-heading').boundingBox();assert.ok(header.x>=0&&header.x+header.width<=width);continue;}
   const nav=page.locator('nav').first();assert.deepEqual(await nav.locator('a').allTextContents(),['首页','我的内容','发现','学习记录'],file);
   assert.equal(await nav.locator('a').last().getAttribute('href'),'stats.html');
   if(file.startsWith('wordbook'))assert.ok((await nav.locator('a').nth(2).getAttribute('href')).includes('kind=wordbook'),'wordbook discover filter retained');
   const bounds=await nav.locator('a').evaluateAll(nodes=>nodes.map(node=>({left:node.getBoundingClientRect().left,right:node.getBoundingClientRect().right})));
   assert.ok(bounds.every(b=>b.left>=0 && b.right<=width),'navigation fits '+file+' '+width);
  }
 }
 console.log('Six course/wordbook/record pages: consistent labels, record links, vocabulary filter and four widths passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
