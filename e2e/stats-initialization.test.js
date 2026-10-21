'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'chunklab-stats-init-'));
const port=require('./lib/free-port').freePort(15500,100),base='http://127.0.0.1:'+port;
let child,browser;
(async()=>{try{
  child=spawn(process.execPath,['server/index.js'],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,
    NODE_ENV:'test',HOST:'127.0.0.1',PORT:String(port),CHUNKLAB_DATA_DIR:dir,CHUNKLAB_APP_ROOT:root,
    REQUIRE_AUTH:'true',PHONE_AUTH_ENABLED:'false',CHUNKLAB_WRITE_PROTOCOL:'3',JWT_SECRET:crypto.randomBytes(32).toString('hex')}});
  let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch(_){}if(ready)break;await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready);
  const signup=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'stats-init-fixture',password:'SyntheticStats2026!'})});
  assert.equal(signup.status,200);const account=await signup.json();
  const headers={'Content-Type':'application/json',Authorization:'Bearer '+account.token};
  async function operation(requestId,type,payload,extra={}){
    const response=await fetch(base+'/api/operations',{method:'POST',headers,
      body:JSON.stringify({protocol:3,requestId,type,payload,...extra})});
    assert.equal(response.status,200,await response.text());
  }
  const mistakeKey='stats-init-deck::Synthetic sentence.';
  await operation('stats_init_deck_0001','deck.put',{deck:{id:'stats-init-deck',name:'Synthetic stats fixture',
    items:[{cid:'one',sentence:'Synthetic sentence.',translation:'测试句子。',chunks:['Synthetic sentence.'],hints:['测试句子。']}]}},{expectedRev:null});
  await operation('stats_init_answer_0001','learning.answer',{
    eventId:'stats_init_answer_0001',key:'stats-init-deck#one',deckId:'stats-init-deck',courseId:'stats-init-deck',generation:0,
    ok:false,sessionId:'stats_init_session_0001',answerOrder:0,chunkRight:0,chunkTotal:1,
    mistake:{key:mistakeKey,row:{_key:mistakeKey,deckId:'stats-init-deck',sentence:'Synthetic sentence.',
      translation:'测试句子。',mistakes:[],history:[],needsReview:true}}});
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});
  const context=await browser.newContext({serviceWorkers:'block'});await context.addInitScript(token=>localStorage.setItem('chunklab_token',token),account.token);
  const page=await context.newPage(),errors=[],writes=[],legacyWrites=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{
    const pathname=new URL(request.url()).pathname;
    if(request.method()==='POST'&&pathname==='/api/operations')writes.push(request.postDataJSON());
    if(request.method()!=='GET'&&['/api/data','/api/import'].includes(pathname))legacyWrites.push(pathname);
  });
  await page.goto(base+'/stats.html');await page.waitForURL('**/main.html?view=stats');
  await page.waitForFunction(()=>window.CL&&CL.serverPersistenceReady()&&document.querySelector('#statsPageHost')?.shadowRoot?.querySelector('#statsContent')?.getAttribute('aria-busy')==='false');
  const state=await page.evaluate(()=>({legacy:window._statsInitialSync,ready:CL.serverPersistenceReady(),
    text:document.querySelector('#statsPageHost').shadowRoot.querySelector('#statsContent').textContent}));
  assert.equal(state.legacy,undefined,'embedded initialization remains private rather than leaking a test-only global');
  assert.equal(state.ready,true);assert.ok(state.text.trim().length>0);assert.deepEqual(errors,[]);
  await page.locator('#statsPageHost').locator('[data-tab="wrong"]').click();
  const remove=page.locator('#statsPageHost').locator('.wrong-del');
  assert.equal(await remove.count(),1,'synthetic mistake renders inside the real embedded page');
  await remove.click();
  await page.waitForFunction(()=>document.querySelector('#statsPageHost').shadowRoot.querySelectorAll('.wrong-del').length===0);
  const confirmed=await (await fetch(base+'/api/data',{headers})).json();
  assert.equal(confirmed.mem.reinforceBook.some(row=>row._key===mistakeKey),false);
  assert.equal(confirmed.mem.stats.totalAnswered,1,'removing a mistake does not rewrite answer counts');
  const removal=writes.filter(row=>row.type==='mistake.remove');
  assert.equal(removal.length,1,'one user click sends exactly one narrow removal');
  assert.equal(removal[0].payload.key,mistakeKey);
  await page.goto(base+'/main.html?view=stats');
  await page.waitForFunction(()=>CL.serverPersistenceReady()&&document.querySelector('#statsPageHost')?.shadowRoot?.querySelector('#statsContent')?.getAttribute('aria-busy')==='false');
  await page.locator('#statsPageHost').locator('[data-tab="wrong"]').click();
  assert.equal(await page.locator('#statsPageHost').locator('.wrong-del').count(),0,'confirmed removal survives navigation');
  assert.deepEqual(legacyWrites,[],'embedded interactions never submit a full snapshot');
  assert.deepEqual(errors,[]);
  console.log('Stats initialization: redirect, embedded readiness, real narrow mistake removal and direct entry passed; no private globals exposed');
}finally{
  if(browser)await browser.close();if(child&&child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}
  assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(dir,{recursive:true,force:true});
}})().catch(error=>{console.error(error);process.exitCode=1;});
