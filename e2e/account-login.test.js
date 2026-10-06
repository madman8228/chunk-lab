'use strict';
const {chromium}=require('playwright-core');
const {spawn}=require('child_process');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),port=require('./lib/free-port').freePort(9400,100);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cl-login-')),base='http://127.0.0.1:'+port;
let browser,server;
(async()=>{try{
  server=spawn(process.execPath,['index.js'],{cwd:path.join(root,'server'),env:{...process.env,PORT:String(port),CHUNKLAB_DATA_DIR:temp,REQUIRE_AUTH:'true',JWT_SECRET:require('crypto').randomBytes(32).toString('hex'),NODE_ENV:'test',CHUNKLAB_WRITE_PROTOCOL:'3'},stdio:'ignore'});
  let ready=false;
  /* 就绪窗口 300×100ms=30s（原 60×100ms=6s）：实测为临界窗口，宿主 node 冷启动 5.4s。
     health 一旦 200 立即 break ⇒ 成功路径不增加耗时。 */
  for(let i=0;i<300;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch(_){}if(ready)break;await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready);
  for(const username of ['alice-test','bob-test']){
    const r=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'test-only-password'})});
    assert.ok(r.ok,'register temporary account');
  }
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
  await page.goto(base+'/api/health');await page.evaluate(()=>localStorage.setItem('chunklab_manual','1'));
  await page.goto(base+'/main.html');
  async function login(name){
    await page.locator('#chunkauth-mask input[placeholder="用户名"]').fill(name);
    await page.locator('#chunkauth-mask input[type="password"]').fill('test-only-password');
    /* 登录成功后 setSession 会触发 AccountStorage 的受控 reload。
       必须先等待这次导航完成，不能在旧页面卸载期间调用 CL.preload()。 */
    await Promise.all([
      page.waitForNavigation({waitUntil:'domcontentloaded'}),
      page.locator('#chunkauth-mask button').click()
    ]);
    await page.waitForFunction(name=>window.ChunkAPI && ChunkAPI.getToken() && JSON.parse(atob(ChunkAPI.getToken().split('.')[1])).uname===name && window.CL && !document.getElementById('chunkauth-mask') && document.documentElement.style.visibility!=='hidden',name);
    await page.evaluate(()=>CL.preload());
    await page.evaluate(()=>CL.ensureCloud());
    await page.waitForFunction(()=>CL.serverPersistenceReady());
  }
  await login('alice-test');
  const aliceEpoch=await page.evaluate(()=>AccountStorage.sessionEpoch);
  assert.ok(aliceEpoch,'登录后存在持久会话代次');
  await page.evaluate(()=>ServerStore.submitCommitted('deck.put',{deck:{id:'alice-only',name:'Alice private',items:[{cid:'one',en:'Hello.',zh:'你好。'}]}},{expectedRev:null}));
  await page.evaluate(()=>ChunkAuthUI.logout());
  await page.locator('#chunkauth-mask').waitFor();
  assert.equal(await page.evaluate(()=>ChunkAPI.getToken()),null,'explicit logout remains logged out');
  await login('bob-test');
  assert.equal(await page.evaluate(async()=>(await ServerCache.read()).snapshot.mem.decks.some(c=>c.id==='alice-only')),false,'B confirmed view cannot read A');
  assert.equal(await page.evaluate(async()=>JSON.stringify(await ChunkAPI.getData()).includes('alice-only')),false,'B cloud has no A data');
  await page.evaluate(()=>ChunkAuthUI.logout());await page.locator('#chunkauth-mask').waitFor();
  await login('alice-test');
  assert.notEqual(await page.evaluate(()=>AccountStorage.sessionEpoch),aliceEpoch,'A退出后再次登录即使uid相同也使用新会话代次');
  assert.equal(await page.evaluate(async()=>(await ServerCache.read()).snapshot.mem.decks.some(c=>c.id==='alice-only')),true,'A confirmed course preserved');
  await page.evaluate(()=>localStorage.setItem('chunklab.v1',JSON.stringify({decks:[{id:'old-owned',name:'Old'}]})));
  assert.equal(await page.locator('#btnRecoverLegacy,#legacyRecovery,#recoveryCenter,#syncBadge').count(),0,'normal login does not expose legacy conflict/recovery controls');
  const ctxOther=await browser.newContext({serviceWorkers:'block'});
  try {
    const other=await ctxOther.newPage();
    await other.goto(base+'/api/health');
    await other.addScriptTag({path:path.join(root,'api.js')});
    await other.evaluate(async()=>{
      const result=await ChunkAPI.login('alice-test','test-only-password');
      ChunkAPI.setToken(result.token);
    });
    const snapshot=await other.evaluate(()=>ChunkAPI.getData());
    assert.ok(snapshot.mem.decks.some(deck=>deck.id==='alice-only'),'fresh device reads server-confirmed course without local data');
    const exported=await other.evaluate(()=>ChunkAPI.exportData());
    assert.ok(exported.mem.decks.some(deck=>deck.id==='alice-only'),'confirmed export preserves private course');
    await other.goto(base+'/decks.html?courseView=joined&courseType=all');
    await other.locator('#deckList').getByText('Alice private',{exact:true}).waitFor({timeout:15000});
  } finally {await ctxOther.close();}
  assert.ok(await page.evaluate(()=>localStorage.getItem('chunklab.v1').includes('old-owned')),'unassigned legacy asset untouched');
  console.log('[account-login] protocol 3 login/logout account isolation, fresh-device course read and export passed');
}finally{
  if(browser)await browser.close();
  if(server && server.exitCode===null){const ended=new Promise(r=>server.once('exit',r));server.kill();await ended;}
  fs.rmSync(temp,{recursive:true,force:true});
}})().catch(e=>{console.error(e);process.exitCode=1;});
