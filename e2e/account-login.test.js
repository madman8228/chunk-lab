'use strict';
const {chromium}=require('playwright-core');
const {spawn}=require('child_process');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),port=require('./lib/free-port').freePort(9400,100);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cl-login-')),base='http://127.0.0.1:'+port;
let browser,server;
(async()=>{try{
  server=spawn(process.execPath,['index.js'],{cwd:path.join(root,'server'),env:{...process.env,PORT:String(port),CHUNKLAB_DATA_DIR:temp,REQUIRE_AUTH:'true',JWT_SECRET:require('crypto').randomBytes(32).toString('hex'),NODE_ENV:'test'},stdio:'ignore'});
  let ready=false;
  for(let i=0;i<60;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch(_){}if(ready)break;await new Promise(r=>setTimeout(r,100));}
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
    await page.locator('#chunkauth-mask button').click();
    await page.waitForFunction(name=>window.ChunkAPI && ChunkAPI.getToken() && JSON.parse(atob(ChunkAPI.getToken().split('.')[1])).uname===name && window.CL && !document.getElementById('chunkauth-mask') && document.documentElement.style.visibility!=='hidden',name);
    await page.evaluate(()=>CL.preload());
  }
  await login('alice-test');
  const aliceEpoch=await page.evaluate(()=>AccountStorage.sessionEpoch);
  assert.ok(aliceEpoch,'登录后存在持久会话代次');
  await page.evaluate(async()=>{await CL.writeCourses([{courseId:'alice-only',name:'Alice private'}]);await CL.cloudSyncNow(CL.loadMem());});
  await page.evaluate(()=>ChunkAuthUI.logout());
  await page.locator('#chunkauth-mask').waitFor();
  assert.equal(await page.evaluate(()=>ChunkAPI.getToken()),null,'explicit logout remains logged out');
  await login('bob-test');
  assert.equal(await page.evaluate(()=>CL.readCourses().some(c=>c.courseId==='alice-only')),false,'B cannot read A');
  assert.equal(await page.evaluate(async()=>JSON.stringify(await ChunkAPI.getData()).includes('alice-only')),false,'B cloud has no A data');
  await page.evaluate(()=>ChunkAuthUI.logout());await page.locator('#chunkauth-mask').waitFor();
  await login('alice-test');
  assert.notEqual(await page.evaluate(()=>AccountStorage.sessionEpoch),aliceEpoch,'A退出后再次登录即使uid相同也使用新会话代次');
  assert.equal(await page.evaluate(()=>CL.readCourses().some(c=>c.courseId==='alice-only')),true,'A data preserved');
  await page.evaluate(()=>localStorage.setItem('chunklab.v1',JSON.stringify({decks:[{id:'old-owned',name:'Old'}]})));
  await page.locator('#btnSettingsTop').click();
  await page.locator('#backupHead').click();
  await page.locator('#btnRecoverLegacy').click();
  await page.locator('#legacyDownload').click();
  await page.waitForFunction(()=>document.getElementById('legacyRecoveryStatus').textContent.includes('确认'));
  await page.locator('#legacyMine').check();
  const downloaded=page.waitForEvent('download');
  await page.locator('#legacyDownload').click();
  const download=await downloaded;
  const file=await download.path();
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).mem.decks[0].id,'old-owned','download contains old data');
  assert.equal(await page.evaluate(()=>CL.readCourses()[0].courseId),'alice-only','download does not replace current data');
  await page.locator('#legacyPreview').click();
  await page.waitForFunction(()=>!document.getElementById('legacyApply').disabled);
  await page.locator('#legacyApply').click();
  await page.waitForFunction(()=>window.AccountStorage && AccountStorage.recovery.revision && window.CL);
  await page.evaluate(()=>CL.preload());
  assert.equal(await page.evaluate(()=>CL.loadMem().decks.some(d=>d.id==='old-owned')),true,'UI restore activates staged data');
  assert.equal(await page.evaluate(()=>CL.readCourses().some(c=>c.courseId==='alice-only')),true,'UI restore preserves current courses');
  console.log('[account-login] real authenticated A login → logout → B login → logout → A login passed');
  console.log('[legacy backup UI] unchecked blocked; checked download verified; current data unchanged');
  console.log('[legacy restore UI] preview → confirmation → reload preserves old decks and current courses');
}finally{
  if(browser)await browser.close();
  if(server && server.exitCode===null){const ended=new Promise(r=>server.once('exit',r));server.kill();await ended;}
  fs.rmSync(temp,{recursive:true,force:true});
}})().catch(e=>{console.error(e);process.exitCode=1;});
