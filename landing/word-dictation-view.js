(function(root){
 'use strict';
 let sequence=0;
 function create(item,{onAttempt,onComplete}={}){
  const model=root.VocabularyWordDictation,activity=item.learning?.wordDictation;model.validate(item,activity);
  const node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
  const section=node('section'),play=node('button'),playLabel=node('span','听单词'),form=node('form'),label=node('label','听写答案'),entry=node('div'),segments=node('div'),input=node('input'),confirm=node('button','确认'),feedback=node('p');
  section.className='dictation-practice';form.className='guided-form';feedback.className='guided-feedback';feedback.id='dictation-feedback-'+(++sequence);feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
  input.id='dictation-answer-'+sequence;label.htmlFor=input.id;input.name='word';input.type='text';input.maxLength=200;input.autocomplete='off';input.autocapitalize='off';input.spellcheck=false;input.enterKeyHint='done';input.setAttribute('aria-describedby',feedback.id);input.lang='en';
  const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');icon.innerHTML='<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>';
  play.type='button';play.className='dictation-play';playLabel.className='dictation-play-label';play.append(icon,playLabel);play.setAttribute('aria-label','播放单词音频');confirm.type='submit';confirm.className='guided-confirm';confirm.disabled=true;form.noValidate=true;label.className='dictation-answer-label';entry.className='dictation-entry';segments.className='dictation-segments';segments.setAttribute('aria-hidden','true');entry.append(input,segments);form.append(entry,confirm);section.append(play,label,form,feedback);
  const target=Array.from(item.word.normalize('NFKC').trim().replace(/\s+/g,' '));
  function renderSegments(){const count=target.length;segments.replaceChildren();for(let i=0;i<count;i++){const segment=node('span');segment.className=target[i]===' '?'dictation-space':'dictation-segment';segments.append(segment);}entry.style.setProperty('--dictation-length',String(count));syncScroll();}
  function syncScroll(){segments.style.transform='translateX('+(-input.scrollLeft)+'px)';}
  function playState(text,accessible){playLabel.textContent=text;play.setAttribute('aria-label',accessible);}
  input.addEventListener('scroll',syncScroll);renderSegments();
  let audio=null,objectUrl=null,controller=null,timer=null,generation=0,heard=false,complete=false,destroyed=false,loading=false;
  function stop(){
   generation++;clearTimeout(timer);controller?.abort();controller=null;loading=false;
   if(audio){audio.onplaying=null;audio.onerror=null;audio.onended=null;audio.pause();}
   play.disabled=destroyed;play.removeAttribute('aria-busy');playState('听单词','播放单词音频');
  }
  function failure(message){stop();heard=false;confirm.disabled=true;feedback.textContent=message;playState('重试','重试播放音频');}
  async function playback(){
   if(destroyed||loading)return;stop();const ticket=generation;loading=true;play.disabled=true;play.setAttribute('aria-busy','true');playState('加载中','正在读取课程音频');feedback.textContent='正在读取课程音频…';
   const current=()=>!destroyed&&ticket===generation;
   timer=setTimeout(()=>{if(current())failure('音频读取或播放超时，请重试；输入已保留。');},12000);
   try{
    if(!audio){
     const candidate=new Audio();if(!candidate.canPlayType(activity.audio.mimeType))throw Error('当前浏览器不支持该课程音频格式。');
     controller=new AbortController();
     const response=await fetch(activity.audio.url,{signal:controller.signal,cache:'force-cache'});if(!response.ok)throw Error('课程音频暂时无法读取。');
     const bytes=await response.arrayBuffer();if(!current())return;
     const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(value=>value.toString(16).padStart(2,'0')).join('');if(!current())return;
     if(bytes.byteLength!==activity.audio.bytes||digest!==activity.audio.sha256)throw Error('课程音频版本不一致，请重新读取课程。');
     objectUrl=URL.createObjectURL(new Blob([bytes],{type:activity.audio.mimeType}));candidate.src=objectUrl;candidate.preload='none';audio=candidate;
    }
    audio.onplaying=()=>{if(!current())return;clearTimeout(timer);heard=true;loading=false;play.disabled=false;play.removeAttribute('aria-busy');playState('再听一次','重新播放音频');confirm.disabled=complete;feedback.textContent='音频正在播放。';};
    audio.onerror=()=>{if(current())failure('音频播放失败，请重试；输入已保留。');};
    audio.onended=()=>{if(current())feedback.textContent=complete?'听写正确；这是辅助练习结果。':'';};
    audio.currentTime=0;await audio.play();
   }catch(error){if(current())failure((error.message||'音频播放失败')+' 可重试播放；输入已保留。');}
  }
  play.onclick=playback;
  form.onsubmit=event=>{
   event.preventDefault();if(destroyed||complete)return;
   if(!heard){feedback.textContent='请先成功播放课程音频。';return;}
   const result=model.evaluate(item,activity,{word:input.value});
   if(input.value.trim())onAttempt?.({values:{word:input.value},inputMode:'typing'});
   if(!result.correct){input.setAttribute('aria-invalid','true');feedback.textContent='拼写尚不正确，请再听一次；输入已保留。';input.focus();return;}
   complete=true;input.readOnly=true;confirm.disabled=true;feedback.textContent='听写正确；这是辅助练习结果。';stop();
   onComplete?.({values:{word:input.value},inputMode:'typing',practiceType:'word-dictation',practiceRevision:activity.revision});
  };
  input.oninput=()=>{input.removeAttribute('aria-invalid');feedback.textContent='';renderSegments();};
  function visibility(){if(document.hidden)stop();}
  function destroy(){if(destroyed)return;destroyed=true;stop();if(audio){audio.removeAttribute('src');audio.load();}if(objectUrl)URL.revokeObjectURL(objectUrl);document.removeEventListener('visibilitychange',visibility);root.removeEventListener('pagehide',stop);}
  document.addEventListener('visibilitychange',visibility);root.addEventListener('pagehide',stop);
  return {element:section,focus:()=>{if(!destroyed)input.focus();},values:()=>({word:input.value}),stop,destroy};
 }
 root.VocabularyWordDictationView={create};
})(window);
