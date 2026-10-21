(function(global){
 'use strict';
 function setTitle(host,text){
  const title=host.querySelector('[data-course-title]'),subtitle=host.querySelector('[data-course-subtitle]');
  if(!title)return;
  const separator=subtitle?text.lastIndexOf(' · '):-1;
  title.textContent=separator<0?text:text.slice(0,separator);
  title.title=text;
  if(subtitle)subtitle.textContent=separator<0?'':text.slice(separator+3);
 }
 global.CourseLearningHeader={setTitle};
})(window);
