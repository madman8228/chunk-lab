/* Ephemeral local microphone capture only; never uploads or writes learning data. */
(function(root){
 'use strict';
 const MAX_MS=30000,MAX_BYTES=2000000;
 function create(onChange=()=>{}){
  let state='idle',error='',generation=0,destroyed=false,stream=null,recorder=null,timer=null,parts=[],bytes=0,startedAt=0,recorded=null;
  const snapshot=()=>({state,error,hasRecording:!!recorded});
  const notify=()=>onChange(snapshot());
  function stopTracks(value){for(const track of value?.getTracks()||[]){track.onended=null;track.stop();}}
  function release(){
   generation++;root.clearTimeout(timer);timer=null;
   const old=recorder;recorder=null;if(old){old.ondataavailable=null;old.onstop=null;old.onerror=null;try{if(old.state!=='inactive')old.stop();}catch(_){/* Still release the microphone if the encoder fails. */}}
   stopTracks(stream);stream=null;parts=[];bytes=0;
   if(recorded){root.URL.revokeObjectURL(recorded.url);recorded=null;}
  }
  function fail(message){release();state='error';error=message;notify();}
  async function start(){
   if(destroyed||['requesting','recording','stopping'].includes(state))return false;
   release();error='';
   if(!root.isSecureContext||!root.navigator?.mediaDevices?.getUserMedia||typeof root.MediaRecorder!=='function'){fail('当前环境不能录音，请使用支持录音的安全页面；不会记为完成。');return false;}
   state='requesting';notify();const ticket=generation,valid=()=>!destroyed&&ticket===generation;
   try{
    const obtained=await root.navigator.mediaDevices.getUserMedia({audio:true,video:false});
    if(!valid()){stopTracks(obtained);return false;}stream=obtained;
    if(!stream.getAudioTracks().some(track=>track.readyState==='live'))throw Error('NO_AUDIO_TRACK');
    const preferred=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(type=>root.MediaRecorder.isTypeSupported?.(type));
    recorder=preferred?new root.MediaRecorder(stream,{mimeType:preferred}):new root.MediaRecorder(stream);
    recorder.ondataavailable=event=>{if(!valid())return;if(!event.data?.size)return;if(bytes+event.data.size>MAX_BYTES){fail('录音超过大小限制，请缩短后重新录制；本次录音已丢弃。');return;}parts.push(event.data);bytes+=event.data.size;};
    recorder.onerror=()=>{if(valid())fail('录音编码失败，请重新录制。');};
    recorder.onstop=()=>{
     if(!valid())return;root.clearTimeout(timer);timer=null;stopTracks(stream);stream=null;
     if(!bytes){fail('没有录到声音数据，请检查麦克风后重试。');return;}
     try{const mimeType=recorder.mimeType||parts[0].type;if(!mimeType)throw Error('MISSING_MIME');const blob=new root.Blob(parts,{type:mimeType});recorded={blob,url:root.URL.createObjectURL(blob),mimeType,bytes:blob.size,durationMs:Math.max(0,Date.now()-startedAt)};parts=[];recorder.ondataavailable=null;recorder.onstop=null;recorder.onerror=null;recorder=null;state='ready';notify();}catch(_){fail('录音无法生成回放，请重新录制。');}
    };
    for(const track of stream.getTracks())track.onended=()=>{if(valid()&&state==='recording')fail('麦克风已断开，请连接后重新录制。');};
    recorder.start(250);startedAt=Date.now();state='recording';timer=root.setTimeout(stop,MAX_MS);notify();return true;
   }catch(cause){if(!valid())return false;const message=cause?.name==='NotAllowedError'?'未获得麦克风权限，请允许后重试；不会记为完成。':cause?.name==='NotFoundError'||cause?.message==='NO_AUDIO_TRACK'?'没有可用麦克风，请连接设备后重试。':'麦克风暂时无法录音，请检查设备或浏览器权限后重试。';fail(message);return false;}
  }
  function stop(){
   if(destroyed||state!=='recording')return;state='stopping';root.clearTimeout(timer);timer=null;
   try{recorder.stop();stopTracks(stream);stream=null;if(state==='stopping')notify();}catch(_){fail('录音未能正常结束，请重新录制。');}
  }
  function cancel(){if(destroyed)return;release();state='idle';error='';notify();}
  function visibility(){if(root.document.hidden)cancel();}
  function destroy(){if(destroyed)return;release();destroyed=true;state='destroyed';error='';root.document.removeEventListener('visibilitychange',visibility);root.removeEventListener('pagehide',cancel);notify();}
  root.document.addEventListener('visibilitychange',visibility);root.addEventListener('pagehide',cancel);
  return {start,stop,cancel,destroy,snapshot,recording:()=>recorded?{...recorded}:null};
 }
 const api={create,MAX_MS,MAX_BYTES};root.VocabularyReadAloudRecorder=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
