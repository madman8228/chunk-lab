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
    error: 'conflict', code: 'SYNC_CONFLICT', traceId: '12345678-1234-4234-8234-123456789abc', conflicts: [{ entity: 'decks', id: 'd1', currentRev: 2 }]
  }) };
  await assert.rejects(context.ChunkAPI.submitOperation({ protocol:3, type:'deck.put', payload:{} }), error =>
    error.status === 409 && error.code === 'SYNC_CONFLICT' && error.traceId === '12345678-1234-4234-8234-123456789abc' && error.conflicts[0].id === 'd1');
  response = { status: 200, ok: true, text: async () => '{"ok":true}' };
  assert.equal((await context.ChunkAPI.submitOperation({ protocol:3, type:'deck.put', payload:{} })).ok, true);
  const api=context.ChunkAPI;
  let snapshotUrl;
  context.fetch=async(url)=>{ snapshotUrl=url; return {status:200,ok:true,text:async()=>'{"seq":17,"delta":true}'}; };
  await api.getData(12);
  assert.ok(snapshotUrl.endsWith('/api/data?since=12'), 'confirmed cache pulls must request a delta from the applied watermark');
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
  await assert.rejects(api.getData(),e=>e.code==='NOT_AUTH'&&e.status===401);
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
  context.AccountStorage={storage:context.localStorage,assertCurrent() {},credentialsChanged() {}};
  storage.set('chunklab.restore-cloud-hold','1');
  context.fetch=async(url)=>({status:200,ok:true,text:async()=>
    url.endsWith('/api/sync/batch') ? '{"seq":4,"snapshot":{}}' : '{"ok":true}'});
  assert.equal((await api.getSyncBatchResolution('r1')).ok,true,'restore hold allows read-only historical receipts');
  assert.equal((await api.getSyncResolution('r1')).ok,true,'entity receipts remain readable');
  await assert.rejects(api.request('/api/sync/batch/resolve',{method:'POST',body:'{}'}),
    e=>e.code==='RESTORE_LOCAL_ONLY','restore hold does not permit retired conflict writes');
  await assert.rejects(api.request('/api/data',{method:'PUT',body:'{}'}),e=>e.code==='RESTORE_LOCAL_ONLY',
    'restore hold must block an explicit retired snapshot write probe');
  await assert.rejects(api.importCourseContent({protocol:3,type:'course.put'}),e=>e.code==='RESTORE_LOCAL_ONLY',
    'restore hold must block content mutations until the preserved source is reconciled');
  storage.delete('chunklab.restore-cloud-hold');
  response={status:428,ok:false,text:async()=>'{"error":"请升级客户端","code":"CLIENT_UPGRADE_REQUIRED"}'};
  context.fetch=async()=>response;
  let upgradeEvents=0;
  context.Event=function(type){this.type=type;};
  context.dispatchEvent=function(event){if(event.type==='chunklab-upgrade-required')upgradeEvents++;};
  await assert.rejects(api.submitOperation({protocol:3,type:'deck.put',payload:{}}),e=>e.status===428 && e.code==='CLIENT_UPGRADE_REQUIRED');
  assert.equal(context.__chunklabUpgradeRequired,true,'旧页面必须保留升级提示信号');
  assert.equal(upgradeEvents,1,'运行中的旧页面必须收到升级事件');
  response={status:429,ok:false,headers:{get:name=>name==='Retry-After'?'7':null},text:async()=>'{"error":"rate limited"}'};
  await assert.rejects(api.submitOperation({protocol:3,requestId:'retry-after-seconds',type:'learning.answer',payload:{}}),
    error=>error.status===429&&error.retryAfterMs===7000);
  response={status:429,ok:false,headers:{get:name=>name==='Retry-After'?new Date(Date.now()+5000).toUTCString():null},text:async()=>'{"error":"rate limited"}'};
  await assert.rejects(api.submitOperation({protocol:3,requestId:'retry-after-date',type:'learning.answer',payload:{}}),
    error=>error.status===429&&error.retryAfterMs>=3000&&error.retryAfterMs<=5000);
  response={status:429,ok:false,headers:{get:name=>name==='Retry-After'?'invalid':null},text:async()=>'{"error":"rate limited"}'};
  await assert.rejects(api.submitOperation({protocol:3,requestId:'retry-after-invalid',type:'learning.answer',payload:{}}),
    error=>error.status===429&&error.retryAfterMs===undefined);
  for(const method of ['putData','importData','getSyncBatch','resolveSyncBatch','getSyncEntity','resolveSync','postCourse','deleteCourse','publishDeck']) {
    assert.equal(api[method],undefined,'normal API does not expose retired method '+method);
  }
  /* 设置账号凭据（把静默游客账号就地升级为可跨设备账号）：
     路径虽以 /api/auth/ 开头，但不是登录/注册，必须照常带上既有 token ——
     服务端正是据 token 判定「改的是哪个账号」，漏带就变成未鉴权，用户会改不动自己的账号。 */
  let credUrl, credHeaders, credBody;
  context.fetch = async (url, options) => {
    credUrl = url; credHeaders = options.headers; credBody = options.body;
    return { status: 200, ok: true, text: async () => '{"ok":true,"user":{"id":7,"username":"zhangsan"}}' };
  };
  api.setToken('guest-account-token');
  const credResult = await api.setCredentials({ username: 'zhangsan', password: 'secret123' });
  assert.equal(credResult.user.username, 'zhangsan');
  assert.ok(credUrl.endsWith('/api/auth/credentials'), '设置账号端点路径: ' + credUrl);
  assert.equal(credHeaders.Authorization, 'Bearer guest-account-token', '设置账号必须带 token');
  assert.deepEqual(JSON.parse(credBody), { username: 'zhangsan', password: 'secret123' }, '请求体只含用户显式给出的字段');
  /* 失败（如用户名已被占用）不得清掉会话，否则用户一输错就被登出、以为账号丢了 */
  context.fetch = async () => ({ status: 400, ok: false, text: async () => '{"error":"用户名已被占用"}' });
  await assert.rejects(api.setCredentials({ username: 'taken' }), /已被占用/);
  assert.equal(api.getToken(), 'guest-account-token', '设置失败必须保留当前会话');
  let healthUrl, healthOptions;
  context.fetch = async (url, options) => {
    healthUrl = url; healthOptions = options;
    return { status: 200, ok: true, text: async () => '{"ok":true}' };
  };
  assert.equal((await api.reportSaveHealth({ version: 1, clientId: 'client-123456789012345', pending: 2 })).ok, true);
  assert.ok(healthUrl.endsWith('/api/client-save-health'));
  assert.equal(healthOptions.headers.Authorization, 'Bearer guest-account-token');
  assert.equal(JSON.parse(healthOptions.body).pending, 2);
  console.log('[api] stale token/base/body responses rejected; late 401 preserves new login');
  console.log('[api] error receipts preserved; success unaffected');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
