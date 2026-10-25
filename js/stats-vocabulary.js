(function(global){
  'use strict';
  var domain='sentence', selectedDomain='sentence', summary=null, events=null, phase='loading', generation=0, loading=false;
  var owner=null, flight=null, refreshError=false, dailyFlight=null;
  var summaryDirty=true, eventsDirty=true, eventsLoading=false, eventsFlight=null, eventsPhase='idle', activeTab='overview';
  var eventsTab='sent',eventsGeneration=0;
  function currentOwner(){var account=global.AccountStorage,api=global.ChunkAPI;return JSON.stringify([account&&account.owner,account&&account.sessionEpoch,api&&api.getBase?api.getBase():'']);}
  function visible(){return typeof statsSurfaceVisible==='function'?statsSurfaceVisible():document.visibilityState!=='hidden';}
  function resetScope(){if(owner===currentOwner())return;owner=currentOwner();generation++;summary=null;events=null;loading=false;eventsLoading=false;flight=null;eventsFlight=null;phase='loading';eventsPhase='idle';summaryDirty=true;eventsDirty=true;refreshError=false;}
  function node(tag,text,className){var el=document.createElement(tag);if(text!=null)el.textContent=text;if(className)el.className=className;return el;}
  function operationId(){return global.crypto&&typeof global.crypto.randomUUID==='function'?global.crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);}
  function button(text,fn){var el=node('button',text,'btn');el.type='button';el.dataset.archiveFocus=text;el.onclick=fn;return el;}
  function reviewLauncher(container,includeDaily){
    var controls=node('div',null,'archive-word-review-controls'),course=node('select'),kind=node('select'),practice=node('select'),output=node('div',null,'archive-word-review-list');
    course.setAttribute('aria-label','选择词书');kind.setAttribute('aria-label','筛选复习内容');practice.setAttribute('aria-label','练习方式');
    var loadingOption=node('option','正在加载词书…');loadingOption.value='';loadingOption.disabled=true;course.append(loadingOption);
    [['wrong','错题'],['due','待复习']].forEach(function(v){var o=node('option',v[1]);o.value=v[0];kind.append(o);});
    [['','全部练习'],['sentence-cloze','句子填空'],['guided-expression','中文引导句子'],['word-choice','选词填空'],['chunk-order','词序拼块'],['word-dictation','单词听写']].forEach(function(v){var o=node('option',v[1]);o.value=v[0];practice.append(o);});
    var refreshButton=button('查看专项复习',refresh),courseRows=[];
    controls.append(course,kind,practice,refreshButton);container.append(controls,output);
    if(activeTab==='overview'||includeDaily){
      var dailyButton=button('开始今日混合复习',startDailyReview);dailyButton.className='btn primary';
      controls.append(dailyButton);
    }
    global.ChunkAPI.request('/api/learning-archive/vocabulary/courses?limit=100').then(function(result){
      if(!result.confirmed||!Array.isArray(result.items))throw Error('未确认词书列表');courseRows=result.items;
      course.replaceChildren();courseRows.forEach(function(row){var o=node('option',row.title||row.bookId);o.value=row.bookId;course.append(o);});
      if(!courseRows.length){var emptyOption=node('option','当前账号没有可用于复习的词书');emptyOption.value='';emptyOption.disabled=true;course.append(emptyOption);output.append(node('p','当前账号没有可用于专项复习的词书。','muted'));}
    }).catch(function(){course.replaceChildren();var errorOption=node('option','词书列表暂不可用');errorOption.value='';errorOption.disabled=true;course.append(errorOption);output.append(node('p','词书列表暂不可用，请稍后重试。','muted'));});
    async function refresh(){
      output.replaceChildren();if(!course.value){output.append(node('p','请选择词书。','muted'));return;}
      refreshButton.disabled=true;
      try{
        var query=new URLSearchParams({bookId:course.value,kind:kind.value,limit:'100'});if(practice.value)query.set('practiceType',practice.value);
        var result=await global.ChunkAPI.request('/api/learning-archive/vocabulary/review?'+query);
        if(!result.confirmed||!Array.isArray(result.items)||!Number.isSafeInteger(result.total)||result.total<0)throw Error('复习列表未确认');
        output.append(node('p','当前筛选共 '+result.total+' 项。','archive-word-review-count'));
        if(!result.items.length){output.append(node('p',kind.value==='wrong'?'当前词书没有已记录错答。':kind.value==='due'?'当前暂无到期词条。':'当前没有待巩固词条。','muted'));return;}
        result.items.forEach(function(item){var row=node('div',null,'archive-word-review-row');
          row.append(node('strong',(item.title||item.itemId)+(item.meaning?' · '+item.meaning:'')),node('span',item.practiceType+' · '+(item.state.status==='needs-reinforcement'?'需巩固':item.state.due?'待复习':'已到间隔'),'muted'));
          var start=button('复习此类内容（最多10项）',async function(){start.disabled=true;try{
            var sessionId=operationId();await global.ChunkAPI.submitOperation({protocol:3,requestId:operationId(),type:'vocabulary.review.session',payload:{action:'start',sessionId:sessionId,bookId:result.bookId,bookRevision:result.bookRevision,practiceType:item.practiceType,kind:kind.value,expectedSessionRev:0}});
            var back=location.pathname+location.search;location.href='wordbook.html?book='+encodeURIComponent(result.bookId)+'&practice='+encodeURIComponent(item.practiceType)+'&reviewSession='+encodeURIComponent(sessionId)+'&returnTo='+encodeURIComponent(back);
          }catch(error){start.disabled=false;row.append(node('span',error.message||'无法启动专项复习','muted'));}});
          start.disabled=item.canReview===false;
          row.append(start);output.append(row);
        });
      }catch(error){output.append(node('p',error.message||'专项复习列表加载失败。','muted'));}
      finally{refreshButton.disabled=false;}
    }
  }
  function dailyOperation(payload){return global.ChunkAPI.submitOperation({protocol:3,requestId:operationId(),type:'daily-review.session',payload:payload});}
  async function startDailyReview(event){
    var trigger=event.currentTarget,container=trigger.closest('.review-word-group')||trigger.parentElement;
    var note=container.querySelector('.archive-word-review-start-status');if(!note){note=node('p',null,'archive-word-review-start-status muted');note.setAttribute('role','status');note.setAttribute('aria-live','polite');container.append(note);}note.textContent='正在读取已确认到期的句子与当前词书待复习项…';trigger.disabled=true;
    try{
      var book=container.querySelector('select[aria-label="选择词书"]');
      if(!book||!book.value)throw Error('请先选择一本词书；混合复习不会合并多本词书。');
      var sentenceItems=typeof global.getDailyReviewSentenceCandidates==='function'?global.getDailyReviewSentenceCandidates():[];
      var query=new URLSearchParams({bookId:book.value,kind:'due',limit:'100'});
      var result=await global.ChunkAPI.request('/api/learning-archive/vocabulary/review?'+query);
      if(!result.confirmed||!Array.isArray(result.items))throw Error('单词待复习列表尚未确认。');
      var vocabularyItems=result.items.filter(function(item){return item.canReview&&item.state&&Number.isSafeInteger(item.state.dueAt);}).map(function(item){
        var reference={bookId:result.bookId,bookRevision:result.bookRevision,itemId:item.itemId,contentRevision:item.contentRevision,practiceType:item.practiceType};
        return {type:'vocabulary',key:reference.bookId+'#'+reference.itemId+'#'+reference.practiceType,dueAt:item.state.dueAt,reference:reference};
      });
      if(!sentenceItems.length&&!vocabularyItems.length)throw Error('当前没有已到期的句子或单词。');
      var sessionId=operationId(),candidates=sentenceItems.concat(vocabularyItems).sort(function(a,b){return a.dueAt-b.dueAt||a.type.localeCompare(b.type)||a.key.localeCompare(b.key);}).slice(0,500);
      await dailyOperation({action:'start',sessionId:sessionId,expectedRevision:0,items:candidates});
      var url=new URL(location.href);url.searchParams.set('dailyReview',sessionId);history.replaceState(null,'',url.href);
      await continueDailyReview(sessionId);
    }catch(error){trigger.disabled=false;note.textContent=error.message||'今日混合复习暂时无法启动。';}
  }
  async function continueDailyReview(sessionId){
    if(dailyFlight)return dailyFlight;
    dailyFlight=(async function(){
      var parent;
      while(true){
        parent=await global.ChunkAPI.request('/api/learning-archive/daily-review-sessions/'+encodeURIComponent(sessionId));
        if(!parent.confirmed||!Array.isArray(parent.items))throw Error('今日复习队列尚未确认。');
        if(parent.status==='completed'){var completedUrl=new URL(location.href);completedUrl.searchParams.delete('dailyReview');history.replaceState(null,'',completedUrl.href);return;}
        var index=parent.index||0;
        if(index>=parent.items.length){await dailyOperation({action:'finish',sessionId:sessionId,expectedRevision:parent.revision});var cleanUrl=new URL(location.href);cleanUrl.searchParams.delete('dailyReview');history.replaceState(null,'',cleanUrl.href);var message=document.querySelector('.review-word-group');if(message)message.append(node('p','今日混合复习已完成。','archive-word-review-count'));return;}
        var child=parent.childSession;
        if(child&&child.status==='in-progress'&&child.type==='sentence'){
          if(child.index>=child.total){await dailyOperation({action:'progress',sessionId:sessionId,expectedRevision:parent.revision,index:child.endIndex,childSession:Object.assign({},child,{status:'completed'})});continue;}
          var sentenceGroup=parent.items.slice(index,child.endIndex);
          await global.launchDailyReviewSentenceGroup(sentenceGroup.slice(child.index),sessionId,child.endIndex,child.index,child.total);return;
        }
        if(child&&child.status==='in-progress'&&child.type==='vocabulary'){
          var childState=await global.ChunkAPI.request('/api/learning-archive/vocabulary/review-sessions/'+encodeURIComponent(child.sessionId));
          if(childState.status==='completed'&&childState.index>=child.total){
            await dailyOperation({action:'progress',sessionId:sessionId,expectedRevision:parent.revision,index:child.endIndex,childSession:Object.assign({},child,{index:child.total,status:'completed'})});
            continue;
          }
          if(childState.status==='completed')throw Error('单词复习子会话提前结束；队列未跳过剩余词条，请从待复习入口重新开始。');
          if(childState.status==='paused')await global.ChunkAPI.submitOperation({protocol:3,requestId:operationId(),type:'vocabulary.review.session',payload:{action:'resume',sessionId:child.sessionId,bookId:child.bookId,bookRevision:child.bookRevision,practiceType:child.practiceType,expectedSessionRev:childState.revision}});
          var back=new URL(location.href);back.searchParams.set('dailyReview',sessionId);
          location.href='wordbook.html?book='+encodeURIComponent(child.bookId)+'&practice='+encodeURIComponent(child.practiceType)+'&reviewSession='+encodeURIComponent(child.sessionId)+'&returnTo='+encodeURIComponent(back.pathname+back.search);return;
        }
        var first=parent.items[index],end=index+1;
        function sameGroup(a,b){return a.type===b.type&&(a.type==='sentence'||(a.reference.bookId===b.reference.bookId&&a.reference.practiceType===b.reference.practiceType));}
        while(end<parent.items.length&&sameGroup(first,parent.items[end]))end++;
        var group=parent.items.slice(index,end),childId=operationId();
        if(first.type==='sentence'){
          await dailyOperation({action:'progress',sessionId:sessionId,expectedRevision:parent.revision,index:index,childSession:{sessionId:childId,type:'sentence',index:0,total:group.length,endIndex:end,status:'in-progress'}});
          if(typeof global.launchDailyReviewSentenceGroup!=='function')throw Error('句子播放器暂不可用。');
          await global.launchDailyReviewSentenceGroup(group,sessionId,end,0,group.length);
        }else{
          var ref=first.reference;
          await global.ChunkAPI.submitOperation({protocol:3,requestId:operationId(),type:'vocabulary.review.session',payload:{action:'start',sessionId:childId,bookId:ref.bookId,bookRevision:ref.bookRevision,practiceType:ref.practiceType,kind:'due',expectedSessionRev:0,itemIds:group.map(function(item){return item.reference.itemId;})}});
          await dailyOperation({action:'progress',sessionId:sessionId,expectedRevision:parent.revision,index:index,childSession:{sessionId:childId,type:'vocabulary',index:0,total:group.length,endIndex:end,status:'in-progress',bookId:ref.bookId,bookRevision:ref.bookRevision,practiceType:ref.practiceType}});
          var back=new URL(location.href);back.searchParams.set('dailyReview',sessionId);
          location.href='wordbook.html?book='+encodeURIComponent(ref.bookId)+'&practice='+encodeURIComponent(ref.practiceType)+'&reviewSession='+encodeURIComponent(childId)+'&returnTo='+encodeURIComponent(back.pathname+back.search);
        }
        return;
      }
    })().catch(function(error){console.error('[daily-review] continuation failed',error);var alertNode=document.querySelector('.review-word-group');if(alertNode)alertNode.append(node('p',error.message||'今日复习无法继续，请重试。','muted'));}).finally(function(){dailyFlight=null;});
    return dailyFlight;
  }
  function status(text,retry){var row=node('div',null,'archive-word-status');row.setAttribute('role','status');row.append(node('span',text,'muted'));if(retry){var action=button('重试',function(){eventsPhase='idle';eventsDirty=true;load();});action.className='archive-word-retry';row.append(action);}return row;}
  function render(tab){
    activeTab=tab;resetScope();
    var dailyId=new URLSearchParams(location.search).get('dailyReview');if(dailyId&&visible())continueDailyReview(dailyId);
    if((tab==='sent'||tab==='wrong')&&eventsTab!==tab){eventsTab=tab;eventsGeneration++;events=null;eventsDirty=true;eventsLoading=false;eventsFlight=null;eventsPhase='idle';}
    // Overview always includes both knowledge domains; keep list filters for other tabs.
    domain=tab==='overview'?'all':selectedDomain;
    var domains=document.getElementById('statsDomains');
    domains.hidden=tab==='overview';
    Array.from(domains.children).forEach(function(el){el.setAttribute('aria-selected',String(el.dataset.domain===domain));});
    if(visible()&&domain!=='sentence'){
      if(summaryDirty&&!loading)load();
      if((tab==='sent'||tab==='wrong'&&summary&&summary.domains.some(function(item){return item.source==='vocabulary-book'&&item.errorsRecorded;}))&&phase==='ready'&&eventsDirty&&!eventsLoading&&eventsPhase!=='error')loadEvents();
    }
    var panel=document.getElementById('statsVocabulary');if(!panel)return;
    var focused=document.activeElement,restoreFocus=panel.contains(focused),focusKey=restoreFocus&&focused.dataset.archiveFocus;
    try{
    if(owner!==currentOwner()){summary=null;events=null;phase='loading';refreshError=false;}
    var vocabularyOnly=domain==='vocabulary';
    var growth=document.getElementById('statsGrowth');if(growth)growth.hidden=tab!=='overview'||vocabularyOnly;
    var insights=document.getElementById('statsInsights');if(insights)insights.hidden=tab!=='overview'||vocabularyOnly;
    document.getElementById('statsContent').dataset.domain=domain;
    var sentenceHeading=document.getElementById('statsSentenceHeading');if(sentenceHeading)sentenceHeading.hidden=tab==='overview'||tab==='sent'||tab==='wrong'||vocabularyOnly;
    var sentenceHeader=document.getElementById('statsSentenceHeader');if(sentenceHeader)sentenceHeader.hidden=tab==='overview'||tab==='sent'||tab==='wrong'||vocabularyOnly;
    document.getElementById('statsCards').hidden=true;
    var trend=document.getElementById('statsTrend');
    if(trend){
      trend.hidden=tab!=='overview';
      var sentenceGroup=trend.querySelector('.review-sentence-group');
      if(sentenceGroup)sentenceGroup.hidden=vocabularyOnly;
      var grid=trend.querySelector('.review-domain-grid');
      var previousWords=grid&&grid.querySelector('.review-word-group');if(previousWords)previousWords.remove();
      if(grid&&tab==='overview'&&domain!=='sentence'){
        var words=node('section',null,'review-word-group');words.setAttribute('aria-label','单词复习');words.append(node('h4','单词复习'));
        reviewLauncher(words);grid.append(words);
      }
    }
    document.getElementById('statsBody').hidden=vocabularyOnly;
    document.getElementById('statsRecordToolbar').hidden=tab!=='sent'||vocabularyOnly;
    panel.replaceChildren();panel.hidden=tab==='overview'||domain==='sentence';
    if(panel.hidden)return;
    panel.append(node('h3',tab==='sent'?'单词学习记录':tab==='review'?'单词待复习':tab==='wrong'?'单词错题记录':'学习进展 · 单词'));
    if(refreshError)panel.append(status('更新失败，显示上次记录',true));
    if(phase!=='ready'){
      panel.append(status(phase==='loading'?'加载中…':phase==='guest'?'登录后查看':'加载失败',phase==='error'));
      return;
    }
    if(tab==='wrong'&&!summary.domains.some(function(item){return item.source==='vocabulary-book'&&item.errorsRecorded;})) {panel.append(node('p','尚未保存完整答错历史，暂不能统计。','muted'));return;}
    if(tab==='wrong'){
      var wordBook=summary.domains.find(function(item){return item.source==='vocabulary-book';});
      var frequent=wordBook&&wordBook.frequentErrors||[];
      var ranking=node('section',null,'word-wrong-ranking');ranking.append(node('h4','常错单词'));
      if(!frequent.length)ranking.append(node('p','暂无可统计错答。','muted'));
      frequent.forEach(function(item){var row=node('div',null,'word-wrong-rank');row.append(node('span',item.title+(item.meaning?' · '+item.meaning:'')),node('strong',item.wrongAnswers+' 次'));ranking.append(row);});
      panel.append(ranking);
      var targeted=node('section',null,'archive-word-summary');targeted.append(node('h4','按词书和练习方式专项复习'));reviewLauncher(targeted);panel.append(targeted);
    }
    if(tab==='sent'||tab==='wrong'){
      if(tab==='wrong')panel.append(node('p','仅显示已记录错答。','muted'));
      if(!events){panel.append(status(eventsPhase==='error'?'加载失败':'加载中…',eventsPhase==='error'));return;}
      if(!events.items.length)panel.append(node('p',tab==='wrong'?'暂无已记录的错误提交。':'还没有单词学习记录。','muted'));
      var list=node('div',null,'archive-word-events');
      events.items.forEach(function(item){
        var row=node('div',null,'archive-word-event');
        var title=node('strong',(item.title||item.itemId)+(item.meaning?' · '+item.meaning:''));
        var practiceNames={'guided-expression':'中文引导句子','sentence-cloze':'句子填空','word-choice':'选词填空','chunk-order':'词序拼块','word-dictation':'单词听写','read-aloud':'跟读自报'};
        if(practiceNames[item.practiceType])row.append(node('span',practiceNames[item.practiceType],'muted'));
        row.append(title,node('span',item.outcome==='answer-incorrect'?'错误提交 · 非完成记录':item.outcome==='independent-recall'?'独立回忆 · 非应用测评':'辅助练习完成','muted'),
          node('time',new Date(item.at).toLocaleString('zh-CN'),'muted'));
        if(item.course){
          if(item.course.available&&item.course.title){var courseLink=node('a',(item.course.bookId.startsWith('draft:')?'草稿体验 · ':item.course.bookId.startsWith('personal-book:')?'我的课程 · ':'')+item.course.title);courseLink.href='wordbook-details.html?book='+encodeURIComponent(item.course.bookId);row.append(courseLink);}
          else row.append(node('span','课程暂不可用','muted'));
        }
        if(tab==='wrong'&&item.answers){var submitted=item.submittedText||(['word-choice','chunk-order'].includes(item.practiceType)?'原题内容暂不可用':Object.values(item.answers).map(function(value){return Array.isArray(value)?value.join(' / '):String(value);}).join(' / '));row.append(node('span','提交：'+submitted,'muted'));}
        list.append(row);
      });panel.append(list);
      if(events.nextOffset!==null)panel.append(button('加载更多记录',function(){loadMore();}));
      return;
    }
    summary.domains.forEach(function(item){
      var section=node('section',null,'archive-word-summary');
      section.append(node('h4',item.source==='vocabulary-book'?'单词本学习':'历史场景词汇'));
      var line=item.dueItems===null?'请选择词书和练习方式查看专项状态':item.dueItems+' 项到期';
      section.append(node('p',line));
      if(item.source==='vocabulary-book')reviewLauncher(section);
      panel.append(section);
    });
    }finally{
      if(restoreFocus&&!panel.hidden){
        var nextFocus=Array.from(panel.querySelectorAll('[data-archive-focus]')).find(function(el){return el.dataset.archiveFocus===focusKey;})||panel.querySelector('h3');
        if(nextFocus){if(nextFocus.tagName==='H3')nextFocus.tabIndex=-1;nextFocus.focus({preventScroll:true});}
      }
    }
  }
  function refresh(){if(typeof global.renderStats==='function')global.renderStats();}
  function load(){
    resetScope();
    if(!visible()||domain==='sentence'){summaryDirty=true;return Promise.resolve();}
    if(loading&&owner===currentOwner())return flight;
    var requestOwner=owner, id=generation;
    summaryDirty=false;loading=true;
    refreshError=false;
    if(!summary)phase='loading';
    var api=global.ChunkAPI;
    try {if(!api||!api.isLoggedIn()){summary=null;events=null;phase='guest';loading=false;refresh();return Promise.resolve();}}
    catch(error){phase='error';loading=false;refresh();return Promise.resolve();}
    flight=api.request('/api/learning-archive/vocabulary/summary')
      .then(function(result){if(id!==generation||requestOwner!==currentOwner())return;
        if(!result.confirmed||!Array.isArray(result.domains))throw new Error('Unconfirmed archive');
        summary=result;phase='ready';
      }).catch(function(){if(id===generation&&requestOwner===currentOwner()){refreshError=!!summary;phase=refreshError?'ready':'error';}})
      .finally(function(){if(id===generation){loading=false;refresh();}});
    return flight;
  }
  function loadEvents(){
    resetScope();if(!visible()||domain==='sentence'||!['sent','wrong'].includes(activeTab))return Promise.resolve();
    if(eventsLoading)return eventsFlight;
    var requestOwner=owner,id=generation,eventId=++eventsGeneration;eventsLoading=true;eventsDirty=false;eventsPhase='loading';
    eventsFlight=global.ChunkAPI.request('/api/learning-archive/vocabulary/'+(eventsTab==='wrong'?'attempts?incorrect=true&':'events?')+'limit=20').then(function(result){
      if(id!==generation||eventId!==eventsGeneration||requestOwner!==currentOwner())return;
      if(!result.confirmed||!Array.isArray(result.items))throw Error('Unconfirmed archive');
      events=result;eventsPhase='ready';
    }).catch(function(){if(id===generation&&eventId===eventsGeneration&&requestOwner===currentOwner()){eventsPhase='error';refreshError=true;}})
      .finally(function(){if(id===generation&&eventId===eventsGeneration){eventsLoading=false;refresh();}});
    return eventsFlight;
  }
  function invalidate(event){
    resetScope();
    if(event&&event.detail&&event.detail.owner&&global.AccountStorage&&event.detail.owner!==global.AccountStorage.owner)return;
    summaryDirty=true;eventsDirty=true;eventsPhase='idle';
    if(visible())return load();
  }
  function resume(){resetScope();if(visible()){if(summaryDirty)load();else refresh();}}
  function loadMore(){
    if(eventsLoading||!events||events.nextOffset===null||!visible())return;
    var requestOwner=owner,id=generation,eventId=++eventsGeneration;eventsLoading=true;
    global.ChunkAPI.request('/api/learning-archive/vocabulary/'+(eventsTab==='wrong'?'attempts?incorrect=true&':'events?')+'limit=20&offset='+events.nextOffset).then(function(result){
      if(id!==generation||eventId!==eventsGeneration||requestOwner!==currentOwner())return;
      if(!result.confirmed||!Array.isArray(result.items))throw new Error('Unconfirmed archive');
      var seen=new Set(events.items.map(function(row){return row.id;}));
      events.items=events.items.concat(result.items.filter(function(row){return !seen.has(row.id);}));events.nextOffset=result.nextOffset;
    }).catch(function(){if(eventId===eventsGeneration&&requestOwner===currentOwner()){refreshError=true;}}).finally(function(){if(id===generation&&eventId===eventsGeneration){eventsLoading=false;refresh();}});
  }
  global.StatsVocabulary={render:render,load:function(){eventsPhase='idle';eventsDirty=true;return load();},whenReady:function(){return Promise.all([flight,eventsFlight]);},initialLoading:function(){return !summary&&phase==='loading';},mountDailyReviewLauncher:function(container){reviewLauncher(container,true);}};
  document.getElementById('statsDomains').addEventListener('click',function(event){
    var target=event.target.closest('[data-domain]');if(!target)return;
    selectedDomain=target.dataset.domain;
    domain=activeTab==='overview'?'all':selectedDomain;
    Array.from(this.children).forEach(function(el){el.setAttribute('aria-selected',String(el===target));});refresh();
  });
  global.addEventListener('cloud-config-changed',invalidate);
  global.addEventListener('server-cache-applied',invalidate);
  global.addEventListener('focus',invalidate);
  global.addEventListener('stats-surface-visibility',resume);
  if(global.document&&global.document.addEventListener)global.document.addEventListener('visibilitychange',resume);
  load();
})(window);
