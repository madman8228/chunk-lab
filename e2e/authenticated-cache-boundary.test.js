'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
const port=require('./lib/free-port').freePort(11300,100);
const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'chunklab-auth-boundary-'));
const invalidDataDir=fs.mkdtempSync(path.join(os.tmpdir(),'chunklab-auth-disabled-'));
const base='http://127.0.0.1:'+port;
let server,browser,serverLogs='';
(async()=>{
  try{
    const serverEnv={...process.env,NODE_ENV:'test',PORT:String(port),CHUNKLAB_DATA_DIR:dataDir,
      JWT_SECRET:require('node:crypto').randomBytes(32).toString('hex'),CHUNKLAB_WRITE_PROTOCOL:'3',
      PHONE_AUTH_ENABLED:'false',CORS_ORIGINS:'https://app.test'};
    delete serverEnv.REQUIRE_AUTH;
    server=spawn(process.execPath,['index.js'],{cwd:path.join(root,'server'),env:serverEnv,stdio:['ignore','pipe','pipe']});
    server.stdout.on('data',chunk=>{serverLogs+=chunk;});server.stderr.on('data',chunk=>{serverLogs+=chunk;});
    let ready=false;
    for(let i=0;i<300;i++){ready=await fetch(base+'/api/health').then(r=>r.ok).catch(()=>false);if(ready)break;await new Promise(resolve=>setTimeout(resolve,100));}
    assert.ok(ready,'isolated authenticated server starts');
    const config=await fetch(base+'/api/config').then(r=>r.json());
    assert.equal(config.requireAuth,true);
    assert.equal(config.responseIdentityVersion,1);
    const disabled=spawn(process.execPath,['index.js'],{cwd:path.join(root,'server'),env:{...process.env,
      NODE_ENV:'development',PORT:String(port+1),CHUNKLAB_DATA_DIR:invalidDataDir,REQUIRE_AUTH:'false'},stdio:'ignore'});
    const disabledExit=await new Promise(resolve=>disabled.once('exit',resolve));
    assert.equal(disabledExit,1,'normal service refuses an explicit open mode');
    const anonymous=await fetch(base+'/api/data');
    assert.equal(anonymous.status,401,'personal sync data rejects visitors');
    const registered=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username:'boundary-user',password:'temporary-test-password'})}).then(r=>r.json());
    assert.ok(registered.token);
    const headers={Authorization:'Bearer '+registered.token,'Content-Type':'application/json'};
    const snapshot=await fetch(base+'/api/data',{headers});
    assert.equal(snapshot.headers.get('X-ChunkLab-Account-Id'),String(registered.user.id));
    assert.equal(snapshot.headers.get('Cache-Control'),'private, no-store');
    const crossOrigin=await fetch(base+'/api/data',{headers:{...headers,Origin:'https://app.test'}});
    assert.equal(crossOrigin.headers.get('Access-Control-Expose-Headers'),'X-ChunkLab-Account-Id');
    const requestId='boundary-settings-request-01';
    const saved=await fetch(base+'/api/operations',{method:'POST',headers,body:JSON.stringify({protocol:3,requestId,
      type:'settings.patch',payload:{patch:{sound:true}}})});
    assert.equal(saved.status,200,await saved.text());
    assert.equal(saved.headers.get('X-ChunkLab-Account-Id'),String(registered.user.id));
    const receipt=await fetch(base+'/api/operations/'+requestId,{headers});
    assert.equal(receipt.headers.get('X-ChunkLab-Account-Id'),String(registered.user.id));
    assert.equal((await receipt.json()).requestId,requestId);
    const importFailure=await fetch(base+'/api/content-import',{method:'POST',headers,body:JSON.stringify({protocol:3,type:'course.put'})});
    assert.equal(importFailure.status,400);
    assert.equal(importFailure.headers.get('X-ChunkLab-Account-Id'),String(registered.user.id));
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});
    const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
    await page.goto(base+'/main.html?course=builtin%3Aoral&lesson=lesson%3Aoral-basic');
    await page.locator('#accountEntryPanel').waitFor({timeout:15000});
    assert.match(await page.locator('#accountEntryPanel').innerText(),/登录后开始学习/);
    assert.equal(await page.locator('#homeBody').textContent(),'','anonymous first paint does not render cached personal home data');
    assert.equal(await page.locator('#studyRoot').count(),0,'a protected course deep link never mounts for a visitor');
    const accessLinkDecoration=await page.locator('#accountEntryPanel').evaluate(panel=>{const link=document.createElement('a');link.className='btn';link.href='#';link.textContent='账号与兑换会员';panel.append(link);return getComputedStyle(link).textDecorationLine;});
    assert.equal(accessLinkDecoration,'none','course-access-panel action links should look like buttons, not underlined links');
    await page.locator('#accountEntryPanel button').click();
    await page.locator('#chunkauth-mask').waitFor({timeout:5000});
    await context.close();
    const wordbookContext=await browser.newContext({serviceWorkers:'block'}),wordbookPage=await wordbookContext.newPage();
    const contentRequests=[];wordbookPage.on('request',request=>{if(request.url().includes('/api/wordbooks/'))contentRequests.push(request.url());});
    await wordbookPage.goto(base+'/wordbook.html?book=textbook-wordbook%3Apep-junior-grade9-full-2013&unit=pep-g9-2013-unit-1');
    await wordbookPage.getByText('登录后即可开始单词本练习；登录后会返回当前课程。',{exact:true}).waitFor({timeout:10000});
    assert.equal(await wordbookPage.locator('#studyRoot input, #studyRoot button[type="submit"], #studyRoot .listen-word-view').count(),0,
      'a visitor does not receive exercise controls or textbook learning content');
    assert.equal(contentRequests.length,0,'a visitor is rejected before requesting wordbook content');
    await wordbookPage.getByRole('button',{name:'登录',exact:true}).click();
    await wordbookPage.locator('#chunkauth-mask').waitFor({timeout:5000});
    await wordbookContext.close();
    console.log('[authenticated-cache-boundary] visitor denial, response identity, and protected deep-link gate passed');
  }finally{
    if(browser)await browser.close();
    if(server&&server.exitCode===null){const ended=new Promise(resolve=>server.once('exit',resolve));server.kill();await ended;}
    if(path.resolve(dataDir).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(dataDir).startsWith('chunklab-auth-boundary-'))
      fs.rmSync(dataDir,{recursive:true,force:true});
    if(path.resolve(invalidDataDir).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(invalidDataDir).startsWith('chunklab-auth-disabled-'))
      fs.rmSync(invalidDataDir,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);if(serverLogs)console.error(serverLogs.slice(-5000));process.exitCode=1;});
