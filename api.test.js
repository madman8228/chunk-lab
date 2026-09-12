'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
async function main() {
  let response;
  const storage = new Map();
  const context = {
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k,v) => storage.set(k,String(v)), removeItem: k => storage.delete(k) },
    fetch: async () => response
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(require.resolve('./api.js'), 'utf8'), context);
  response = { status: 409, ok: false, text: async () => JSON.stringify({
    error: 'conflict', code: 'SYNC_CONFLICT', conflicts: [{ entity: 'decks', id: 'd1', currentRev: 2 }]
  }) };
  await assert.rejects(context.ChunkAPI.putData({ mem: {} }), error =>
    error.status === 409 && error.code === 'SYNC_CONFLICT' && error.conflicts[0].id === 'd1');
  response = { status: 200, ok: true, text: async () => '{"ok":true}' };
  assert.equal((await context.ChunkAPI.putData({ mem: {} })).ok, true);
  const api=context.ChunkAPI;
  let release;
  context.fetch=()=>new Promise(resolve=>{release=resolve;});
  api.setToken('account-a');
  let pending=api.getData();
  api.setToken('account-b');
  release({status:401,ok:false,text:async()=>''});
  await assert.rejects(pending,e=>e.code==='SESSION_CHANGED');
  assert.equal(api.getToken(),'account-b','late A 401 must not log out B');

  pending=api.getData();
  storage.set(api.TOKEN_KEY,'account-c'); // Another tab bypasses this instance's setter.
  release({status:200,ok:true,text:async()=>'{"mem":{"private":"B"}}'});
  await assert.rejects(pending,e=>e.code==='SESSION_CHANGED');

  pending=api.getData();
  api.setBase('https://other.invalid');
  release({status:200,ok:true,text:async()=>'{"ok":true}'});
  await assert.rejects(pending,e=>e.code==='SESSION_CHANGED');

  context.fetch=async()=>({status:200,ok:true,text:()=>new Promise(resolve=>{release=resolve;})});
  pending=api.getData();
  await Promise.resolve();
  api.clearToken();api.setToken('account-c'); // Even a same-token round trip invalidates the request.
  release('{"ok":true}');
  await assert.rejects(pending,e=>e.code==='SESSION_CHANGED');

  context.fetch=async()=>({status:401,ok:false,text:async()=>''});
  await assert.rejects(api.getData(),e=>e.code==='NOT_AUTH');
  assert.equal(api.getToken(),null,'current session 401 still logs out');
  api.setToken('existing-account');
  const oldBase=api.getBase();
  let requestUrl,requestHeaders;
  context.fetch=async(url,options)=>{
    requestUrl=url;requestHeaders=options.headers;
    return {status:401,ok:false,text:async()=>'{"error":"wrong password"}'};
  };
  await assert.rejects(api.login('test-user','wrong-password','https://new.invalid'),/wrong password/);
  assert.equal(requestUrl,'https://new.invalid/api/auth/login');
  assert.equal(requestHeaders.Authorization,undefined,'never send existing token to login server');
  assert.equal(api.getToken(),'existing-account','failed login must preserve existing session');
  assert.equal(api.getBase(),oldBase,'editing server address must not commit before login succeeds');
  api.setSession('https://new.invalid','new-account');
  assert.equal(api.getBase(),'https://new.invalid');
  assert.equal(api.getToken(),'new-account');
  api.setBase('https://third.invalid');
  assert.equal(api.getToken(),null,'changing server alone must not forward the old server token');
  context.AccountStorage={storage:context.localStorage,assertCurrent() {}};
  storage.set('chunklab.restore-cloud-hold','1');
  context.fetch=async(url)=>({status:200,ok:true,text:async()=>
    url.endsWith('/api/sync/batch') ? '{"seq":4,"snapshot":{}}' : '{"ok":true}'});
  assert.equal((await api.getSyncBatch()).seq,4,'restore hold must allow conflict comparison');
  assert.equal((await api.resolveSyncBatch({requestId:'r1'})).ok,true,'restore hold must allow fixed resolution');
  await assert.rejects(api.putData({mem:{}}),e=>e.code==='RESTORE_LOCAL_ONLY','restore hold must block ordinary writes');
  storage.delete('chunklab.restore-cloud-hold');
  response={status:428,ok:false,text:async()=>'{"error":"请升级客户端","code":"CLIENT_UPGRADE_REQUIRED"}'};
  context.fetch=async()=>response;
  let upgradeEvents=0;
  context.Event=function(type){this.type=type;};
  context.dispatchEvent=function(event){if(event.type==='chunklab-upgrade-required')upgradeEvents++;};
  await assert.rejects(api.putData({mem:{}}),e=>e.status===428 && e.code==='CLIENT_UPGRADE_REQUIRED');
  assert.equal(context.__chunklabUpgradeRequired,true,'旧页面必须保留升级提示信号');
  assert.equal(upgradeEvents,1,'运行中的旧页面必须收到升级事件');
  let stagedPublication;
  context.BatchSync={
    state:async()=>({baseline:7,localGeneration:4}),
    stage:async(payload,baseline,generation)=>{stagedPublication={payload,baseline,generation};},
    retry:async()=>({receipt:{ok:true,seq:8}})
  };
  assert.equal((await api.publishDeck('deck-1',true)).seq,8,'发布应复用条件批次回执');
  assert.equal(stagedPublication.baseline,7,'发布使用已确认基线');
  assert.equal(stagedPublication.generation,4,'发布绑定本地代次');
  assert.deepEqual(JSON.parse(JSON.stringify(stagedPublication.payload.publications)),[{deckId:'deck-1',publish:true}], '发布以固定载荷入队');
  console.log('[api] stale token/base/body responses rejected; late 401 preserves new login');
  console.log('[api] error receipts preserved; success unaffected');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
