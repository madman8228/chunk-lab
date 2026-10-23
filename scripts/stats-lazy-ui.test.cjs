'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),modules=['stats-growth.js','stats-insights.js','mistake-review.js','stats-page.js'];
(async()=>{
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(url.pathname==='/api/library'?{resources:[]}:url.pathname==='/api/content/shards'?JSON.parse(fs.readFileSync(path.join(root,'server/content/shards.json'))):{requireAuth:false}));return;}
  const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',/\.m?js$/.test(file)?'application/javascript':/\.css$/.test(file)?'text/css':/\.json$/.test(file)?'application/json':'text/html');res.end(fs.readFileSync(file));
 });
 let browser;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});
  for(const width of [946,390]){
   const context=await browser.newContext({viewport:{width,height:932},serviceWorkers:'block'}),page=await context.newPage(),requests=[];
   await context.addInitScript(()=>{const payload=btoa(JSON.stringify({uid:1})).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');const token='test.'+payload+'.test';localStorage.setItem('chunklab_api_base','');localStorage.setItem('chunklab_token',token);localStorage.setItem('chunklab.session.v1',JSON.stringify({version:1,epoch:'isolated',base:'',token}));});
   async function navigate(name){
    await page.locator('#workspaceNavHost .learning-global-nav').waitFor({state:'visible'});
    const close=page.getByRole('button',{name:'关闭提示',exact:true});if(await close.isVisible())await close.click();
    await page.getByRole('link',{name:name,exact:true}).click();
   }
   page.on('request',request=>{const name=new URL(request.url()).pathname.split('/').pop();if(modules.includes(name))requests.push(name);});
   await page.goto(base+'/main.html?view=home');await page.locator('#pageHome').waitFor({state:'visible'});
   assert.deepEqual(requests,[],'home never eagerly requests archive-only modules');
   let release;const gate=new Promise(resolve=>{release=resolve;});
   await page.route('**/js/stats-page.js',async route=>{await gate;await route.continue();});
   await navigate('学习记录');await page.getByText('正在加载学习记录…',{exact:true}).waitFor();
   await page.evaluate(()=>showStatsPage());
   await navigate('首页');await page.locator('#pageHome').waitFor({state:'visible'});release();
   await page.waitForFunction(()=>!!window.StatsPage);
   assert.equal(await page.locator('#pageHome').isVisible(),true,'late module loading does not navigate back');
   await page.evaluate(()=>{const original=ChunkAPI.request;ChunkAPI.isLoggedIn=()=>true;ChunkAPI.request=(url,options)=>url.includes('/api/learning-archive/')?Promise.resolve({confirmed:true,domains:[],identityNote:'隔离统计说明',items:[],nextOffset:null}):original(url,options);});
   await navigate('学习记录');await page.locator('#statsPageHost #statsTabs').waitFor();
   await page.evaluate(()=>dispatchEvent(new CustomEvent('server-cache-applied')));
    assert.equal(await page.locator('#statsPageHost #statsTabs .tab.on').innerText(),'概览','confirmed-cache refresh keeps the current archive tab active');
   await navigate('首页');await navigate('学习记录');
   for(const name of modules)assert.equal(requests.filter(value=>value===name).length,1,'one script request per archive module');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const output=path.join(root,'output/playwright/stats-lazy');fs.mkdirSync(output,{recursive:true});
   await page.screenshot({path:path.join(output,'archive-'+width+'.png'),animations:'disabled'});await context.close();
  }
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),failedRequests=[];page.on('requestfailed',request=>failedRequests.push({url:request.url(),error:request.failure()?.errorText}));let fail=true;
  await context.addInitScript(()=>{const payload=btoa(JSON.stringify({uid:1})).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');const token='test.'+payload+'.test';localStorage.setItem('chunklab_api_base','');localStorage.setItem('chunklab_token',token);localStorage.setItem('chunklab.session.v1',JSON.stringify({version:1,epoch:'isolated',base:'',token}));});
  await page.goto(base+'/main.html?view=home');await page.locator('#workspaceNavHost .learning-global-nav').waitFor({state:'visible'});
  await page.route('**/js/stats-insights.js',route=>{if(fail){fail=false;return route.abort();}return route.continue();});
  await page.getByRole('link',{name:'学习记录',exact:true}).click();await page.getByText('学习记录未能加载，请联网后重试。',{exact:true}).waitFor({timeout:5000}).catch(async error=>{
   throw new Error(error.message+' direct-stats-state='+JSON.stringify({url:page.url(),body:(await page.locator('body').innerText()).slice(0,900),failedRequests}));
  });
  await page.getByRole('button',{name:'重试',exact:true}).click({noWaitAfter:true});await page.locator('#statsPageHost #statsTabs').waitFor();
  await context.close();console.log('PASS: archive modules absent on home, loaded once on demand, entry retry, navigation races and current-tab retention; desktop/mobile isolated HTTP fixture.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
