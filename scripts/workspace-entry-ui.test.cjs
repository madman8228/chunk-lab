'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(url.pathname==='/api/library'?{resources:[]}:url.pathname==='/api/content/shards'?JSON.parse(fs.readFileSync(path.join(root,'server/content/shards.json'))):{requireAuth:false}));return;}
  const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',/\.m?js$/.test(file)?'application/javascript':/\.css$/.test(file)?'text/css':/\.json$/.test(file)?'application/json':'text/html');res.end(fs.readFileSync(file));
 });
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true});
  const page=await browser.newPage({serviceWorkers:'block'});
  await page.addInitScript(()=>sessionStorage.setItem('_startDeck',JSON.stringify({id:'stale-handoff',name:'',items:[]})));
  await page.goto('http://127.0.0.1:'+server.address().port+'/main.html?view=my-learning');
  await page.waitForTimeout(1600);
  assert.equal(await page.locator('#pagePractice').isVisible(),false,'explicit personal-library URL must not expose an empty practice deck');
  assert.equal(await page.locator('#pageMyLearning').isVisible(),true,'personal library must be visible even with an old study handoff');
  assert.equal(await page.locator('#deckName').isVisible(),false,'no empty course-title chip on workspace routes');
  console.log('Workspace entry preserves explicit route and never exposes the empty practice chip.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
