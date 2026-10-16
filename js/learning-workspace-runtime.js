(function(global){
  'use strict';
  // Rendering coordination only. The host remains the sole owner of CL and learning state.
  function create(host){
    var publicResources=null, personalResources=[], preferences={}, vocabularyResumes={}, status='', generation=0, scope='', loading=null, currentView='home';
    var retryTimer=null, retryDelay=2000, initialPending=true, readyViews=new Set();
    function cancelRetry(){if(retryTimer!==null){global.clearTimeout(retryTimer);retryTimer=null;}}
    function scheduleRetry(){
      if(retryTimer!==null)return;
      var captured=scope;
      retryTimer=global.setTimeout(function(){retryTimer=null;if(identity()!==captured||!host.visible())return;if(global.navigator&&global.navigator.onLine===false){scheduleRetry();return;}refresh();},retryDelay);
      retryDelay=Math.min(retryDelay*2,60000);
    }
    function identity(){return JSON.stringify([global.AccountStorage&&AccountStorage.owner,global.ChunkAPI&&ChunkAPI.getBase(),global.ChunkAPI&&ChunkAPI.getToken()]);}
    function signedOut(){var config=global.CL&&CL.getCloudConfig();return !!(config&&config.requireAuth&&!ChunkAPI.getToken());}
    function checkOwner(){var next=identity();if(next!==scope){cancelRetry();retryDelay=2000;scope=next;generation++;initialPending=true;readyViews.clear();publicResources=null;personalResources=[];preferences={};vocabularyResumes={};status='';loading=null;}return scope;}
    function viewFromUrl(){var view=new URLSearchParams(location.search).get('view');return ['home','my-learning','discover'].includes(view)?view:'home';}
    function draw(){
      checkOwner();
      if(initialPending||!readyViews.has(currentView)){
        LearningWorkspaceView.render(host.container(currentView),{view:currentView,loading:true},{navigate:navigate});
        return;
      }
      var data;
      try{AccountStorage.assertCurrent();data=host.read();}
      catch(_){data={catalog:{courses:[]},memberships:{},joinedCourseIds:[],resume:null,due:0};preferences={};status='账号状态已变化，请重新打开页面；原有记录保留。';}
      var local=LearningWorkspace.resourcesFromCatalog(data.catalog);
      var map=new Map(local.map(function(resource){return [resource.resourceId,resource];}));
      (publicResources||[]).concat(personalResources).forEach(function(resource){map.set(resource.resourceId,resource);});
      data.resources=Array.from(map.values());data.publicResources=publicResources||local.filter(function(resource){return resource.visibility==='public';});
      data.preferences=preferences;data.view=currentView;data.status=status;data.loading=false;
      if(signedOut())data.status='登录后查看你的课程、学习进度和复习安排。';
      data.vocabularyResumes=vocabularyResumes;
      if(global.VocabularyStudy)data.resume=VocabularyStudy.selectHomeResume(data.resume,vocabularyResumes);
      data.activeResources=(data.joinedCourseIds||[]).map(function(id){return data.resources.find(function(resource){return resource.courseId===id;});}).filter(Boolean);
      LearningWorkspaceView.render(host.container(currentView),data,{navigate:navigate,filter:filter,select:select,open:host.open,resume:host.resume,review:host.review,leave:host.leave,retry:refresh});
    }
    function refresh(){
      checkOwner();if(loading)return loading.then(function(){if(!readyViews.has(currentView))return refresh();});
      var task=refreshData().finally(function(){if(loading===task)loading=null;});loading=task;return task;
    }
    async function refreshData(){
      var captured=checkOwner(), ticket=++generation, requestedView=currentView;
      var personalError='', directoryError='';
      if(initialPending&&host.prepare){
        try{await host.prepare();}catch(_){personalError='学习内容尚未完整读取，请稍后重试；已有内容保留。';}
        if(ticket!==generation||identity()!==captured)return;
      }
      await Promise.all([
        (async function(){try{if(!ChunkAPI.getToken()){personalResources=[];return;}var response=await ChunkAPI.request('/api/personal-wordbooks',{timeoutMs:10000});if(!Array.isArray(response.resources))throw Error('个人内容响应无效');if(ticket===generation&&identity()===captured)personalResources=response.resources.map(LearningWorkspace.normalizeResource);}catch(error){if(error.status===404&&!personalResources.length)return;personalError='个人单词本尚未读取成功，已有内容保留。';}})(),
        (async function(){if(requestedView==='home')return;try{var response=await ChunkAPI.request('/api/library',{timeoutMs:10000});if(!response||!Array.isArray(response.resources))throw Error('目录响应无效');if(ticket===generation&&identity()===captured)publicResources=response.resources.map(LearningWorkspace.normalizeResource);}catch(_){directoryError='内容目录连接失败，保留最近可读内容。';}})(),
        (async function(){if(signedOut())return;try{var row=await LearningWorkspaceStore.read(),cache=await ServerCache.read();if(ticket===generation&&identity()===captured){preferences=row.projected;vocabularyResumes=cache?.snapshot?.mem?.vocabularyResume||{};}}catch(_){personalError='个人记录尚未确认，请稍后重试；当前不代表空账户。';}})()
      ]);
      if(ticket!==generation||identity()!==captured)return;
      if(!signedOut()&&(directoryError||personalError))scheduleRetry();else{cancelRetry();retryDelay=2000;}
      status=[requestedView==='home'?'':directoryError,personalError].filter(Boolean).join(' ');
      if(!status&&Object.values(preferences).some(function(row){return row.pending;}))status='有待保存的更改，连接恢复后会自动重试。';
      initialPending=false;
      readyViews.add(requestedView);
      if(host.visible()&&currentView===requestedView)draw();
    }
    function show(){currentView=viewFromUrl();host.show(currentView);draw();refresh();}
    function navigate(view){var url=new URL(location.href);url.search='';url.searchParams.set('view',view);history.pushState({},'',url);show();}
    function filter(patch,clear,targetView,replace){var target=targetView==='my-learning'?'my-learning':'discover';var url=new URL(location.href);if(clear)url.search='?view='+target;Object.keys(patch).forEach(function(key){url.searchParams.delete(key);var values=Array.isArray(patch[key])?patch[key]:[patch[key]];values.filter(Boolean).forEach(function(value){url.searchParams.append(key,value);});});url.searchParams.set('view',target);
      if(Object.hasOwn(patch,'schoolStages')){
        var selection=LearningWorkspace.selectionFromUrl(url.search),options=LearningWorkspace.facetOptions(publicResources||[],selection);
        var publisher=url.searchParams.get('publisherId');if(publisher&&!options.publisherId.some(function(option){return option.value===publisher;})){url.searchParams.delete('publisherId');status='已清除不适用于当前学段的版本条件。';}
      }
      if(replace)history.replaceState({},'',url);else history.pushState({},'',url);currentView=target;draw();}
    async function select(type,id,selected,position){
      if(!publicResources){status='目录服务尚未就绪，未提交更改。请重试读取或联系管理员更新服务。';draw();return;}
      var captured=checkOwner();status='正在保存…';draw();
      try{var promise=LearningWorkspaceStore.select(type,id,selected,position);
        // Show queued state without waiting for an offline transaction receipt.
        setTimeout(function(){if(identity()===captured&&host.visible())LearningWorkspaceStore.read().then(function(row){if(identity()!==captured)return;preferences=row.projected;status=row.pending?'待保存，连接恢复后会自动重试。':'';draw();}).catch(function(){});},100);
        var row=await promise;if(identity()!==captured)return;preferences=row.projected;status='已保存';if(host.visible())draw();
      }catch(error){if(identity()!==captured)return;status='保存未确认：'+(error.message||'请稍后重试');if(host.visible())draw();}
    }
    global.addEventListener('popstate',function(){show();});
    global.addEventListener('focus',function(){if(host.visible())refresh();});
    global.addEventListener('online',function(){cancelRetry();retryDelay=2000;if(host.visible())refresh();});
    global.addEventListener('server-cache-applied',function(){if(host.visible())refresh();});
    global.addEventListener('personal-wordbooks-restored',function(){if(host.visible())refresh();});
    global.addEventListener('storage',function(){if(identity()!==scope){checkOwner();if(host.visible())show();}});
    return {show:show,render:draw,refresh:refresh,navigate:navigate};
  }
  global.LearningWorkspaceRuntime={create:create};
})(window);
