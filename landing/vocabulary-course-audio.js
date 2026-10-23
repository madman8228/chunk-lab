(function(root){
 'use strict';
 function create(onStatus,{onEnded}={}){
  const cache=new Map();let current=null,controller=null,timer=null,generation=0,destroyed=false,rate=1;
  function stop(){generation++;clearTimeout(timer);controller?.abort();controller=null;for(const entry of cache.values()){entry.audio.onplaying=null;entry.audio.onerror=null;entry.audio.onended=null;entry.audio.pause();}current=null;onStatus('');}
  async function play(clip){
   if(destroyed)return;stop();const ticket=generation,valid=()=>!destroyed&&ticket===generation;
   if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel();
   onStatus('正在读取课程音频…');timer=setTimeout(()=>{if(valid()){stop();onStatus('音频读取或播放超时，请再次点击重试。');}},12000);
   try{
    let entry=cache.get(clip.sha256);
    if(!entry){
     const audio=new Audio();if(!audio.canPlayType(clip.mimeType))throw Error('当前浏览器不支持该课程音频格式。');
     controller=new AbortController();const response=await fetch(clip.url,{signal:controller.signal,cache:'force-cache'});if(!response.ok)throw Error('课程音频暂时无法读取。');
     const bytes=await response.arrayBuffer();if(!valid())return;
     const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');if(!valid())return;
     if(bytes.byteLength!==clip.bytes||digest!==clip.sha256)throw Error('课程音频版本不一致，请重新读取课程。');
     const url=URL.createObjectURL(new Blob([bytes],{type:clip.mimeType}));audio.src=url;audio.preload='none';entry={audio,url};cache.set(clip.sha256,entry);
    }
    current=entry.audio;current.onplaying=()=>{if(valid()){clearTimeout(timer);onStatus('正在播放课程音频。');}};
    current.onended=()=>{if(valid()){onStatus('');onEnded?.();}};current.onerror=()=>{if(valid()){stop();onStatus('课程音频播放失败，请再次点击重试。');}};
    current.playbackRate=rate;current.preservesPitch=true;current.currentTime=0;await current.play();
   }catch(error){if(valid()){stop();onStatus(navigator.onLine===false?'音频尚未缓存，联网后可播放；可继续文字学习。':(error.message||'音频播放失败')+' 请再次点击重试；不会切换为浏览器合成声音。');}}
  }
  function visibility(){if(document.hidden)stop();}
  function destroy(){if(destroyed)return;stop();destroyed=true;for(const entry of cache.values()){entry.audio.removeAttribute('src');entry.audio.load();URL.revokeObjectURL(entry.url);}cache.clear();document.removeEventListener('visibilitychange',visibility);root.removeEventListener('pagehide',stop);}
  function setRate(value){if(![0.5,0.75,1,1.25,1.5,2].includes(value))throw Error('不支持此播放速度');rate=value;if(current)current.playbackRate=rate;}
  document.addEventListener('visibilitychange',visibility);root.addEventListener('pagehide',stop);return {play,stop,destroy,setRate};
 }
 root.VocabularyCourseAudio={create};
})(window);
