(function(){
  'use strict';
  // Relocate existing controls only; course, answer and persistence state remain with main.
  var page=document.getElementById('pagePractice'),context=page?.querySelector('.practice-context'),bar=document.querySelector('.topbar-row'),stage=document.getElementById('stage');
  if(!page||!context||!bar||!stage)return;
  var anchor=document.createComment('practice context home');context.before(anchor);
  function sync(){
    var active=!page.classList.contains('hidden');
    var ready=active&&!stage.classList.contains('hidden')&&!page.querySelector('.course-access-panel');
    document.documentElement.classList.toggle('practice-reference-layout',active);
    if(ready&&context.parentElement!==bar)bar.querySelector('.brand').after(context);
    else if(!ready&&context.parentElement===bar)anchor.after(context);
  }
  new MutationObserver(sync).observe(page,{attributes:true,attributeFilter:['class'],childList:true});
  new MutationObserver(sync).observe(stage,{attributes:true,attributeFilter:['class']});
  sync();
})();
