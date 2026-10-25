(function(global){
  'use strict';
  // Rendering coordination only. The host remains the sole owner of CL and learning state.
  function create(host){
    var publicResources=null, independentPublicResources=[], personalResources=[], personalResourceAliases={}, preferences={}, vocabularyResumes={}, status='', generation=0, scope='', loading=null, currentView='home', libraryControlsUnavailable=false;
    var retryTimer=null, retryDelay=2000, initialPending=true, readyViews=new Set(), loadingLocal=false, completionRefreshQueued=false;
    var vocabularyCourses={}, completionReadFailed=false, completionDirty=true, completionReadVersion=0;
    var expressionProgress={}, expressionProgressScope='';
    function directoryKey(){return 'workspace-directory.v1:'+JSON.stringify(ChunkAPI.getBase());}
    function readDirectory(){
      try{
        AccountStorage.assertCurrent();
        var raw=AccountStorage.storage.getItem(directoryKey());
        if(!raw||raw.length>1000000)return;
        var row=JSON.parse(raw);
        if(row.version!==1||row.owner!==AccountStorage.owner||row.base!==ChunkAPI.getBase())return;
        if(Array.isArray(row.publicResources))publicResources=row.publicResources.map(LearningWorkspace.normalizeResource);
        if(Array.isArray(row.independentPublicResources))independentPublicResources=row.independentPublicResources.map(LearningWorkspace.normalizeResource);
        if(ChunkAPI.getToken()&&Array.isArray(row.personalResources))personalResources=row.personalResources.map(LearningWorkspace.normalizeResource);
        if(ChunkAPI.getToken()&&row.personalResourceAliases&&typeof row.personalResourceAliases==='object')personalResourceAliases=row.personalResourceAliases;
      }catch(_){/* An unavailable metadata cache never replaces confirmed learning records. */}
    }
    function saveDirectory(){
      try{
        AccountStorage.assertCurrent();
        var raw=JSON.stringify({version:1,owner:AccountStorage.owner,base:ChunkAPI.getBase(),publicResources:publicResources,independentPublicResources:independentPublicResources,personalResources:personalResources,personalResourceAliases:personalResourceAliases});
        if(raw.length<=1000000)AccountStorage.storage.setItem(directoryKey(),raw);
      }catch(_){/* Storage quota does not invalidate a successful directory response. */}
    }
    function cancelRetry(){if(retryTimer!==null){global.clearTimeout(retryTimer);retryTimer=null;}}
    function scheduleRetry(){
      if(retryTimer!==null)return;
      var captured=scope;
      retryTimer=global.setTimeout(function(){retryTimer=null;if(identity()!==captured||!host.visible())return;if(global.navigator&&global.navigator.onLine===false){scheduleRetry();return;}refresh();},retryDelay);
      retryDelay=Math.min(retryDelay*2,60000);
    }
    function identity(){return JSON.stringify([global.AccountStorage&&AccountStorage.owner,global.ChunkAPI&&ChunkAPI.getBase(),global.ChunkAPI&&ChunkAPI.getToken()]);}
    function signedOut(){var config=global.CL&&CL.getCloudConfig();return !!(config&&config.requireAuth&&!ChunkAPI.getToken());}
    function checkOwner(){var next=identity();if(next!==scope){cancelRetry();retryDelay=2000;scope=next;generation++;initialPending=true;publicResources=null;independentPublicResources=[];personalResources=[];personalResourceAliases={};preferences={};vocabularyResumes={};vocabularyCourses={};completionReadFailed=false;completionDirty=true;completionReadVersion++;status='';libraryControlsUnavailable=false;loading=null;}return scope;}
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
      data.libraryControlsUnavailable=currentView==='my-learning'&&(libraryControlsUnavailable||global.navigator&&global.navigator.onLine===false);
      var local=LearningWorkspace.resourcesFromCatalog(data.catalog);
      var map=new Map(local.map(function(resource){return [resource.resourceId,resource];}));
      (publicResources||[]).concat(independentPublicResources,personalResources).forEach(function(resource){map.set(resource.resourceId,resource);});
      data.resources=Array.from(map.values());data.publicResources=Array.from(new Map((publicResources||local.filter(function(resource){return resource.visibility==='public';})).concat(independentPublicResources).map(function(resource){return [resource.resourceId,resource];})).values());
      data.aliases=personalResourceAliases;
      data.preferences=preferences;data.view=currentView;data.status=status;data.loading=false;
      if(signedOut())data.status='登录后查看你的课程、学习进度和复习安排。';
      data.vocabularyResumes=vocabularyResumes;
      data.vocabularyCourses=vocabularyCourses;data.completionReadFailed=completionReadFailed;
      data.courseRows=(data.courseRows||[]).map(function(row){
        var progress=expressionProgressScope===scope&&expressionProgress[row.course.id];
        if(!progress)return row;
        return Object.assign({},row,{completionState:progress.total>0&&progress.completed===progress.total?'completed':row.completionState,progress:'已完成 '+progress.completed+' / '+progress.total+' 单元',
          homeProgressMarkup:'<span class="home-progress-metric"><span class="home-progress-label"><b>'+progress.percent+'%</b></span><span class="home-progress-track"><span style="width:'+progress.percent+'%"></span></span></span>'});
      });
      if(global.VocabularyStudy)data.resume=VocabularyStudy.selectHomeResume(data.resume,vocabularyResumes);
      data.activeResources=(data.joinedCourseIds||[]).map(function(id){return data.resources.find(function(resource){return resource.courseId===id;});}).filter(Boolean);
      LearningWorkspaceView.render(host.container(currentView),data,{navigate:navigate,filter:filter,select:select,open:host.open,join:host.join,resume:host.resume,review:host.review,leave:host.leave,retry:refresh});
    }
    function refresh(localOnly){
      checkOwner();localOnly=localOnly===true&&!initialPending&&readyViews.has(currentView);
      if(loading){var wasLocal=loadingLocal;if(localOnly&&completionDirty)completionRefreshQueued=true;return loading.then(function(){if(!readyViews.has(currentView)||(!localOnly&&wasLocal))return refresh(localOnly);});}
      loadingLocal=localOnly;
      var task=refreshData(localOnly).finally(function(){if(loading===task)loading=null;if(completionRefreshQueued){completionRefreshQueued=false;if(host.visible()&&currentView==='my-learning')refresh(true);}});loading=task;return task;
    }
    async function refreshData(localOnly){
      var captured=checkOwner(), ticket=++generation, requestedView=currentView;
      var personalError='', directoryError='', libraryReadFailed=false;
      if(initialPending&&host.prepare){
        try{await host.prepare();}catch(_){personalError='学习内容未完整加载，已有内容保留。';libraryReadFailed=true;}
        if(ticket!==generation||identity()!==captured)return;
      }
      if(!localOnly){
        readDirectory();
        try{
          if(!signedOut()){
            var localRow=await LearningWorkspaceStore.read(),localCache=await ServerCache.read();
            if(ticket!==generation||identity()!==captured)return;
            preferences=localRow.projected;vocabularyResumes=localCache?.snapshot?.mem?.vocabularyResume||{};
          }
          if(ticket!==generation||identity()!==captured)return;
          initialPending=false;readyViews.add(requestedView);
          if(host.visible()&&currentView===requestedView&&(publicResources||personalResources.length||independentPublicResources.length))draw();
        }catch(_){/* Keep the existing confirmation gate when local account state is unavailable. */}
      }
      await Promise.all([
        (async function(){
          if(requestedView!=='home'||signedOut()||!ChunkAPI.getToken())return;
          expressionProgress={};
          try{
            var result=await ChunkAPI.request('/api/expression-courses');
            if(ticket!==generation||identity()!==captured)return;
            expressionProgressScope=captured;
            (result.courses||[]).forEach(function(course){if(course.progress)expressionProgress[course.courseId]=course.progress;});
          }catch(_){/* Progress remains unconfirmed when its service cannot be reached. */}
        })(),
        (async function(){
          if(localOnly&&!completionDirty||requestedView!=='my-learning'||signedOut())return;
          try{
            var offset=0, nextCourses={}, requestVersion=completionReadVersion;
            do{
              var result=await ChunkAPI.request('/api/learning-archive/vocabulary/courses?limit=100&offset='+offset,{timeoutMs:10000});
              if(ticket!==generation||identity()!==captured||requestVersion!==completionReadVersion)return;
              if(!result.confirmed||!Array.isArray(result.items)||result.nextOffset!==null&&(!Number.isSafeInteger(result.nextOffset)||result.nextOffset<=offset))throw Error('课程进度响应无效');
              result.items.forEach(function(row){nextCourses[row.bookId]=row;});offset=result.nextOffset;
            }while(offset!==null);
            vocabularyCourses=nextCourses;completionReadFailed=false;completionDirty=false;
          }catch(_){if(ticket===generation&&identity()===captured)completionReadFailed=true;}
        })(),
        (async function(){if(localOnly)return;try{if(!ChunkAPI.getToken()){personalResources=[];personalResourceAliases={};return;}var response=await ChunkAPI.request('/api/personal-wordbooks',{timeoutMs:10000});if(!Array.isArray(response.resources))throw Error('个人内容响应无效');var courseResponse={courses:[]};try{courseResponse=await ChunkAPI.request('/api/course-library',{timeoutMs:10000});if(!Array.isArray(courseResponse.courses))throw Error('个人课程目录响应无效');}catch(error){if(error.status!==404)throw error;}var aliases={};var courseResources=courseResponse.courses.map(function(course){(Array.isArray(course.legacyResourceIds)?course.legacyResourceIds:[]).forEach(function(legacyId){if(typeof legacyId==='string'&&legacyId.startsWith('course:'))aliases[legacyId.slice(7)]=course.courseId;});return LearningWorkspace.normalizeResource({resourceId:'course:'+course.courseId,courseId:course.courseId,title:course.title,origin:'imported',visibility:course.visibility,sourceRefs:[{type:'personal-course',id:course.courseId}]});});var nextPersonal=response.resources.map(LearningWorkspace.normalizeResource).concat(courseResources.filter(function(resource){return resource.visibility!=='public';}));var nextPublic=courseResources.filter(function(resource){return resource.visibility==='public';});if(ticket===generation&&identity()===captured){personalResources=nextPersonal;personalResourceAliases=aliases;independentPublicResources=nextPublic;saveDirectory();}}catch(error){if(error.status===404&&!personalResources.length)return;personalError='个人课程目录读取失败，已有内容保留。';libraryReadFailed=true;}})(),
        (async function(){if(localOnly||requestedView==='home')return;try{var response=await ChunkAPI.request('/api/library',{timeoutMs:10000});if(!response||!Array.isArray(response.resources))throw Error('目录响应无效');if(ticket===generation&&identity()===captured){publicResources=response.resources.map(LearningWorkspace.normalizeResource);saveDirectory();}}catch(_){directoryError='内容目录读取失败，已保留旧内容。';libraryReadFailed=true;}})(),
        (async function(){if(signedOut())return;try{var row=await LearningWorkspaceStore.read(),cache=await ServerCache.read();if(ticket===generation&&identity()===captured){preferences=row.projected;vocabularyResumes=cache?.snapshot?.mem?.vocabularyResume||{};}}catch(_){personalError='学习记录未确认，不代表空账户。';}})()
      ]);
      if(ticket!==generation||identity()!==captured)return;
      // Confirmation events update projected progress, not independent remote directories.
      // Retain remote errors and their retry timer until a remote refresh succeeds.
      if(localOnly){if(personalError)status=personalError;if(host.visible()&&currentView===requestedView)draw();return;}
      libraryControlsUnavailable=libraryReadFailed||global.navigator&&global.navigator.onLine===false;
      if(!signedOut()&&(directoryError||personalError))scheduleRetry();else{cancelRetry();retryDelay=2000;}
      status=requestedView==='my-learning'&&(directoryError||personalError)?'内容暂时无法加载。':requestedView!=='home'&&directoryError&&personalError?'部分内容未能读取，已保留现有内容。':[requestedView==='home'?'':directoryError,personalError].filter(Boolean).join(' ');
      if(requestedView==='my-learning'&&(directoryError||personalError)&&(publicResources||personalResources.length||independentPublicResources.length))status='正在显示已缓存内容，连接恢复后自动更新。';
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
    global.addEventListener('offline',function(){if(host.visible()){draw();refresh();}});
    global.addEventListener('server-cache-applied',function(){completionDirty=true;completionReadVersion++;if(host.visible())refresh(true);});
    global.addEventListener('personal-wordbooks-restored',function(){if(host.visible())refresh();});
    global.addEventListener('storage',function(){if(identity()!==scope){checkOwner();if(host.visible())show();}});
    return {show:show,render:draw,refresh:refresh,navigate:navigate};
  }
  global.LearningWorkspaceRuntime={create:create};
})(window);
