(function(root){
 'use strict';
 const preferenceKey='chunklab.wordbookAccent';
 function getAccent(){try{const saved=root.localStorage.getItem(preferenceKey);if(['en-US','en-GB'].includes(saved))return saved;}catch{}return 'en-US';}
 function audioFor(item,accent=getAccent()){const activity=item.learning?.sentenceAudio;return activity?.audioByAccent?.[accent]||(accent==='en-US'?activity?.audio:null)||null;}
 function phoneticFor(item,accent=getAccent()){const value=item.phonetics?.[accent]||(accent==='en-GB'?item.phonetic:null);return value?.trim()||((accent==='en-GB'?'英式':'美式')+'音标待补充');}
 function create(item,{autoplay=true,onAutoplayChange,onNext,onPrevious,hasPrevious=false,positionLabel='',rate=1,onRateChange,getFavorite,onFavorite}={}){
  const node=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const area=node('section','listen-word-view'),pictureSlot=node('div','listen-word-picture-slot'),sentence=node('div','listen-word-sentence'),feedback=node('p','listen-word-audio-status'),buttons=[];
  sentence.lang='en';feedback.setAttribute('role','status');feedback.hidden=true;
  let figure=null,destroyed=false,expanded=false;
  const card=node('div','listen-word-card'),placeholder=node('div','listen-word-placeholder','点击句中的高亮单词，查看图片和释义');
  pictureSlot.append(placeholder);
  const audio=root.VocabularyCourseAudio.create(message=>{feedback.textContent=message;feedback.hidden=!message;});
  audio.setRate?.(rate);
  function toggle(){
   expanded=!expanded;
   placeholder.hidden=expanded;
   if(expanded&&!figure){
    figure=node('figure','listen-word-picture');figure.id='listen-word-image';
    const src=item.images?.wide?.find(url=>url.endsWith('.webp'))||item.images?.wide?.[0];
    if(src){const image=node('img','');image.src=src;image.alt=item.scene||'';image.decoding='async';image.onerror=()=>{image.hidden=true;figure.classList.add('without-image');if(!figure.querySelector('.listen-word-media-missing'))figure.append(node('p','listen-word-media-missing',navigator.onLine===false?'图片尚未缓存，联网后可加载。':'图片暂时无法加载，可继续文字学习。'));};figure.append(image);}
    const caption=node('figcaption','listen-word-definition');caption.append(node('span','listen-word-meaning',item.meaning));figure.append(caption);
    if(item.translation)figure.append(node('div','listen-word-dialogue',item.translation));
    pictureSlot.append(figure);
    if(!src)figure.classList.add('without-image');
   }
   if(figure)figure.hidden=!expanded;
   for(const button of buttons)button.setAttribute('aria-expanded',String(expanded));
  }
  for(const part of item.exercise.parts){
   if(Object.hasOwn(part,'text'))sentence.append(document.createTextNode(part.text));
   else{
    const target=node('span','listen-word-target'),button=node('button','listen-word-token',part.answers[0]);
    button.type='button';button.setAttribute('aria-label',part.answers[0]+'，查看图片和释义');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','listen-word-image');button.onclick=toggle;buttons.push(button);target.append(button);sentence.append(target);
   }
  }
  const play=node('button','listen-word-play');play.type='button';play.setAttribute('aria-label','重播整句');play.title='重播整句';
  play.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>';
  const activity=item.learning?.sentenceAudio,accentSelect=node('select','listen-word-accent');accentSelect.setAttribute('aria-label','发音口音');
  for(const [value,label] of [['en-US','美式'],['en-GB','英式']]){const option=node('option','',label);option.value=value;accentSelect.append(option);}
  let accent=getAccent();
  accentSelect.value=accent;
  const tools=node('div','listen-word-assistance'),phoneticValue=node('span','listen-word-pronunciation'),translation=node('p','listen-word-translation',item.translation||'暂无句子翻译'),translate=node('button','listen-word-translate','显示翻译');
  function selectedClip(){return audioFor(item,accent);}
  function refreshAccent(){phoneticValue.textContent=phoneticFor(item,accent);play.disabled=!activity?.audio&&!activity?.audioByAccent?.['en-US']&&!activity?.audioByAccent?.['en-GB'];}
  function replay(){const selected=selectedClip();if(selected)audio.play(selected);else{feedback.textContent=(accent==='en-GB'?'暂无英式音频':'暂无美式音频');feedback.hidden=false;}}
  accentSelect.onchange=()=>{accent=accentSelect.value;try{root.localStorage.setItem(preferenceKey,accent);}catch{}audio.stop();feedback.textContent='';feedback.hidden=true;refreshAccent();};
  play.onclick=replay;refreshAccent();
  play.append(document.createTextNode('朗读句子'));translation.hidden=true;translate.type='button';translate.setAttribute('aria-expanded','false');translate.onclick=()=>{translation.hidden=!translation.hidden;translate.textContent=translation.hidden?'显示翻译':'收起翻译';translate.setAttribute('aria-expanded',String(!translation.hidden));};
  tools.append(play,phoneticValue,accentSelect,translate);card.append(pictureSlot,sentence,tools,translation,feedback);area.append(card);
  const controls=node('div','listen-word-controls'),progress=node('span','listen-word-position',positionLabel),previous=node('button','listen-word-previous','← 上一词'),next=node('button','listen-word-next','下一词 →');progress.setAttribute('aria-label','单词进度');previous.type='button';previous.disabled=!hasPrevious;previous.onclick=()=>{audio.stop();onPrevious?.();};next.type='button';next.onclick=()=>{audio.stop();onNext?.();};controls.append(previous,progress,next);area.append(controls);
  const actions=node('div','listen-word-bottom-actions'),favorite=node('button','listen-word-favorite'),speed=node('select','listen-word-speed');
  favorite.type='button';favorite.setAttribute('aria-label','收藏当前单词');favorite.title='收藏当前单词';favorite.setAttribute('aria-pressed','false');
  favorite.innerHTML='<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4V4Z"/></svg>';
  const setFavorite=selected=>{favorite.setAttribute('aria-pressed',String(selected));favorite.setAttribute('aria-label',selected?'取消收藏当前单词':'收藏当前单词');favorite.title=selected?'取消收藏当前单词':'收藏当前单词';};
  favorite.disabled=!onFavorite;favorite.onclick=async()=>{favorite.disabled=true;try{const selected=await onFavorite();if(!destroyed){setFavorite(selected);feedback.textContent=selected?'单词收藏已保存在本机，联网后自动同步。':'已取消单词收藏，联网后自动同步。';feedback.hidden=false;}}catch(error){if(!destroyed){feedback.textContent=error.message||'收藏暂时不可用，请稍后重试。';feedback.hidden=false;}}finally{if(!destroyed)favorite.disabled=false;}};
  if(getFavorite){favorite.disabled=true;Promise.resolve().then(getFavorite).then(selected=>{if(!destroyed)setFavorite(selected);}).catch(()=>{}).finally(()=>{if(!destroyed)favorite.disabled=!onFavorite;});}
  speed.setAttribute('aria-label','语音播放速度');speed.title='语音播放速度';for(const value of [0.5,0.75,1,1.25,1.5,2]){const option=node('option','',value+'×');option.value=String(value);option.selected=value===rate;speed.append(option);}speed.onchange=()=>{const value=Number(speed.value);audio.setRate?.(value);onRateChange?.(value);};actions.append(favorite,speed);controls.insertBefore(actions,next);
  const settings=node('label','listen-word-setting'),check=node('input','');
  check.type='checkbox';check.setAttribute('role','switch');check.checked=autoplay;check.onchange=()=>{onAutoplayChange?.(check.checked);if(!check.checked)audio.stop();};settings.append(document.createTextNode('自动播放整句'),check);
  Promise.resolve().then(()=>{if(!destroyed&&autoplay&&selectedClip())replay();});
  return {element:area,settings,stop:()=>audio.stop(),focus(){},destroy(){destroyed=true;audio.destroy();}};
 }
 root.VocabularyListenWordView={create,getAccent,audioFor,phoneticFor};
})(window);
