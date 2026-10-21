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
 global.LessonCard={create};
})(window);
