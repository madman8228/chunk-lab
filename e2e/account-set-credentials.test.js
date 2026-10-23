'use strict';
/**
 * account-set-credentials.test.js · 「历史游客账号保留原身份并升级凭据」真实浏览器回归
 *
 * 背景：历史版本可能已有 guest_<随机> 账号，不能因新版本停止自动建游客账号而丢失其身份/访问权。
 * 使用隔离服务器显式构造历史游客，不依赖当前首访流程自动注册：
 *
 *   1. 预置历史游客上下文 A → 导入一门独立课程 → 记下 user_id
 *   2. A 在设置里「设置账号」（改用户名 + 设密码）
 *      - 账号名展示更新为新名
 *      - 仍未登出、user_id 不变（改名不换账号 ⇒ 零迁移的前提）
 *      - chunklab_guest 被清除、chunklab_manual 置位
 *   3. 全新上下文 B（模拟另一台设备）用手设的账号登录
 *      - 拿到**同一个 user_id**
 *      - 能在独立课程库读取同一课程；课程正文不复制进个人学习快照
 *   4. B 用错密码登录：必须报错且**不得**静默换成新游客
 *
 * 运行：node e2e/account-set-credentials.test.js   退出码 0 = 全通过
 */
const {chromium}=require('playwright-core');
const {spawn}=require('child_process');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),port=require('./lib/free-port').freePort(9200,100);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cl-setcred-')),base='http://127.0.0.1:'+port;
const NEW_USER='cl-cross-device',NEW_PASS='cross-device-pass-1';
const GUEST_USER='guest_legacy_course_fixture',GUEST_PASS='legacy-guest-fixture-pass';
let browser,server;
function check(name,cond,detail){ if(cond) console.log('  \u2713 '+name); else { console.log('  \u2717 '+name+(detail?'  \u2192 '+detail:'')); throw new Error(name); } }

/**
 * 等「会话代次落定」。
 *
 * 根因（本测试第一版就踩了）：任何一次写 token（游客自动注册、登录、退出）都会让
 * AccountStorage 捕获的 epoch 与存储中的记录不一致 → 它**主动 reload 一次**。
 * 此时后续 evaluate 的响应会被 checkSession() 判为「登录状态已切换」而抛错 —— 表现为假红。
 * 元素出现 ≠ 值稳定：这里等的是「AccountStorage 捕获的 epoch == 存储记录的 epoch」这个**值**。
 */
async function settleSession(page){
  await page.waitForFunction(()=>{
    try{
      const rec=JSON.parse(localStorage.getItem('chunklab.session.v1')||'null');
      return !!(window.AccountStorage && rec && rec.epoch && AccountStorage.sessionEpoch===rec.epoch);
    }catch(e){ return false; }
  },null,{timeout:25000});
  /* sessionEpoch 对齐发生在受控 reload 之后；等新文档进入 DOMContentLoaded，
     再调用 CL.preload，避免命中旧文档卸载中的 promise。 */
  await page.waitForLoadState('domcontentloaded');
}
async function loginOn(page,user,pass){
  await page.locator('#chunkauth-mask input[placeholder="用户名"]').fill(user);
  await page.locator('#chunkauth-mask input[type="password"]').fill(pass);
  await Promise.all([
    page.waitForNavigation({waitUntil:'domcontentloaded'}),
    page.locator('#chunkauth-mask button').first().click()
  ]);
  await page.waitForFunction(()=>window.CL && !document.getElementById('chunkauth-mask'),null,{timeout:20000});
  await settleSession(page);
  await page.evaluate(()=>CL.ensureCloud());
}

