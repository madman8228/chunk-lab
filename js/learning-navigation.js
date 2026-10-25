(function(global){
  'use strict';
  var entries=[['home','首页'],['my-learning','我的学习'],['discover','发现'],['stats','学习记录']];
  var navigationIcons={
    home:'<path d="m12 3 10 9h-3v9h-5v-6h-4v6H5v-9H2L12 3Z"/>',
    'my-learning':'<path d="M3 4h6a4 4 0 0 1 3 1.3A4 4 0 0 1 15 4h6v16h-6a4 4 0 0 0-3 1 4 4 0 0 0-3-1H3V4Zm8 2v12h2V6h-2Z"/>',
    discover:'<path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm5 5-3 7-7 3 3-7 7-3Zm-5 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/>',
    stats:'<path d="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm1 2h-2v5l4 2.4 1-1.7-3-1.8V7Z"/>'
  };
  function create(current,navigate){
    var nav=document.createElement('nav');
    nav.className='learning-global-nav';
    nav.setAttribute('aria-label','学习导航');
    entries.forEach(function(entry){
      var link=document.createElement('a');
      var icon=document.createElement('span');icon.className='learning-nav-icon';icon.setAttribute('aria-hidden','true');
      icon.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor" focusable="false">'+navigationIcons[entry[0]]+'</svg>';
      link.append(icon,document.createTextNode(entry[1]));
      link.href='main.html?view='+entry[0];
      if(current===entry[0])link.setAttribute('aria-current','page');
      if(navigate)link.addEventListener('click',function(event){
        if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
        if(entry[0]==='stats'){if(global.openStatsPage){event.preventDefault();global.openStatsPage();}return;}
        event.preventDefault();navigate(entry[0]);
      });
      nav.append(link);
    });
    return nav;
  }
  function studyTabs(current,navigate){
    var nav=document.createElement('nav');nav.className='study-section-nav';nav.setAttribute('aria-label','我的学习');
    [['courses','在学课程与词库','book'],['review','待复习','refresh'],['wrong','错题本','warn'],['sent','学习明细','stats']].forEach(function(entry){
      var link=document.createElement('a');link.dataset.studyTab=entry[0];link.href=entry[0]==='courses'?'main.html?view=my-learning':'main.html?view=stats&tab='+entry[0];
      if(current===entry[0])link.setAttribute('aria-current','page');
      if(global.Icons){var icon=document.createElement('span');icon.setAttribute('aria-hidden','true');icon.innerHTML=global.Icons.svg(entry[2]);link.append(icon);}
      link.append(document.createTextNode(entry[1]));
      link.onclick=function(event){if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;if(entry[0]!=='courses'&&global.openStatsPage){event.preventDefault();global.openStatsPage(entry[0]);}else if(entry[0]==='courses'&&navigate){event.preventDefault();navigate('my-learning');}};nav.append(link);
    });
    return nav;
  }
  function mount(current,navigate){
    var route=new URLSearchParams(global.location.search).get('view');
    if(entries.some(function(entry){return entry[0]===route;}))current=route;
    var host=document.getElementById('workspaceNavHost');if(!host)return create(current,navigate);
    host.learningNavigate=navigate;
    var nav=host.querySelector('.learning-global-nav');
    if(!nav){nav=create(current,function(view){if(host.learningNavigate)host.learningNavigate(view);});host.replaceChildren(nav);}
    Array.from(nav.children).forEach(function(link,index){if(entries[index][0]===current)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    return nav;
  }
  global.LearningNavigation={create:create,mount:mount,studyTabs:studyTabs};
  var archiveNav=document.querySelector('[data-learning-navigation="stats"]');
  if(archiveNav)archiveNav.replaceWith(create('stats'));
})(window);
