'use strict';
const {chromium}=require('playwright-core'),{spawn}=require('child_process');
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),port=require('./lib/free-port').freePort(9400,100),base='http://127.0.0.1:'+port;
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cl-batch-client-'));
let browser,server,count=0;
function check(label,v){assert.ok(v,label);count++;console.log('  ✓ '+label);}
(async()=>{try{
  server=spawn(process.execPath,['testing/start-historical.js'],{cwd:path.join(root,'server'),env:{...process.env,PORT:String(port),CHUNKLAB_DATA_DIR:temp,REQUIRE_AUTH:'true',JWT_SECRET:require('crypto').randomBytes(32).toString('hex'),NODE_ENV:'test',CHUNKLAB_WRITE_PROTOCOL:'2'},stdio:'ignore'});
  let ready=false;
  /* 就绪窗口 300×100ms=30s（原 60×100ms=6s）：实测为临界窗口，宿主 node 冷启动 5.4s。
     本文件上轮靠重试才过、本轮直接过 ⇒ 落在临界带上，必须抬窗口。
     health 一旦 200 立即 break ⇒ 成功路径不增加耗时。 */
  for(let i=0;i<300;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch(_){}if(ready)break;await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
  const registered=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'batch-client',password:'test-password'})});assert.ok(registered.ok);
  const token=(await registered.json()).token;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
  await page.goto(base+'/api/health');await page.evaluate(t=>localStorage.setItem('chunklab_token',t),token);
  async function init(p){
    for(const file of ['js/account-storage.js','js/idb.js','api.js'])await p.addScriptTag({path:path.join(root,file)});
    // Historical isolated fixture adapter, not part of the shipped API.
    await p.evaluate(()=>{ChunkAPI.putData=payload=>ChunkAPI.request('/api/data',{method:'PUT',body:JSON.stringify(payload)});});
    await p.addScriptTag({path:path.join(root,'js/batch-sync.js')});
  }
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
  // Current page integration is covered separately in operation-page-integration.test.js.
  console.log('[legacy batch fixture] '+count+' passed; historical queue only, not product-page integration');
}finally{
  if(browser)await browser.close();
  if(server && server.exitCode===null){const ended=new Promise(r=>server.once('exit',r));server.kill();await ended;}
  fs.rmSync(temp,{recursive:true,force:true});
}})().catch(e=>{console.error(e);process.exitCode=1;});
