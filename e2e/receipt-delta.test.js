'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'chunklab-receipt-delta-'));
const port=require('./lib/free-port').freePort(11500,100),base='http://127.0.0.1:'+port;
let child,browser;
(async()=>{
  try{
    child=spawn(process.execPath,['server/index.js'],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,
      CHUNKLAB_DATA_DIR:dir,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'test',REQUIRE_AUTH:'true',PHONE_AUTH_ENABLED:'false',CHUNKLAB_WRITE_PROTOCOL:'3',
      JWT_SECRET:crypto.randomBytes(40).toString('hex'),ADMIN_JWT_SECRET:crypto.randomBytes(40).toString('hex'),MEMBERSHIP_CONTENT_GRANT_KEY:crypto.randomBytes(32).toString('base64')}});
    let ready=false;
    for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch(_){}if(ready)break;await new Promise(r=>setTimeout(r,100));}
    assert.ok(ready);
    const signup=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'receipt-test',password:'SyntheticReceipt2026!'})});
    assert.equal(signup.status,200);const account=await signup.json();
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});
    const context=await browser.newContext({serviceWorkers:'block'});
    await context.addInitScript(token=>localStorage.setItem('chunklab_token',token),account.token);
    const page=await context.newPage();let reads=0;
    page.on('request',request=>{if(new URL(request.url()).pathname==='/api/data')reads++;});
    async function client(){
      for(const file of ['js/account-storage.js','js/idb.js','api.js'])await page.addScriptTag({path:path.join(root,file)});
      await page.evaluate(async()=>{const config=await(await fetch('/api/config')).json();window.CL={getCloudConfig:()=>config};});
      for(const file of ['js/server-cache.js','js/server-store.js'])await page.addScriptTag({path:path.join(root,file)});
    }
    await page.goto(base+'/api/health');await client();await page.evaluate(()=>ServerCache.refresh());
    async function patch(id,patch){return page.evaluate(({id,patch})=>ServerStore.submitCommitted('settings.patch',{patch},{requestId:id}),{id,patch});}
    let start=reads;const first=await patch('receipt-direct-apply-001',{sound:false});assert.equal(reads,start,'normal receipt needs no GET');
    assert.equal(await page.evaluate(async()=>(await ServerStore.pending()).length),0);
    await page.evaluate(()=>ChunkAPI.submitOperation({protocol:3,requestId:'receipt-remote-write-001',type:'settings.patch',payload:{patch:{shuffle:true}}}));
    start=reads;await patch('receipt-gap-fallback-001',{sound:true});assert.equal(reads,start+1,'remote sequence gap fetches complete missing range');
    assert.deepEqual(await page.evaluate(async()=>{const row=await ServerCache.read();return{sound:row.snapshot.mem.settings.sound,shuffle:row.snapshot.mem.settings.shuffle};}),{sound:true,shuffle:true});
    await page.route('**/api/operations',async route=>{
      const response=await route.fetch(),body=await response.json();
      if(body.requestId==='receipt-old-format-001')delete body.changes;
      await route.fulfill({response,json:body});
    });
    start=reads;await patch('receipt-old-format-001',{shuffle:false});assert.equal(reads,start+1,'old response retains GET compatibility');
    await page.unroute('**/api/operations');
    await page.evaluate(()=>{
      const original=IDBStore.commitServerCache.bind(IDBStore);let failed=false;
      IDBStore.commitServerCache=(...args)=>{if(!failed){failed=true;return Promise.reject(Error('synthetic one-time storage failure'));}return original(...args);};
    });
    start=reads;await patch('receipt-idb-fallback-001',{sound:false});assert.equal(reads,start+1,'failed local receipt application safely falls back');
    const latest=await page.evaluate(async()=>(await ServerCache.read()).appliedSeq);
    await page.reload();await client();
    start=reads;const duplicate=await patch('receipt-direct-apply-001',{sound:false});
    assert.equal(duplicate.seq,first.seq);assert.equal(reads,start,'covered duplicate ACK retires without rollback or GET');
    assert.equal(await page.evaluate(async()=>(await ServerCache.read()).appliedSeq),latest);
    assert.equal(await page.evaluate(async()=>(await ServerStore.pending()).length),0);
    const occurredAt=Date.now()-20000;
    async function answer(index,time=occurredAt+index*100){return page.evaluate(({index,time})=>{
      const id='browser-evidence-answer-'+String(index).padStart(4,'0');
      return ServerStore.submitCommitted('learning.answer',{eventId:id,key:'evidence#one',deckId:'evidence',ok:true,
        occurredAt:time,sessionId:'browser-evidence-session',contentFingerprint:'synthetic-v1',firstAttempt:true,assisted:false},{requestId:id});
    },{index,time});}
    const evidenceResponses=[];let patches=0;
    page.on('response',response=>{
      if(new URL(response.url()).pathname!=='/api/operations')return;
      evidenceResponses.push(response.json().then(body=>{if(body.changes?.mem?.stats?.bySentence?.['evidence#one']?.learningV1?.evidenceDelta)patches++;}).catch(()=>{}));
    });
    start=reads;for(let i=0;i<36;i++)await answer(i);
    await Promise.all(evidenceResponses);assert.ok(patches>0,'real client opts in to append-only evidence responses');
    assert.equal(reads,start,'matching evidence deltas do not cause extra downlink');
    assert.equal(await page.evaluate(async()=>(await ServerCache.read()).snapshot.mem.stats.bySentence['evidence#one'].learningV1.evidence.length),36);
    start=reads;const late=await answer(36,occurredAt-1000);assert.equal(reads,start,'late event ordering is verified locally without GET');
    const canonical=await page.evaluate(id=>ChunkAPI.getOperationReceipt(id),late.requestId);
    assert.deepEqual(await page.evaluate(async()=>(await ServerCache.read()).snapshot.mem.stats.bySentence['evidence#one']),canonical.changes.mem.stats.bySentence['evidence#one']);
    await page.route('**/api/operations',async route=>{
      const response=await route.fetch(),body=await response.json();
      if(body.requestId==='browser-evidence-answer-0037')body.changes.mem.stats.bySentence['evidence#one'].learningV1.evidenceDelta.previousHash='0'.repeat(64);
      await route.fulfill({response,json:body});
    });
    start=reads;await answer(37);assert.equal(reads,start+1,'bad proof falls back to full canonical delta without losing the answer');
    await page.unroute('**/api/operations');
    await page.evaluate(time=>ChunkAPI.submitOperation({protocol:3,requestId:'browser-evidence-remote-0038',type:'learning.answer',payload:{
      eventId:'browser-evidence-remote-0038',key:'evidence#one',deckId:'evidence',ok:false,occurredAt:time}}),occurredAt+3800);
    start=reads;await answer(39);assert.equal(reads,start+1,'a remote evidence gap is never skipped');
    const evidence=await page.evaluate(async()=>(await ServerCache.read()).snapshot.mem.stats.bySentence['evidence#one'].learningV1.evidence);
    assert.equal(evidence.length,40);assert.ok(evidence.some(event=>event.id==='browser-evidence-remote-0038'&&event.ok===false));
    assert.equal(await page.evaluate(async()=>(await ServerStore.pending()).length),0);
    await page.reload();await client();
    start=reads;await answer(40);assert.equal(reads,start,'persisted long history remains a valid proof base after reload');
    assert.equal(await page.evaluate(async()=>(await ServerCache.read()).snapshot.mem.stats.bySentence['evidence#one'].learningV1.evidence.length),41);
    assert.equal(await page.evaluate(async()=>(await ServerStore.pending()).length),0);
    console.log('receipt browser: direct apply, evidence delta, late ordering, corrupt proof fallback, remote gap, old response, local failure, persisted history/reload and atomic retirement passed');
  }finally{
    if(browser)await browser.close();
    if(child&&child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(dir,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
