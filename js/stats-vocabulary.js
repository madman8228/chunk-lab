(function(global){
  'use strict';
  var domain='sentence', selectedDomain='sentence', summary=null, events=null, phase='loading', generation=0, loading=false;
  var owner=null, flight=null, refreshError=false;
  var summaryDirty=true, eventsDirty=true, eventsLoading=false, eventsFlight=null, eventsPhase='idle', activeTab='overview';
  var eventsTab='sent',eventsGeneration=0;
  function currentOwner(){var account=global.AccountStorage,api=global.ChunkAPI;return JSON.stringify([account&&account.owner,account&&account.sessionEpoch,api&&api.getBase?api.getBase():'']);}
  function visible(){return typeof statsSurfaceVisible==='function'?statsSurfaceVisible():document.visibilityState!=='hidden';}
  function resetScope(){if(owner===currentOwner())return;owner=currentOwner();generation++;summary=null;events=null;loading=false;eventsLoading=false;flight=null;eventsFlight=null;phase='loading';eventsPhase='idle';summaryDirty=true;eventsDirty=true;refreshError=false;}
  function node(tag,text,className){var el=document.createElement(tag);if(text!=null)el.textContent=text;if(className)el.className=className;return el;}
  function button(text,fn){var el=node('button',text,'btn');el.type='button';el.dataset.archiveFocus=text;el.onclick=fn;return el;}
  function status(text,retry){var row=node('div',null,'archive-word-status');row.setAttribute('role','status');row.append(node('span',text,'muted'));if(retry){var action=button('重试',function(){eventsPhase='idle';eventsDirty=true;load();});action.className='archive-word-retry';row.append(action);}return row;}
  function render(tab){
    activeTab=tab;resetScope();
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
        var book=phase==='ready'&&summary&&summary.domains.find(function(item){return item.source==='vocabulary-book';});
        var due=book&&typeof book.dueItems==='number'&&Number.isFinite(book.dueItems)&&book.dueItems>=0?book.dueItems:null;
        var words=node('section',null,'review-word-group');words.setAttribute('aria-label','单词复习');words.append(node('h4','单词复习'));
        var list=node('div',null,'review-state-list');
        [['待复习',due],['逾期',null],['需巩固',null]].forEach(function(item){
          var row=node('div',null,'review-state-readonly');row.append(node('span',item[0]));
          if(item[1]!==null)row.append(node('strong',String(item[1])),node('span','项','review-state-unit'));
          else row.append(node('span',phase==='loading'?'读取中':phase==='guest'?'登录后查看':phase==='error'?'未确认':'暂无统计','review-state-unavailable'));
          list.append(row);
        });
        words.append(list);grid.append(words);
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
      var line=item.dueItems===null?'到期信息尚未接入':item.dueItems+' 项到期';
      section.append(node('p',line));
      section.append(node('p','到期信息供查看；指定词复习入口尚未接入。','muted'));
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
  global.StatsVocabulary={render:render,load:function(){eventsPhase='idle';eventsDirty=true;return load();},whenReady:function(){return Promise.all([flight,eventsFlight]);},initialLoading:function(){return !summary&&phase==='loading';}};
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
