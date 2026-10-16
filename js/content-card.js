(function(global){
  'use strict';
  // Presentation only: callers supply links/actions; this component never reads or writes account data.
  var activeMenu=null;
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
    article.append(node('span',options.kindLabel,'content-card-kind '+(library?'library-kind-tag':'discover-kind-tag')));
    var copy=node('div',undefined,'content-card-copy '+(library?'library-copy':'discover-copy'));
    var heading=node('h3');
    if(options.href){
      var link=node('a',resource.title,'content-card-title '+(library?'library-title-link':'discover-preview'));link.href=options.href;link.setAttribute('aria-label',options.linkLabel||resource.title);heading.append(link);
      article.classList.add(library?'is-clickable':'has-preview');
      article.addEventListener('click',function(event){if(event.target.closest('a,button,input,select,summary,details')||global.getSelection&&String(global.getSelection()))return;link.click();});
    }else heading.textContent=resource.title;
    copy.append(heading);
    if(options.items.length){
      var menu=node('details',undefined,'content-card-menu '+(library?'library-more':'discover-card-menu'));menu.dataset.resource=resource.resourceId;
      var trigger=node('summary');trigger.setAttribute('aria-label',resource.title+' 的更多操作');trigger.setAttribute('data-focus-key',resource.resourceId+':more');
      trigger.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>';
      var panel=node('div',undefined,'content-card-actions workspace-action-menu-panel '+(library?'library-more-actions':'workspace-actions'));
      options.items.forEach(function(item){panel.append(item);});menu.append(trigger,panel);copy.append(menu);bindMenu(menu,trigger,panel);
    }
    article.append(copy);return article;
  }
  global.ContentCard={create:create};
})(window);
