(function(global){
  'use strict';
  // Presentation only: callers supply links/actions; this component never reads or writes account data.
  var activeMenu=null;
  var menuOpeners=new WeakMap();
  function node(tag,text,className){var result=document.createElement(tag);if(text!==undefined)result.textContent=text;if(className)result.className=className;return result;}
  function closeMenu(restore){if(!activeMenu)return;var previous=activeMenu;activeMenu=null;previous.menu.open=false;previous.trigger.setAttribute('aria-expanded','false');if(restore&&previous.trigger.isConnected)previous.trigger.focus({preventScroll:true});}
  document.addEventListener('pointerdown',function(event){if(activeMenu&&!activeMenu.menu.contains(event.target))closeMenu(false);});
  document.addEventListener('focusin',function(event){if(activeMenu&&!activeMenu.menu.contains(event.target))closeMenu(false);});
  global.addEventListener('resize',function(){closeMenu(false);});
  document.addEventListener('scroll',function(event){if(activeMenu&&!activeMenu.panel.contains(event.target))closeMenu(false);},true);
  function bindMenu(menu,trigger,panel){
    trigger.setAttribute('aria-expanded','false');
    function items(){return Array.from(panel.querySelectorAll('a[href],button:not(:disabled)')).filter(function(item){return item.getClientRects().length;});}
    function open(){
      closeMenu(false);menu.open=true;trigger.setAttribute('aria-expanded','true');activeMenu={menu:menu,trigger:trigger,panel:panel};
      panel.style.transform='';panel.style.top='100%';panel.style.bottom='auto';
      var rect=panel.getBoundingClientRect();
      if(rect.bottom>innerHeight-12&&menu.getBoundingClientRect().top>rect.height+12){panel.style.top='auto';panel.style.bottom='100%';}
      var shift=rect.left<12?12-rect.left:rect.right>innerWidth-12?innerWidth-12-rect.right:0;
      if(shift)panel.style.transform='translateX('+shift+'px)';
    }
    menuOpeners.set(menu,open);
    trigger.addEventListener('click',function(event){event.preventDefault();if(menu.open)closeMenu(false);else open();});
    menu.addEventListener('keydown',function(event){
      if(event.key==='Escape'&&menu.open){event.preventDefault();event.stopPropagation();closeMenu(true);return;}
      if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();var opening=!menu.open;if(opening)open();
      var choices=items();if(!choices.length)return;var index=choices.indexOf(document.activeElement);
      var target=event.key==='Home'?0:event.key==='End'?choices.length-1:opening||index<0?(event.key==='ArrowUp'?choices.length-1:0):(index+(event.key==='ArrowUp'?-1:1)+choices.length)%choices.length;
      choices[target].focus();
    });
    panel.addEventListener('click',function(event){if(event.target.closest('a,button'))closeMenu(true);});
  }
  function create(options){
    var resource=options.resource,library=options.variant==='library';
    var facets=resource.facets||{},version=facets.textbookVersion;
    var shortTitle=version&&facets.grades?.length===1&&facets.volume&&facets.edition?facets.grades[0]+facets.volume+'（'+facets.edition+'）':resource.title;
    // Legacy class aliases preserve existing entry-point/test selectors, not separate visual templates.
    var article=node('article',undefined,'workspace-card content-card'+(library?'':' discover-card'));
    article.dataset.resource=resource.resourceId;
    var fallback=global.CourseCovers&&CourseCovers.fallback(resource),src=resource.coverUrl||fallback;
    if(src){
      var image=node('img');image.src=src;image.alt='';image.loading='lazy';image.className='content-card-cover';
      if(!resource.coverUrl||(global.CourseCovers&&CourseCovers.variants||[]).includes(resource.coverUrl))article.classList.add('has-default-cover');
      image.onerror=function(){if(fallback&&image.getAttribute('src')!==fallback){image.src=fallback;article.classList.add('has-default-cover');}else image.style.visibility='hidden';};
      article.append(image);
    }
    var kindTag=node('span',options.kindLabel,'content-card-kind '+(library?'library-kind-tag':'discover-kind-tag'));
    if(options.kindKey)kindTag.dataset.kind=options.kindKey;
    article.append(kindTag);
    if(version){var versionTag=node('span',version,'content-card-version');versionTag.title=[facets.publisherId,version,facets.edition].filter(Boolean).join(' · ');article.append(versionTag);}
    var copy=node('div',undefined,'content-card-copy '+(library?'library-copy':'discover-copy'));
    var heading=node('h3');
    if(options.href){
      var link=node('a',shortTitle,'content-card-title '+(library?'library-title-link':'discover-preview'));link.href=options.href;link.title=resource.title;link.setAttribute('aria-label',options.linkLabel||resource.title);heading.append(link);
      article.classList.add(library?'is-clickable':'has-preview');
      if(options.onActivate){link.addEventListener('click',function(event){event.preventDefault();options.onActivate();});}
      article.addEventListener('click',function(event){if(event.target.closest('a,button,input,select,summary,details')||global.getSelection&&String(global.getSelection()))return;if(options.onActivate)options.onActivate();else link.click();});
    }else{heading.textContent=shortTitle;heading.title=resource.title;}
    copy.append(heading);
    var shelf=options.variant==='discover';
    if(shelf){
      article.classList.add('has-learning-footer');
      if(options.metadata)copy.append(node('p',options.metadata,'content-card-metadata'));
    }
    var footer=shelf?node('div',undefined,'content-card-learning-footer'):copy;
    if(shelf&&options.primaryAction){var primary=options.primaryAction;primary.classList.add('content-card-learn');primary.textContent=(['加入学习','加入练习'].includes(primary.textContent)?'+ ':'')+primary.textContent;footer.append(primary);}
    if(shelf&&options.saveAction){var save=options.saveAction;save.classList.add('content-card-save');save.setAttribute('aria-label',save.textContent+'：'+resource.title);save.title=save.textContent;save.setAttribute('aria-pressed',String(!!options.saved));save.innerHTML='<svg viewBox="0 0 24 24" width="17" height="17" fill="'+(options.saved?'currentColor':'none')+'" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';footer.append(save);}
    var menuItems=(options.additionalMenuItems||[]).concat(options.items.filter(function(item){return !shelf||item!==options.primaryAction&&item!==options.saveAction;}));
    if(menuItems.length){
      var menu=node('details',undefined,'content-card-menu '+(library?'library-more':'discover-card-menu'));menu.dataset.resource=resource.resourceId;
      var trigger=node('summary');trigger.setAttribute('aria-label',resource.title+' 的更多操作');trigger.setAttribute('data-focus-key',resource.resourceId+':more');
      trigger.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>';
      var panel=node('div',undefined,'content-card-actions workspace-action-menu-panel '+(library?'library-more-actions':'workspace-actions'));
      menuItems.forEach(function(item){panel.append(item);});menu.append(trigger,panel);footer.append(menu);bindMenu(menu,trigger,panel);
    }
    if(shelf)copy.append(footer);
    article.append(copy);return article;
  }
  function captureMenu(container){return activeMenu&&activeMenu.menu.open&&container.contains(activeMenu.menu)?activeMenu.menu.dataset.resource:null;}
  function restoreMenu(container,resourceId){
    if(activeMenu&&!activeMenu.menu.isConnected)closeMenu(false);
    if(!resourceId)return;
    var menu=Array.from(container.querySelectorAll('.content-card-menu')).find(function(node){return node.dataset.resource===resourceId;});
    if(menu&&menuOpeners.has(menu))menuOpeners.get(menu)();
  }
  global.ContentCard={create:create,captureMenu:captureMenu,restoreMenu:restoreMenu};
})(window);
