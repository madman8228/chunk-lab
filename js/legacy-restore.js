/* Conservative local restore: immutable staging copy, then one active-pointer
 * commit. Original and previous account copies remain untouched. */
(function(g){
  'use strict';
  var stores={courses:'courseId',progress:'cid',sentenceStats:'key',events:'id',syncIntents:'key',syncMeta:'key'};
  var smallKeys=['chunklab.v1','chunklab_revs_v1','chunklab.sync-conflict.v1'];
  function stable(v){
    if(Array.isArray(v))return '['+v.map(stable).join(',')+']';
    if(v && typeof v==='object')return '{'+Object.keys(v).sort().map(function(k){return JSON.stringify(k)+':'+stable(v[k]);}).join(',')+'}';
    return JSON.stringify(v);
  }
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function hasPendingBatch(rows){
    return (rows && rows.syncMeta||[]).some(function(row){return row && row.key==='conditional-batch-v1' && row.pending;})
      || (rows && rows.syncIntents||[]).some(function(row){return row && row.key==='conditional-batch-v1' && row.pending;});
  }
  function open(name,create){return new Promise(function(resolve,reject){
    var r=g.indexedDB.open(name,create?4:undefined);
    r.onupgradeneeded=function(){
      if(!create){r.transaction.abort();return;}
      Object.keys(stores).forEach(function(s){if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s,{keyPath:stores[s]});});
    };
    r.onsuccess=function(){resolve(r.result);};r.onerror=function(){reject(r.error);};
    r.onblocked=function(){reject(new Error('请关闭其他旧页面后重试'));};
  });}
  async function snapshot(){
    var a=g.AccountStorage,db=await open(a.databaseName,false),data={small:{},rows:{}};
    try{await new Promise(function(resolve,reject){
      // The freeze rejects future business transactions; this transaction drains
      // writes already started before the freeze.
      var names=Object.keys(stores).filter(function(s){return db.objectStoreNames.contains(s);});
      var tx=db.transaction(names,'readwrite');
      tx.oncomplete=resolve;tx.onerror=tx.onabort=function(){reject(tx.error || new Error('读取当前数据失败'));};
      names.forEach(function(s){var r=tx.objectStore(s).getAll();r.onsuccess=function(){data.rows[s]=r.result;};});
    });}finally{db.close();}
    smallKeys.forEach(function(k){data.small[k]=g.localStorage.getItem(a.recovery.prefix+k);});
    return data;
  }
  function merge(current,legacy){
    var result=clone(current),conflicts=[];
    var revisions=JSON.parse(current.small['chunklab_revs_v1']||'{}');
    function addRows(name,incoming){
      var key=stores[name],map=new Map((result.rows[name]||[]).map(function(r){return [r[key],r];}));
      incoming.forEach(function(r){
        if(!r || typeof r[key]!=='string' || !r[key])throw new Error('旧数据缺少有效编号：'+name);
        var entity=name==='progress'?'courseProgress':name;
        if(!map.has(r[key]) && (((revisions[entity]||{})[r[key]]) || (current.rows.syncIntents||[]).some(function(i){return i.entity===entity && i.id===r[key] && i.deleted;}))){conflicts.push('已删除或待删除 / '+name+' / '+r[key]);return;}
        if(map.has(r[key]) && stable(map.get(r[key]))!==stable(r))conflicts.push(name+' / '+r[key]);
        else map.set(r[key],r);
      });result.rows[name]=Array.from(map.values());
    }
    var mem=JSON.parse(result.small['chunklab.v1']||'{}'),old=legacy.mem;
    var archivedStores=(legacy.legacyArchive||{}).stores||{};
    if(hasPendingBatch(archivedStores))conflicts.push('旧数据仍有待同步操作，请先保留备份处理这些操作');
    if(hasPendingBatch(current.rows))conflicts.push('当前数据仍有待同步操作，请先完成同步后再恢复');
    if(old.reinforceBook===undefined && legacy.reinforceBook)old=Object.assign({},old,{reinforceBook:legacy.reinforceBook});
    var decks=new Map((mem.decks||[]).map(function(d){return [d.id,d];}));
    (old.decks||[]).forEach(function(d){
      if(!d || typeof d.id!=='string' || !d.id)throw new Error('旧题库缺少有效编号');
      if(!decks.has(d.id) && (revisions.decks||{})[d.id]){conflicts.push('已删除题库 / '+d.name);return;}
      if((decks.has(d.id) && stable(decks.get(d.id))!==stable(d)) || Array.from(decks.values()).some(function(x){return x.id!==d.id && x.name===d.name;}))conflicts.push('题库 / '+d.name);
      else decks.set(d.id,d);
    });mem.decks=Array.from(decks.values());
    // Keep current preferences/navigation. Business fields cannot overwrite
    // different values; only absent entries and zero counters are filled.
    function fill(target,source,path){
      Object.keys(source||{}).forEach(function(k){
        if(['__proto__','constructor','prototype'].indexOf(k)>=0)throw new Error('不支持的旧数据字段');
        var v=source[k];
        if(target[k]===undefined || target[k]===null || target[k]===0)target[k]=clone(v);
        else if(stable(target[k])===stable(v))return;
        else if(target[k] && v && typeof v==='object' && typeof target[k]==='object' && !Array.isArray(v) && !Array.isArray(target[k]))fill(target[k],v,path+'/'+k);
        else if(Array.isArray(target[k]) && !target[k].length)target[k]=clone(v);
        else conflicts.push(path+'/'+k);
      });
    }
    ['mastered','best','progress','deletedItems','reinforceBook'].forEach(function(k){
      if(old[k]!==undefined){var box={};box[k]=mem[k];fill(box,{[k]:old[k]},'学习数据');mem[k]=box[k];}
    });
    var stats=clone(old.stats||{});delete stats.bySentence;delete stats.events;
    mem.stats=mem.stats||{};fill(mem.stats,stats,'统计');
    addRows('courses',legacy.courses||[]);
    // Same title under another course ID is also a conflict, not a duplicate.
    var titles=new Map();(result.rows.courses||[]).forEach(function(c){if(c.name && titles.has(c.name) && titles.get(c.name)!==c.courseId)conflicts.push('课程 / '+c.name);titles.set(c.name,c.courseId);});
    addRows('progress',Object.keys(legacy.courseProgress||{}).map(function(k){return {cid:k,data:legacy.courseProgress[k]};}));
    addRows('sentenceStats',Object.keys((old.stats||{}).bySentence||{}).map(function(k){return {key:k,data:old.stats.bySentence[k]};}));
    addRows('events',(old.stats||{}).events||[]);
    result.small['chunklab.v1']=JSON.stringify(mem);
    return {result:result,conflicts:conflicts};
  }
  async function preview(confirmed){
    g.AccountStorage.assertCurrent();await g.CL.preload();
    var legacy=await g.LegacyBackup.prepare(confirmed),current=await snapshot(),plan=merge(current,legacy);
    return {owner:g.AccountStorage.owner,current:current,legacy:legacy,result:plan.result,conflicts:plan.conflicts};
  }
  async function previewImported(data){
    g.AccountStorage.assertCurrent();await g.CL.preload();
    if(!data || !data.mem || typeof data.mem!=='object')throw new Error('备份数据格式不正确');
    var legacy={mem:clone(data.mem),courses:Array.isArray(data.courses)?clone(data.courses):[],
      courseProgress:data.courseProgress&&typeof data.courseProgress==='object'?clone(data.courseProgress):{},
      reinforceBook:Array.isArray(data.book)?clone(data.book):[],
      legacyArchive:data.legacyArchive&&typeof data.legacyArchive==='object'?clone(data.legacyArchive):{}};
    var current=await snapshot(),plan=merge(current,legacy);
    return {owner:g.AccountStorage.owner,current:current,legacy:legacy,result:plan.result,conflicts:plan.conflicts};
  }
  function sameIdentity(owner){
    var token=g.localStorage.getItem('chunklab_token'),uid=token?String(JSON.parse(g.atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).uid):'local';
    var base=new URL(g.localStorage.getItem('chunklab_api_base')||'/',g.location.origin).href.replace(/\/+$/,'');
    if(JSON.stringify([base,uid])!==owner)throw new Error('账号已切换，请回到原账号重试');
  }
  async function apply(view){
    if(!g.navigator.locks)throw new Error('此浏览器暂不支持安全恢复，请使用支持 Web Locks 的浏览器');
    if(view.conflicts.length)throw new Error('存在冲突，未恢复任何数据');
    return g.navigator.locks.request('chunklab-restore',async function(){
      var a=g.AccountStorage,r=a.recovery;
      a.assertCurrent();sameIdentity(view.owner);
      var journal={id:g.crypto.randomUUID(),owner:view.owner,previous:r.revision};
      g.localStorage.setItem(r.lockKey,JSON.stringify(journal));
      try{
        var now=await snapshot();
        if(stable(now)!==stable(view.current))throw new Error('当前数据已变化，请重新预览');
        if(hasPendingBatch(now.rows))throw new Error('当前数据仍有待同步操作，请先完成同步后再恢复');
        // No writes to the active namespace from this point onward.
        var name=r.originalDatabase+'-restore-'+journal.id,db=await open(name,true);
        /* A restored namespace is a new local history. Never carry the old
           account-wide base/request across the activation point: it may
           describe the pre-restore data and would turn a later cloud resume
           into an unsafe rebase. Keep ordinary entity journals for the
           explicit post-restore reconciliation, but invalidate the batch
           baseline and discard its fixed request. */
        var restoredRows=clone(view.result.rows);
        restoredRows.syncIntents=(restoredRows.syncIntents||[]).filter(function(row){return row.key!=='conditional-batch-v1';});
        restoredRows.syncMeta=(restoredRows.syncMeta||[]).filter(function(row){return row.key!=='conditional-batch-v1';});
        restoredRows.syncMeta.push({key:'conditional-batch-v1',owner:a.owner,baseline:null,pending:null});
        try{await new Promise(function(resolve,reject){
          var tx=db.transaction(Object.keys(stores),'readwrite');
          tx.oncomplete=resolve;tx.onerror=tx.onabort=function(){reject(tx.error||new Error('副本保存失败'));};
          try{Object.keys(stores).forEach(function(s){(restoredRows[s]||[]).forEach(function(row){tx.objectStore(s).put(row);});});}
          catch(e){tx.abort();reject(e);}
        });}finally{db.close();}
        var prefix=r.originalPrefix+'restore.'+journal.id+'.';
        smallKeys.forEach(function(k){if(view.result.small[k]!==null)g.localStorage.setItem(prefix+k,view.result.small[k]);});
        // Preserve a recoverable record of the source and previous version in
        // the new IDB, outside the business stores (large pictures stay in IDB).
        var archive=await open(name+'-archive',true);
        try{await new Promise(function(resolve,reject){
          var tx=archive.transaction('events','readwrite');tx.objectStore('events').put({id:'restore-backup',legacy:view.legacy,previous:view.current});
          tx.oncomplete=resolve;tx.onerror=tx.onabort=function(){reject(tx.error||new Error('恢复备份保存失败'));};
        });}finally{archive.close();}
        sameIdentity(view.owner);
        if((g.localStorage.getItem(r.pointerKey)||'')!==journal.previous)throw new Error('本地版本已变化，请重新预览');
        // Keep recovered data local until cloud conflict handling is confirmed.
        g.localStorage.setItem(prefix+'chunklab.restore-cloud-hold','1');
        g.localStorage.setItem(r.pointerKey,journal.id);
        g.localStorage.removeItem(r.lockKey);
        g.location.reload();
      }catch(e){
        // Leave the lock durable: after a crash/failure, the user can cancel to
        // return to the unchanged active version before making another preview.
        throw e;
      }
    });
  }
  async function cancel(){
    if(!g.navigator.locks)throw new Error('此浏览器暂不支持安全恢复');
    await g.navigator.locks.request('chunklab-restore',async function(){
      sameIdentity(g.AccountStorage.owner);
      var r=g.AccountStorage.recovery,journal=JSON.parse(g.localStorage.getItem(r.lockKey)||'null');
      if(journal && journal.owner===g.AccountStorage.owner && /^[0-9a-f-]{36}$/.test(journal.id) && g.localStorage.getItem(r.pointerKey)!==journal.id){
        // Only this incomplete staging version is disposable. Never delete an
        // active, previous, or unassigned legacy database.
        for(var suffix of ['', '-archive'])await new Promise(function(resolve,reject){
          var req=g.indexedDB.deleteDatabase(r.originalDatabase+'-restore-'+journal.id+suffix);
          req.onsuccess=resolve;req.onerror=function(){reject(req.error);};req.onblocked=function(){reject(new Error('未完成副本仍被占用，请关闭其他页面后重试'));};
        });
        smallKeys.concat(['chunklab.restore-cloud-hold']).forEach(function(k){g.localStorage.removeItem(r.originalPrefix+'restore.'+journal.id+'.'+k);});
      }
      g.localStorage.removeItem(r.lockKey);g.location.reload();
    });
  }
  g.LegacyRestore={preview:preview,previewImported:previewImported,apply:apply,cancel:cancel,merge:merge};
  if(!g.AccountStorage || !g.AccountStorage.recovery)return;
  function pendingUI(){
    if(!g.localStorage.getItem(g.AccountStorage.recovery.lockKey) || g.document.getElementById('restorePending'))return;
    var mask=g.document.createElement('div');mask.id='restorePending';mask.setAttribute('role','dialog');mask.setAttribute('aria-modal','true');mask.setAttribute('aria-label','恢复尚未结束');
    mask.style.cssText='position:fixed;inset:0;z-index:99998;background:var(--card,#fff);padding:32px;overflow:auto';
    var text=g.document.createElement('p');text.textContent='恢复尚未结束，写入和同步已暂停。原数据仍保留。点击下方按钮重新打开当前版本，然后可重新预览恢复。';
    var button=g.document.createElement('button');button.className='btn';button.textContent='重新打开当前版本';
    button.onclick=function(){cancel().catch(function(e){text.textContent=e.message;});};mask.append(text,button);g.document.body.appendChild(mask);
  }
  var previewButton=g.document.getElementById('legacyPreview'),applyButton=g.document.getElementById('legacyApply'),view;
  if(previewButton){
    var status=g.document.getElementById('legacyRecoveryStatus');
    previewButton.onclick=async function(){
      view=null;applyButton.disabled=true;previewButton.disabled=true;
      try{
        view=await preview(g.document.getElementById('legacyMine').checked);
        status.textContent=view.conflicts.length ? '本次不会恢复，发现冲突：'+view.conflicts.join('；') : '预览：合并后共 '+JSON.parse(view.result.small['chunklab.v1']).decks.length+' 个题库、'+(view.result.rows.courses||[]).length+' 个课程。保留当前设置；原数据及当前版本均保留。恢复后仅在本机使用，云端同步暂停。';
        applyButton.disabled=!!view.conflicts.length;
      }catch(e){status.textContent=e.message;}finally{previewButton.disabled=false;}
    };
    applyButton.onclick=async function(){
      if(!view || !g.document.getElementById('legacyMine').checked){status.textContent='请先确认归属并重新预览';return;}
      applyButton.disabled=true;
      try{await apply(view);}catch(e){status.textContent=e.message;pendingUI();}
    };
  }
  pendingUI();
  if(!g.localStorage.getItem(g.AccountStorage.recovery.lockKey) && g.AccountStorage.storage.getItem('chunklab.restore-cloud-hold')){
    var notice=g.document.createElement('p');notice.setAttribute('role','status');notice.textContent='旧数据已恢复到本机。为保护云端数据，同步暂未启用；请保留备份。';
    notice.style.cssText='padding:8px 16px;background:#fff4d6;color:#694800';g.document.body.prepend(notice);
    var reconcile=g.document.createElement('button');reconcile.className='btn sm';reconcile.textContent='核对云端版本';
    reconcile.style.cssText='margin:4px 16px 12px';
    reconcile.onclick=function(){
      if(g.SyncResolutionUI && g.SyncResolutionUI.open) g.SyncResolutionUI.open();
      else { reconcile.textContent='请回到练习页处理'; reconcile.disabled=true; }
    };
    g.document.body.insertBefore(reconcile,notice.nextSibling);
  }
})(window);
