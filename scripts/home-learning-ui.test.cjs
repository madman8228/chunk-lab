'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),express=require('../server/node_modules/express'),{chromium}=require('playwright-core');
(async()=>{const app=express();app.get('/api/config',(_,res)=>res.json({requireAuth:true,authMode:'phone'}));app.use(express.static(path.resolve(__dirname,'..')));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let browser;
try{browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')writes.push(r.url());});await page.goto('http://127.0.0.1:'+server.address().port+'/');
assert.equal(await page.locator('#workspaceEntry').isVisible(),true);assert.equal(await page.locator('#homeLearning').isVisible(),false);
assert.equal(await page.getByRole('link',{name:'开始学习',exact:true}).getAttribute('href'),'main.html?view=home');
assert.equal(await page.getByRole('link',{name:'发现内容',exact:true}).getAttribute('href'),'main.html?view=discover');
for(const width of [1440,946,390,360]){await page.setViewportSize({width,height:932});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log('PASS: guest entry is minimal, examples are not personal content, four widths and no record writes');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
