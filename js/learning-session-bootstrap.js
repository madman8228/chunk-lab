(function(global){
  'use strict';
  function identity(){return JSON.stringify([AccountStorage.owner,ChunkAPI.getBase(),ChunkAPI.getToken(),AccountStorage.sessionEpoch]);}
  function preload(){return Promise.resolve(CL.preload());}
  async function ready(options){const captured=identity();AccountStorage.assertCurrent();
    if(!ChunkAPI.getToken())throw Object.assign(Error('请先登录，再查看个人学习内容。'),{code:'AUTH_REQUIRED',status:401});
    await preload();let source='server';
    if(ChunkAPI.getToken()){await CL.ensureCloud();AccountStorage.assertCurrent();if(identity()!==captured)throw Error('账号已变化，请重新打开单词本');
      if(!CL.serverPersistenceReady()){
        const config=CL.getCloudConfig?.();let cache=null;
        if(options?.allowConfirmedOffline===true&&CL.getPersistenceState?.()==='offline'&&config?.persistenceMode==='server-authoritative'&&config.writeProtocol===3&&config.responseIdentityVersion===1&&(config.requireAuth===true||config.testMode===true)&&global.ServerCache)cache=await global.ServerCache.read();
        AccountStorage.assertCurrent();if(identity()!==captured)throw Error('账号已变化，请重新打开单词本');
        if(!cache||!Number.isSafeInteger(cache.appliedSeq)||cache.appliedSeq<0||cache.snapshot?.seq!==cache.appliedSeq||!cache.snapshot.mem||typeof cache.snapshot.mem!=='object'||Array.isArray(cache.snapshot.mem)){
          const cause=CL.getCloudStartupError?.();
          if(cause)throw Object.assign(Error(cause.message||'学习记录尚未确认'),{code:cause.code,status:cause.status});
          throw Object.assign(Error('学习记录尚未确认'),{code:'LEARNING_STATE_UNCONFIRMED'});
        }
        source='confirmed-cache';
      }}
    return {identity:captured,loggedIn:!!ChunkAPI.getToken(),source};}
  global.LearningSessionBootstrap={identity,preload,ready};
})(window);
