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
const recoveryProfileDir=fs.mkdtempSync(path.join(os.tmpdir(),'chunklab-auth-recovery-profile-'));
const base='http://127.0.0.1:'+port;
let server,browser,recoveryContext,serverLogs='';
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
    const learningFormat=await fetch(base+'/api/learning-data/format',{headers});
    assert.equal(learningFormat.headers.get('X-ChunkLab-Account-Id'),String(registered.user.id));
    assert.equal((await learningFormat.json()).format,'legacy-v1','new accounts remain on the legacy learning snapshot until migrated');
    const inactiveLearning=await fetch(base+'/api/learning-data',{headers});
    assert.equal(inactiveLearning.status,409,'unmigrated accounts cannot be switched to a references-only snapshot');
    assert.equal((await inactiveLearning.json()).code,'LEARNING_DATA_FORMAT_NOT_ACTIVE');
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
    recoveryContext=await chromium.launchPersistentContext(recoveryProfileDir,{headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath(),serviceWorkers:'block'});
    let cachePage;
    await recoveryContext.addInitScript(token=>localStorage.setItem('chunklab_token',token),registered.token);
    cachePage=await recoveryContext.newPage();
    const cacheRequests=[];
    cachePage.on('request',request=>{if(/\/api\/(?:learning-data|data)(?:\?|$)/.test(request.url()))cacheRequests.push(request.url());});
    await cachePage.goto(base+'/main.html?view=home');
    await cachePage.waitForFunction(()=>window.ServerCache&&window.IDBStore&&window.AccountStorage.owner!=='legacy-unassigned');
    const oldCache=await cachePage.evaluate(async()=>{
      await ServerCache.refresh();
      return {row:await ServerCache.read()};
    });
    assert.equal(oldCache.row.key,'server-cache-v3','legacy account startup keeps the old cache key');
    const Database=require(require.resolve('better-sqlite3',{paths:[path.join(root,'server')]}));
    const testDb=new Database(path.join(dataDir,'chunklab.db'));
    try {
      testDb.prepare("INSERT INTO user_learning_data_formats(user_id,format,migration_id) VALUES(?,'references-v1','isolated-cache-switch-test')")
        .run(registered.user.id);
    } finally { testDb.close(); }
    const newCache=await cachePage.evaluate(async()=>{
      await ServerCache.refresh();
      return {row:await ServerCache.read(),legacy:await IDBStore.readServerCache(JSON.stringify([
        new URL(ChunkAPI.getBase()||location.origin,location.origin).origin,AccountStorage.owner,3
      ]),AccountStorage.owner)};
    });
    assert.equal(newCache.row.key,'learning-cache-v1','account capability switches to a separate confirmed cache');
    assert.ok(newCache.legacy&&newCache.legacy.key==='server-cache-v3','switching formats preserves the legacy cache');
    assert.ok(cacheRequests.some(url=>url.includes('/api/data'))&&cacheRequests.some(url=>url.includes('/api/learning-data')),
      'client uses the endpoint selected by the authenticated account format');
    const retiredSnapshot=await fetch(base+'/api/data',{headers});
    assert.equal(retiredSnapshot.status,428,'migrated accounts cannot download the old mixed snapshot');
    assert.equal((await retiredSnapshot.json()).code,'LEARNING_DATA_FORMAT_UPGRADE_REQUIRED');
    const learningExport=await fetch(base+'/api/export',{headers}).then(response=>response.json());
    assert.equal(learningExport.format,'references-v1');
    assert.equal(Object.hasOwn(learningExport,'courses'),false,'new learning exports contain references only');
    const legacyContentWrite=await fetch(base+'/api/operations',{method:'POST',headers,body:JSON.stringify({protocol:3,
      requestId:'format-switch-deck-put-01',type:'deck.put',expectedRev:null,
      payload:{deck:{id:'must-not-return-to-account',name:'must not save',items:[{sentence:'Hello.'}]}}})});
    assert.equal(legacyContentWrite.status,428);
    assert.equal((await legacyContentWrite.json()).code,'COURSE_CONTENT_MOVED');
    const oldCourse={courseId:'legacy-import-fence-course',title:'Must not save',nodes:[]};
    const oldDeck={id:'legacy-import-fence-deck',name:'Must not save',items:[]};
    const largeLegacyImport=await fetch(base+'/api/content-import',{method:'POST',headers,body:JSON.stringify({protocol:3,
      requestId:'format-switch-content-import-01',type:'course.put',expectedRev:null,payload:{course:oldCourse}})});
    assert.equal(largeLegacyImport.status,428,'references-v1 also fences the large-body import path');
    assert.equal((await largeLegacyImport.json()).code,'COURSE_CONTENT_MOVED');
    const oldCourseRoute=await fetch(base+'/api/courses',{method:'POST',headers,body:JSON.stringify({course:oldCourse})});
    assert.equal(oldCourseRoute.status,428,'the retired course endpoint cannot recreate account-owned content');
    const oldBackupImport=await fetch(base+'/api/import',{method:'POST',headers,body:JSON.stringify({__app:'chunklab',data:{courses:[oldCourse]}})});
    assert.equal(oldBackupImport.status,428,'the retired whole-account backup import cannot bypass the content boundary');
    const readOnlyDb=new Database(path.join(dataDir,'chunklab.db'),{readonly:true,fileMustExist:true});
    try {
      assert.equal(readOnlyDb.prepare('SELECT count(*) AS n FROM user_courses WHERE user_id=? AND course_id=?').get(registered.user.id,oldCourse.courseId).n,0);
      assert.equal(readOnlyDb.prepare('SELECT count(*) AS n FROM user_decks WHERE user_id=? AND id=?').get(registered.user.id,oldDeck.id).n,0);
    } finally { readOnlyDb.close(); }
    const stillAllowedLearning=await fetch(base+'/api/operations',{method:'POST',headers,body:JSON.stringify({protocol:3,
      requestId:'format-switch-settings-01',type:'settings.patch',payload:{patch:{sound:false}}})});
    assert.equal(stillAllowedLearning.status,200,'learning state writes remain available after content is separated');
    const answerEventId='format_switch_answer_0001';
    const answerPayload={eventId:answerEventId,key:'format-switch-course#item-1',deckId:'format-switch-course',
      courseId:'format-switch-course',generation:0,sessionId:'format-switch-session-01',answerOrder:0,
      chunkRight:1,chunkTotal:1,ok:true};
    await cachePage.route('**/api/**',route=>route.abort());
    const queuedAnswer=await cachePage.evaluate(payload=>ServerStore.submit('learning.answer',payload,
      {requestId:'format-switch-answer-01'}),answerPayload);
    assert.equal(queuedAnswer.requestId,'format-switch-answer-01','offline answer is durably queued with its original request ID');
    const queuedBeforeReload=await cachePage.evaluate(async()=>{
      const row=(await ServerStore.pending()).find(item=>item.requestId==='format-switch-answer-01');
      return row&&{requestId:row.requestId,operation:row.operation,owner:row.owner,scope:row.scope};
    });
    assert.deepEqual(queuedBeforeReload.operation.payload,answerPayload,'the offline queue retains the exact learning payload');
    await cachePage.reload({waitUntil:'domcontentloaded'});
    await cachePage.waitForFunction(()=>window.ServerStore&&window.ServerCache&&window.IDBStore,{timeout:15000});
    const recoveredQueue=await cachePage.evaluate(async()=>{
      const row=(await ServerStore.pending()).find(item=>item.requestId==='format-switch-answer-01');
      const cache=await ServerCache.read();
      return {row:row&&{requestId:row.requestId,operation:row.operation,owner:row.owner,scope:row.scope},
        owner:AccountStorage.owner,cacheKey:cache&&cache.key};
    });
    assert.deepEqual(recoveredQueue.row,queuedBeforeReload,'reload preserves the original owner, scope, request ID, and payload');
    assert.equal(JSON.parse(recoveredQueue.owner)[1],String(registered.user.id));
    assert.equal(recoveredQueue.cacheKey,'learning-cache-v1','offline reload reuses only the confirmed account learning cache');
    await recoveryContext.close();
    recoveryContext=await chromium.launchPersistentContext(recoveryProfileDir,{headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath(),serviceWorkers:'block'});
    await recoveryContext.addInitScript(token=>localStorage.setItem('chunklab_token',token),registered.token);
    cachePage=await recoveryContext.newPage();
    await cachePage.route('**/api/**',route=>route.abort());
    await cachePage.goto(base+'/main.html?view=home');
    await cachePage.waitForFunction(()=>window.LearningSessionBootstrap&&window.ServerStore&&window.IDBStore,{timeout:15000});
    const restartedOffline=await cachePage.evaluate(async()=>{
      const row=(await ServerStore.pending()).find(item=>item.requestId==='format-switch-answer-01');
      const cache=await ServerCache.read();
      return {row:row&&{requestId:row.requestId,operation:row.operation,owner:row.owner,scope:row.scope},key:cache&&cache.key};
    });
    assert.deepEqual(restartedOffline.row,queuedBeforeReload,'closing and relaunching the browser preserves the queued request unchanged');
    assert.equal(restartedOffline.key,'learning-cache-v1','restarted browser retains the confirmed learning cache offline');
    await cachePage.unroute('**/api/**');
    await cachePage.reload({waitUntil:'domcontentloaded'});
    await cachePage.waitForFunction(()=>window.LearningSessionBootstrap&&window.ServerStore&&window.IDBStore,{timeout:15000});
    await cachePage.evaluate(()=>LearningSessionBootstrap.ready({allowConfirmedOffline:true}));
    await cachePage.evaluate(()=>ServerStore.retryPending());
    assert.equal(await cachePage.evaluate(async()=> (await ServerStore.pending()).length),0,
      'after reconnect and a fresh session bootstrap, the original operation is applied and retired only after server confirmation');
    const referencesSnapshot=await fetch(base+'/api/learning-data',{headers}).then(response=>response.json());
    assert.equal(referencesSnapshot.format,'references-v1');
    assert.equal(referencesSnapshot.mem.stats.events.filter(event=>event.id===answerEventId).length,1,
      'a saved answer is returned through the learning-only snapshot after format activation');
    assert.equal(referencesSnapshot.courses.length,0,'learning synchronization never carries course bodies');
    assert.equal(referencesSnapshot.mem.decks.length,0,'learning synchronization never carries deck bodies');
    await recoveryContext.close();
    recoveryContext=null;
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
    if(recoveryContext)await recoveryContext.close();
    if(browser)await browser.close();
    if(server&&server.exitCode===null){const ended=new Promise(resolve=>server.once('exit',resolve));server.kill();await ended;}
    if(path.resolve(dataDir).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(dataDir).startsWith('chunklab-auth-boundary-'))
      fs.rmSync(dataDir,{recursive:true,force:true});
    if(path.resolve(invalidDataDir).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(invalidDataDir).startsWith('chunklab-auth-disabled-'))
      fs.rmSync(invalidDataDir,{recursive:true,force:true});
    if(path.resolve(recoveryProfileDir).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(recoveryProfileDir).startsWith('chunklab-auth-recovery-profile-'))
      fs.rmSync(recoveryProfileDir,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);if(serverLogs)console.error(serverLogs.slice(-5000));process.exitCode=1;});
