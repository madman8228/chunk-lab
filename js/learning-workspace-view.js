(function(global){
  'use strict';
  var presentations=new WeakMap();
  function createDiscoverFilterPanel(tabs,filters){
    var panel=element('section',undefined,'discover-filter-panel');panel.setAttribute('aria-label','课程分类筛选');
    var toolbar=element('div',undefined,'discover-toolbar');toolbar.append(tabs);panel.append(toolbar);
    if(filters.childElementCount)panel.append(filters);
    return panel;
  }
  function createDiscoverSearch(value,onSearch){
    var node=element('form',undefined,'discover-searchbar');node.setAttribute('role','search');node.setAttribute('autocomplete','off');
    var icon=element('span',undefined,'discover-input-icon');icon.setAttribute('aria-hidden','true');
    icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';
    var terms=['人教版七年级','中考词汇','新概念第一册','高考词汇'];
    var input=element('input');input.type='search';input.name='course-search';input.autocomplete='off';input.value=value;input.placeholder=terms[0];input.setAttribute('aria-label','搜索教材、词单或课程');input.setAttribute('data-focus-key','discover-search');
    var composing=false,lastValue=value,index=0,timer=null;
    function apply(){if(composing||input.value===lastValue)return;lastValue=input.value;onSearch(input.value);}
    node.addEventListener('submit',function(event){event.preventDefault();apply();});
    input.addEventListener('compositionstart',function(){composing=true;});
    input.addEventListener('compositionend',function(){composing=false;apply();});
    input.addEventListener('input',apply);
    input.addEventListener('keydown',function(event){if(event.key==='Enter'&&!event.isComposing){event.preventDefault();apply();}});
    var submit=button('搜索',apply);submit.className='discover-search-submit';node.append(icon,input,submit);
    if(!global.matchMedia('(prefers-reduced-motion: reduce)').matches)timer=setInterval(function(){
      if(!input.isConnected||input.value||document.activeElement===input||document.hidden)return;
      index=(index+1)%terms.length;input.placeholder=terms[index];
    },3200);
    return {node:node,dispose:function(){if(timer!==null){clearInterval(timer);timer=null;}}};
  }
  function element(tag, text, className){
    var node=document.createElement(tag);
    if(text!==undefined) node.textContent=text;
    if(className) node.className=className;
    return node;
  }
  function button(text, action){var node=element('button',text);node.type='button';node.onclick=action;return node;}
  function notice(root, text, actions, presentation){
    var scope=JSON.stringify([global.AccountStorage&&global.AccountStorage.owner,global.ChunkAPI&&global.ChunkAPI.getBase(),global.ChunkAPI&&global.ChunkAPI.getToken()]);
    var key=JSON.stringify([scope,text||'']);
    if(presentation.noticeKey!==key){presentation.noticeKey=key;presentation.noticeDismissed=false;presentation.notice=null;}
    var rail=document.getElementById('noticeBannerRail');
    if(!text||text==='已保存'||presentation.noticeDismissed){if(rail)rail.replaceChildren();return;}
    if(!presentation.notice){
      var readFailure=/内容目录(?:连接失败|读取失败)|个人记录尚未确认|目录服务尚未就绪|个人单词本(?:尚未读取成功|读取失败)|学习内容未完整加载|学习记录未确认|部分内容未能读取|内容暂时无法加载|正在显示已缓存内容/.test(text);
      presentation.notice=global.NoticeBanner.create({message:text,actionLabel:'重试',
        onAction:readFailure?function(){presentation.noticeRetry();}:null,
        onDismiss:function(){presentation.noticeDismissed=true;}
      });
      presentation.notice.classList.add('workspace-notice');
    }
    presentation.noticeRetry=actions.retry;
    if(rail)rail.replaceChildren(presentation.notice);
  }
  function fuzzyMatch(text, query){
    var needle=String(query||'').normalize('NFKC').toLowerCase().trim().replace(/\s+/g,'');
    if(!needle)return true;
    var haystack=String(text||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
    if(haystack.includes(needle))return true;
    var cursor=0;
    for(var character of needle){cursor=haystack.indexOf(character,cursor);if(cursor<0)return false;cursor+=character.length;}
    return true;
  }
  function render(container, data, actions){
    var presentation=presentations.get(container);
    if(!presentation){
      presentation={composing:false,pending:null};presentations.set(container,presentation);
      function flush(){Promise.resolve().then(function(){var pending=presentation.pending;if(pending&&!presentation.composing&&!container.querySelector('dialog[open]')){presentation.pending=null;if(pending.route===location.search)render(container,pending.data,pending.actions);}});}
      container.addEventListener('compositionstart',function(){presentation.composing=true;},true);
      container.addEventListener('compositionend',function(){presentation.composing=false;flush();},true);
      container.addEventListener('close',flush,true);
    }
    var existing=container.querySelector('.learning-workspace');
    if(data.loading||existing&&existing.dataset.route!==location.search)presentation.composing=false;
    if(existing&&existing.dataset.route===location.search&&(presentation.composing||container.querySelector('dialog[open]'))){presentation.pending={data:data,actions:actions,route:location.search};return;}
    presentation.pending=null;
    if(data.loading&&existing&&existing.getAttribute('aria-busy')==='true'&&existing.dataset.route===location.search)return;
    if(presentation.search){presentation.search.dispose();presentation.search=null;}
    var model=global.LearningWorkspace;
    var root=element('div',undefined,'learning-workspace'+(data.view==='home'?' workspace-home':data.view==='my-learning'?' workspace-home workspace-library':' workspace-discover'));
    var focused=container.contains(document.activeElement)&&document.activeElement.getAttribute('data-focus-key');
    var focusedInput=focused&&typeof document.activeElement.selectionStart==='number'?{start:document.activeElement.selectionStart,end:document.activeElement.selectionEnd,direction:document.activeElement.selectionDirection}:null;
    var previousRoot=container.querySelector('.learning-workspace');
    var completedExpanded=!!(container.querySelector('.home-completed-courses[open]'));
    var openCardMenu=previousRoot&&previousRoot.dataset.route===location.search?global.ContentCard.captureMenu(container):null;
    var previousSearch=container.querySelector('.library-search-input,.discover-searchbar input[type=search]');
    var searchDraft=previousRoot&&previousRoot.dataset.route===location.search&&previousSearch?previousSearch.value:null;
    root.dataset.route=location.search;
    var nav=global.LearningNavigation.mount(data.view,actions.navigate);
    if(!document.getElementById('workspaceNavHost'))root.append(nav);
    var heading=element('header',undefined,'workspace-heading');
    if(data.view!=='home')root.append(heading);
    if(data.loading){
      root.setAttribute('aria-busy','true');
      notice(root,'正在读取学习内容…',actions,presentation);
      container.replaceChildren(root);return;
    }
    // The home surface uses its confirmed/local course view, not discovery transport status.
    var visibleStatus=data.view==='home'?String(data.status||'').replace('内容目录连接失败，保留最近可读内容。','').trim():data.status;
    notice(root,visibleStatus,actions,presentation);
    function completionFor(resource){
      var book=(resource.sourceRefs||[]).find(function(ref){return ref.type==='vocabulary-book';});
      if(book)return !data.completionReadFailed&&data.vocabularyCourses&&data.vocabularyCourses[book.id]||{state:'unknown'};
      return data.courseCompletion&&data.courseCompletion[resource.courseId]||{state:'unknown'};
    }
    function card(resource){
      function discoverMenuItem(label,iconName,action,status){
        var item=button('',action),icon=element('span',undefined,'content-card-menu-icon'),text=element('span',label,'content-card-menu-label');
        item.className='content-card-menu-item';if(global.Icons)icon.innerHTML=global.Icons.svg(iconName);item.append(icon,text);
        if(status){item.disabled=true;item.title=status;item.setAttribute('aria-label',label+'，'+status);item.append(element('span',status,'content-card-menu-status'));}
        return item;
      }
      var library=data.view==='my-learning', refs=resource.sourceRefs||[];
      var completion=completionFor(resource);
      var preferences=data.preferences||{},savedId=resource.savedTargetId||resource.resourceId;
      var saved=Object.values(preferences).find(function(row){return row.itemType==='resource'&&row.targetId===savedId;});
      var joined=!!(data.memberships&&data.memberships[resource.courseId]&&data.memberships[resource.courseId].joined);
      var book=refs.find(function(ref){return ref.type==='vocabulary-book';}),personalCourse=refs.find(function(ref){return ref.type==='personal-course';}),expressionCourse=refs.find(function(ref){return ref.type==='expression-course';}),href='',items=[],additionalMenuItems=[];
      var isDiscoverCourse=!library&&!!resource.courseId&&!personalCourse;
      if(resource.available){
        if(book)href=CourseReturn.forward('wordbook-details.html?book='+encodeURIComponent(book.id),CourseReturn.source());
        else if(personalCourse)href=CourseReturn.forward('main.html?personalCourse='+encodeURIComponent(personalCourse.id),CourseReturn.source());
        else if(expressionCourse)href=CourseReturn.forward('expression-learn.html?course='+encodeURIComponent(expressionCourse.id),CourseReturn.source());
        else if(resource.courseId)href=CourseReturn.forward('decks.html?courseView='+(library&&(resource.visibility==='private'||joined)?'joined':'discover')+'&course='+encodeURIComponent(resource.courseId)+'&returnView='+(library?'my-learning':'discover'),CourseReturn.source());
        if(library){var protectedRef=refs.find(function(ref){return ref.type==='protected-course';});if(protectedRef)href='main.html?protectedCourse='+encodeURIComponent(protectedRef.id);}
      }
      if(library&&href){
        var manage;
        if(expressionCourse){manage=button(joined?'打开表达课程':'加入并开始学习',function(){actions.open(resource);});manage.className='library-primary';}
        else{manage=element('a',book?'打开单词本':personalCourse?'打开课程':'查看课节','library-primary');manage.href=href;}
        manage.setAttribute('data-focus-key',resource.resourceId+':manage');items.push(manage);
        if(completion.state==='completed'){var recordsLink=element('a','学习记录');recordsLink.href='stats.html';items.push(recordsLink);}
      }
      if(!library||saved&&saved.selected){
        var save=button(saved&&saved.selected?'取消收藏':'收藏',function(){actions.select('resource',savedId,!(saved&&saved.selected));});
        save.disabled=!!(saved&&saved.pending);save.setAttribute('data-focus-key',resource.resourceId+':save');items.push(save);
      }
      var launch=null,joinAction=null;
      if(resource.available&&isDiscoverCourse){
        joinAction=button(joined?'已加入练习':'加入练习',function(){joinAction.disabled=true;joinAction.textContent='加入中…';actions.join(resource).catch(function(error){alert(error.message||'加入练习失败，请重试。');}).finally(function(){if(joinAction.isConnected){joinAction.disabled=false;joinAction.textContent='加入练习';}});});
        joinAction.disabled=joined;joinAction.setAttribute('data-focus-key',resource.resourceId+':join');items.push(joinAction);
      }else if(resource.available){
        var resume=book&&data.vocabularyResumes&&data.vocabularyResumes[book.id];
        var label=completion.state==='completed'?'再次学习':book?(resume&&resume.status==='active'?'继续练习':'开始练习'):personalCourse?'开始学习':joined?(library?'直接进入学习':'继续学习'):'加入学习';
        launch=button(label,function(){actions.open(resource,{restart:completion.state==='completed',join:!joined});});launch.setAttribute('data-focus-key',resource.resourceId+':learn');items.push(launch);
        if(library&&joined)items.push(button('退出在学',function(){
          if(!global.confirm('退出在学？课程和已有学习记录会保留。'))return;
          actions.leave(resource.courseId).catch(function(error){alert(error.message);});
        }));
      }
      if(saved&&saved.pending){var pending=element('span','待保存');pending.setAttribute('role','status');items.push(pending);}
      if(!library){
        var canEnter=resource.available&&(joined||joinAction||launch);
        additionalMenuItems=[
          discoverMenuItem(joined?'继续学习':'加入学习','plus',joined?function(){actions.open(resource,{join:false});}:canEnter?function(){(joinAction||launch).click();}:null,canEnter?'':'暂不可用'),
          discoverMenuItem(saved&&saved.selected?'取消收藏资源':'收藏资源','heart',function(){save.click();}),
          discoverMenuItem('分享给同学','plane',null,'暂未开放'),
          discoverMenuItem('不感兴趣','close',null,'暂未开放')
        ];
        if(!canEnter)additionalMenuItems[0].disabled=true;
        if(saved&&saved.pending)additionalMenuItems[1].disabled=true;
      }
      var activities=resource.activities||[],kindKey=!resource.available?'unavailable':activities.includes('vocabulary')?'word':activities.includes('expression')?'oral':'sentence';
      var result=global.ContentCard.create({resource:resource,variant:library?'library':'discover',href:href,
        primaryAction:!library?(joinAction||launch):null,saveAction:!library?save:null,saved:!!(saved&&saved.selected),
        additionalMenuItems:additionalMenuItems,
        onActivate:isDiscoverCourse?function(){actions.open(resource,{join:expressionCourse?false:!joined});}:null,
        metadata:!library?(function(){var parts=[];if(resource.curriculum){var trackLabels={scenario:'情景表达', 'sentence-building':'组装句子', pronunciation:'音标发音', phonics:'自然拼读'};parts.push(trackLabels[resource.curriculum.track]+' · '+resource.curriculum.stage);if(resource.curriculum.status==='candidate')parts.push('待核对旧课程映射');}if(book){if(Number.isSafeInteger(resource.unitCount))parts.push(resource.unitCount+' 个单元');if(Number.isSafeInteger(resource.itemCount))parts.push(resource.itemCount+' 个单词');return parts.join(' · ');}var course=(data.catalog&&data.catalog.courses||[]).find(function(item){return item.id===resource.courseId;});if(Number.isSafeInteger(resource.unitCount))parts.push(resource.unitCount+' 课节');if(course&&course.itemCount)parts.push(course.itemCount+(kindKey==='word'?' 词':' 条内容'));return parts.join(' · ');})():'',
        linkLabel:(library?'打开内容：':'查看 ')+resource.title,
        kindLabel:resource.available?(activities.includes('vocabulary')?'单词':activities.includes('expression')?'表达':'句子'):'暂不可用',kindKey:kindKey,items:items});
      if(library&&['completed','updated'].includes(completion.state))result.querySelector('.content-card-copy').append(element('span',completion.state==='completed'?'已学完':'曾学完 · 有新内容待补学','library-completion-label'));
      return result;
    }
    function section(title,resources){var area=element('section',undefined,'workspace-section');if(title)area.append(element('h2',title));else area.setAttribute('aria-label','内容结果');
      var grid=element('div',undefined,'workspace-grid');resources.forEach(function(resource){grid.append(card(resource));});area.append(grid);root.append(area);return area;}
    if(data.view==='discover'){
      var selection=model.selectionFromUrl(location.search);
      var intro=element('section',undefined,'discover-intro workspace-page-intro');
      intro.append(element('h1','教材同步、词单与口语课，一站找到'));
      var introTitle=intro.querySelector('h1');introTitle.replaceChildren(document.createTextNode('教材同步、词单与口语课，'),element('span','一站找到','discover-title-accent'));
      root.insertBefore(intro,root.firstChild);
      var tabs=element('div',undefined,'workspace-tabs');
      tabs.setAttribute('role','group');tabs.setAttribute('aria-label','内容分类');
      function chooseCategory(kind,category){var patch={kind:kind,category:category,practicalTopic:'',wordbookCategory:'',track:'',stage:''};Object.keys(model.FACET_LABELS).forEach(function(key){patch[key]=[];});actions.filter(patch);}
      [['','全部',''],['','零基础','beginner'],['','实用英语','practical'],['wordbook','单词本',''],['','新概念','new-concept'],['','中小学同步','school']].forEach(function(item){var tab=button(item[1],function(){chooseCategory(item[0],item[2]);});tab.setAttribute('aria-pressed',selection.category===item[2]&&selection.kind===item[0]);tab.setAttribute('data-focus-key','discover-category-'+(item[2]||item[0]||'all'));tabs.append(tab);});root.append(tabs);
      var filters=element('div',undefined,'workspace-filter discover-filter');
      var countKinds=[['',''],['','beginner'],['','practical'],['wordbook',''],['','new-concept'],['','school']];
      Array.from(tabs.children).forEach(function(tab,index){var countSelection=Object.assign({},selection,{kind:countKinds[index][0],category:countKinds[index][1],practicalTopic:'',wordbookCategory:'',query:'',track:'',stage:''});Object.keys(model.FACET_LABELS).forEach(function(key){countSelection[key]=[];});var count=model.filterResources(data.publicResources||[],countSelection).length;var badge=element('span',String(count),'discover-tab-count');badge.setAttribute('aria-label',count+' 项资源');tab.append(badge);});
      presentation.search=createDiscoverSearch(searchDraft===null?selection.query:searchDraft,function(query){actions.filter({q:query},false,'discover',true);});
      intro.append(presentation.search.node);
      if(!heading.childElementCount)heading.remove();
      if(selection.kind==='wordbook'&&!selection.category){
        var wordbookTabs=element('div',undefined,'discover-text-tabs');wordbookTabs.setAttribute('role','group');wordbookTabs.setAttribute('aria-label','单词本分类');
        [['','全部']].concat(Object.entries(model.WORDBOOK_CATEGORIES)).forEach(function(item){var tab=button(item[1],function(){actions.filter({wordbookCategory:item[0]});});tab.setAttribute('aria-pressed',selection.wordbookCategory===item[0]);tab.setAttribute('data-focus-key','discover-wordbook-'+(item[0]||'all'));wordbookTabs.append(tab);});filters.append(wordbookTabs);root.append(filters);
      }
      if(selection.category==='practical'){
        var topics=element('div',undefined,'discover-text-tabs');topics.setAttribute('role','group');topics.setAttribute('aria-label','实用英语分类');
        [['','全部']].concat(Object.entries(model.PRACTICAL_TOPICS)).forEach(function(item){var tab=button(item[1],function(){actions.filter({practicalTopic:item[0]});});tab.setAttribute('aria-pressed',selection.practicalTopic===item[0]);tab.setAttribute('data-focus-key','discover-practical-'+(item[0]||'all'));topics.append(tab);});filters.append(topics);root.append(filters);
      }
      if(selection.category==='beginner'){
        var beginnerFilters=element('div',undefined,'discover-text-tabs');beginnerFilters.setAttribute('role','group');beginnerFilters.setAttribute('aria-label','零基础课程路线与阶段筛选');
        var routeChoices=[['','全部路线'],['scenario','情景表达'],['sentence-building','组装句子'],['pronunciation','音标发音'],['phonics','自然拼读']];
        routeChoices.forEach(function(item){var tab=button(item[1],function(){actions.filter({track:item[0],stage:''});});tab.setAttribute('aria-pressed',selection.track===item[0]);beginnerFilters.append(tab);});
        var stageChoices=[['','全部阶段'],['S0','入门'],['S1','基础'],['S2','进阶'],['S3','拓展'],['S4','应用']];
        stageChoices.forEach(function(item){var tab=button(item[1],function(){actions.filter({stage:item[0]});});tab.setAttribute('aria-pressed',selection.stage===item[0]);beginnerFilters.append(tab);});
        filters.append(beginnerFilters);root.append(filters);
      }
      if(selection.category==='school'){
        function filterRow(label,key,choices,allLabel){
          var row=element('div',undefined,'discover-text-tabs');row.setAttribute('role','group');row.setAttribute('aria-label',label);
          row.append(element('span',label,'discover-facet-label'));
          (key==='schoolStages'?choices:[''].concat(choices)).forEach(function(value){var tab=button(value||(allLabel||'全部'+label),function(){var patch={};patch[key]=value?[value]:[];if(key==='schoolStages')patch.grades=[];actions.filter(patch);});tab.setAttribute('aria-pressed',value?selection[key].includes(value):!selection[key].length);tab.setAttribute('data-focus-key','discover-'+key+'-'+(value||'all'));row.append(tab);});filters.append(row);
        }
        filterRow('学段','schoolStages',['小学','初中','高中'],'全部');
        var gradesByStage={'小学':['一年级','二年级','三年级','四年级','五年级','六年级'],'初中':['七年级','八年级','九年级'],'高中':['高一','高二','高三']};
        if(gradesByStage[selection.schoolStages[0]])filterRow('年级','grades',gradesByStage[selection.schoolStages[0]],'全部');
        root.append(filters);
      }
      if(selection.category==='new-concept'){
        var volumes=element('div',undefined,'discover-text-tabs');volumes.setAttribute('role','group');volumes.setAttribute('aria-label','新概念册次');
        ['','第一册','第二册','第三册','第四册'].forEach(function(value){var tab=button(value||'全部',function(){actions.filter({volume:value?[value]:[]});});tab.setAttribute('aria-pressed',value?selection.volume.includes(value):!selection.volume.length);tab.setAttribute('data-focus-key','discover-volume-'+(value||'all'));volumes.append(tab);});filters.append(volumes);root.append(filters);
      }
      var results=model.filterResources(data.publicResources||[],selection);
      root.append(createDiscoverFilterPanel(tabs,filters));
      var resultBar=element('div',undefined,'discover-result-toolbar'),resultCount=element('p','共 '+results.length+' 项资源','discover-result-count'),resultActions=element('div',undefined,'discover-result-actions');resultBar.append(resultCount,resultActions);root.append(resultBar);
      if(selection.kind==='wordbook'){var createBook=element('a','添加单词本','discover-create-book');createBook.href='wordbook-create.html';resultActions.append(createBook);}
      var sorting=element('div',undefined,'discover-sort');sorting.setAttribute('role','group');sorting.setAttribute('aria-label','资源排序');
      ['推荐','最热门','最新'].forEach(function(label,index){var option=button(label,function(){});option.setAttribute('aria-pressed',String(index===0));if(index){option.disabled=true;option.title=index===1?'暂无热度统计，暂不可用':'暂无上架时间，暂不可用';}sorting.append(option);});resultActions.append(sorting);
      var layout=element('div',undefined,'discover-layout');layout.setAttribute('role','group');layout.setAttribute('aria-label','资源显示方式');
      ['网格','列表'].forEach(function(label,index){var option=button('',function(){root.classList.toggle('discover-list-mode',index===1);layout.querySelectorAll('button').forEach(function(item){item.setAttribute('aria-pressed',String(item===option));});});option.setAttribute('aria-label',label+'显示');option.title=label+'显示';option.setAttribute('aria-pressed',String(index===0));option.innerHTML=index===0?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M3 6h1M3 12h1M3 18h1"/></svg>';layout.append(option);});resultActions.append(layout);
      if(selection.kind==='textbook')model.groupTextbooks(results).forEach(function(group){section(group[0].facets.seriesId||group[0].title,group);});
      else section('',results);
      if(!results.length)root.append(element('p','没有找到相关内容，试试更短的关键词。','workspace-status'));
    }else if(data.view==='my-learning'){
      var uniqueResources=Array.from(new Map((data.resources||[]).map(function(row){return [row.resourceId,row];})).values());
      var savedResources=model.collectPersonalResources(uniqueResources,data.preferences||{},data.aliases||{});
      var personal=new Map();
      uniqueResources.filter(function(row){return row.visibility==='private'||['completed','updated'].includes(completionFor(row).state)||data.memberships&&data.memberships[row.courseId]&&data.memberships[row.courseId].joined;}).concat(savedResources).forEach(function(row){personal.set(row.resourceId,row);});
      var owned=Array.from(personal.values());
      var parameters=new URLSearchParams(location.search), libraryCategory=['all','active','completed','saved'].includes(parameters.get('contentStatus'))?parameters.get('contentStatus'):'all';
      var query=parameters.get('contentQuery')||'';
      var groups={all:owned,active:owned.filter(function(row){return completionFor(row).state!=='completed'&&((row.sourceRefs||[]).some(function(ref){return ref.type==='personal-course';})||data.memberships&&data.memberships[row.courseId]&&data.memberships[row.courseId].joined);}),completed:owned.filter(function(row){return completionFor(row).state==='completed';}),saved:Array.from(new Map(savedResources.map(function(row){return [row.resourceId,row];})).values())};
      var courseRows=data.courseRows||(data.activeResources||[]).map(function(resource){return {course:{id:resource.courseId,title:resource.title},lessons:[],resource:resource,progress:'',progressMarkup:''};});
      var vocabularyResources=owned.filter(function(resource){return (resource.activities||[]).includes('vocabulary')||(resource.sourceRefs||[]).some(function(ref){return ref.type==='vocabulary-book';});});
      var sentenceResources=owned.filter(function(resource){return (resource.activities||[]).some(function(activity){return activity==='chunks'||activity==='sentence'||activity==='expression';});});
      var activity=data.homeActivity||{},streak=Math.max(0,Number(activity.streak)||0),due=Math.max(0,Number(data.due)||0);
      var dashboard=element('div',undefined,'my-learning-dashboard');
      var intro=element('section',undefined,'my-learning-intro workspace-page-intro');
      var introCopy=element('div',undefined,'my-learning-intro-copy');
      introCopy.append(element('h1','早上好，继续前进'));
      var introStats=element('div',undefined,'my-learning-intro-stats');
      [['fire','连续 '+streak+' 天','my-learning-stat is-streak'],['target','待复习 '+due+' 条','my-learning-stat']].forEach(function(item){
        var badge=element('a',undefined,item[2]);badge.href='main.html?view=stats'+(item[0]==='fire'?'':'&tab=review');
        var icon=element('span',undefined,'my-learning-stat-icon');icon.setAttribute('aria-hidden','true');if(global.Icons)icon.innerHTML=global.Icons.svg(item[0]);
        badge.append(icon,element('strong',item[1]));introStats.append(badge);
      });
      intro.append(introCopy,introStats);dashboard.append(intro);

      var resume=data.resume||null;
      var resumeRow=resume&&resume.toolId==='chunks'&&resume.deck?courseRows.find(function(entry){return (entry.lessons||[]).some(function(lesson){return lesson.contentRef&&lesson.contentRef.type==='sentence-deck'&&lesson.contentRef.id===resume.deck.id;});}):null;
      var firstActive=courseRows.find(function(entry){return entry.completionState!=='completed'&&!entry.unavailable&&!entry.loadFailed;});
      var hero=element('section',undefined,'my-learning-resume');
      var resumeCopy=element('div',undefined,'my-learning-resume-copy');
      resumeCopy.append(element('span','继续上次学习','my-learning-resume-kicker'));
      resumeCopy.append(element('h2',resume?(resume.title||resume.deck&&resume.deck.name||'继续上次学习'):'准备好继续学习了吗？'));
      var resumeSummary=element('p');
      var currentCourse=resumeRow||firstActive;
      if(currentCourse){
        resumeSummary.append(element('strong',currentCourse.course.title||currentCourse.title));
        var courseMetric=document.createElement('div');courseMetric.innerHTML=currentCourse.homeProgressMarkup||'';
        var coursePercent=courseMetric.querySelector('.home-progress-label b');
        resumeSummary.append(document.createTextNode(' · '+(currentCourse.progress||'学习进度待确认')+(coursePercent?' · 已学习 '+coursePercent.textContent:'')));
      }else resumeSummary.textContent='选择一门课程或词单，开始今天的学习。';
      resumeCopy.append(resumeSummary);
      var resumeActions=element('div',undefined,'my-learning-resume-actions');
      var resumeButton=button(resume||firstActive?'继续学习':'去发现课程',function(){if(resume)actions.resume(resume);else if(firstActive){var resource=firstActive.resource||(data.resources||[]).find(function(item){return item.courseId===firstActive.course.id;})||model.resourcesFromCatalog({courses:[firstActive.course]})[0];if(resource)actions.open(resource);else actions.navigate('discover');}else actions.navigate('discover');});
      resumeButton.className='my-learning-resume-button';
      resumeButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"/></svg><span>'+((resume||firstActive)?'继续学习':'去发现课程')+'</span>';
      resumeActions.append(resumeButton);
      var reviewShortcut=element('a',undefined,'my-learning-review-link');reviewShortcut.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 7v5h-5M20 12a8 8 0 1 0-2 5"/></svg>';reviewShortcut.append(element('span','一键复习 '+due+' 条'));reviewShortcut.href='main.html?view=stats&tab=review';reviewShortcut.onclick=function(event){if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;if(global.openStatsPage){event.preventDefault();global.openStatsPage('review');}};resumeActions.append(reviewShortcut);
      resumeCopy.append(resumeActions);
      var resumeStats=element('div',undefined,'my-learning-resume-stats');
      [['连续打卡',streak,'天'],['在学课程',courseRows.filter(function(entry){return entry.completionState!=='completed';}).length,'门'],['待复习',due,'条']].forEach(function(item){var stat=element('div',undefined,'my-learning-resume-stat');var value=element('div',undefined,'my-learning-resume-value');value.append(element('strong',String(item[1])),element('small',item[2]));stat.append(value,element('span',item[0]));resumeStats.append(stat);});
      hero.append(resumeCopy,resumeStats);
      dashboard.append(hero);

      var courseArea=element('section',undefined,'my-learning-courses');
      var courseHeading=element('div',undefined,'my-learning-section-heading');
      var courseMark=element('span',undefined,'my-learning-course-mark');courseMark.setAttribute('aria-hidden','true');courseMark.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 3h12v18l-6-4-6 4V3Z"/></svg>';
      courseHeading.append(courseMark,element('h2','我的课程'),element('span',courseRows.length+' 门 · '+courseRows.filter(function(entry){return entry.completionState!=='completed';}).length+' 门在学'));
      var discoverCourses=element('a','去发现加课 ›');discoverCourses.href='main.html?view=discover';courseHeading.append(discoverCourses);
      courseArea.append(courseHeading);
      var courseGrid=element('div',undefined,'my-learning-course-grid');
      courseRows.slice(0,6).forEach(function(entry){
        var row=element('article',undefined,'my-learning-course');
        var resource=entry.resource||(data.resources||[]).find(function(item){return item.courseId===entry.course.id;})||model.resourcesFromCatalog({courses:[entry.course]})[0];
        var completed=entry.completionState==='completed',unavailable=!!(entry.unavailable||entry.loadFailed||!resource);
        var cover=element('span',undefined,'my-learning-course-cover');cover.setAttribute('aria-hidden','true');if(entry.coverMarkup)cover.innerHTML=entry.coverMarkup;
        var lastTime=Number(entry.lastStudiedAt||entry.lastOpenedAt)||0,lastTimeText='';
        if(lastTime>0){var lastDate=new Date(lastTime),todayDate=new Date(),lastDay=new Date(lastDate.getFullYear(),lastDate.getMonth(),lastDate.getDate()).getTime(),todayDay=new Date(todayDate.getFullYear(),todayDate.getMonth(),todayDate.getDate()).getTime();var daysAgo=Math.round((todayDay-lastDay)/86400000);var clock=lastDate.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});lastTimeText=(entry.lastStudiedAt?'':'上次打开 ')+(daysAgo===0?'今天 '+clock:daysAgo===1?'昨天 '+clock:lastDate.toLocaleDateString('zh-CN')+' '+clock);}
        var copy=element('div',undefined,'my-learning-course-copy');var courseTitle=element('h3',entry.course.title||entry.title);courseTitle.title=entry.course.title||entry.title;var courseMeta=element('p',(entry.progress||'学习进度待确认')+(lastTimeText?' · '+lastTimeText:''));courseMeta.title=courseMeta.textContent;copy.append(courseTitle,courseMeta);
        if(entry.homeProgressMarkup||entry.progressMarkup){var progress=element('div',undefined,'my-learning-course-progress');progress.innerHTML=entry.homeProgressMarkup||entry.progressMarkup;copy.append(progress);}
        var open=button(completed?'再次学习':'继续学习',function(){if(!resource)return;if(resumeRow===entry&&resume)actions.resume(resume);else actions.open(resource,{restart:completed});});
        open.className='my-learning-course-action';open.disabled=unavailable;open.setAttribute('aria-label',(completed?'再次学习 ':'继续学习 ')+(entry.title||entry.course.title));
        open.innerHTML=completed?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"/></svg>';
        row.append(cover,copy,open);
        if((entry.lessons||[]).length>1&&!unavailable){var lessons=element('a','选课节','my-learning-course-lessons');lessons.href='decks.html?courseView=joined&course='+encodeURIComponent(entry.course.id)+'&returnView=my-learning';lessons.setAttribute('aria-label','选择 '+(entry.title||entry.course.title)+' 的课节');row.append(lessons);}
        courseGrid.append(row);
      });
      if(!courseRows.length)courseGrid.append(element('p','还没有在学课程。可以从发现页选择课程开始。','my-learning-empty'));
      courseArea.append(courseGrid);dashboard.append(courseArea);

      var learningColumns=element('div',undefined,'my-learning-columns');
      function resourceList(title,items,kind,moreHref,emptyText){
        var panel=element('section',undefined,'my-learning-list-panel');
        var panelHeading=element('div',undefined,'my-learning-section-heading');panelHeading.append(element('h2',title));
        var more=element('a',kind==='vocabulary'?'词单记录':'句子记录');more.href=moreHref;panelHeading.append(more);panel.append(panelHeading);
        var list=element('div',undefined,'my-learning-list');
        items.slice(0,4).forEach(function(resource){
          var item=element('article',undefined,'my-learning-list-item');
          var ref=(resource.sourceRefs||[]).find(function(source){return source.type==='vocabulary-book';});
          var resumeState=ref&&data.vocabularyResumes&&data.vocabularyResumes[ref.id];
          var note=kind==='vocabulary'?(resumeState&&resumeState.status==='active'?'继续上次的单词学习':'已加入单词学习'):resource.description||'继续上次的句子学习';
          item.append(element('span',kind==='vocabulary'?'词':'句','my-learning-list-mark'),element('span',resource.title,'my-learning-list-title'),element('span',note,'my-learning-list-meta'));
          var open=button('继续',function(){actions.open(resource,{join:!(data.memberships&&data.memberships[resource.courseId]&&data.memberships[resource.courseId].joined)});});open.setAttribute('aria-label','继续学习 '+resource.title);item.append(open);list.append(item);
        });
        if(!items.length){list.append(element('p',emptyText,'my-learning-empty'));var discover=element('a',kind==='vocabulary'?'去发现词单':'去发现课程','my-learning-empty-link');discover.href=kind==='vocabulary'?'main.html?view=discover&kind=wordbook':'main.html?view=discover';list.append(discover);}
        panel.append(list);return panel;
      }
      learningColumns.append(resourceList('我的词单',vocabularyResources,'vocabulary','main.html?view=stats&tab=sent&domain=word','还没有可继续学习的词单。'),resourceList('句子跟读',sentenceResources,'sentence','main.html?view=stats&tab=sent&domain=sentence','加入句子课程后，学习进度会显示在这里。'));
      dashboard.append(learningColumns);

      var favorites=element('section',undefined,'my-learning-favorites');
      var favoritesHeading=element('div',undefined,'my-learning-section-heading');var favoriteMark=element('span',undefined,'my-learning-course-mark');favoriteMark.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';favoritesHeading.append(favoriteMark,element('h2','我的收藏'));
      favorites.append(favoritesHeading);
      var favoriteList=element('div',undefined,'my-learning-favorite-list');
      var favoriteTabs=element('div',undefined,'my-learning-favorite-tabs');favoriteTabs.setAttribute('role','group');favoriteTabs.setAttribute('aria-label','收藏类型');
      function favoriteKind(resource){return resource.kind==='sentence'?'sentence':resource.kind==='word'?'word':'course';}
      function renderFavorites(kind){favoriteList.replaceChildren();favoriteTabs.querySelectorAll('button').forEach(function(tab){tab.setAttribute('aria-pressed',String(tab.dataset.kind===kind));});var rows=savedResources.filter(function(resource){return kind==='all'||favoriteKind(resource)===kind;});rows.forEach(function(resource){var type=favoriteKind(resource),favorite=button('',function(){actions.open(resource,{join:!(data.memberships&&data.memberships[resource.courseId]&&data.memberships[resource.courseId].joined)});});favorite.className='my-learning-favorite';favorite.title=resource.title;var mark=element('span',type==='sentence'?'句':type==='word'?'词':'课','my-learning-favorite-icon is-'+type);mark.setAttribute('aria-hidden','true');favorite.append(mark,element('span',resource.title,'my-learning-favorite-title'));favorite.setAttribute('aria-label',({sentence:'句子',word:'单词',course:'课程'}[type])+'收藏：'+resource.title);favoriteList.append(favorite);});if(!rows.length)favoriteList.append(element('p',kind==='all'?'还没有收藏。':'暂无'+({sentence:'句子',word:'单词',course:'课程'}[kind])+'收藏。','my-learning-empty'));}
      [['all','全部'],['sentence','句子'],['word','单词'],['course','课程']].forEach(function(item){var tab=button(item[1],function(){renderFavorites(item[0]);});tab.dataset.kind=item[0];favoriteTabs.append(tab);});favoritesHeading.append(favoriteTabs);renderFavorites('all');
      favorites.append(favoriteList);dashboard.append(favorites);root.append(dashboard);

      root.removeChild(heading);
      var management=element('details',undefined,'my-learning-management');management.open=!!query||libraryCategory!=='all';
      management.append(element('summary','课程与词库管理'));
      if(!data.libraryControlsUnavailable){
        var create=element('a','创建/导入','library-create');create.href='course-create.html';
        var libraryHeadingActions=element('div',undefined,'workspace-heading-actions');libraryHeadingActions.append(create);heading.append(libraryHeadingActions);
        var search=element('input');search.type='search';search.className='library-search-input';search.value=searchDraft===null?query:searchDraft;search.placeholder='搜索';search.setAttribute('aria-label','搜索我的学习');search.setAttribute('data-focus-key','library-search');libraryHeadingActions.insertBefore(search,create);
        var composing=false,lastSearchValue=search.value;
        function applySearch(){if(search.value===lastSearchValue)return;lastSearchValue=search.value;actions.filter({contentQuery:search.value},false,'my-learning',true);}
        search.addEventListener('compositionstart',function(){composing=true;});
        search.addEventListener('compositionend',function(){composing=false;applySearch();});
        search.addEventListener('input',function(){if(!composing)applySearch();});
      }
      var categories=global.LearningNavigation.studyTabs('courses',actions.navigate);
      var statusFilter=element('select',undefined,'study-content-filter');statusFilter.setAttribute('aria-label','课程与词库筛选');
      [['all','课程与词库'],['completed','已学完'],['saved','收藏']].forEach(function(item){var option=element('option',item[1]);option.value=item[0];option.selected=libraryCategory===item[0];statusFilter.append(option);});
      statusFilter.onchange=function(){actions.filter({contentStatus:statusFilter.value},false,'my-learning');};heading.append(statusFilter);heading.prepend(categories);
      var panel=element('section',undefined,'workspace-section library-panel');
      if(libraryCategory==='completed'){
        if(data.completionReadFailed){var retryProgress=element('p','单词本完成进度暂未读取成功，当前列表可能不完整。','workspace-status');retryProgress.append(button('重试读取',actions.retry));panel.append(retryProgress);}
        if(Object.values(data.courseCompletion||{}).some(function(row){return row.state==='unknown';}))panel.append(element('p','部分课程进度尚未核实，核实后才会计入已学完。','workspace-status'));
      }
      var results=groups[libraryCategory].filter(function(row){return fuzzyMatch(row.title+' '+row.description,query);});
      var grid=element('div',undefined,'workspace-grid');results.forEach(function(resource){grid.append(card(resource));});panel.append(grid);
      if(!results.length&&(!data.status||data.status==='已保存')){var empty=element('div',undefined,'library-empty');var hasLibraryFilters=Boolean(query);var emptyMessage=hasLibraryFilters?'没有符合条件的内容。':libraryCategory==='completed'?'暂无学完内容':libraryCategory==='saved'?'还没有收藏的内容。':libraryCategory==='active'?'还没有在学的内容。':'';if(!hasLibraryFilters&&!owned.length&&libraryCategory==='all'){var emptyCopy=element('p');emptyCopy.append(document.createTextNode('你还没有个人内容，去'));var discoverLink=element('a','发现','library-empty-discover');discoverLink.href='main.html?view=discover';discoverLink.onclick=function(event){if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();actions.navigate('discover');};emptyCopy.append(discoverLink,document.createTextNode('选一份开始'));empty.append(emptyCopy);}else empty.append(element('p',emptyMessage));panel.append(empty);}
      management.append(heading,panel);root.append(management);
    }else{
      var dashboard=element('div',undefined,'home-dashboard');
      var mainColumn=element('div',undefined,'home-dashboard-main');
      var activity=data.homeActivity||{};
      var now=new Date();
      var welcome=element('section',undefined,'home-welcome');
      var welcomeCopy=element('div');
      var streak=element('a',undefined,'home-streak');streak.href='stats.html';streak.title='按学习记录计算连续天数，点击查看打卡记录';
      var streakIcon=element('span',undefined,'home-inline-icon');streakIcon.setAttribute('aria-hidden','true');
      if(global.Icons)streakIcon.innerHTML=global.Icons.svg('fire');
      streak.append(streakIcon,element('span',activity.streak>0?'连续打卡 '+activity.streak+' 天':'今天开始打卡'));welcomeCopy.append(streak);
      welcomeCopy.append(element('h1','高效掌握单词与地道句子表达'));
      welcomeCopy.append(element('p','基于间隔复习思路，每天学一点，积累你的英语知识库。'));
      var heroActions=element('div',undefined,'home-hero-actions');
      var dueLink=element('a','去复习（'+Math.max(0,Number(data.due)||0)+'）');dueLink.href='main.html?view=stats&tab=review';
      var wrongLink=element('a','错题本（'+Math.max(0,Number(data.wrong)||0)+'）');wrongLink.href='main.html?view=stats&tab=wrong';
      [dueLink,wrongLink].forEach(function(link){link.onclick=function(event){if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;if(global.openStatsPage){event.preventDefault();global.openStatsPage(link===dueLink?'review':'wrong');}};});
      heroActions.append(dueLink,wrongLink);welcome.append(welcomeCopy,heroActions);root.append(welcome);
      dashboard.append(mainColumn);root.append(dashboard);
      var courseRows=data.courseRows||(data.activeResources||[]).map(function(resource){return {course:{id:resource.courseId,title:resource.title},lessons:[],resource:resource,progress:'',progressMarkup:''};});
      var courseGroups=[courseRows.filter(function(entry){return entry.completionState!=='completed';}),courseRows.filter(function(entry){return entry.completionState==='completed';})];
      if(courseGroups[0].length>1)mainColumn.classList.add('has-multiple-courses');
      courseGroups.forEach(function(group,groupIndex){
      if(groupIndex)return;
      if(group.length){
        var activeArea=element('section',undefined,'home-courses workspace-active');
        var activeHeader=element('div',undefined,'workspace-section-heading');activeHeader.append(element('h2',groupIndex?'已学完 · '+group.length:'当前在学'));
        var all=element('a',groupIndex?'查看已学完':'查看所有课程与词库');all.href='main.html?view=my-learning'+(groupIndex?'&contentStatus=completed':'');all.onclick=function(event){event.preventDefault();if(groupIndex)actions.filter({contentStatus:'completed'},false,'my-learning');else actions.navigate('my-learning');};activeHeader.append(all);activeArea.append(activeHeader);
        var manageArrow=element('span',undefined,'home-inline-icon');manageArrow.setAttribute('aria-hidden','true');if(global.Icons)manageArrow.innerHTML=global.Icons.svg('chevR');all.append(manageArrow);
        var rows=element('div',undefined,'home-decks');
        group.forEach(function(entry){
          var row=element('div',undefined,'hd-row');
          if(entry.unavailable||entry.loadFailed){row.append(element('p',entry.title+' · '+entry.progress));rows.append(row);return;}
          var resource=entry.resource||(data.resources||[]).find(function(item){return item.courseId===entry.course.id;})||model.resourcesFromCatalog({courses:[entry.course]})[0];
          var courseResume=data.resume&&data.resume.toolId==='chunks'&&data.resume.deck&&entry.lessons.some(function(lesson){return lesson.contentRef&&lesson.contentRef.type==='sentence-deck'&&lesson.contentRef.id===data.resume.deck.id;});
          var open=button('',function(){
            if(open.getAttribute('aria-busy')==='true')return;
            open.setAttribute('aria-busy','true');
            if(global.OperationToast)global.OperationToast.show('正在进入「'+entry.course.title+'」学习模式…');
            // Allow feedback to paint before a navigation or synchronous lesson setup.
            global.requestAnimationFrame(function(){global.requestAnimationFrame(function(){
              try{if(courseResume&&!groupIndex)actions.resume(data.resume);else actions.open(resource,{restart:!!groupIndex});}
              finally{open.removeAttribute('aria-busy');}
            });});
          });open.className='hd-main-action';
          open.disabled=resource.available===false;
          open.setAttribute('aria-label',(groupIndex?'再次学习 ':'继续学习 ')+entry.course.title+(entry.progress?'；'+entry.progress:'')+(entry.progressAria?'；'+entry.progressAria:''));
          var cover=element('span',undefined,'workspace-course-cover');
          // These fragments come from the host's escaped course/progress renderer.
          if(entry.coverMarkup)cover.innerHTML=entry.coverMarkup;
          cover.querySelectorAll('img').forEach(function(image){image.onerror=function(){image.hidden=true;};});
          open.append(cover);
          var copy=element('span',undefined,'grow');var titleLine=element('span',undefined,'home-course-title-line');titleLine.append(element('span',entry.course.title,'nm'));
          var progressLine=element('span',undefined,'home-course-progress-line');progressLine.append(element('span',entry.progress,'sub home-deck-progress'));
          if(entry.homeProgressMarkup||entry.progressMarkup){var progress=element('span',undefined,'home-course-metrics');progress.innerHTML=entry.homeProgressMarkup||entry.progressMarkup;progressLine.append(progress);}
          copy.append(titleLine,progressLine);
          open.append(copy);row.append(open);
          var kind=element('span','句子','home-content-kind');titleLine.insertBefore(kind,titleLine.firstChild);
          if(entry.lessons.length>1){var select=element('a',undefined,'hd-select-lessons');select.href='decks.html?courseView=joined&course='+encodeURIComponent(entry.course.id);select.setAttribute('aria-label','选择 '+entry.course.title+' 的课节');
            if(global.Icons){var list=element('span');list.innerHTML=Icons.svg('list');select.append(list);}select.append(element('span','选课节'));row.append(select);}
          var next=element('a',undefined,'hd-action');next.href='decks.html?courseView=joined&course='+encodeURIComponent(entry.course.id);next.setAttribute('aria-label','查看 '+entry.course.title+' 的课节');if(global.Icons)next.innerHTML=Icons.svg('chevR');row.append(next);
          if(entry.course.isProtected)row.querySelectorAll('a').forEach(function(link){link.href=CourseReturn.forward(entry.course.contentType==='expression'?'expression-learn.html?course='+encodeURIComponent(entry.course.id):'main.html?protectedCourse='+encodeURIComponent(entry.course.id),CourseReturn.source());});
          next.setAttribute('aria-label',(groupIndex?'再次学习 ':'继续学习 ')+entry.course.title);
          next.textContent=groupIndex?'再次学习':'继续学习';
          next.onclick=function(event){if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();open.click();};
          rows.append(row);
        });activeArea.append(rows);
        if(groupIndex){var completedSection=element('details',undefined,'home-completed-courses');completedSection.open=completedExpanded;completedSection.append(element('summary','已学完 · '+group.length),activeArea);mainColumn.append(completedSection);}else mainColumn.append(activeArea);
      }
      });
      var wordbooks=(data.resources||[]).filter(function(resource){return (resource.sourceRefs||[]).some(function(ref){return ref.type==='vocabulary-book'&&data.vocabularyResumes&&data.vocabularyResumes[ref.id]&&data.vocabularyResumes[ref.id].status==='active';});});
      if(wordbooks.length){
        var wordGrid=mainColumn.querySelector('.workspace-active .home-decks');
        if(!wordGrid){var wordArea=element('section',undefined,'workspace-active');var wordHeader=element('div',undefined,'workspace-section-heading');wordHeader.append(element('h2','当前在学'));var allContent=element('a','查看所有课程与词库');allContent.href='main.html?view=my-learning';wordHeader.append(allContent);wordGrid=element('div',undefined,'home-decks');wordArea.append(wordHeader,wordGrid);mainColumn.prepend(wordArea);}
        wordbooks.forEach(function(resource){var row=element('div',undefined,'hd-row is-wordbook'),open=button('',function(){actions.open(resource);});open.className='hd-main-action';var cover=element('span',undefined,'workspace-course-cover');var mark=element('span',undefined,'hc-course-cover');if(global.Icons)mark.innerHTML=global.Icons.svg('book');cover.append(mark);var copy=element('span',undefined,'grow');copy.append(element('span','单词词库','home-content-kind'),element('span',resource.title,'nm'),element('span','继续上次的单词学习','sub'));var metrics=element('span',undefined,'home-course-metrics'),metric=element('span',undefined,'home-progress-metric'),label=element('span',undefined,'home-progress-label');label.append(element('span','掌握进度'),element('b','—'));metric.append(label,element('span',undefined,'home-progress-track'));metrics.append(metric);copy.append(metrics);open.append(cover,copy);var next=button('继续背词',function(){actions.open(resource);});next.className='hd-action';row.append(open,next);wordGrid.append(row);});
      }
      if(!courseRows.length&&!wordbooks.length){var empty=element('section',undefined,'workspace-start');var discover=button('选择课程或词库，开始学习',function(){actions.navigate('discover');});discover.className='workspace-start-link';empty.append(discover);mainColumn.append(empty);}
      var recommendations=[
        {id:'builtin:oral',title:'口语3000句',summary:'按生活、工作与出行等主题练习常用表达。',cover:'assets/covers/oral-3000.webp'},
        {id:'builtin:idioms',title:'高频短语',summary:'通过例句练习常见英语短语和惯用表达。',cover:'assets/covers/idioms.webp'}
      ];
      var recommendationArea=element('section',undefined,'home-recommendations');
      recommendationArea.setAttribute('aria-labelledby','homeRecommendationsTitle');
      var recommendationHeading=element('div',undefined,'workspace-section-heading');
      recommendationHeading.append(element('h2','热门推荐'));
      recommendationHeading.querySelector('h2').id='homeRecommendationsTitle';
      var moreRecommendations=element('a','去发现页看更多');moreRecommendations.href='main.html?view=discover';
      var moreArrow=element('span',undefined,'home-inline-icon');moreArrow.setAttribute('aria-hidden','true');moreArrow.innerHTML=global.Icons?global.Icons.svg('chevR'):'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>';moreRecommendations.append(moreArrow);
      recommendationHeading.append(moreRecommendations);
      var recommendationGrid=element('div',undefined,'home-recommendation-grid');
      recommendations.forEach(function(item){
        var card=element('article',undefined,'home-recommendation-card');card.dataset.courseId=item.id;
        var cover=element('img',undefined,'home-recommendation-cover');cover.src=item.cover;cover.alt='';cover.width=72;cover.height=72;cover.loading='lazy';
        var copy=element('div',undefined,'home-recommendation-copy');
        var title=element('div',undefined,'home-recommendation-title');
        title.append(element('span','内置课程','home-content-kind'),element('h3',item.title));
        copy.append(title,element('p',item.summary));
        var action=button('加入学习',function(){actions.open({courseId:item.id,sourceRefs:[]});});action.className='home-recommendation-action';
        card.append(cover,copy,action);recommendationGrid.append(card);
      });
      var dailyQuote=element('section',undefined,'home-daily-quote');dailyQuote.setAttribute('aria-label','每日一句');
      dailyQuote.append(element('span','每日一句','home-daily-quote-label'));
      var quoteCopy=element('div',undefined,'home-daily-quote-copy');
      quoteCopy.append(element('p','Small steps every day add up to big changes.','home-daily-quote-english'),element('p','每天一小步，积累成大的改变。','home-daily-quote-translation'));
      var speak=button('',function(){
        var speech=global.speechSynthesis,Utterance=global.SpeechSynthesisUtterance;
        if(!speech||!Utterance)return;
        if(speak.getAttribute('aria-pressed')==='true'){speech.cancel();speak.setAttribute('aria-pressed','false');speak.setAttribute('aria-label','朗读每日一句');return;}
        var utterance=new Utterance('Small steps every day add up to big changes.');utterance.lang='en-US';utterance.rate=0.92;
        utterance.onstart=function(){speak.setAttribute('aria-pressed','true');speak.setAttribute('aria-label','正在朗读每日一句，点击停止');};
        utterance.onend=utterance.onerror=function(){speak.setAttribute('aria-pressed','false');speak.setAttribute('aria-label','朗读每日一句');};
        speech.cancel();speech.speak(utterance);
      });
      speak.className='home-daily-quote-speak';speak.setAttribute('aria-label','朗读每日一句');speak.setAttribute('aria-pressed','false');
      speak.disabled=!(global.speechSynthesis&&global.SpeechSynthesisUtterance);
      speak.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
      dailyQuote.append(quoteCopy,speak);
      recommendationArea.append(recommendationHeading,recommendationGrid,dailyQuote);mainColumn.append(recommendationArea);
      root.append(element('footer','© '+now.getFullYear()+' jqka.top · 英语学习与表达练习平台','home-dashboard-footer'));
    }
    container.replaceChildren(root);
    global.ContentCard.restoreMenu(root,openCardMenu);
    if(focused){var replacement=Array.from(root.querySelectorAll('[data-focus-key]')).find(function(node){return node.getAttribute('data-focus-key')===focused;});if(replacement){replacement.focus({preventScroll:true});if(focusedInput&&typeof replacement.setSelectionRange==='function')replacement.setSelectionRange(Math.min(focusedInput.start,replacement.value.length),Math.min(focusedInput.end,replacement.value.length),focusedInput.direction||'none');}}
  }
  global.LearningWorkspaceView={render:render};
})(window);
