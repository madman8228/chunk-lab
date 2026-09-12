/* Read-only recovery of unassigned pre-account storage. Never claims, deletes,
 * imports or uploads data. Confirmation is required before reading private data. */
(function(global){
  'use strict';
  var keys=['chunklab.v1','chunklab.courses.v1','chunklab.course-progress.v1','chunklab_reinforce'];
  function readLocal(){
    return keys.map(function(key){return global.localStorage.getItem(key);});
  }
  function parse(raw,fallback){return raw === null ? fallback : JSON.parse(raw);}
  function rows(){
    return new Promise(function(resolve,reject){
      var missing=false,request=global.indexedDB.open('chunklab-idb');
      // Opening a nonexistent database must not create an empty legacy database.
      request.onupgradeneeded=function(){missing=true;request.transaction.abort();};
      request.onerror=function(){if(missing)resolve({});else reject(request.error);};
      request.onblocked=function(){reject(new Error('请关闭旧页面后重试'));};
      request.onsuccess=function(){
        var db=request.result,names=Array.from(db.objectStoreNames),result={};
        if(!names.length){db.close();resolve(result);return;}
        var tx=db.transaction(names,'readonly');
        tx.oncomplete=function(){db.close();resolve(result);};
        tx.onerror=tx.onabort=function(){db.close();reject(tx.error || new Error('读取旧数据失败'));};
        names.forEach(function(name){var r=tx.objectStore(name).getAll();r.onsuccess=function(){result[name]=r.result;};});
      };
    });
  }
  async function prepare(confirmed){
    if(confirmed!==true)throw new Error('请先确认旧数据属于你');
    global.AccountStorage.assertCurrent();
    var owner=global.AccountStorage.owner;
    if(global.localStorage.getItem('chunklab.storage-owner.v1')!=='legacy-unassigned')throw new Error('没有待确认归属的旧数据');
    var before=readLocal(),data=await rows();
    global.AccountStorage.assertCurrent();
    if(owner!==global.AccountStorage.owner || JSON.stringify(before)!==JSON.stringify(readLocal()))throw new Error('旧数据正在变化，请关闭其他页面后重试');
    if(before.every(function(v){return v===null;}) && !Object.keys(data).some(function(k){return data[k].length;}))throw new Error('没有找到旧版数据');
    var mem=parse(before[0],{});
    if(!mem || typeof mem!=='object' || Array.isArray(mem))throw new Error('旧数据格式异常，未修改原数据');
    var courses=parse(before[1],[]),progress=parse(before[2],{});
    if(!Array.isArray(courses) || !progress || typeof progress!=='object' || Array.isArray(progress))throw new Error('旧课程格式异常，未修改原数据');
    var map=new Map(courses.map(function(c){return [c.courseId,c];}));
    (data.courses || []).forEach(function(c){map.set(c.courseId,c);});
    (data.progress || []).forEach(function(r){progress[r.cid]=r.data;});
    mem.stats=mem.stats || {};
    mem.stats.bySentence=mem.stats.bySentence || {};
    (data.sentenceStats || []).forEach(function(r){mem.stats.bySentence[r.key]=r.data;});
    var events=new Map((mem.stats.events || []).map(function(e){return [e.id,e];}));
    (data.events || []).forEach(function(e){events.set(e.id,e);});
    mem.stats.events=Array.from(events.values());
    return {__app:'chunklab',__version:2,exportedAt:new Date().toISOString(),mem:mem,
      reinforceBook:mem.reinforceBook || parse(before[3],[]),courses:Array.from(map.values()),courseProgress:progress,
      legacyArchive:{localKeys:Object.fromEntries(keys.map(function(k,i){return [k,before[i]];})),stores:data}};
  }
  function mount(){
    var button=global.document.getElementById('btnRecoverLegacy');
    if(!button)return;
    var box=global.document.getElementById('legacyRecovery'),status=global.document.getElementById('legacyRecoveryStatus');
    button.onclick=function(){box.hidden=!box.hidden;};
    global.document.getElementById('legacyDownload').onclick=async function(){
      var trigger=this;trigger.disabled=true;
      try{
        var backup=await prepare(global.document.getElementById('legacyMine').checked);
        var url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
        var link=global.document.createElement('a');link.href=url;link.download='chunklab_legacy_backup.json';link.click();
        global.setTimeout(function(){URL.revokeObjectURL(url);},1000);
        status.textContent='已请求下载备份，请确认文件保存成功。原数据和当前数据均未修改。';
      }catch(error){status.textContent=error.message || '读取失败，原数据未修改';}
      finally{trigger.disabled=false;}
    };
  }
  global.LegacyBackup={prepare:prepare};
  mount();
})(window);
