'use strict';
/**
 * account-set-credentials.test.js · 「游客账号就地升级为可跨设备账号」真实浏览器回归
 *
 * 背景：鉴权模式下首访会自动注册一个静默游客账号（guest_<随机>，密码随机且用户不知晓），
 * 用户换设备登不回来。本测试验证补救路径真的成立，且**数据不丢**：
 *
 *   1. 全新上下文 A 自动成为游客 → 写入一份数据 → 记下 user_id
 *   2. A 在设置里「设置账号」（改用户名 + 设密码）
 *      - 账号名展示更新为新名
 *      - 仍未登出、user_id 不变（改名不换账号 ⇒ 零迁移的前提）
 *      - chunklab_guest 被清除、chunklab_manual 置位
 *        （否则下次启动会拿旧凭据静默重登 → 失败 → 自动新建空游客 → 用户以为数据丢了）
 *   3. 全新上下文 B（模拟另一台设备）用手设的账号登录
 *      - 拿到**同一个 user_id**
 *      - 能看到 A 写入的那份数据 ⇒ 这才是本功能的最终承诺
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
const COURSE_ID='guest-carried-over';
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
}
async function loginOn(page,user,pass){
  await page.locator('#chunkauth-mask input[placeholder="用户名"]').fill(user);
  await page.locator('#chunkauth-mask input[type="password"]').fill(pass);
  await page.locator('#chunkauth-mask button').first().click();
  await page.waitForFunction(()=>window.CL && !document.getElementById('chunkauth-mask'),null,{timeout:20000});
  await settleSession(page);
  await page.evaluate(()=>CL.preload());
}

(async()=>{try{
  server=spawn(process.execPath,['index.js'],{cwd:path.join(root,'server'),env:{...process.env,PORT:String(port),CHUNKLAB_DATA_DIR:temp,REQUIRE_AUTH:'true',JWT_SECRET:require('crypto').randomBytes(32).toString('hex'),NODE_ENV:'test'},stdio:'ignore'});
  let ready=false;
  for(let i=0;i<60;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch(_){}if(ready)break;await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready,'server ready');
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});

  /* ---------- 1. 上下文 A：自动成为游客并留下数据 ---------- */
  const ctxA=await browser.newContext({serviceWorkers:'block'}),pageA=await ctxA.newPage();
  await pageA.goto(base+'/main.html');
  await pageA.waitForFunction(()=>window.ChunkAPI && ChunkAPI.getToken() && window.CL && window.AccountStorage,
    null,{timeout:20000});
  await settleSession(pageA); /* 游客自动注册写 token → 触发一次重载，必须等它落定 */
  await pageA.evaluate(()=>CL.preload());
  const guestName=await pageA.evaluate(async()=>(await ChunkAPI.me()).user.username);
  check('首访自动获得游客账号', /^guest_/.test(guestName), 'name='+guestName);
  const uidBefore=await pageA.evaluate(async()=>(await ChunkAPI.me()).user.id);
  await pageA.evaluate(async(id)=>{await CL.writeCourses([{courseId:id,name:'Carried over'}]);await CL.cloudSyncNow(CL.loadMem());},COURSE_ID);

  /* ---------- 2. 在设置里「设置账号」 ---------- */
  await pageA.locator('#btnSettingsTop').click();
  await pageA.waitForFunction(()=>document.getElementById('accountSection') && !document.getElementById('accountSection').hidden);
  check('登录后「设置账号」按钮可见', await pageA.locator('#btnAccountSet').isVisible());
  /* 提示文案由 refreshAccountUi → me() 异步写入，必须等它落地再断言（否则是「等元素≠等值」的假红） */
  await pageA.waitForFunction(()=>document.getElementById('acctHint').textContent.includes('设置账号'),null,{timeout:15000});
  check('游客态提示文案指向「设置账号」', true);
  await pageA.locator('#btnAccountSet').click();
  await pageA.locator('#chunkacct-mask').waitFor();
  await pageA.locator('#chunkacct-mask input[placeholder="用户名（自己起一个）"]').fill(NEW_USER);
  await pageA.locator('#chunkacct-mask input[placeholder="密码（至少 6 位）"]').fill(NEW_PASS);
  await pageA.locator('#chunkacct-mask input[placeholder="再输一次密码"]').fill(NEW_PASS);
  await pageA.locator('#chunkacct-mask button').first().click();
  await pageA.waitForFunction(()=>!document.getElementById('chunkacct-mask'),null,{timeout:15000});
  await pageA.waitForFunction(n=>document.getElementById('acctNameText').textContent===n,NEW_USER,{timeout:15000});
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
  await pageB.locator('#chunkauth-mask').waitFor({timeout:20000});
  await loginOn(pageB,NEW_USER,NEW_PASS);
  const bUid=await pageB.evaluate(async()=>(await ChunkAPI.me()).user.id);
  check('新设备登录到同一个账号（user_id 相同）', bUid===uidBefore, 'A='+uidBefore+' B='+bUid);
  const bSeesCourse=await pageB.evaluate(async(id)=>{
    await ChunkAPI.getData();
    return CL.readCourses().some(c=>c.courseId===id);
  },COURSE_ID);
  check('新设备能看到原账号的数据（跨设备同一份学习数据）', bSeesCourse===true);

  /* ---------- 4. 错密码必须报错，且不得静默换成新游客 ---------- */
  await pageB.evaluate(()=>ChunkAuthUI.logout());
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

  console.log('[account-set-credentials] 游客 → 自设账号 → 另一设备登回同一份数据 通过');
  console.log('[account-set-credentials] 改名不换 user_id；游客凭据已清除；错密码不静默换账号');
}finally{
  if(browser)await browser.close();
  if(server && server.exitCode===null){const ended=new Promise(r=>server.once('exit',r));server.kill();await ended;}
  try{fs.rmSync(temp,{recursive:true,force:true});}catch(_){}
}})().catch(e=>{console.error(e);process.exitCode=1;});
