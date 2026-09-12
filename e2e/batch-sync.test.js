'use strict';
const {chromium}=require('playwright-core'),{spawn}=require('child_process');
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),port=require('./lib/free-port').freePort(9400,100),base='http://127.0.0.1:'+port;
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cl-batch-client-'));
let browser,server,count=0;
function check(label,v){assert.ok(v,label);count++;console.log('  ✓ '+label);}
(async()=>{try{
  server=spawn(process.execPath,['index.js'],{cwd:path.join(root,'server'),env:{...process.env,PORT:String(port),CHUNKLAB_DATA_DIR:temp,REQUIRE_AUTH:'true',JWT_SECRET:require('crypto').randomBytes(32).toString('hex'),NODE_ENV:'test'},stdio:'ignore'});
  let ready=false;
  for(let i=0;i<60;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch(_){}if(ready)break;await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
  const registered=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'batch-client',password:'test-password'})});assert.ok(registered.ok);
  const token=(await registered.json()).token;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
  await page.goto(base+'/api/health');await page.evaluate(t=>localStorage.setItem('chunklab_token',t),token);
  async function init(p){for(const file of ['js/account-storage.js','js/idb.js','api.js','js/batch-sync.js'])await p.addScriptTag({path:path.join(root,file)});}
  await init(page);
  check('旧 conditional-batch-v1 记录迁移到 syncMeta',await page.evaluate(async()=>{
    const db=await IDBStore.open();
    await new Promise((resolve,reject)=>{const t=db.transaction('syncIntents','readwrite');t.objectStore('syncIntents').put({key:'conditional-batch-v1',owner:AccountStorage.owner,baseline:null,pending:null});t.oncomplete=resolve;t.onerror=()=>reject(t.error);});
    const state=await BatchSync.state();
    const meta=await new Promise((resolve,reject)=>{const t=db.transaction('syncMeta','readonly'),r=t.objectStore('syncMeta').get('conditional-batch-v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const legacy=await new Promise((resolve,reject)=>{const t=db.transaction('syncIntents','readonly'),r=t.objectStore('syncIntents').get('conditional-batch-v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    return state.baseline===null && meta && !legacy;
  }));
  check('未知基线不能生成上行请求',await page.evaluate(async()=>{try{await BatchSync.stage({mem:{}},null);return false;}catch(e){return e.code==='UNKNOWN_BASE';}}));
  const pending=await page.evaluate(async()=>{
    const remote=await ChunkAPI.getData();await BatchSync.observe(remote.seq,null);
    const scope='atomic-receipt-test';
    await IDBStore.writeStatsBatch({stats:{'atomic-receipt':{times:1}}},scope);
    const intent=(await IDBStore.readLearningIntents(scope))[0];
    const current=await BatchSync.state();
    await IDBStore.updateSyncMeta('conditional-batch-v1',function(record){
      record.pending={requestId:'atomic-ack-request',capturedGeneration:record.localGeneration,operationReceipts:[{key:intent.key,operationId:intent.operationId}]};
      return record;
    });
    await IDBStore.acknowledgeConditionalBatch('conditional-batch-v1','atomic-ack-request',
      current.baseline,current.localGeneration,[{key:intent.key,operationId:intent.operationId}]);
    window.atomicReceiptAck=!(await BatchSync.state()).pending && (await IDBStore.readLearningIntents(scope)).length===0;
    const payload={mem:{},statsDelta:{sbs:{sentence:{times:1}}}};
    const staged=BatchSync.stage(payload,remote.seq);payload.statsDelta.sbs.sentence.times=99;
    return staged;
  });
  check('条件同步回执同事务推进基线并清理匹配学习日志',await page.evaluate(()=>window.atomicReceiptAck));
  check('排队后修改原对象不改变固定请求',pending.statsDelta.sbs.sentence.times===1);
  await page.reload();await init(page);
  check('刷新后编号、版本和内容完整保留',JSON.stringify((await page.evaluate(()=>BatchSync.state())).pending)===JSON.stringify(pending));
  check('待确认期间阻止推进基线和下一批',await page.evaluate(async()=>{
    let observed=false,staged=false;const s=await BatchSync.state();
    try{await BatchSync.observe(s.baseline+1,s.baseline);}catch(e){observed=e.code==='BATCH_PENDING';}
    try{await BatchSync.stage({mem:{}},s.baseline);}catch(e){staged=e.code==='BATCH_PENDING';}
    return observed && staged;
  }));
  // Server commits, but the browser loses the successful response.
  await page.route('**/api/data',async route=>{if(route.request().method()==='PUT'){await route.fetch();await route.abort();}else await route.continue();});
  check('服务端成功但回执丢失时保留原请求',await page.evaluate(async()=>{try{await BatchSync.retry();return false;}catch(e){return !!(await BatchSync.state()).pending;}}));
  await page.unroute('**/api/data');
  const serverBefore=await page.evaluate(()=>ChunkAPI.getData());
  await page.reload();await init(page);
  const retry=await page.evaluate(()=>BatchSync.retry());
  check('刷新重试返回原回执且服务端不重复写入',retry.receipt.seq===serverBefore.seq && (await page.evaluate(()=>ChunkAPI.getData())).seq===serverBefore.seq);
  check('成功确认原子清理待发请求并推进基线',await page.evaluate(async()=>{const s=await BatchSync.state();return !s.pending && s.baseline!==null;}));
  check('组装请求后本地代次变化会拒绝旧 payload',await page.evaluate(async()=>{
    const before=await BatchSync.state();
    await BatchSync.noteLocalGeneration(before.localGeneration+1);
    try{await BatchSync.stage({mem:{stale:true}},before.baseline,before.localGeneration);return false;}
    catch(e){return e.code==='GENERATION_CHANGED' && !(await BatchSync.state()).pending;}
  }));
  check('落盘失败不会生成可发送的请求',await page.evaluate(async()=>{
    const before=await BatchSync.state(),put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(value){if(value.key==='conditional-batch-v1')throw Error('模拟存储失败');return put.apply(this,arguments);};
    let failed=false;try{await BatchSync.stage({mem:{}},before.baseline);}catch(e){failed=true;}finally{IDBObjectStore.prototype.put=put;}
    const after=await BatchSync.state();return failed && !after.pending && after.baseline===before.baseline;
  }));
  check('旧页面不能给旧修改套用更新后的基线',await page.evaluate(async()=>{
    const s=await BatchSync.state();try{await BatchSync.stage({mem:{}},s.baseline-1);return false;}catch(e){return e.code==='BASE_CHANGED';}
  }));
  const other=await context.newPage();await other.goto(base+'/api/health');await init(other);
  const baseline=(await page.evaluate(()=>BatchSync.state())).baseline;
  const competing=await Promise.all([page.evaluate(async seq=>{try{await BatchSync.stage({mem:{},statsDelta:{sbs:{next:{times:2}}}},seq);return true;}catch(e){return false;}},baseline),other.evaluate(async seq=>{try{await BatchSync.stage({mem:{},statsDelta:{sbs:{next:{times:3}}}},seq);return true;}catch(e){return false;}},baseline)]);
  check('两页面竞争只固定一批，不相互替换',competing.filter(Boolean).length===1);
  await page.evaluate(async()=>{const original=ChunkAPI.putData;ChunkAPI.putData=async()=>({ok:true});try{await BatchSync.retry();}catch(e){window.badReceipt=e.code;}finally{ChunkAPI.putData=original;}});
  check('无有效版本回执不能清理请求',await page.evaluate(async()=>badReceipt==='INVALID_RECEIPT' && !!(await BatchSync.state()).pending));
  await page.evaluate(async()=>{const seq=(await ChunkAPI.getData()).seq;await ChunkAPI.putData({mem:{},baseSeq:seq,statsDelta:{sbs:{remote:{times:4}}}});});
  check('云端并发变化时冲突保留原请求，不自动换基线',await page.evaluate(async()=>{
    const before=JSON.stringify((await BatchSync.state()).pending);
    try{await BatchSync.retry();return false;}catch(e){return e.code==='SYNC_CONFLICT' && before===JSON.stringify((await BatchSync.state()).pending);}
  }));
  /* Real entry-point smoke: the module must be on main.html and core must
     send the same conditional contract, rather than only passing the
     isolated queue tests above. */
  const liveContext=await browser.newContext({serviceWorkers:'block'});
  const live=await liveContext.newPage();
  await live.goto(base+'/api/health');
  await live.evaluate(t=>localStorage.setItem('chunklab_token',t),token);
  const requests=[];
  live.on('request',request=>{if(request.method()==='PUT'&&request.url().endsWith('/api/data'))requests.push(request.postDataJSON());});
  await live.goto(base+'/main.html');
  await live.waitForFunction(()=>window.CL&&window.BatchSync);
  await live.evaluate(()=>CL.ensureCloud());
  /* A page refresh must restore the durable localGeneration before the next
     save reserves a successor.  Without this, syncMeta at generation 50
     would be followed by an in-memory generation 1 and the request would be
     rejected as stale forever. */
  await live.evaluate(async()=>{
    await IDBStore.updateSyncMeta('conditional-batch-v1',function(record){
      record.localGeneration=Math.max(record.localGeneration||0,50);
      record.acceptedGeneration=record.localGeneration;
      record.pending=null; record.status='clean';
      return record;
    });
  });
  await live.reload();
  await live.waitForFunction(()=>window.CL&&window.BatchSync);
  await live.evaluate(()=>CL.ensureCloud());
  const restoredGeneration=await live.evaluate(async()=>{
    const state=await BatchSync.state();
    return {localGeneration:state.localGeneration,acceptedGeneration:state.acceptedGeneration};
  });
  check('刷新后恢复持久同步代次',restoredGeneration.localGeneration>=50 && restoredGeneration.acceptedGeneration>=50,JSON.stringify(restoredGeneration));
  await live.evaluate(async()=>{
    const mem=CL.loadMem();
    mem.decks=(mem.decks||[]).filter(d=>d.id!=='live-conditional-smoke');
    mem.decks.push({id:'live-conditional-smoke',name:'live conditional smoke',builtin:false,items:[{sentence:'Live smoke',translation:'',chunks:['Live','smoke'],hints:[],alts:[]}]});
    CL.saveAndNotify(mem);
    await CL.cloudSyncNow(mem);
  });
  check('真实 main.html 已加载 BatchSync 并发出条件请求',requests.some(p=>Number.isSafeInteger(p.baseSeq)&&typeof p.requestId==='string'));
  const liveState=await live.evaluate(async()=>BatchSync.state());
  check('真实保存完成后固定请求已确认',!liveState.pending,JSON.stringify(liveState));
  check('真实条件同步回执推进本地基线',Number.isSafeInteger(liveState.baseline),JSON.stringify(liveState));
  const rapidSave=await live.evaluate(async()=>{
    const first=CL.loadMem();
    first.decks=(first.decks||[]).filter(d=>d.id!=='rapid-a'&&d.id!=='rapid-b');
    first.decks.push({id:'rapid-a',name:'rapid A',builtin:false,items:[]});
    const second=JSON.parse(JSON.stringify(first));
    second.decks.push({id:'rapid-b',name:'rapid B',builtin:false,items:[]});
    const results=await Promise.all([CL.saveAndNotify(first),CL.saveAndNotify(second)]);
    await CL.cloudSyncNow(CL.loadMem());
    const remote=await ChunkAPI.getData(), state=await BatchSync.state();
    return {results,ids:(remote.mem.decks||[]).map(d=>d.id),state};
  });
  check('异步连续保存均成功并最终同步最新内容',rapidSave.results.every(Boolean) && rapidSave.ids.includes('rapid-a') && rapidSave.ids.includes('rapid-b') && !rapidSave.state.pending,JSON.stringify(rapidSave));
  const courseGeneration=await live.evaluate(async()=>{
    const before=await BatchSync.state();
    const courses=CL.readCourses();
    await CL.writeCourses(courses.concat([{courseId:'live-course-generation',title:'generation smoke',events:[]} ]));
    const after=await BatchSync.state();
    return {before:before.localGeneration,after:after.localGeneration};
  });
  check('真实课程保存与同步代次在同一持久边界推进',courseGeneration.after>courseGeneration.before,JSON.stringify(courseGeneration));
  await live.route('**/api/data',async route=>{
    if(route.request().method()==='PUT'){await route.fetch();await route.abort();}else await route.continue();
  });
  const lostPublication=await live.evaluate(async()=>{
    try{await ChunkAPI.publishDeck('live-conditional-smoke',true);return false;}
    catch(e){return !!(await BatchSync.state()).pending;}
  });
  await live.unroute('**/api/data');
  const publicationRetry=await live.evaluate(async()=>{
    const retry=await BatchSync.retry(),remote=await ChunkAPI.getData();
    const deck=(remote.mem.decks||[]).find(d=>d.id==='live-conditional-smoke');
    return {retry,public:!!(deck&&deck.isPublic),pending:(await BatchSync.state()).pending};
  });
  check('题库发布复用条件队列，丢回执后可重试且状态保留',lostPublication && publicationRetry.public && !publicationRetry.pending,JSON.stringify(publicationRetry));
  await live.close();
  await liveContext.close();
  console.log('[batch-sync browser] '+count+' passed; core ordinary-sync integration verified');
}finally{
  if(browser)await browser.close();
  if(server && server.exitCode===null){const ended=new Promise(r=>server.once('exit',r));server.kill();await ended;}
  fs.rmSync(temp,{recursive:true,force:true});
}})().catch(e=>{console.error(e);process.exitCode=1;});
