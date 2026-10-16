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
    if(data.view==='home')heading.append(element('h1','今日学习'));
    root.append(heading);
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
    if(visibleStatus&&visibleStatus!=='已保存'){
      var readFailure=/内容目录连接失败|个人记录尚未确认|目录服务尚未就绪/.test(visibleStatus);
      var notice=element('div',undefined,'workspace-notice');
      var status=element('p',visibleStatus,'workspace-status');status.setAttribute('role','status');notice.append(status);
      if(readFailure)notice.append(button('重试读取',actions.retry));
      root.append(notice);
    }
    function card(resource){
      var library=data.view==='my-learning', refs=resource.sourceRefs||[];
      var preferences=data.preferences||{},savedId=resource.savedTargetId||resource.resourceId;
      var saved=Object.values(preferences).find(function(row){return row.itemType==='resource'&&row.targetId===savedId;});
      var joined=!!(data.memberships&&data.memberships[resource.courseId]&&data.memberships[resource.courseId].joined);
      var book=refs.find(function(ref){return ref.type==='vocabulary-book';}),href='',items=[];
      if(resource.available){
        if(book)href='wordbook-details.html?book='+encodeURIComponent(book.id);
        else if(resource.courseId)href='decks.html?courseView='+(library&&(resource.visibility==='private'||joined)?'joined':'discover')+'&course='+encodeURIComponent(resource.courseId)+'&returnView='+(library?'my-learning':'discover');
        if(library){var protectedRef=refs.find(function(ref){return ref.type==='protected-course';});if(protectedRef)href='main.html?protectedCourse='+encodeURIComponent(protectedRef.id);}
      }
      if(library&&href){
        var manage=element('a',book?'打开单词本':'查看课节','library-primary');manage.href=href;
        manage.setAttribute('data-focus-key',resource.resourceId+':manage');items.push(manage);
      }
      if(!library||saved&&saved.selected){
        var save=button(saved&&saved.selected?'取消收藏':'收藏',function(){actions.select('resource',savedId,!(saved&&saved.selected));});
        save.disabled=!!(saved&&saved.pending);save.setAttribute('data-focus-key',resource.resourceId+':save');items.push(save);
      }
      if(resource.available){
        var resume=book&&data.vocabularyResumes&&data.vocabularyResumes[book.id];
        var label=book?(resume&&resume.status==='active'?'继续练习':'开始练习'):joined?(library?'直接进入学习':'继续学习'):'加入学习';
        var launch=button(label,function(){actions.open(resource);});launch.setAttribute('data-focus-key',resource.resourceId+':learn');items.push(launch);
        if(library&&joined)items.push(button('退出在学',function(){
          if(!global.confirm('退出在学？课程和已有学习记录会保留。'))return;
          actions.leave(resource.courseId).catch(function(error){alert(error.message);});
        }));
      }
      if(saved&&saved.pending){var pending=element('span','待保存');pending.setAttribute('role','status');items.push(pending);}
      return global.ContentCard.create({resource:resource,variant:library?'library':'discover',href:href,
        linkLabel:(library?'打开内容：':'查看 ')+resource.title,
        kindLabel:resource.available?((resource.activities||[]).includes('vocabulary')?'单词':'句子'):'暂不可用',items:items});
    }
    function section(title,resources){var area=element('section',undefined,'workspace-section');if(title)area.append(element('h2',title));else area.setAttribute('aria-label','内容结果');
      var grid=element('div',undefined,'workspace-grid');resources.forEach(function(resource){grid.append(card(resource));});area.append(grid);root.append(area);return area;}
    if(data.view==='discover'){
      var selection=model.selectionFromUrl(location.search);
      if(selection.kind==='wordbook'){var createBook=element('a','添加单词本','library-create');createBook.href='wordbook-create.html';heading.append(createBook);}
      var tabs=element('div',undefined,'workspace-tabs');
      var counts=model.resourceKindCounts(data.publicResources||[],selection);tabs.setAttribute('role','group');tabs.setAttribute('aria-label','内容分类');
      [['','全部'],['course','课程'],['wordbook','单词本'],['textbook','教材']].forEach(function(item){var tab=button(item[1]+'（'+counts[item[0]||'all']+'）',function(){actions.filter({kind:item[0]});});tab.setAttribute('aria-pressed',selection.kind===item[0]);tab.setAttribute('data-focus-key','discover-kind-'+(item[0]||'all'));tabs.append(tab);});root.append(tabs);
      var filters=element('div',undefined,'workspace-filter discover-filter');
      var discoverToolbar=element('div',undefined,'discover-toolbar');root.insertBefore(discoverToolbar,tabs);discoverToolbar.append(tabs);
      var searchToolbar=element('div',undefined,'discover-searchbar');discoverToolbar.append(searchToolbar);
      if(!heading.childElementCount)heading.remove();
      var search=element('input');search.type='search';search.placeholder='搜索';search.value=searchDraft===null?selection.query:searchDraft;search.setAttribute('aria-label','搜索内容');search.setAttribute('data-focus-key','discover-search');searchToolbar.append(search);
      var composing=false,lastSearchValue=search.value;
      function applySearch(){if(search.value===lastSearchValue)return;lastSearchValue=search.value;actions.filter({q:search.value},false,'discover',true);}
      search.addEventListener('compositionstart',function(){composing=true;});
      search.addEventListener('compositionend',function(){composing=false;applySearch();});
      search.addEventListener('input',function(){if(!composing)applySearch();});
      var options=model.facetOptions(data.publicResources||[],selection);
      var primary=selection.kind==='course'?['levels','goals']:selection.kind==='wordbook'?['goals','schoolStages']:selection.kind==='textbook'?['schoolStages','publisherId']:['levels','schoolStages'];
      function addFilter(key,parent){if(!options[key].length&&!selection[key].length)return;
        var group=element('fieldset',undefined,'workspace-facet');group.append(element('legend',model.FACET_LABELS[key]));
        var choices=options[key].slice();selection[key].forEach(function(value){if(!choices.some(function(option){return option.value===value;}))choices.push({value:value,count:0});});
        choices.forEach(function(option){var label=element('label');var input=element('input');input.type='checkbox';input.name=key;input.value=option.value;input.checked=selection[key].includes(option.value);label.append(input,document.createTextNode(option.value+' · '+option.count));group.append(label);});parent.append(group);
      }
      var mainFacets=element('div',undefined,'discover-facets');primary.forEach(function(key){addFilter(key,mainFacets);});if(mainFacets.children.length)filters.append(mainFacets);
      var more=element('details',undefined,'discover-more');more.append(element('summary','更多筛选'));var extra=element('div',undefined,'discover-facets');
      Object.keys(model.FACET_LABELS).filter(function(key){return primary.indexOf(key)<0;}).forEach(function(key){addFilter(key,extra);});more.append(extra);if(extra.children.length)filters.append(more);
      var mobile=matchMedia('(max-width:700px)').matches;
      var hasFacets=!!filters.querySelector('.discover-facets input[type=checkbox]');
      if(hasFacets){
        filters.addEventListener('change',function(event){if(!event.target.matches('input[type=checkbox]'))return;var patch={q:search.value};Object.keys(model.FACET_LABELS).forEach(function(key){patch[key]=Array.from(filters.querySelectorAll('input[type=checkbox]')).filter(function(input){return input.name===key&&input.checked;}).map(function(input){return input.value;});});actions.filter(patch);});
        if(mobile){
          var drawer=element('dialog',undefined,'workspace-filter-drawer');drawer.setAttribute('aria-label','筛选内容');drawer.addEventListener('keydown',function(event){event.stopPropagation();});
          var trigger=button('筛选内容',function(){drawer.showModal();});trigger.className='workspace-filter-trigger';trigger.setAttribute('data-focus-key','discover-filters');root.append(trigger);
          var close=button('关闭筛选',function(){drawer.close();});close.className='workspace-filter-close';filters.prepend(close);
          drawer.addEventListener('close',function(){trigger.focus();});drawer.append(filters);root.append(drawer);
        }else root.append(filters);
      }
      var selected=element('div',undefined,'workspace-actions');
      Object.keys(model.FACET_LABELS).forEach(function(key){selection[key].forEach(function(value){selected.append(button(model.FACET_LABELS[key]+'：'+value+' · 移除',function(){var patch={};patch[key]=selection[key].filter(function(item){return item!==value;});actions.filter(patch);}));});});root.append(selected);
      var results=model.filterResources(data.publicResources||[],selection);
      if(selection.kind==='textbook')model.groupTextbooks(results).forEach(function(group){section(group[0].facets.seriesId||group[0].title,group);});
      else section('',results);
      if(!results.length)root.append(element('p','没有找到相关内容，试试更短的关键词。','workspace-status'));
    }else if(data.view==='my-learning'){
      var uniqueResources=Array.from(new Map((data.resources||[]).map(function(row){return [row.resourceId,row];})).values());
      var savedResources=model.collectPersonalResources(uniqueResources,data.preferences||{},data.aliases||{});
      var personal=new Map();
      uniqueResources.filter(function(row){return row.visibility==='private'||data.memberships&&data.memberships[row.courseId]&&data.memberships[row.courseId].joined;}).concat(savedResources).forEach(function(row){personal.set(row.resourceId,row);});
      var owned=Array.from(personal.values());
      var parameters=new URLSearchParams(location.search), libraryCategory=['all','active','saved'].includes(parameters.get('contentStatus'))?parameters.get('contentStatus'):'all';
      var query=parameters.get('contentQuery')||'';
      var groups={all:owned,active:owned.filter(function(row){return data.memberships&&data.memberships[row.courseId]&&data.memberships[row.courseId].joined;}),saved:Array.from(new Map(savedResources.map(function(row){return [row.resourceId,row];})).values())};
      var create=element('a','创建/导入','library-create');create.href='course-create.html';heading.append(create);
      var libraryHeadingActions=element('div',undefined,'workspace-heading-actions');libraryHeadingActions.append(create);heading.append(libraryHeadingActions);
      var search=element('input');search.type='search';search.className='library-search-input';search.value=searchDraft===null?query:searchDraft;search.placeholder='搜索';search.setAttribute('aria-label','搜索我的内容');search.setAttribute('data-focus-key','library-search');libraryHeadingActions.insertBefore(search,create);
      var composing=false,lastSearchValue=search.value;
      function applySearch(){if(search.value===lastSearchValue)return;lastSearchValue=search.value;actions.filter({contentQuery:search.value},false,'my-learning',true);}
      search.addEventListener('compositionstart',function(){composing=true;});
      search.addEventListener('compositionend',function(){composing=false;applySearch();});
      search.addEventListener('input',function(){if(!composing)applySearch();});
      var categories=element('div',undefined,'library-categories');categories.setAttribute('role','group');categories.setAttribute('aria-label','学习库分类');
      var panel=element('section',undefined,'workspace-section library-panel');
      [['all','全部'],['active','在学'],['saved','收藏']].forEach(function(item){var choice=button(item[1]+' · '+groups[item[0]].length,function(){actions.filter({contentStatus:item[0]},false,'my-learning');});choice.setAttribute('aria-pressed',libraryCategory===item[0]);choice.setAttribute('data-focus-key','library-status-'+item[0]);choice.dataset.category=item[0];categories.append(choice);});
      var results=groups[libraryCategory].filter(function(row){return fuzzyMatch(row.title+' '+row.description,query);});
      var grid=element('div',undefined,'workspace-grid');results.forEach(function(resource){grid.append(card(resource));});panel.append(grid);
      if(!results.length&&(!data.status||data.status==='已保存')){var empty=element('div',undefined,'library-empty');var hasLibraryFilters=Boolean(query);var emptyMessage=hasLibraryFilters?'没有符合条件的内容。':libraryCategory==='saved'?'还没有收藏的内容。':libraryCategory==='active'?'还没有在学的内容。':'还没有个人内容，先选一份开始。';empty.append(element('p',emptyMessage));if(!hasLibraryFilters&&!owned.length&&libraryCategory==='all')empty.append(button('去发现内容',function(){actions.navigate('discover');}));panel.append(empty);}
      heading.prepend(categories);root.append(panel);
    }else{
      if(data.due>0){
        var review=button('开始复习',actions.review);review.className='workspace-review-action';
        review.setAttribute('aria-label','开始复习');
        var dueCount=element('span',String(data.due),'workspace-due-count');dueCount.setAttribute('aria-label',data.due+' 项待复习');review.append(dueCount);
        var headingActions=element('div',undefined,'workspace-heading-actions');headingActions.append(review);heading.append(headingActions);
      }
      var courseRows=data.courseRows||(data.activeResources||[]).map(function(resource){return {course:{id:resource.courseId,title:resource.title},lessons:[],resource:resource,progress:'',progressMarkup:''};});
      if(courseRows.length){
        var activeArea=element('section',undefined,'home-courses workspace-active');
        var activeHeader=element('div',undefined,'workspace-section-heading');activeHeader.append(element('h2','当前在学'));
        var all=element('a','管理在学');all.href='main.html?view=my-learning';all.onclick=function(event){event.preventDefault();actions.navigate('my-learning');};activeHeader.append(all);activeArea.append(activeHeader);
        var rows=element('div',undefined,'home-decks');
        courseRows.forEach(function(entry){
          var row=element('div',undefined,'hd-row');
          if(entry.unavailable||entry.loadFailed){row.append(element('p',entry.title+' · '+entry.progress));rows.append(row);return;}
          var resource=entry.resource||(data.resources||[]).find(function(item){return item.courseId===entry.course.id;})||model.resourcesFromCatalog({courses:[entry.course]})[0];
          var courseResume=data.resume&&data.resume.toolId==='chunks'&&data.resume.deck&&entry.lessons.some(function(lesson){return lesson.contentRef&&lesson.contentRef.type==='sentence-deck'&&lesson.contentRef.id===data.resume.deck.id;});
          var open=button('',function(){if(courseResume)actions.resume(data.resume);else actions.open(resource);});open.className='hd-main-action';
          open.disabled=resource.available===false;
          open.setAttribute('aria-label','继续学习 '+entry.course.title+(entry.progress?'；'+entry.progress:'')+(entry.progressAria?'；'+entry.progressAria:''));
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
        if(courseRows.length<(data.courseLimit||3)){var add=button('添加课程',function(){actions.navigate('discover');});add.className='home-add-course';
          if(global.Icons){var plus=element('span',undefined,'hac-ico');plus.innerHTML=Icons.svg('plus');add.prepend(plus);}activeArea.append(add);}
        root.append(activeArea);
      }else if(!data.resume&&!data.due&&!data.status){
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
    if(focused){var replacement=Array.from(root.querySelectorAll('[data-focus-key]')).find(function(node){return node.getAttribute('data-focus-key')===focused;});if(replacement){replacement.focus({preventScroll:true});if(focusedInput&&typeof replacement.setSelectionRange==='function')replacement.setSelectionRange(Math.min(focusedInput.start,replacement.value.length),Math.min(focusedInput.end,replacement.value.length),focusedInput.direction||'none');}}
  }
  global.LearningWorkspaceView={render:render};
})(window);
