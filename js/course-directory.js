/* Course-directory presentation; the host supplies confirmed progress and navigation. */
(function(global){
 'use strict';
 function mount(options){
  var root=options.root,course=options.course,lessons=options.lessons,rows=[],filter='all';
  function node(tag,cls,text){var el=document.createElement(tag);el.className=cls;if(text!==undefined)el.textContent=text;return el;}
  var hero=node('section','directory-overview'),copy=node('div','directory-overview-copy'),title=node('h2','',course.title),summary=node('p','directory-overview-items'),label=node('p','directory-overview-total-progress','正在核对学习进度…'),progress=node('progress',''),progressMeta=node('div','directory-overview-progress-meta');progress.max=100;progress.value=0;progress.setAttribute('aria-label','课程学习进度');
  progressMeta.append(summary,label);copy.append(title,progress,progressMeta);var actions=node('div','directory-overview-actions'),resume=node('button','directory-continue','开始学习');resume.type='button';resume.disabled=true;
  var review=node('a','directory-quick-review','快速复习');review.href='main.html?view=stats&tab=review';review.title='查看账号全部待复习内容';
  actions.append(resume,review);copy.append(actions);
  var metrics=node('aside','directory-passport-metrics');metrics.setAttribute('aria-label','学习统计');
  function metric(value,caption,kind){var box=node('div','directory-passport-metric '+kind),number=node('strong','',value),text=node('span','',caption);box.append(number,text);metrics.append(box);return number;}
  metric(options.streak===undefined?'—':String(options.streak)+' 天','全站连续学习','streak');
  var completedMetric=metric('—','完成课节','completed');
  var practicedMetric=metric('—','练习句子','practiced');
  hero.append(copy,metrics);
  var controls=node('div','directory-controls'),search=node('input','');search.type='search';search.placeholder='搜索课节名称';search.setAttribute('aria-label','搜索课节');controls.append(search);
  var buttons=[];['全部','未开始','学习中','已完成'].forEach(function(text,index){var button=node('button','',text);button.type='button';button.setAttribute('aria-pressed',String(index===0));button.onclick=function(){filter=['all','not-started','in-progress','completed'][index];buttons.forEach(function(item){item.setAttribute('aria-pressed',String(item===button));});draw();};buttons.push(button);controls.append(button);});
  var empty=node('p','directory-empty','没有符合条件的课节。');empty.hidden=true;root.prepend(hero,controls);root.append(empty);
  var cards=Array.from(root.querySelectorAll('.catalog-lesson'));
  cards.forEach(function(card,index){rows.push({card:card,lesson:lessons[index],status:'unknown'});});
  function draw(){var count=0;rows.forEach(function(row){var visible=(filter==='all'||row.status===filter)&&row.lesson.title.toLowerCase().includes(search.value.trim().toLowerCase());row.card.hidden=!visible;if(visible)count++;});root.querySelectorAll('.catalog-group').forEach(function(group){group.hidden=!Array.from(group.querySelectorAll('.catalog-lesson')).some(function(card){return !card.hidden;});});empty.hidden=count>0;}
  search.oninput=draw;
  Promise.all(rows.map(async function(row){var result=await options.progress(row.lesson);if(!root.isConnected)return;row.result=result;row.status=result.ready?(result.total>0&&result.done===result.total?'completed':result.done>0||result.started?'in-progress':'not-started'):'unknown';var footer=row.card.querySelector('.catalog-lesson-footer');var state=node('span','directory-unit-state',{'completed':'已完成','in-progress':'学习中','not-started':'未开始','unknown':'进度待核实'}[row.status]);var bar=node('progress','directory-unit-progress');bar.max=100;bar.value=result.ready&&result.total?Math.round(result.done/result.total*100):0;bar.setAttribute('aria-label',row.lesson.title+' 学习进度');footer.append(state,bar);})).then(function(){
   if(!root.isConnected)return;
   if(global.LessonCard)rows.forEach(function(row){LessonCard.setStatus(row.card,row.status,row.result.total?row.result.done/row.result.total*100:0);});
   var ready=rows.every(function(row){return row.result&&row.result.ready;}),done=rows.filter(function(row){return row.status==='completed';}).length;
   var percent=ready&&rows.length?Math.round(rows.reduce(function(sum,row){return sum+(row.result.total?row.result.done/row.result.total:0);},0)/rows.length*100):0;
   label.textContent=ready?'已完成 '+done+' / '+rows.length+' 课节 · 总进度 '+percent+'%':'部分课节进度暂未确认';progress.value=percent;
   var totalItems=rows.reduce(function(sum,row){return sum+(row.result.total||0);},0),practiced=rows.reduce(function(sum,row){return sum+(row.result.done||0);},0);
   summary.textContent=ready?totalItems+' 条学习内容':'内容总数待核实';
   completedMetric.textContent=ready?done+' / '+rows.length:'—';practicedMetric.textContent=ready?practiced+' / '+totalItems:'—';
   buttons.forEach(function(button,index){button.textContent=['全部','未开始','学习中','已完成'][index]+'（'+(index===0?rows.length:rows.filter(function(row){return row.status===['all','not-started','in-progress','completed'][index];}).length)+'）';});
   var next=rows.find(function(row){return row.status==='in-progress'&&row.lesson.available!==false;})||rows.find(function(row){return row.status==='not-started'&&row.lesson.available!==false;})||rows.find(function(row){return row.lesson.available!==false;});
   if(next&&next.status==='in-progress')title.textContent='继续「'+next.lesson.title+'」，还差 '+Math.max(0,100-Math.round(next.result.done/Math.max(1,next.result.total)*100))+'% 完成本课';
   else if(done===rows.length&&rows.length)title.textContent='本课程已学完，继续复习巩固';
   else if(next&&done>0)title.textContent='下一课：「'+next.lesson.title+'」';
   resume.disabled=!next;resume.textContent=done===rows.length?'再次学习':next&&next.status==='in-progress'?'继续学习 · '+next.lesson.title:'开始学习';resume.onclick=function(){if(next)options.open(next.lesson);};draw();
  }).catch(function(){summary.textContent='内容总数暂不可用';label.textContent='学习进度暂时无法读取，可从下方选择课节。';});
 }
 global.CourseDirectory={mount:mount};
})(window);
