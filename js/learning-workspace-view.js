(function(global){
  'use strict';
  var presentations=new WeakMap();
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
      var readFailure=/内容目录(?:连接失败|读取失败)|个人记录尚未确认|目录服务尚未就绪|个人单词本(?:尚未读取成功|读取失败)|学习内容未完整加载|学习记录未确认|部分内容未能读取|内容暂时无法加载/.test(text);
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
    if(data.loading&&container.querySelector('.workspace-loading')&&container.querySelector('.learning-workspace').dataset.route===location.search)return;
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
    var nav=global.LearningNavigation.create(data.view,actions.navigate);
    var navHost=document.getElementById('workspaceNavHost');
    if(navHost){
      var focusedNav=navHost.contains(document.activeElement)&&document.activeElement.getAttribute('href');
      navHost.replaceChildren(nav);
      if(focusedNav){var replacementNav=Array.from(nav.querySelectorAll('a')).find(function(link){return link.getAttribute('href')===focusedNav;});if(replacementNav)replacementNav.focus({preventScroll:true});}
    }else root.append(nav);
    var heading=element('header',undefined,'workspace-heading');
    if(data.view!=='home'||Number(data.due)>0)root.append(heading);
    if(data.loading){
      root.setAttribute('aria-busy','true');
      var loading=element('section',undefined,'workspace-loading');
      var message=element('p','正在读取学习内容…','workspace-loading-message');message.setAttribute('role','status');loading.append(message);
      var placeholders=element('div',undefined,'workspace-loading-rows');placeholders.setAttribute('aria-hidden','true');
      for(var i=0;i<3;i++){
        var placeholder=element('div',undefined,'workspace-loading-row');
        placeholder.append(element('span',undefined,'workspace-loading-cover'),element('span',undefined,'workspace-loading-line'));placeholders.append(placeholder);
      }
      loading.append(placeholders);root.append(loading);container.replaceChildren(root);return;
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
      var library=data.view==='my-learning', refs=resource.sourceRefs||[];
      var completion=completionFor(resource);
      var preferences=data.preferences||{},savedId=resource.savedTargetId||resource.resourceId;
      var saved=Object.values(preferences).find(function(row){return row.itemType==='resource'&&row.targetId===savedId;});
      var joined=!!(data.memberships&&data.memberships[resource.courseId]&&data.memberships[resource.courseId].joined);
      var book=refs.find(function(ref){return ref.type==='vocabulary-book';}),href='',items=[];
      if(resource.available){
        if(book)href=CourseReturn.forward('wordbook-details.html?book='+encodeURIComponent(book.id),CourseReturn.source());
        else if(resource.courseId)href=CourseReturn.forward('decks.html?courseView='+(library&&(resource.visibility==='private'||joined)?'joined':'discover')+'&course='+encodeURIComponent(resource.courseId)+'&returnView='+(library?'my-learning':'discover'),CourseReturn.source());
        if(library){var protectedRef=refs.find(function(ref){return ref.type==='protected-course';});if(protectedRef)href='main.html?protectedCourse='+encodeURIComponent(protectedRef.id);}
      }
      if(library&&href){
        var manage=element('a',book?'打开单词本':'查看课节','library-primary');manage.href=href;
        manage.setAttribute('data-focus-key',resource.resourceId+':manage');items.push(manage);
        if(completion.state==='completed'){var recordsLink=element('a','学习记录');recordsLink.href='stats.html';items.push(recordsLink);}
      }
      if(!library||saved&&saved.selected){
        var save=button(saved&&saved.selected?'取消收藏':'收藏',function(){actions.select('resource',savedId,!(saved&&saved.selected));});
        save.disabled=!!(saved&&saved.pending);save.setAttribute('data-focus-key',resource.resourceId+':save');items.push(save);
      }
      if(resource.available){
        var resume=book&&data.vocabularyResumes&&data.vocabularyResumes[book.id];
        var label=completion.state==='completed'?'再次学习':book?(resume&&resume.status==='active'?'继续练习':'开始练习'):joined?(library?'直接进入学习':'继续学习'):'加入学习';
        var launch=button(label,function(){actions.open(resource,{restart:completion.state==='completed'});});launch.setAttribute('data-focus-key',resource.resourceId+':learn');items.push(launch);
        if(library&&joined)items.push(button('退出在学',function(){
          if(!global.confirm('退出在学？课程和已有学习记录会保留。'))return;
          actions.leave(resource.courseId).catch(function(error){alert(error.message);});
        }));
      }
      if(saved&&saved.pending){var pending=element('span','待保存');pending.setAttribute('role','status');items.push(pending);}
      var result=global.ContentCard.create({resource:resource,variant:library?'library':'discover',href:href,
        linkLabel:(library?'打开内容：':'查看 ')+resource.title,
        kindLabel:resource.available?((resource.activities||[]).includes('vocabulary')?'单词':'句子'):'暂不可用',items:items});
      if(library&&['completed','updated'].includes(completion.state))result.querySelector('.content-card-copy').append(element('span',completion.state==='completed'?'已学完':'曾学完 · 有新内容待补学','library-completion-label'));
      return result;
    }
    function section(title,resources){var area=element('section',undefined,'workspace-section');if(title)area.append(element('h2',title));else area.setAttribute('aria-label','内容结果');
      var grid=element('div',undefined,'workspace-grid');resources.forEach(function(resource){grid.append(card(resource));});area.append(grid);root.append(area);return area;}
    if(data.view==='discover'){
      var selection=model.selectionFromUrl(location.search);
      if(selection.kind==='wordbook'){var createBook=element('a','添加单词本','library-create');createBook.href='wordbook-create.html';heading.append(createBook);}
      var tabs=element('div',undefined,'workspace-tabs');
      tabs.setAttribute('role','group');tabs.setAttribute('aria-label','内容分类');
      function chooseCategory(kind,category){var patch={kind:kind,category:category,practicalTopic:''};Object.keys(model.FACET_LABELS).forEach(function(key){patch[key]=[];});actions.filter(patch);}
      [['','全部',''],['','实用英语','practical'],['wordbook','单词本',''],['','新概念','new-concept'],['','中小学同步','school']].forEach(function(item){var tab=button(item[1],function(){chooseCategory(item[0],item[2]);});tab.setAttribute('aria-pressed',selection.category===item[2]&&selection.kind===item[0]);tab.setAttribute('data-focus-key','discover-category-'+(item[2]||item[0]||'all'));tabs.append(tab);});root.append(tabs);
      var filters=element('div',undefined,'workspace-filter discover-filter');
      var discoverToolbar=element('div',undefined,'discover-toolbar');root.insertBefore(discoverToolbar,tabs);discoverToolbar.append(tabs);
      var searchToolbar=element('div',undefined,'discover-searchbar');discoverToolbar.append(searchToolbar);
      if(createBook){createBook.style.marginTop='0';searchToolbar.append(createBook);}
      if(!heading.childElementCount)heading.remove();
      var search=element('input');search.type='search';search.placeholder='搜索';search.value=searchDraft===null?selection.query:searchDraft;search.setAttribute('aria-label','搜索内容');search.setAttribute('data-focus-key','discover-search');searchToolbar.append(search);
      var composing=false,lastSearchValue=search.value;
      function applySearch(){if(search.value===lastSearchValue)return;lastSearchValue=search.value;actions.filter({q:search.value},false,'discover',true);}
      search.addEventListener('compositionstart',function(){composing=true;});
      search.addEventListener('compositionend',function(){composing=false;applySearch();});
      search.addEventListener('input',function(){if(!composing)applySearch();});
      if(selection.category==='practical'){
        var topics=element('div',undefined,'discover-text-tabs');topics.setAttribute('role','group');topics.setAttribute('aria-label','实用英语分类');
        [['','全部']].concat(Object.entries(model.PRACTICAL_TOPICS)).forEach(function(item){var tab=button(item[1],function(){actions.filter({practicalTopic:item[0]});});tab.setAttribute('aria-pressed',selection.practicalTopic===item[0]);tab.setAttribute('data-focus-key','discover-practical-'+(item[0]||'all'));topics.append(tab);});filters.append(topics);root.append(filters);
      }
      if(selection.category==='school'){
        function filterRow(label,key,choices,allLabel){
          var row=element('div',undefined,'discover-text-tabs');row.setAttribute('role','group');row.setAttribute('aria-label',label);
          [''].concat(choices).forEach(function(value){var tab=button(value||(allLabel||'全部'+label),function(){var patch={};patch[key]=value?[value]:[];if(key==='schoolStages')patch.grades=[];actions.filter(patch);});tab.setAttribute('aria-pressed',value?selection[key].includes(value):!selection[key].length);tab.setAttribute('data-focus-key','discover-'+key+'-'+(value||'all'));row.append(tab);});filters.append(row);
        }
        filterRow('学段','schoolStages',['小学','初中','高中'],'全部');
        var gradesByStage={'小学':['一年级','二年级','三年级','四年级','五年级','六年级'],'初中':['七年级','八年级','九年级'],'高中':['高一','高二','高三']};
        if(gradesByStage[selection.schoolStages[0]])filterRow('年级','grades',gradesByStage[selection.schoolStages[0]],'全部');
        root.append(filters);
      }
      var results=model.filterResources(data.publicResources||[],selection);
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
      var groups={all:owned,active:owned.filter(function(row){return completionFor(row).state!=='completed'&&data.memberships&&data.memberships[row.courseId]&&data.memberships[row.courseId].joined;}),completed:owned.filter(function(row){return completionFor(row).state==='completed';}),saved:Array.from(new Map(savedResources.map(function(row){return [row.resourceId,row];})).values())};
      if(!data.libraryControlsUnavailable){
        var create=element('a','创建/导入','library-create');create.href='course-create.html';
        var libraryHeadingActions=element('div',undefined,'workspace-heading-actions');libraryHeadingActions.append(create);heading.append(libraryHeadingActions);
        var search=element('input');search.type='search';search.className='library-search-input';search.value=searchDraft===null?query:searchDraft;search.placeholder='搜索';search.setAttribute('aria-label','搜索我的内容');search.setAttribute('data-focus-key','library-search');libraryHeadingActions.insertBefore(search,create);
        var composing=false,lastSearchValue=search.value;
        function applySearch(){if(search.value===lastSearchValue)return;lastSearchValue=search.value;actions.filter({contentQuery:search.value},false,'my-learning',true);}
        search.addEventListener('compositionstart',function(){composing=true;});
        search.addEventListener('compositionend',function(){composing=false;applySearch();});
        search.addEventListener('input',function(){if(!composing)applySearch();});
      }
      var categories=element('div',undefined,'library-categories');categories.setAttribute('role','group');categories.setAttribute('aria-label','学习库分类');
      var panel=element('section',undefined,'workspace-section library-panel');
      [['all','全部'],['active','在学'],['completed','已学完'],['saved','收藏']].forEach(function(item){var choice=button(item[1]+' · '+groups[item[0]].length,function(){actions.filter({contentStatus:item[0]},false,'my-learning');});choice.setAttribute('aria-pressed',libraryCategory===item[0]);choice.setAttribute('data-focus-key','library-status-'+item[0]);choice.dataset.category=item[0];categories.append(choice);});
      if(libraryCategory==='completed'){
        if(data.completionReadFailed){var retryProgress=element('p','单词本完成进度暂未读取成功，当前列表可能不完整。','workspace-status');retryProgress.append(button('重试读取',actions.retry));panel.append(retryProgress);}
        if(Object.values(data.courseCompletion||{}).some(function(row){return row.state==='unknown';}))panel.append(element('p','部分课程进度尚未核实，核实后才会计入已学完。','workspace-status'));
      }
      var results=groups[libraryCategory].filter(function(row){return fuzzyMatch(row.title+' '+row.description,query);});
      var grid=element('div',undefined,'workspace-grid');results.forEach(function(resource){grid.append(card(resource));});panel.append(grid);
      if(!results.length&&(!data.status||data.status==='已保存')){var empty=element('div',undefined,'library-empty');var hasLibraryFilters=Boolean(query);var emptyMessage=hasLibraryFilters?'没有符合条件的内容。':libraryCategory==='completed'?'暂无学完内容':libraryCategory==='saved'?'还没有收藏的内容。':libraryCategory==='active'?'还没有在学的内容。':'';if(!hasLibraryFilters&&!owned.length&&libraryCategory==='all'){var emptyCopy=element('p');emptyCopy.append(document.createTextNode('你还没有个人内容，去'));var discoverLink=element('a','发现','library-empty-discover');discoverLink.href='main.html?view=discover';discoverLink.onclick=function(event){if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();actions.navigate('discover');};emptyCopy.append(discoverLink,document.createTextNode('选一份开始'));empty.append(emptyCopy);}else empty.append(element('p',emptyMessage));panel.append(empty);}
      heading.prepend(categories);root.append(panel);
    }else{
      if(data.due>0){
        var review=button('开始复习',actions.review);review.className='workspace-review-action';
        review.setAttribute('aria-label','开始复习');
        var dueCount=element('span',String(data.due),'workspace-due-count');dueCount.setAttribute('aria-label',data.due+' 项待复习');review.append(dueCount);
        var headingActions=element('div',undefined,'workspace-heading-actions');headingActions.append(review);heading.append(headingActions);
      }
      var courseRows=data.courseRows||(data.activeResources||[]).map(function(resource){return {course:{id:resource.courseId,title:resource.title},lessons:[],resource:resource,progress:'',progressMarkup:''};});
      var courseGroups=[courseRows.filter(function(entry){return entry.completionState!=='completed';}),courseRows.filter(function(entry){return entry.completionState==='completed';})];
      courseGroups.forEach(function(group,groupIndex){
      if(group.length){
        var activeArea=element('section',undefined,'home-courses workspace-active');
        var activeHeader=element('div',undefined,'workspace-section-heading');activeHeader.append(element('h2',groupIndex?'已学完 · '+group.length:'当前在学'));
        var all=element('a',groupIndex?'查看已学完':'管理在学');all.href='main.html?view=my-learning'+(groupIndex?'&contentStatus=completed':'');all.onclick=function(event){event.preventDefault();if(groupIndex)actions.filter({contentStatus:'completed'},false,'my-learning');else actions.navigate('my-learning');};activeHeader.append(all);activeArea.append(activeHeader);
        var rows=element('div',undefined,'home-decks');
        group.forEach(function(entry){
          var row=element('div',undefined,'hd-row');
          if(entry.unavailable||entry.loadFailed){row.append(element('p',entry.title+' · '+entry.progress));rows.append(row);return;}
          var resource=entry.resource||(data.resources||[]).find(function(item){return item.courseId===entry.course.id;})||model.resourcesFromCatalog({courses:[entry.course]})[0];
          var courseResume=data.resume&&data.resume.toolId==='chunks'&&data.resume.deck&&entry.lessons.some(function(lesson){return lesson.contentRef&&lesson.contentRef.type==='sentence-deck'&&lesson.contentRef.id===data.resume.deck.id;});
          var open=button('',function(){if(courseResume&&!groupIndex)actions.resume(data.resume);else actions.open(resource,{restart:!!groupIndex});});open.className='hd-main-action';
          open.disabled=resource.available===false;
          open.setAttribute('aria-label',(groupIndex?'再次学习 ':'继续学习 ')+entry.course.title+(entry.progress?'；'+entry.progress:'')+(entry.progressAria?'；'+entry.progressAria:''));
          var cover=element('span',undefined,'workspace-course-cover');
          // These fragments come from the host's escaped course/progress renderer.
          if(entry.coverMarkup)cover.innerHTML=entry.coverMarkup;
          cover.querySelectorAll('img').forEach(function(image){image.onerror=function(){image.hidden=true;};});
          open.append(cover);
          var copy=element('span',undefined,'grow');copy.append(element('span',entry.course.title,'nm'),element('span',entry.progress,'sub home-deck-progress'));
          if(entry.progressMarkup){var progress=element('span');progress.innerHTML=entry.progressMarkup;copy.append(progress);}
          open.append(copy);row.append(open);
          if(entry.lessons.length>1){var select=element('a',undefined,'hd-select-lessons');select.href='decks.html?courseView=joined&course='+encodeURIComponent(entry.course.id);select.setAttribute('aria-label','选择 '+entry.course.title+' 的课节');
            if(global.Icons){var list=element('span');list.innerHTML=Icons.svg('list');select.append(list);}select.append(element('span','选课节'));row.append(select);}
          var next=element('a',undefined,'hd-action');next.href='decks.html?courseView=joined&course='+encodeURIComponent(entry.course.id);next.setAttribute('aria-label','查看 '+entry.course.title+' 的课节');if(global.Icons)next.innerHTML=Icons.svg('chevR');row.append(next);
          if(entry.course.isProtected)row.querySelectorAll('a').forEach(function(link){link.href='main.html?protectedCourse='+encodeURIComponent(entry.course.id);});
          rows.append(row);
        });activeArea.append(rows);
        if(!groupIndex&&courseRows.length<(data.courseLimit||3)){var add=button('添加课程',function(){actions.navigate('discover');});add.className='home-add-course';
          if(global.Icons){var plus=element('span',undefined,'hac-ico');plus.innerHTML=Icons.svg('plus');add.prepend(plus);}activeArea.append(add);}
        if(groupIndex){var completedSection=element('details',undefined,'home-completed-courses');completedSection.open=completedExpanded;completedSection.append(element('summary','已学完 · '+group.length),activeArea);root.append(completedSection);}else root.append(activeArea);
      }
      });
      if(!courseRows.length&&!data.resume&&!data.due&&!data.status){
        var empty=element('section',undefined,'workspace-start');
        var discover=button('',function(){actions.navigate('discover');});discover.className='workspace-start-link';discover.setAttribute('aria-label','选择学习内容');
        var bookMark=element('span',undefined,'workspace-start-book');bookMark.setAttribute('aria-hidden','true');
        bookMark.innerHTML='<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 12C18 8 12 8 5 10v27c7-2 13-2 19 2 6-4 12-4 19-2V10c-7-2-13-2-19 2Zm0 0v27M11 17c3-1 5 0 8 1m-8 7c3-1 5 0 8 1m10-8c3-1 5-2 8-1m-8 9c3-1 5-2 8-1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        var startCopy=element('span',undefined,'workspace-start-copy');startCopy.append(element('strong','挑选学习内容'),element('span','课程 · 单词本 · 教材'));
        var startAction=element('span','去发现','workspace-start-action');
        var arrow=element('span');arrow.setAttribute('aria-hidden','true');arrow.innerHTML='<svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';startAction.append(arrow);
        discover.append(bookMark,startCopy,startAction);empty.append(discover);root.append(empty);
      }
    }
    container.replaceChildren(root);
    global.ContentCard.restoreMenu(root,openCardMenu);
    if(focused){var replacement=Array.from(root.querySelectorAll('[data-focus-key]')).find(function(node){return node.getAttribute('data-focus-key')===focused;});if(replacement){replacement.focus({preventScroll:true});if(focusedInput&&typeof replacement.setSelectionRange==='function')replacement.setSelectionRange(Math.min(focusedInput.start,replacement.value.length),Math.min(focusedInput.end,replacement.value.length),focusedInput.direction||'none');}}
  }
  global.LearningWorkspaceView={render:render};
})(window);
