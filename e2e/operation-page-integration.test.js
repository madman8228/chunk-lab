'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright-core');
const Database=require('../server/node_modules/better-sqlite3');
const {waitForAsync}=require('./lib/wait-for-async');
const root=path.resolve(__dirname,'..');
const port=require('./lib/free-port').freePort(11920,100),base='http://127.0.0.1:'+port;
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cl-operation-page-'));
let server,browser;
(async()=>{try{
  server=spawn(process.execPath,['index.js'],{cwd:path.join(root,'server'),env:{...process.env,
    PORT:String(port),CHUNKLAB_DATA_DIR:temp,NODE_ENV:'test',REQUIRE_AUTH:'false',CHUNKLAB_WRITE_PROTOCOL:'3'},stdio:'ignore'});
  let ready=false;
  for(let i=0;i<300;i++){
    ready=await fetch(base+'/api/health').then(response=>response.ok).catch(()=>false);
    if(ready)break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(ready,'isolated server started');
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
  const legacy=[],operations=[];
  page.on('request',request=>{
    const pathname=new URL(request.url()).pathname;
    if(request.method()!=='GET'&&['/api/data','/api/import','/api/deck/publish','/api/sync/resolve','/api/sync/batch/resolve'].includes(pathname))legacy.push(pathname);
    if(request.method()==='POST'&&pathname==='/api/operations')operations.push(request.postDataJSON());
  });
  await page.goto(base+'/main.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.CL&&CL.serverPersistenceReady());
  assert.equal(await page.evaluate(()=>typeof window.BatchSync),'undefined');
  await page.evaluate(async()=>{
    await Promise.all(['parallel-a','parallel-b'].map(id=>ServerStore.submitCommitted('deck.put',{
      deck:{id,name:id,items:[{cid:'one',en:'Hello.',zh:'你好。'}]}
    },{requestId:'create-'+id,expectedRev:null})));
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.CL&&CL.serverPersistenceReady());
  const ids=await page.evaluate(async()=>(await ServerCache.read()).snapshot.mem.decks.map(deck=>deck.id));
  assert.ok(ids.includes('parallel-a')&&ids.includes('parallel-b'),'both concurrent writes survive reload');
  await page.goto(base+'/decks.html?courseView=joined&courseType=all',{waitUntil:'domcontentloaded'});
  await page.getByText('parallel-a',{exact:true}).waitFor();
  await page.getByText('parallel-b',{exact:true}).waitFor();
  await page.evaluate(()=>CourseEnrollment.join('user-deck:parallel-a'));
  const membership=await page.evaluate(async()=>{
    const snapshot=await ChunkAPI.getData();
    return snapshot.courseProgress[CourseEnrollment.keyFor('user-deck:parallel-a')];
  });
  assert.equal(membership.joined,true,'enrollment confirmed by server');
  let lost=false;
  let markCommitted;
  const publicationCommitted=new Promise(resolve=>{markCommitted=resolve;});
  await page.route('**/api/operations',async route=>{
    const operation=route.request().postDataJSON();
    if(operation.type==='deck.publish'){
      const response=await route.fetch();
      assert.equal(response.status(),200,'publish committed before simulating lost receipt');
      lost=true;await route.abort();markCommitted();
    }else await route.continue();
  });
  await page.evaluate(async()=>{
    const row=await ServerCache.read();
    return ServerStore.submit('deck.publish',{deckId:'parallel-a',publish:true},
      {requestId:'publish-lost-receipt',expectedRev:row.snapshot.revs.decks['parallel-a']});
  });
  await publicationCommitted;
  assert.equal(lost,true);
  await page.unroute('**/api/operations');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.CL&&CL.serverPersistenceReady());
  await page.evaluate(()=>ServerStore.retryPending());
  await waitForAsync(page,async()=>{
    const data=await ChunkAPI.getData();
    return data.mem.decks.some(deck=>deck.id==='parallel-a'&&deck.isPublic===true)&&(await ServerStore.pending()).length===0;
  });
  const db=new Database(path.join(temp,'chunklab.db'),{readonly:true});
  try{
    assert.equal(db.prepare('SELECT count(*) n FROM user_operation_receipts WHERE request_id=?').get('publish-lost-receipt').n,1,
      'lost-receipt retry commits once');
    assert.equal(db.prepare('SELECT rev FROM user_decks WHERE id=?').get('parallel-a').rev,2,'retry never increments publication revision twice');
  }finally{db.close();}
  assert.ok(operations.some(operation=>operation.type==='course.enrollment'));
  assert.ok(operations.some(operation=>operation.type==='deck.publish'));
  assert.deepEqual(legacy,[],'real pages never send retired mutations');
  console.log('[operation-page-integration] concurrent course writes, visible reload, enrollment and lost publication receipt retry passed');
}finally{
  if(browser)await browser.close();
  if(server&&server.exitCode===null){const ended=new Promise(resolve=>server.once('exit',resolve));server.kill();await ended;}
  assert.equal(path.dirname(path.resolve(temp)),path.resolve(os.tmpdir()));
  assert.ok(path.basename(temp).startsWith('cl-operation-page-'));
  fs.rmSync(temp,{recursive:true,force:true});
}})().catch(error=>{console.error(error);process.exitCode=1;});
