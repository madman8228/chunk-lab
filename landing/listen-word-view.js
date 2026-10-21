(function(root){
 'use strict';
 function create(item,{autoplay=true,onAutoplayChange,onNext,positionLabel=''}={}){
  const node=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const area=node('section','listen-word-view'),pictureSlot=node('div','listen-word-picture-slot'),sentence=node('div','listen-word-sentence'),feedback=node('p','listen-word-audio-status'),buttons=[],definitions=[];
  sentence.lang='en';feedback.setAttribute('role','status');feedback.hidden=true;
  let figure=null,destroyed=false,expanded=false;
  const audio=root.VocabularyCourseAudio.create(message=>{feedback.textContent=message;feedback.hidden=!message;});
  function toggle(){
   expanded=!expanded;
   if(expanded&&!figure){
    figure=node('figure','listen-word-picture');figure.id='listen-word-image';
    const src=item.images?.wide?.find(url=>url.endsWith('.webp'))||item.images?.wide?.[0];
    if(src){const image=node('img','');image.src=src;image.alt=item.scene||'';image.decoding='async';figure.append(image);}
    const caption=node('figcaption','listen-word-definition');caption.append(node('span','listen-word-meaning',item.meaning));figure.append(caption);
    if(item.translation)figure.append(node('div','listen-word-dialogue',item.translation));
    pictureSlot.append(figure);
    if(!src)figure.classList.add('without-image');
   }
   if(figure)figure.hidden=!expanded;
   for(const definition of definitions)definition.style.visibility=expanded?'visible':'hidden';
   for(const button of buttons)button.setAttribute('aria-expanded',String(expanded));
  }
  for(const part of item.exercise.parts){
   if(Object.hasOwn(part,'text'))sentence.append(document.createTextNode(part.text));
   else{
    const target=node('span','listen-word-target'),button=node('button','listen-word-token',part.answers[0]),definition=node('span','listen-word-word-details');
    const phonetic=typeof item.phonetic==='string'?item.phonetic.trim():'';
    definition.append(node('span',phonetic?'listen-word-phonetic':'listen-word-phonetic-missing',phonetic||'音标待补充'));definition.style.visibility='hidden';
    button.type='button';button.setAttribute('aria-label',part.answers[0]+'，查看图片和释义');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','listen-word-image');button.onclick=toggle;buttons.push(button);definitions.push(definition);target.append(button,definition);sentence.append(target);
   }
  }
  const clip=item.learning?.sentenceAudio?.audio,play=node('button','listen-word-play');play.type='button';play.setAttribute('aria-label','重播整句');play.title='重播整句';
  play.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>';
  function replay(){if(clip)audio.play(clip);}
  play.onclick=replay;play.disabled=!clip;
  sentence.append(play);area.append(pictureSlot,sentence,feedback);
  const controls=node('div','listen-word-controls'),progress=node('span','listen-word-position',positionLabel),next=node('button','listen-word-next','下一词');progress.setAttribute('aria-label','单词进度');next.type='button';next.onclick=()=>{audio.stop();onNext?.();};controls.append(progress,next);area.append(controls);
  const settings=node('label','listen-word-setting'),check=node('input','');
  check.type='checkbox';check.checked=autoplay;check.onchange=()=>{onAutoplayChange?.(check.checked);if(!check.checked)audio.stop();};settings.append(check,document.createTextNode('自动播放整句'));
  Promise.resolve().then(()=>{if(!destroyed&&autoplay&&clip)replay();});
  return {element:area,settings,stop:()=>audio.stop(),focus(){},destroy(){destroyed=true;audio.destroy();}};
 }
 root.VocabularyListenWordView={create};
})(window);