(async()=>{try{
  server=spawn(process.execPath,['index.js'],{cwd:path.join(root,'server'),env:{...process.env,PORT:String(port),CHUNKLAB_DATA_DIR:temp,REQUIRE_AUTH:'true',PHONE_AUTH_ENABLED:'false',JWT_SECRET:require('crypto').randomBytes(32).toString('hex'),NODE_ENV:'test',CHUNKLAB_WRITE_PROTOCOL:'3'},stdio:'ignore'});
  let ready=false;
  /* 就绪窗口 300×100ms=30s（原 60×100ms=6s）：实测为临界窗口，宿主 node 冷启动 5.4s。
     health 一旦 200 立即 break ⇒ 成功路径不增加耗时。 */
  for(let i=0;i<300;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch(_){}if(ready)break;await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready,'server ready');
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});

  /* ---------- 1. 上下文 A：显式构造历史游客并留下独立课程 ---------- */
  const legacyGuestResponse=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:GUEST_USER,password:GUEST_PASS})});
  assert.equal(legacyGuestResponse.status,200,'isolated fixture creates a historical guest account explicitly');
  const legacyGuest=await legacyGuestResponse.json();
  const ctxA=await browser.newContext({serviceWorkers:'block'}),pageA=await ctxA.newPage();
  await pageA.addInitScript(token=>{
    localStorage.setItem('chunklab_token',token);
    localStorage.setItem('chunklab.session.v1',JSON.stringify({version:1,base:'',token,epoch:'legacy-guest-fixture'}));
  },legacyGuest.token);
  await pageA.goto(base+'/main.html');
  await pageA.waitForFunction(()=>window.ChunkAPI && ChunkAPI.getToken() && window.CL && window.AccountStorage && CL.serverPersistenceReady(),
    null,{timeout:20000});
  await pageA.evaluate(({username,password})=>localStorage.setItem('chunklab_guest',JSON.stringify({username,password})),{username:GUEST_USER,password:GUEST_PASS});
  await pageA.evaluate(()=>CL.ensureCloud());
  const guestName=await pageA.evaluate(async()=>(await ChunkAPI.me()).user.username);
  check('历史游客身份由合成夹具提供', guestName===GUEST_USER, 'name='+guestName);
  const uidBefore=await pageA.evaluate(async()=>(await ChunkAPI.me()).user.id);
  const imported=await pageA.evaluate(async()=>ChunkAPI.request('/api/course-library/import',{method:'POST',body:JSON.stringify({
    requestId:'credential-course-import-01',kind:'course',content:{courseId:'credential-course-source-01',title:'Credential continuity fixture',items:[
      {id:'line-1',cid:'stable-line-1',sentence:'We learn together.',chunks:['We learn','together.']}
    ]}
  })}));
  check('历史游客课程进入独立课程库',!!imported.courseId,JSON.stringify(imported));
  const COURSE_ID=imported.courseId;

  /* ---------- 2. 在设置里「设置账号」 ---------- */
  await pageA.locator('#btnSettingsTop').click();
  await pageA.locator('#chunkacct-mask').waitFor();
  await pageA.locator('#chunkacct-mask input[placeholder="用户名（自己起一个）"]').fill(NEW_USER);
  await pageA.locator('#chunkacct-mask input[placeholder="密码（至少 6 位）"]').fill(NEW_PASS);
  await pageA.locator('#chunkacct-mask input[placeholder="再输一次密码"]').fill(NEW_PASS);
  await pageA.locator('#chunkacct-mask button').first().click();
  await pageA.waitForFunction(()=>!document.getElementById('chunkacct-mask'),null,{timeout:15000});
  await pageA.waitForFunction(()=>document.getElementById('btnSettingsTop').textContent==='个人中心',null,{timeout:15000});
  check('账号名展示已更新为新名', true);

  const after=await pageA.evaluate(async()=>({
    name:(await ChunkAPI.me()).user.username,
    uid:(await ChunkAPI.me()).user.id,
    guest:localStorage.getItem('chunklab_guest'),
    manual:localStorage.getItem('chunklab_manual'),
    token:!!ChunkAPI.getToken()
  }));
  check('服务端账号名已是新名（回查 users 表）', after.name===NEW_USER, 'name='+after.name);
  check('设置账号后未登出', after.token===true);
  check('user_id 未变（改名不换账号 ⇒ 数据零迁移的前提）', after.uid===uidBefore, 'before='+uidBefore+' after='+after.uid);
  check('游客凭据已清除（防旧凭据静默重登失败后新建空账号）', after.guest===null, 'guest='+after.guest);
  check('已置手动会话标记（token 过期走登录框，不静默换账号）', after.manual==='1');

  /* ---------- 3. 上下文 B：模拟另一台设备，用新账号登回 ---------- */
  const ctxB=await browser.newContext({serviceWorkers:'block'}),pageB=await ctxB.newPage();
  await pageB.goto(base+'/api/health');
  await pageB.evaluate(()=>localStorage.setItem('chunklab_manual','1')); /* 有主账号的访客：不自动建游客 */
  await pageB.goto(base+'/main.html');
  await pageB.locator('#btnSettingsTop').waitFor();
  await pageB.locator('#btnSettingsTop').click(); /* 当前产品只在用户主动操作后打开登录框 */
  await pageB.locator('#chunkauth-mask').waitFor({timeout:20000});
  await loginOn(pageB,NEW_USER,NEW_PASS);
  const bUid=await pageB.evaluate(async()=>(await ChunkAPI.me()).user.id);
  check('新设备登录到同一个账号（user_id 相同）', bUid===uidBefore, 'A='+uidBefore+' B='+bUid);
  const bSeesCourse=await pageB.evaluate(async id=>{
    const library=await ChunkAPI.request('/api/course-library/'+encodeURIComponent(id));
    const learning=await ChunkAPI.getData();
    return {title:library.title,line:library.content.items[0].sentence,
      copiedIntoLearning:(learning.mem.decks||[]).some(course=>course.id===id)||(learning.mem.courses||[]).some(course=>course.courseId===id)};
  },COURSE_ID);
  check('新设备按同一账号权限读取独立课程',bSeesCourse.title==='Credential continuity fixture'&&bSeesCourse.line==='We learn together.');
  check('课程正文没有复制进个人学习同步数据',bSeesCourse.copiedIntoLearning===false);
  await pageB.goto(base+'/main.html');
  await settleSession(pageB);
  await pageB.waitForFunction(()=>window.ChunkAuthUI && window.CL);

  /* ---------- 4. 错密码必须报错，且不得静默换成新游客 ---------- */
  await pageB.evaluate(()=>ChunkAuthUI.logout());
  await pageB.waitForLoadState('domcontentloaded'); /* logout/auth epoch change triggers the app's controlled reload */
  await pageB.waitForFunction(()=>window.ChunkAPI&&!ChunkAPI.isLoggedIn()&&document.getElementById('btnSettingsTop')?.textContent==='登录');
  await pageB.locator('#btnSettingsTop').click();
  await pageB.locator('#chunkauth-mask').waitFor();
  await pageB.locator('#chunkauth-mask input[placeholder="用户名"]').fill(NEW_USER);
  await pageB.locator('#chunkauth-mask input[type="password"]').fill('definitely-wrong-pass');
  await pageB.locator('#chunkauth-mask button').first().click();
  await pageB.waitForFunction(()=>{
    const m=document.getElementById('chunkauth-mask');
    return m && /错误/.test(m.textContent);
  },null,{timeout:20000});
  check('错密码显示错误提示', true);
  check('错密码后仍未登录（不静默新建游客账号）', (await pageB.evaluate(()=>ChunkAPI.getToken()))===null);

  console.log('[account-set-credentials] 历史游客 → 自设账号 → 另一设备读取同一独立课程 通过');
  console.log('[account-set-credentials] 改名不换 user_id；游客凭据已清除；错密码不静默换账号');
}finally{
  if(browser)await browser.close();
  if(server && server.exitCode===null){const ended=new Promise(r=>server.once('exit',r));server.kill();await ended;}
  try{fs.rmSync(temp,{recursive:true,force:true});}catch(_){}
}})().catch(e=>{console.error(e);process.exitCode=1;});
