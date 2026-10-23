(function(global){
 'use strict';
 function create(options){
  const node=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const card=node('div','catalog-lesson'),media=node('div','catalog-lesson-media'+(options.customImage?' is-custom':'')),image=node('img',''),caption=node('div','catalog-lesson-caption');
  image.src=options.image;image.alt=options.imageAlt||'';image.loading='lazy';
  const title=node('span','lesson-name',options.title);title.title=options.title;
  caption.append(node('span','lesson-index',options.index),title);media.append(image,caption);
  const footer=node('div','catalog-lesson-footer'),meta=node('span','lesson-meta',options.meta);footer.append(meta);card.append(media,footer);
  return {card,footer,meta};
 }
 function setStatus(card,status,percent){
  var states={completed:['已完成','✓'], 'in-progress':['学习中',''],in_progress:['学习中',''], 'not-started':['未开始',''],not_started:['未开始',''],unknown:['待核实','']};
  var value=states[status]||states.unknown;
  var badge=card.querySelector('.lesson-status-badge');
  if(!badge){badge=document.createElement('span');badge.className='lesson-status-badge';var media=card.querySelector('.catalog-lesson-media');(media||card).append(badge);}
  badge.dataset.state=status.replace('_','-');badge.textContent=(value[1]?value[1]+' ':'')+value[0];
  card.dataset.learningState=badge.dataset.state;
  var label=card.querySelector('.directory-unit-state');
  if(label){label.dataset.state=badge.dataset.state;label.textContent=status==='in-progress'||status==='in_progress'?'学到 '+Math.max(0,Math.min(100,Math.round(percent||0)))+'%':value[0];}
 }
 global.LessonCard={create,setStatus};
})(window);
