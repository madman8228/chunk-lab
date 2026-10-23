'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
(async () => {
  let service, dataDir;
  const server = http.createServer((req, res) => {
    if(req.url==='/api/content/shards'){
      res.setHeader('Content-Type','application/json');
      if(!req.headers.authorization){res.writeHead(401);res.end(JSON.stringify({error:'login required'}));return;}
      res.setHeader('X-ChunkLab-Account-Id','1');
      res.end(fs.readFileSync(path.join(root,'server/content/shards.json')));return;
    }
    if (req.url.startsWith('/api/')) { res.setHeader('Content-Type', 'application/json');if(req.headers.authorization)res.setHeader('X-ChunkLab-Account-Id','1');res.end(JSON.stringify({requireAuth:false})); return; }
    const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, bytes) => {
      if(error){res.writeHead(404).end();return;}
      res.setHeader('Content-Type', /\.(mjs|js)$/.test(file)?'application/javascript':file.endsWith('.html')?'text/html':file.endsWith('.json')?'application/json':'application/octet-stream');res.end(bytes);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let base='http://127.0.0.1:'+server.address().port;
  if(process.env.REAL_TEST==='1'){
    const port=require('../e2e/lib/free-port').freePort(11300,100);
    dataDir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'chunklab-catalog-entry-'));
    service=require('node:child_process').spawn(process.execPath,['index.js'],{cwd:path.join(root,'server'),env:{...process.env,PORT:String(port),CHUNKLAB_DATA_DIR:dataDir,NODE_ENV:'test',REQUIRE_AUTH:'true',JWT_SECRET:'isolated-catalog-entry-test-key-123456789',CHUNKLAB_WRITE_PROTOCOL:'3'},stdio:'ignore'});
    base='http://127.0.0.1:'+port;
    let ready=false;
    for(let i=0;i<100;i++){ready=await fetch(base+'/api/health').then(r=>r.ok).catch(()=>false);if(ready)break;await new Promise(r=>setTimeout(r,100));}
    assert.ok(ready,'isolated real service ready');
  }
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({serviceWorkers:'block'});
    let testToken='e30.eyJ1aWQiOjF9.catalog-fixture';
    if(service){
      const username='catalog-entry-'+Date.now();
      const response=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'CatalogEntryTest123!'})});
      assert.equal(response.status,200,'isolated test account registration');testToken=(await response.json()).token;
      const shardProbe=await fetch(base+'/api/content/shards',{headers:{Authorization:'Bearer '+testToken}});assert.equal(shardProbe.status,200,'isolated token can read the authenticated content manifest');
    }
    await page.addInitScript(token=>localStorage.setItem('chunklab_token',token),testToken);
    if(process.env.RECOVERY_TEST==='1'){
      let first=true;
      await page.route('**/api/data*',route=>{if(first){first=false;return route.abort();}return route.continue();});
    }
    const errors=[];let unauthenticatedShardRequests=0;page.on('pageerror',e=>errors.push(e.message));
    page.on('request',request=>{if(request.url().includes('/api/content/shards')&&!request.headers().authorization)unauthenticatedShardRequests++;});
    page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errors.push(m.text());});
    page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
    await page.goto(base+'/decks.html?courseView=all&course=builtin%3Aidioms&courseType=decks');
    await page.locator('.catalog-lesson').first().waitFor();
    let releaseEngine;
    const engineGate=new Promise(resolve=>{releaseEngine=resolve;});
    await page.route('**/js/chunk-engine.mjs',async route=>{await engineGate;await route.continue();});
    if(process.env.JOIN_TEST === '1') await page.evaluate(()=>CourseEnrollment.join('builtin:idioms'));
    const visits=[];page.on('framenavigated',frame=>{if(frame===page.mainFrame())visits.push(frame.url());});
    await page.locator('.catalog-lesson').first().click();
    try{
      await page.waitForFunction(()=>document.getElementById('deckName')?.textContent==='高频短语',null,{timeout:5000});
      assert.equal(await page.locator('#mProgress').textContent(),'--/--','name is available before the practice engine finishes loading');
    }finally{releaseEngine();}
    await page.waitForFunction(()=>document.getElementById('deckName')?.textContent && document.getElementById('mProgress')?.textContent!=='--/--',null,{timeout:10000}).catch(()=>{});
    const state=await page.evaluate(()=>({url:location.href,deck:document.getElementById('deckName')?.textContent,question:document.getElementById('zh')?.textContent,progress:document.getElementById('mProgress')?.textContent,boot:document.getElementById('bootMessage')?.textContent}));
    console.log(JSON.stringify({state,errors,visits}));
    assert.ok(state.deck && state.progress !== '--/--', 'catalog lesson must load a named, playable practice');
    assert.ok(!/加载中|加载失败|准备练习/.test(state.question),'a real question is rendered');
    assert.equal(unauthenticatedShardRequests,0,'content startup never requests the protected shard map before credentials are ready');
    const ignored=/^Service Worker registration blocked|^\[sw\]|^\[saving\]|^\[AIPrompts/;
    assert.deepEqual(errors.filter(e=>!ignored.test(e)&&!(process.env.RECOVERY_TEST==='1'&&/net::ERR_FAILED|服务端缓存暂不可用|^\[course\] startup projection unavailable:/.test(e))),[],'no unexpected product loading errors');
    const blocked=await browser.newPage({serviceWorkers:'block'});
    await blocked.addInitScript(token=>localStorage.setItem('chunklab_token',token),testToken);
    await blocked.goto(base+'/decks.html?courseView=all&course=builtin%3Aidioms&courseType=decks');
    await blocked.locator('.catalog-lesson').first().waitFor();
    await blocked.evaluate(()=>{CourseEnrollment.readMemberships=()=>({});CourseEnrollment.join=()=>Promise.reject(new Error('最多加入 3 门课程'));});
    let dialogMessage='';blocked.once('dialog',async dialog=>{dialogMessage=dialog.message();await dialog.dismiss();});
    await blocked.locator('.catalog-lesson').first().click();
    await blocked.waitForFunction(()=>!startCatalogLesson.pending);
    assert.match(dialogMessage,/3 门/);
    assert.ok(blocked.url().includes('decks.html'),'failed enrollment never navigates to an empty practice');
    await blocked.close();
  } finally {
    await browser.close(); await new Promise(resolve=>server.close(resolve));
    if(service){const stopped=new Promise(resolve=>service.once('exit',resolve));service.kill();await stopped;}
    if(dataDir && path.dirname(dataDir)===path.resolve(require('node:os').tmpdir()) && path.basename(dataDir).startsWith('chunklab-catalog-entry-'))fs.rmSync(dataDir,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
