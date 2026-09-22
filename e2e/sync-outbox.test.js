/* Real IndexedDB checks against a temporary server, never the user's database. */
'use strict';
const {chromium}=require('playwright-core');
const {spawn}=require('child_process');
const http=require('http'),fs=require('fs'),path=require('path'),os=require('os');
const root=path.resolve(__dirname,'..'),port=require('./lib/free-port').freePort(9400,100);
/* core.js 的必需依赖模块（合成页面必须与真实页面一样在 core.js 之前加载；单一来源见 lib/core-deps.js）。 */
const coreDeps=require('./lib/core-deps');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cl-outbox-'));
let browser,server;
async function ready(){
  /* 就绪窗口 300×100ms=30s（原 60×100ms=6s）：同库其余 6s 窗口已实测为临界窗口，
     宿主 node 冷启动实测 5.4s。health 一旦 200 立即 return ⇒ 成功路径不增加耗时。 */
  for(let i=0;i<300;i++){
    const ok=await new Promise(resolve=>{
      const req=http.get('http://127.0.0.1:'+port+'/api/health',res=>{res.resume();resolve(res.statusCode===200);});
      req.on('error',()=>resolve(false));req.setTimeout(500,()=>req.destroy());
    });
    if(ok)return;await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('server unavailable');
}
function check(label,ok){if(!ok)throw new Error(label);console.log('  ✓ '+label);}
(async()=>{
  try{
    server=spawn(process.execPath,['index.js'],{cwd:path.join(root,'server'),env:{...process.env,PORT:String(port),CHUNKLAB_DATA_DIR:temp,NODE_ENV:'test'},stdio:'ignore'});
    await ready();browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || chromium.executablePath()});
    const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
    await page.goto('http://127.0.0.1:'+port+'/api/health');
    async function init(p){await p.addScriptTag({path:path.join(root,'js','sync-outbox.js')});await p.evaluate(()=>{window.q=SyncOutbox.create(SyncOutbox.createIndexedDBAdapter(indexedDB,IDBKeyRange)).forAccount('test-service','alice');});}
    await init(page);
    const sent=await page.evaluate(async()=>{
      await q.observe('decks','d',{rev:3,deleted:false,value:{id:'d',name:'old'}});
      await q.stage([{entity:'decks',id:'d',deleted:true,value:null}]);
      return q.prepare('decks','d');
    });
    await page.reload();await init(page);
    const retry=await page.evaluate(()=>q.prepare('decks','d'));
    check('刷新后删除操作与操作ID完整保留',JSON.stringify(sent)===JSON.stringify(retry));
    const second=await context.newPage();await second.goto('http://127.0.0.1:'+port+'/api/health');await init(second);
    await second.evaluate(()=>q.stage([{entity:'decks',id:'d',deleted:false,value:{id:'d',name:'recreated'}}]));
    check('另一标签页新改动不替换在途请求',JSON.stringify(await page.evaluate(()=>q.prepare('decks','d')))===JSON.stringify(sent));
    await page.evaluate(op=>q.acknowledge('decks','d',op.operationId,op.rev),sent);
    const successor=await second.evaluate(()=>q.prepare('decks','d'));
    check('确认旧请求后推进后续改动基线',successor.value.name==='recreated' && successor.baseRev===sent.rev && successor.rev>sent.rev);
    check('旧回执不能确认新请求',await page.evaluate(op=>q.acknowledge('decks','d',op.operationId,op.rev),sent)===false);
    check('同一浏览器另一账号看不到待发操作',await page.evaluate(async()=>{
      const other=SyncOutbox.create(SyncOutbox.createIndexedDBAdapter(indexedDB,IDBKeyRange)).forAccount('test-service','bob');
      return (await other.pending()).length===0;
    }));
    const failure=await page.evaluate(async()=>{
      const original=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(value,key){if(String(key).includes('rollback-b'))throw new Error('disk failure');return original.apply(this,arguments);};
      let failed=false;
      try{await q.stage(['rollback-a','rollback-b'].map(id=>({entity:'decks',id,deleted:false,value:{id,name:id}})));}catch(e){failed=true;}
      finally{IDBObjectStore.prototype.put=original;}
      return failed && !(await q.pending()).some(s=>s.id.startsWith('rollback-'));
    });
    check('第二个项目写失败时整批待发意图回滚',failure);
    await page.evaluate(op=>q.conflict('decks','d',op.operationId,{currentRev:20}),successor);
    await page.reload();await init(page);
    check('冲突状态刷新后仍冻结且保留内容',await page.evaluate(async()=>{
      try{await q.prepare('decks','d');return false;}catch(e){return e.code==='SYNC_CONFLICT' && (await q.pending())[0].head.value.name==='recreated';}
    }));
    await page.addScriptTag({path:path.join(root,'js','idb.js')});
    check('业务全量替换遇到同步异常时保留原数据',await page.evaluate(async()=>{
      await IDBStore.putCourses([{courseId:'original',name:'keep'}]);
      let failed=false;
      try {
        await IDBStore.putCourses([{courseId:'first'}, {courseId:'invalid', uncloneable:function(){}}]);
      } catch (_) { failed=true; }
      const courses=await IDBStore.getCourses();
      return failed && courses.length===1 && courses[0].courseId==='original';
    }));
    await second.addScriptTag({path:path.join(root,'js','idb.js')});
    for(const tab of [page,second]){
      await coreDeps.addCoreDependencies(tab, root);
      await tab.addScriptTag({path:path.join(root,'core.js')});
      await tab.evaluate(async()=>{await CL.preload(); window.beforeCourses=CL.readCourses();});
    }
    await Promise.all([
      page.evaluate(()=>CL.writeCourses(beforeCourses.concat([{courseId:'tab-a',name:'A'}]))),
      second.evaluate(()=>CL.writeCourses(beforeCourses.concat([{courseId:'tab-b',name:'B'}])))
    ]);
    check('实际保存入口并发新增课程不互相覆盖',await page.evaluate(async()=>{
      const ids=(await IDBStore.getCourses()).map(c=>c.courseId);
      return ['original','tab-a','tab-b'].every(id=>ids.includes(id));
    }));
    await Promise.all([
      page.evaluate(()=>CL.writeProgress({'progress-a':{step:1}})),
      second.evaluate(()=>CL.writeProgress({'progress-b':{step:2}}))
    ]);
    check('实际保存入口并发进度不互相覆盖',await page.evaluate(async()=>{
      const value=await IDBStore.getProgress();
      return value['progress-a'].step===1 && value['progress-b'].step===2;
    }));
    check('事务合并函数异常保留原课程',await page.evaluate(async()=>{
      const before=JSON.stringify(await IDBStore.getCourses());
      let failed=false;
      try{await IDBStore.updateCourses(()=>{throw new Error('merge failed');});}catch(_){failed=true;}
      return failed && JSON.stringify(await IDBStore.getCourses())===before;
    }));
    check('启动读取旧快照后不覆盖期间新增课程',await page.evaluate(async()=>{
      const original=IDBStore.loadAll;
      IDBStore.loadAll=async function(){
        const stale=await original();
        await IDBStore.updateCourses(current=>current.concat([{courseId:'during-preload'}]));
        return stale;
      };
      try{await CL.preload();}finally{IDBStore.loadAll=original;}
      return (await IDBStore.getCourses()).some(c=>c.courseId==='during-preload');
    }));
    check('实际课程保存同时留下待同步记录',await page.evaluate(async()=>{
      const records=await IDBStore.readSyncIntents(JSON.stringify(['','local']));
      return records.some(r=>r.id==='tab-a' && r.value.name==='A' && !r.baseKnown);
    }));
    check('待同步记录写失败业务数据也回滚',await page.evaluate(async()=>{
      const before=JSON.stringify(await IDBStore.getCourses());
      const original=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(){if(this.name==='syncIntents')throw new Error('quota');return original.apply(this,arguments);};
      let failed=false;
      try{await CL.writeCourses(CL.readCourses().concat([{courseId:'must-rollback'}]));}catch(_){failed=true;}
      finally{IDBObjectStore.prototype.put=original;}
      return failed && JSON.stringify(await IDBStore.getCourses())===before;
    }));
    await page.evaluate(async()=>{await CL.preload();await CL.writeCourses(CL.readCourses().filter(c=>c.courseId!=='tab-a'));});
    await page.reload();await page.addScriptTag({path:path.join(root,'js','idb.js')});
    check('刷新后删除意图仍保留',await page.evaluate(async()=>{
      const record=(await IDBStore.readSyncIntents(JSON.stringify(['','local']))).find(r=>r.id==='tab-a');
      return record.deleted && record.value===null && !!record.operationId;
    }));
    check('不同账号不读取当前待同步记录',await page.evaluate(async()=>{
      return (await IDBStore.readSyncIntents(JSON.stringify(['','other']))).length===0;
    }));
    const clean=await browser.newContext({serviceWorkers:'block'}), sending=await clean.newPage();
    await sending.goto('http://127.0.0.1:'+port+'/api/health');
    await sending.addScriptTag({path:path.join(root,'js','idb.js')});
    await sending.evaluate(()=>{
      window.ChunkAPI={getBase:()=>'',getToken:()=>null,isLoggedIn:()=>false,
        getConfig:async()=>({requireAuth:false}),getData:async()=>({}),putData:async()=>({ok:true})};
    });
    await coreDeps.addCoreDependencies(sending, root);
    await sending.addScriptTag({path:path.join(root,'core.js')});
    check('真实保存与上传成功后清理对应日志',await sending.evaluate(async()=>{
      await CL.preload();await CL.ensureCloud();
      await CL.writeCourses([{courseId:'sent',name:'one'}]);
      const ok=await CL.cloudSyncNow(CL.loadMem());
      return ok && (await IDBStore.readSyncIntents(JSON.stringify(['','local']))).length===0;
    }));
    check('网络失败不清理日志',await sending.evaluate(async()=>{
      ChunkAPI.putData=async()=>{throw new Error('offline');};
      await CL.writeCourses([{courseId:'sent',name:'two'}]);
      const ok=await CL.cloudSyncNow(CL.loadMem());
      return !ok && (await IDBStore.readSyncIntents(JSON.stringify(['','local'])))[0].value.name==='two';
    }));
    await sending.evaluate(()=>{
      ChunkAPI.putData=()=>new Promise(resolve=>{window.release=resolve;});
      window.flight=CL.cloudSyncNow(CL.loadMem());
    });
    await sending.waitForFunction(()=>typeof window.release==='function');
    check('上传期间新增修改不被旧回执删除',await sending.evaluate(async()=>{
      await CL.writeCourses([{courseId:'sent',name:'three'}]);
      ChunkAPI.putData=async()=>{throw new Error('offline');};
      release({ok:true});await flight;
      const records=await IDBStore.readSyncIntents(JSON.stringify(['','local']));
      return records.length===1 && records[0].value.name==='three';
    }));
    check('学习日志在真实保存上传成功后清理',await sending.evaluate(async()=>{
      ChunkAPI.putData=async()=>({ok:true});
      const mem=CL.loadMem();
      mem.stats.bySentence['learn#one']={times:1,okTimes:1,lastAt:1};
      mem.stats.events.push({id:'learn-event',kind:'answer',at:1});
      CL.saveMem(mem);await CL.waitForSync();
      const before=await IDBStore.readLearningIntents(JSON.stringify(['','local']));
      const ok=await CL.cloudSyncNow(mem);
      return before.length>=2 && ok && (await IDBStore.readLearningIntents(JSON.stringify(['','local']))).length===0;
    }));
    await sending.evaluate(async()=>{
      const mem=CL.loadMem();mem.stats.bySentence['learn#one']={times:2,okTimes:1,lastAt:2};CL.saveMem(mem);await CL.waitForSync();
      window.learningRelease=null;
      ChunkAPI.putData=()=>new Promise(resolve=>{learningRelease=resolve;});
      window.learningFlight=CL.cloudSyncNow(mem);
    });
    await sending.waitForFunction(()=>typeof learningRelease==='function');
    check('旧学习回执不清理更新后的档案日志',await sending.evaluate(async()=>{
      const mem=CL.loadMem();mem.stats.bySentence['learn#one']={times:3,okTimes:1,lastAt:3};CL.saveMem(mem);
      ChunkAPI.putData=async()=>{throw new Error('offline');};
      learningRelease({ok:true});await learningFlight;await CL.waitForSync();
      const records=await IDBStore.readLearningIntents(JSON.stringify(['','local']));
      return records.some(r=>r.id==='learn#one' && r.value.times===3);
    }));
    await clean.close();
    const recoveryContext=await browser.newContext({serviceWorkers:'block'}), recovery=await recoveryContext.newPage();
    async function bootRecovery(){
      await recovery.goto('http://127.0.0.1:'+port+'/api/health');
      for(const file of ['js/idb.js','api.js']) await recovery.addScriptTag({path:path.join(root,file)});
      await coreDeps.addCoreDependencies(recovery, root);
      for(const file of ['core.js','js/sync-resolution.js']) await recovery.addScriptTag({path:path.join(root,file)});
      await recovery.evaluate(()=>CL.ensureCloud());
    }
    await bootRecovery();
    const frozenBody=await recovery.evaluate(async()=>{
      const send=ChunkAPI.putData;
      ChunkAPI.putData=async payload=>{
        if(payload.baseRevs){window.sentBody=JSON.stringify(payload);await send(payload);throw new Error('lost response');}
        return send(payload);
      };
      await CL.writeCourses([{courseId:'recover-course',name:'offline edit'}]);
      await CL.cloudSyncNow(CL.loadMem());
      const pending=await IDBStore.readSyncIntents(JSON.stringify(['','local']));
      return pending[0].frozen.payload;
    });
    check('发送前固定条件请求并保留丢失回执',frozenBody.baseRevs.courses['recover-course']===null);
    await recovery.reload();await bootRecovery();
    check('刷新自动重试已固定请求并清理日志',await recovery.evaluate(async()=>{
      const remote=await ChunkAPI.getSyncEntity('courses','recover-course');
      return remote.value.name==='offline edit' && remote.rev===1 && (await IDBStore.readSyncIntents(JSON.stringify(['','local']))).length===0;
    }));
    await recovery.evaluate(async()=>{
      ChunkAPI.putData=async()=>{throw new Error('offline');};
      await CL.writeCourses([]);await CL.cloudSyncNow(CL.loadMem());
    });
    await recovery.reload();await bootRecovery();
    check('离线删除刷新后自动传递墓碑',await recovery.evaluate(async()=>{
      return (await ChunkAPI.getSyncEntity('courses','recover-course')).deleted && CL.readCourses().length===0;
    }));
    await recovery.evaluate(async()=>{
      await CL.writeCourses([{courseId:'recover-course',name:'restored'}]);await CL.cloudSyncNow(CL.loadMem());
      await CL.writeProgress({'recover-course':{step:1}});await CL.cloudSyncNow(CL.loadMem());
      ChunkAPI.putData=async()=>{throw new Error('offline');};
      await CL.writeProgress({'recover-course':{step:2}});await CL.cloudSyncNow(CL.loadMem());
    });
    await recovery.reload();await bootRecovery();
    check('离线进度刷新后自动恢复',await recovery.evaluate(async()=>{
      return (await ChunkAPI.getSyncEntity('courseProgress','recover-course')).value.step===2;
    }));
    await recovery.evaluate(async()=>{
      const remote=await ChunkAPI.getSyncEntity('courses','recover-course');
      await ChunkAPI.putData({mem:{},courses:[{courseId:'recover-course',name:'other device'}],revs:{courses:{'recover-course':remote.rev+1}}});
      await CL.writeCourses([{courseId:'recover-course',name:'my edit'}]);await CL.cloudSyncNow(CL.loadMem());
    });
    await recovery.reload();await bootRecovery();
    check('云端已变动时刷新不覆盖任何一方',await recovery.evaluate(async()=>{
      return (await ChunkAPI.getSyncEntity('courses','recover-course')).value.name==='other device'
        && CL.readCourses()[0].name==='my edit' && CL.getSyncConflict().some(c=>c.id==='recover-course');
    }));
    check('确认使用云端后清理冲突意图且不重放旧值',await recovery.evaluate(async()=>{
      const preview=await SyncResolution.preview();await SyncResolution.resolve(preview,'remote');
      await CL.cloudSyncNow(CL.loadMem());
      return CL.readCourses()[0].name==='other device' && (await IDBStore.readSyncIntents(JSON.stringify(['','local']))).length===0;
    }));
    check('读取基础版本后云端再变动，条件写拒绝覆盖',await recovery.evaluate(async()=>{
      const read=ChunkAPI.getSyncEntity;
      let once=true;
      ChunkAPI.getSyncEntity=async(entity,id)=>{
        const old=await read(entity,id);
        if(once && entity==='courses'){
          once=false;
          await ChunkAPI.putData({mem:{},courses:[{courseId:id,name:'raced remote'}],revs:{courses:{[id]:old.rev+1}}});
        }
        return old;
      };
      await CL.writeCourses([{courseId:'recover-course',name:'raced local'}]);
      const ok=await CL.cloudSyncNow(CL.loadMem());
      ChunkAPI.getSyncEntity=read;
      return !ok && (await read('courses','recover-course')).value.name==='raced remote'
        && CL.readCourses()[0].name==='raced local';
    }));
    await recovery.evaluate(async()=>{await SyncResolution.resolve(await SyncResolution.preview(),'local');});
    const prior=await recovery.evaluate(async()=>{
      const send=ChunkAPI.putData;
      ChunkAPI.putData=async body=>{await send(body);throw new Error('lost reply');};
      await CL.writeCourses([{courseId:'recover-course',name:'first frozen'}]);await CL.cloudSyncNow(CL.loadMem());
      await CL.writeCourses([{courseId:'recover-course',name:'successor'}]);
      CL.setResolutionPaused(true);
      return (await IDBStore.readSyncIntents(JSON.stringify(['','local'])))[0].frozen.payload;
    });
    const retries=[];
    recovery.on('request',req=>{if(req.method()==='PUT') retries.push(req.postData());});
    await recovery.reload();await bootRecovery();
    check('旧请求固定重试后再发送后续修改',await recovery.evaluate(async()=>{
      return (await ChunkAPI.getSyncEntity('courses','recover-course')).value.name==='successor'
        && (await IDBStore.readSyncIntents(JSON.stringify(['','local']))).length===0;
    }) && retries[0]===JSON.stringify(prior));
    check('拉取期间产生的新修改不被云端快照覆盖',await recovery.evaluate(async()=>{
      const get=ChunkAPI.getData;
      ChunkAPI.getData=async()=>{
        const data=await get();
        await CL.writeCourses([{courseId:'recover-course',name:'edited during pull'}]);
        CL.setResolutionPaused(true);
        return data;
      };
      await CL.syncFromCloud();ChunkAPI.getData=get;
      return CL.readCourses()[0].name==='edited during pull'
        && (await IDBStore.readSyncIntents(JSON.stringify(['','local'])))[0].value.name==='edited during pull';
    }));
    await recovery.reload();await bootRecovery();
    await recovery.evaluate(async()=>{
      await ChunkAPI.putData({mem:{},statsDelta:{sbs:{'delete#record':{times:1,okTimes:1,lastAt:1}},evs:[],sbsGone:[]}});
      await CL.syncFromCloud();await CL.waitForSync();
      ChunkAPI.putData=async()=>{throw new Error('offline');};
      const mem=CL.loadMem();delete mem.stats.bySentence['delete#record'];CL.saveMem(mem);
      await CL.waitForSync();await CL.cloudSyncNow(mem);
    });
    await recovery.reload();await bootRecovery();
    check('离线删除学习档案刷新后不复活且补传清理',await recovery.evaluate(async()=>{
      await CL.waitForSync();
      const remote=await ChunkAPI.getData();
      const pending=await IDBStore.readLearningIntents(JSON.stringify(['','local']));
      return !remote.mem.stats.bySentence['delete#record'] && !CL.loadMem().stats.bySentence['delete#record']
        && !pending.some(r=>r.id==='delete#record');
    }));
    await recoveryContext.close();
    check('学习事件写失败时句子档案也回滚',await page.evaluate(async()=>{
      await IDBStore.writeStatsBatch({stats:{atomic:{times:1}},events:[{id:'atomic-old'}]});
      let failed=false;
      try{await IDBStore.writeStatsBatch({stats:{atomic:{times:2}},events:[{id:'bad',value:function(){}}],replaceEvents:true});}catch(_){failed=true;}
      const data=await IDBStore.loadAll();
      return failed && data.sentenceStats.atomic.times===1 && data.events.some(e=>e.id==='atomic-old');
    }));
    check('学习记录与 localGeneration 在同一事务提交',await page.evaluate(async()=>{
      const scope='learning-atomic';
      await IDBStore.writeStatsBatch({stats:{'atomic-generation':{times:1}},events:[{id:'generation-event'}],businessMem:{localGeneration:42,data:{settings:{batchSize:10}}}},scope,{
        key:'conditional-batch-v1',schemaVersion:1,localGeneration:42
      });
      const db=await IDBStore.open();
      const state=await new Promise((resolve,reject)=>{const t=db.transaction('syncMeta','readonly'),r=t.objectStore('syncMeta').get('conditional-batch-v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      const business=await new Promise((resolve,reject)=>{const t=db.transaction('syncMeta','readonly'),r=t.objectStore('syncMeta').get('business-mem-v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      return state.localGeneration===42 && business.localGeneration===42 && business.data.settings.batchSize===10 && (await IDBStore.loadAll()).sentenceStats['atomic-generation'].times===1;
    }));
    check('同步元数据失败时学习记录一并回滚',await page.evaluate(async()=>{
      const original=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(value){if(this.name==='syncMeta' && value.schemaVersion===99) throw Error('meta failure');return original.apply(this,arguments);};
      let failed=false;
      try{await IDBStore.writeStatsBatch({stats:{'atomic-generation':{times:99}},events:[{id:'generation-bad'}],businessMem:{localGeneration:99,data:{settings:{batchSize:99}}}},'learning-atomic',{
        key:'conditional-batch-v1',schemaVersion:99,localGeneration:99
      });}catch(_){failed=true;}
      finally{IDBObjectStore.prototype.put=original;}
      const data=await IDBStore.loadAll();
      const db=await IDBStore.open();
      const state=await new Promise((resolve,reject)=>{const t=db.transaction('syncMeta','readonly'),r=t.objectStore('syncMeta').get('conditional-batch-v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      const business=await new Promise((resolve,reject)=>{const t=db.transaction('syncMeta','readonly'),r=t.objectStore('syncMeta').get('business-mem-v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      return failed && data.sentenceStats['atomic-generation'].times===1 && !data.events.some(e=>e.id==='generation-bad') && state.localGeneration===42 && business.localGeneration===42 && business.data.settings.batchSize===10;
    }));
    check('学习日志失败时业务记录也回滚',await page.evaluate(async()=>{
      const original=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(){if(this.name==='syncIntents') throw new Error('quota');return original.apply(this,arguments);};
      let failed=false;
      try{await IDBStore.writeStatsBatch({stats:{atomic:{times:99}}},'learning-test');}catch(_){failed=true;}
      finally{IDBObjectStore.prototype.put=original;}
      return failed && (await IDBStore.loadAll()).sentenceStats.atomic.times===1;
    }));
    await page.evaluate(()=>IDBStore.writeStatsBatch({gone:['atomic'],events:[{id:'learning-event'}]},'learning-test'));
    await page.reload();await page.addScriptTag({path:path.join(root,'js','idb.js')});
    check('刷新保留学习删除日志且不混入课程队列',await page.evaluate(async()=>{
      const pending=await IDBStore.readLearningIntents('learning-test');
      return pending.some(r=>r.id==='atomic' && r.deleted) && pending.some(r=>r.id==='learning-event')
        && (await IDBStore.readSyncIntents('learning-test')).length===0;
    }));
    console.log('[sync-outbox e2e] 36 passed');
  }finally{
    if(browser)await browser.close();
    if(server && server.exitCode===null){const exited=new Promise(resolve=>server.once('exit',resolve));server.kill();await exited;}
    fs.rmSync(temp,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
