'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { freePort } = require('./lib/free-port');
const root = path.resolve(__dirname, '..');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-usage-test-'));
const port = freePort(14500, 200);
const base = 'http://127.0.0.1:' + port;
const preview = process.argv.includes('--preview');
const server = spawn(process.execPath, ['server/index.js'], { cwd: root, windowsHide: true,
  env: { ...process.env, CHUNKLAB_DATA_DIR: directory, PORT: String(port), REQUIRE_AUTH: 'true',
    PHONE_AUTH_ENABLED: 'false', NODE_ENV: 'test', JWT_SECRET: 'isolated-usage-test-jwt-secret-123456789',
    ADMIN_JWT_SECRET: 'isolated-usage-test-admin-secret-123456789', ADMIN_PASSWORD: 'UsagePreview123!' },
  stdio: ['ignore','pipe','pipe'] });
let logs='';server.stdout.on('data',data=>{logs+=data;});server.stderr.on('data',data=>{logs+=data;});
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function request(route,token,body,expected=200) {
  const response=await fetch(base+route,{ method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined });
  const data=await response.json();assert.equal(response.status,expected,route+': '+JSON.stringify(data));return data;
}
(async function(){
  try {
    let ready=false;
    for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/health')).ok;if(ready)break;}catch(_){}await delay(100);}
    assert.ok(ready,logs);
    await request('/api/usage/study',null,{},401);
    const account=await request('/api/auth/register',null,{username:'usage-review-user',password:'TestPassword123!'});
    const admin=await request('/api/admin/login',null,{password:'UsagePreview123!'});
    await request('/api/usage/heartbeat',account.token,{});
    const first={sessionId:'http-test-session-12345',sequence:1,elapsedMs:0,kind:'wordbook',resourceId:'wordbook:review'};
    await request('/api/usage/study',account.token,first);
    await delay(80);
    const second=await request('/api/usage/study',account.token,{...first,sequence:2,elapsedMs:100});
    assert.ok(second.creditedMs>0&&second.creditedMs<=100);
    assert.equal((await request('/api/usage/study',account.token,{...first,sequence:2,elapsedMs:100})).creditedMs,0);
    await request('/api/usage/study',account.token,{...first,elapsedMs:30001},400);
    await request('/api/admin/overview',account.token,undefined,401);
    // Fixtures belong only to this freshly allocated temporary database.
    const Database=require('../server/node_modules/better-sqlite3');
    const fixture=new Database(path.join(directory,'chunklab.db'));
    fixture.prepare('INSERT INTO vocabulary_attempts(user_id,event_id,word,independent,occurred_at) VALUES(?,?,?,?,?)')
      .run(account.user.id,'fixture-word-123','borrow',0,Date.now());
    fixture.close();
    const overview=await request('/api/admin/overview?days=7',admin.token);
    assert.equal(overview.today.activeVisitors,1);assert.equal(overview.today.activeLearners,1);assert.equal(overview.usage.answers,1);
    assert.equal(overview.daily.length,7);
    const users=await request('/api/admin/users?search=usage-review',admin.token);
    assert.equal(users.users.length,1);assert.equal(users.users[0].answers,1);assert.equal(users.users[0].learningDays,1);
    const detail=await request('/api/admin/users/'+account.user.id,admin.token);
    assert.equal(detail.studyTime.totalMs,second.creditedMs);assert.equal(detail.recent[0].kind,'vocabulary');
    assert.equal(JSON.stringify(users).includes('password_hash'),false);
    assert.equal(JSON.stringify(detail).includes('password_hash'),false);
    if(preview){
      console.log(JSON.stringify({base,directory,adminPassword:'UsagePreview123!',adminToken:admin.token}));
      await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
    } else {
      await request('/api/content-import',account.token,{protocol:3,requestId:'usage-sentence-fixture-123',type:'deck.put',expectedRev:null,
        payload:{deck:{id:'usage-sentence-test',name:'计时测试课程',items:[{id:'usage-test-one',sentence:'We learn together.',en:'We learn together.',translation:'我们一起学习。',chunks:['We learn','together.'],alts:[[],[]],hints:['我们学习','一起']}]}}});
      await request('/api/operations',account.token,{protocol:3,requestId:'usage-enrollment-fixture-123',type:'course.enrollment',
        payload:{courseId:'user-deck:usage-sentence-test',joined:true}});
      const {chromium}=require('playwright-core');
      const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});
      try {
        const context=await browser.newContext({serviceWorkers:'block'});
        await context.addInitScript(token=>{localStorage.setItem('chunklab_token',token);localStorage.setItem('chunklab_manual','1');},account.token);
        const page=await context.newPage();
        const errors=[];page.on('pageerror',error=>errors.push(error.message));
        await page.goto(base+'/main.html?view=home');
        await page.waitForFunction(()=>window.CL&&CL.serverPersistenceReady()&&window.mem&&mem.decks.some(deck=>deck.id==='usage-sentence-test'),{},{timeout:20000});
        await page.evaluate(()=>{showPracticePage();startDeck(findDeck('usage-sentence-test'),0);});
        await page.waitForFunction(()=>window.S&&S.deck&&!S.finished&&!document.getElementById('pagePractice').classList.contains('hidden'),{},{timeout:20000});
        let live;
        for(let i=0;i<35;i++){
          await delay(400);live=await request('/api/admin/users/'+account.user.id,admin.token);
          if(live.studyTime.totalMs>second.creditedMs+2000)break;
        }
        assert.ok(live.studyTime.totalMs>second.creditedMs+2000,'real sentence practice must send foreground learning time');
        assert.ok(live.studyTime.courses.some(course=>course.name==='计时测试课程'),'user details show the actual course title');
        assert.equal(errors.length,0,errors.join('\n'));
        await page.goto(base+'/main.html?view=home');
        const paused=(await request('/api/admin/users/'+account.user.id,admin.token)).studyTime.totalMs;
        await delay(11000);
        assert.equal((await request('/api/admin/users/'+account.user.id,admin.token)).studyTime.totalMs,paused,'the homepage must not accrue learning time');
        await context.close();
      } finally {await browser.close();}
      console.log('usage analytics HTTP/browser: authenticated counting, retry, admin access, word activity, real study and home pause passed');
    }
  } finally {
    server.kill();await new Promise(resolve=>{if(server.exitCode!==null)resolve();else server.once('exit',resolve);});
    // Remove only the exact temporary directory allocated by this test.
    if(path.dirname(directory)===os.tmpdir()&&path.basename(directory).startsWith('chunklab-usage-test-'))fs.rmSync(directory,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
