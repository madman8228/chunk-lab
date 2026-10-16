(function(global){
  'use strict';
  var entries=[['home','首页'],['my-learning','我的内容'],['discover','发现'],['stats','学习记录']];
  function create(current,navigate){
    var nav=document.createElement('nav');
    nav.className='learning-global-nav';
    nav.setAttribute('aria-label','学习导航');
    entries.forEach(function(entry){
      var link=document.createElement('a');
      link.textContent=entry[1];
      link.href=entry[0]==='stats'?'stats.html':'main.html?view='+entry[0];
      if(current===entry[0])link.setAttribute('aria-current','page');
      if(navigate&&entry[0]!=='stats')link.addEventListener('click',function(event){
        if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
        event.preventDefault();navigate(entry[0]);
      });
      nav.append(link);
    });
    return nav;
  }
  global.LearningNavigation={create:create};
  var archiveNav=document.querySelector('[data-learning-navigation="stats"]');
  if(archiveNav)archiveNav.replaceWith(create('stats'));
})(window);
