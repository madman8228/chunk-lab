/* Business storage belongs to the identity captured when this page starts.
 * Credentials remain in native localStorage. No legacy data is deleted/copied. */
(function(global){
  'use strict';
  var initializationError;
  function unavailable(){throw initializationError || new Error('账号存储尚未初始化');}
  // If credentials/storage cannot be read, never fall back to shared legacy data.
  global.AccountStorage={assertCurrent:unavailable,credentialsChanged:unavailable,
    storage:{getItem:unavailable,setItem:unavailable,removeItem:unavailable},decodeKey:function(){return null;}};
  try {
  var native=global.localStorage, OWNER='chunklab.storage-owner.v1', SESSION='chunklab.session.v1';
  function sessionRecord(){
    try{
      var value=JSON.parse(native.getItem(SESSION)||'null');
      return value && value.version===1 && typeof value.epoch==='string' && value.epoch ? value : null;
    }catch(error){ return null; }
  }
  function identity(){
    var session=sessionRecord();
    var base=new URL(session ? (session.base || '/') : (native.getItem('chunklab_api_base') || '/'),global.location.origin).href.replace(/\/+$/,'');
    var token=session ? session.token : native.getItem('chunklab_token'), uid='local';
    if(token){
      try{
        var claims=JSON.parse(global.atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
        if(claims.uid==null) throw new Error('uid');
        uid=String(claims.uid);
      }catch(error){throw new Error('登录凭据无法识别，请重新登录；本地数据未删除');}
    }
    return JSON.stringify([base,uid]);
  }
  var owner=identity(), initialSession=sessionRecord(), epoch=initialSession && initialSession.epoch || '';
  var legacy=native.getItem(OWNER);
  // Old versions never recorded an owner. Keep their database and keys intact,
  // but do not assign/upload them to whichever account happens to log in first.
  if(!legacy){native.setItem(OWNER,'legacy-unassigned');legacy=native.getItem(OWNER);}
  var prefix=legacy===owner ? '' : 'chunklab.account.'+encodeURIComponent(owner)+'.';
  var pointerKey='chunklab.restore.active.'+encodeURIComponent(owner);
  var lockKey='chunklab.restore.pending.'+encodeURIComponent(owner);
  var revision=native.getItem(pointerKey) || '';
  var originalPrefix=prefix;
  var originalDatabase=prefix ? 'chunklab-idb-'+encodeURIComponent(owner) : 'chunklab-idb';
  if(revision) prefix=originalPrefix+'restore.'+revision+'.';
  var switching=false;
  function changed(){
    var currentSession=sessionRecord(), currentEpoch=currentSession && currentSession.epoch || '';
    if(identity()===owner && currentEpoch===epoch && (native.getItem(pointerKey)||'')===revision) return false;
    if(!switching){
      switching=true;
      // Do not leave the previous account's contents visible after a switch.
      if(global.document && global.document.documentElement) global.document.documentElement.style.visibility='hidden';
      global.setTimeout(function(){global.location.reload();},0);
    }
    return true;
  }
  function assertCurrent(){
    if(changed() || switching){var error=new Error('账号或服务地址已切换，请等待页面重新加载');error.code='SESSION_CHANGED';throw error;}
    if(native.getItem(lockKey)){var locked=new Error('旧数据恢复尚未结束，请完成或取消恢复');locked.code='RESTORE_PENDING';throw locked;}
  }
  global.AccountStorage={
    owner:owner,
    sessionEpoch:epoch,
    databaseName:originalDatabase+(revision ? '-restore-'+revision : ''),
    recovery:{pointerKey:pointerKey,lockKey:lockKey,prefix:prefix,originalPrefix:originalPrefix,originalDatabase:originalDatabase,revision:revision},
    assertCurrent:assertCurrent,
    credentialsChanged:changed,
    storage:{
      getItem:function(key){assertCurrent();return native.getItem(prefix+key);},
      setItem:function(key,value){assertCurrent();native.setItem(prefix+key,value);},
      removeItem:function(key){assertCurrent();native.removeItem(prefix+key);}
    },
    decodeKey:function(key){return prefix ? (key && key.indexOf(prefix)===0 ? key.slice(prefix.length) : null) : key;}
  };
  global.addEventListener('storage',function(event){
    if(event.key===null || event.key==='chunklab_token' || event.key==='chunklab_api_base' || event.key===SESSION || event.key===pointerKey) changed();
    if(event.key===lockKey && event.oldValue && !event.newValue) global.location.reload();
  });
  } catch(error) {
    initializationError=error;
    initializationError.code='ACCOUNT_STORAGE_UNAVAILABLE';
    global.setTimeout(function(){
      var notice=global.document.createElement('div');
      notice.setAttribute('role','alert');
      notice.textContent='无法安全读取账号存储，请重新登录或检查浏览器存储权限。本地数据未删除。';
      notice.style.cssText='position:fixed;inset:0;z-index:99999;background:#fff;padding:32px';
      var retry=global.document.createElement('button');
      retry.textContent='重新登录';
      retry.onclick=function(){
        try{global.localStorage.removeItem('chunklab_token');global.localStorage.removeItem('chunklab_guest');global.localStorage.setItem('chunklab_manual','1');global.location.reload();}
        catch(ignore){retry.textContent='请先允许浏览器存储，再刷新';}
      };
      notice.appendChild(retry);
      global.document.body.appendChild(notice);
    },0);
  }
})(window);
