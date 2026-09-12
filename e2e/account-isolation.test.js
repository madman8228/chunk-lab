'use strict';
const {chromium}=require('playwright-core');
const {spawn}=require('child_process');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),port=require('./lib/free-port').freePort(9400,100);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cl-account-'));
const base='http://127.0.0.1:'+port;
const token=uid=>'eyJhbGciOiJub25lIn0.'+Buffer.from(JSON.stringify({uid})).toString('base64url')+'.test';
let browser,server,count=0;
function check(label,value){assert.ok(value,label);count++;console.log('  ✓ '+label);}
(async()=>{try{
  server=spawn(process.execPath,['index.js'],{cwd:path.join(root,'server'),env:{...process.env,PORT:String(port),CHUNKLAB_DATA_DIR:temp,REQUIRE_AUTH:'false',NODE_ENV:'test'},stdio:'ignore'});
  let ready=false;
  for(let i=0;i<60;i++){
    try{ready=(await fetch(base+'/api/health')).ok;}catch(_){}
    if(ready)break;await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(ready,'temporary server ready');
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
  await context.route('**/isolation.html',route=>route.fulfill({contentType:'text/html',body:
    '<!doctype html><body><script src="/js/account-storage.js"></script><script src="/js/idb.js"></script><script src="/js/batch-sync.js"></script><script src="/core.js"></script><script src="/api.js"></script><script src="/js/sync-resolution.js"></script><script src="/js/legacy-backup.js"></script><script src="/js/legacy-restore.js"></script><script>CL.preload().then(()=>window.ready=true)</script></body>'}));
  await page.goto(base+'/api/health');
  await page.evaluate(t=>{localStorage.setItem('chunklab_token',t);localStorage.setItem('chunklab.v1',JSON.stringify({decks:[{id:'legacy-private',name:'unknown owner'}]}));},token(101));
  await page.addScriptTag({path:path.join(root,'js/idb.js')});
  await page.evaluate(()=>IDBStore.putCourses([{courseId:'legacy-private'}]));
  await page.goto(base+'/isolation.html');
  await page.waitForFunction(()=>window.ready);
  check('旧版无归属数据不自动归给当前账号',await page.evaluate(()=>CL.readCourses().length===0 && !CL.loadMem().decks.some(d=>d.id==='legacy-private')));
  const ownerA=await page.evaluate(()=>AccountStorage.owner);
  await page.evaluate(async()=>{
    const m=CL.loadMem();m.decks.push({id:'private-a',name:'A',items:[]});CL.saveMem(m);
    await CL.writeCourses([{courseId:'course-a',name:'A'}]);
    await CL.writeProgress({'course-a':{step:3}});
    await IDBStore.writeStatsBatch({stats:{'a-sentence':{times:7}},events:[{id:'a-event'}]},AccountStorage.owner);
  });
  const pendingA=await page.evaluate(()=>IDBStore.readSyncIntents(AccountStorage.owner));
  check('A的课程与进度保存后有待发记录',pendingA.length===2);
  const second=await context.newPage();await second.goto(base+'/isolation.html');await second.waitForFunction(()=>window.ready);
  const blocked=await page.evaluate(async t=>{
    ChunkAPI.setToken(t);
    try{await ChunkAPI.putData({mem:CL.loadMem()});return false;}catch(e){return e.code==='SESSION_CHANGED';}
  },token(202));
  check('切换后旧页面的上传立即被阻止',blocked);
  await page.waitForFunction(()=>window.ready && JSON.parse(AccountStorage.owner)[1]==='202');
  await second.waitForFunction(()=>window.ready && JSON.parse(AccountStorage.owner)[1]==='202');
  check('其他标签页也自动切换到B',await second.evaluate(()=>CL.readCourses().length===0));
  check('B看不到A的题库、课程、进度、学习记录和队列',await page.evaluate(async()=>{
    const data=await IDBStore.loadAll();
    return !CL.loadMem().decks.some(d=>d.id==='private-a') && CL.readCourses().length===0
      && Object.keys(CL.readProgress()).length===0 && !data.sentenceStats['a-sentence']
      && !(await IDBStore.readSyncIntents(AccountStorage.owner)).length
      && !(await IDBStore.readLearningIntents(AccountStorage.owner)).length;
  }));
  await page.evaluate(()=>CL.writeCourses([{courseId:'course-b',name:'B'}]));
  await page.evaluate(t=>ChunkAPI.setToken(t),token(101));
  await page.waitForFunction(()=>window.ready && JSON.parse(AccountStorage.owner)[1]==='101');
  check('返回A后自己的课程和学习记录仍在，B的数据不混入',await page.evaluate(async()=>
    CL.readCourses().length===1 && CL.readCourses()[0].courseId==='course-a' && (await IDBStore.loadAll()).sentenceStats['a-sentence'].times===7));
  check('A的待发操作ID在切换往返后保持不变',JSON.stringify(await page.evaluate(()=>IDBStore.readSyncIntents(AccountStorage.owner)))===JSON.stringify(pendingA));
  await page.evaluate(t=>ChunkAPI.setSession('https://another-service.invalid',t),token(101));
  await page.waitForFunction(()=>window.ready && AccountStorage.owner.includes('another-service.invalid'));
  check('同一uid换服务地址后使用独立存储',await page.evaluate(()=>CL.readCourses().length===0));
  await page.evaluate(t=>ChunkAPI.setSession('',t),token(101));
  await page.waitForFunction(owner=>window.ready && AccountStorage.owner===owner,ownerA);
  check('返回原服务后课程仍保留',await page.evaluate(()=>CL.readCourses()[0].courseId==='course-a'));
  check('旧版原始小字段与数据库均未删除',await page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('chunklab-idb');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const rows=await new Promise(resolve=>{const r=db.transaction('courses').objectStore('courses').getAll();r.onsuccess=()=>resolve(r.result);});db.close();
    return localStorage.getItem('chunklab.v1').includes('legacy-private') && rows.length===1;
  }));
  await page.addScriptTag({path:path.join(root,'js/legacy-backup.js')});
  check('取回旧数据前必须确认归属',await page.evaluate(async()=>{
    try{await LegacyBackup.prepare(false);return false;}catch(e){return e.message.includes('确认');}
  }));
  check('旧数据备份包含题库、IDB课程和原始存档，不含登录凭据',await page.evaluate(async()=>{
    const before=localStorage.getItem('chunklab.v1'),backup=await LegacyBackup.prepare(true);
    return backup.mem.decks[0].id==='legacy-private' && backup.courses[0].courseId==='legacy-private'
      && backup.legacyArchive.localKeys['chunklab.v1']===before
      && !JSON.stringify(backup).includes(localStorage.getItem('chunklab_token'))
      && localStorage.getItem('chunklab.v1')===before && CL.readCourses()[0].courseId==='course-a';
  }));
  check('旧数据读取失败不会写入或删除任何本地数据',await page.evaluate(async()=>{
    const before=JSON.stringify(Object.entries(localStorage)),original=indexedDB.open;
    indexedDB.open=function(){throw new Error('模拟读取失败');};
    let failed=false;
    try{await LegacyBackup.prepare(true);}catch(e){failed=true;}finally{indexedDB.open=original;}
    return failed && before===JSON.stringify(Object.entries(localStorage)) && CL.readCourses()[0].courseId==='course-a';
  }));
  check('恢复预览不修改当前版本，并识别编号冲突',await page.evaluate(async()=>{
    window.restoreView=await LegacyRestore.preview(true);
    const conflicting=JSON.parse(JSON.stringify(restoreView.legacy));
    conflicting.courses=[{courseId:'course-a',name:'not A'}];
    return !restoreView.conflicts.length && LegacyRestore.merge(restoreView.current,conflicting).conflicts.length>0
      && CL.readCourses().length===1;
  }));
  check('副本写入失败不切换当前版本，并保留恢复锁',await page.evaluate(async()=>{
    const pointer=localStorage.getItem(AccountStorage.recovery.pointerKey),original=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(){throw new Error('模拟磁盘写入失败');};
    let failed=false;try{await LegacyRestore.apply(restoreView);}catch(e){failed=true;}finally{IDBObjectStore.prototype.put=original;}
    return failed && localStorage.getItem(AccountStorage.recovery.pointerKey)===pointer && !!localStorage.getItem(AccountStorage.recovery.lockKey);
  }));
  await page.reload();await page.locator('#restorePending').waitFor();
  check('刷新后未完成恢复仍阻止写入和上传',await page.evaluate(async()=>{
    let write=false,upload=false;
    try{AccountStorage.storage.setItem('chunklab.v1','bad');}catch(e){write=e.code==='RESTORE_PENDING';}
    try{await ChunkAPI.putData({});}catch(e){upload=e.code==='RESTORE_PENDING';}
    return write && upload;
  }));
  await page.locator('#restorePending button').click();await page.waitForFunction(()=>window.ready && !document.getElementById('restorePending'));
  check('取消失败恢复后原课程仍在',await page.evaluate(()=>CL.readCourses().length===1 && CL.readCourses()[0].courseId==='course-a'));
  check('数据库副本写完后小字段配额失败也不切换版本',await page.evaluate(async()=>{
    const view=await LegacyRestore.preview(true),previous=localStorage.getItem(AccountStorage.recovery.pointerKey),original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){if(k.includes('restore.') && k.endsWith('chunklab.v1'))throw Error('模拟配额不足');return original.call(this,k,v);};
    let failed=false;try{await LegacyRestore.apply(view);}catch(e){failed=true;}finally{Storage.prototype.setItem=original;}
    return failed && localStorage.getItem(AccountStorage.recovery.pointerKey)===previous;
  }));
  await page.reload();await page.locator('#restorePending button').click();await page.waitForFunction(()=>window.ready && !document.getElementById('restorePending'));
  check('取消只清理失败副本，原课程仍保留',await page.evaluate(async()=>
    !(await indexedDB.databases()).some(db=>db.name.includes('-restore-')) && CL.readCourses()[0].courseId==='course-a'));
  check('预览后当前数据变化会阻止旧预览提交',await page.evaluate(async()=>{
    const view=await LegacyRestore.preview(true);
    await CL.writeProgress({'course-a':{step:4}});
    try{await LegacyRestore.apply(view);return false;}catch(e){return e.message.includes('变化');}
  }));
  await page.reload();await page.locator('#restorePending button').click();await page.waitForFunction(()=>window.ready && !document.getElementById('restorePending'));
  await page.evaluate(async()=>{const view=await LegacyRestore.preview(true);if(view.conflicts.length)throw Error(view.conflicts.join(','));await LegacyRestore.apply(view);});
  await page.waitForFunction(()=>window.ready && !!AccountStorage.recovery.revision);
  check('重试成功后旧课程和当前课程同时保留',await page.evaluate(()=>CL.readCourses().some(c=>c.courseId==='course-a') && CL.readCourses().some(c=>c.courseId==='legacy-private')));
  check('恢复后学习记录与原账号待发记录保留',await page.evaluate(async()=>
    (await IDBStore.loadAll()).sentenceStats['a-sentence'].times===7 && (await IDBStore.readSyncIntents(AccountStorage.owner)).length===2));
  check('恢复结果刷新后保留且不会自动上传',await page.evaluate(async()=>{
    try{await ChunkAPI.putData({});return false;}catch(e){return e.code==='RESTORE_LOCAL_ONLY' && localStorage.getItem('chunklab.v1').includes('legacy-private');}
  }));
  check('恢复后可进入云端核对并在确认后解除本地暂停',await page.evaluate(async()=>{
    const view=await SyncResolution.preview();
    if(!view || !view.batch || !view.remoteToken) return false;
    const receipt=await SyncResolution.resolve(view,'local');
    return receipt && receipt.ok===true && !AccountStorage.storage.getItem('chunklab.restore-cloud-hold');
  }));
  check('同一账号再次恢复核对会生成新的请求编号',await page.evaluate(async()=>{
    AccountStorage.storage.setItem('chunklab.restore-cloud-hold','1');
    const first=await SyncResolution.preview();
    const firstReceipt=await SyncResolution.resolve(first,'local');
    AccountStorage.storage.setItem('chunklab.restore-cloud-hold','1');
    const second=await SyncResolution.preview();
    const unique=first.id!==second.id;
    const secondReceipt=await SyncResolution.resolve(second,'local');
    return unique && firstReceipt.ok===true && secondReceipt.ok===true && !AccountStorage.storage.getItem('chunklab.restore-cloud-hold');
  }));
  console.log('[account-isolation e2e] '+count+' passed; restored cloud reconciliation and resume verified');
}finally{
  if(browser)await browser.close();
  if(server && server.exitCode===null){const ended=new Promise(r=>server.once('exit',r));server.kill();await ended;}
  fs.rmSync(temp,{recursive:true,force:true});
}})().catch(e=>{console.error(e);process.exitCode=1;});
