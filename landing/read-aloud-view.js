(function(root){
 'use strict';
 function create(item,{onComplete}={}){
  const activity=item.learning?.readAloud;root.VocabularyReadAloud.validate(item,activity,root.JQKAClozeEngine);
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const form=node('form'),target=node('p',activity.text),privacy=node('p','录音仅留在当前页面，不上传、不评分。每次最多30秒；暂停或离开会丢弃录音。'),actions=node('div'),demo=node('button','听示范'),record=node('button','开始录音'),finish=node('button','结束录音'),cancel=node('button','取消录音'),preview=node('audio'),confirm=node('button','确认已练习'),feedback=node('p');
  form.className='read-aloud-practice';target.className='read-aloud-target';target.lang='en';privacy.className='read-aloud-privacy';actions.className='read-aloud-actions';feedback.className='guided-feedback read-aloud-feedback';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
  for(const button of [demo,record,finish,cancel])button.type='button';confirm.type='submit';confirm.className='guided-confirm';preview.controls=true;preview.preload='none';preview.setAttribute('aria-label','我的录音回放');preview.hidden=true;
  let active=true,destroyed=false,completed=false,listened=false,replayed=false;
  function clearPreview(){replayed=false;preview.pause();if(preview.getAttribute('src')){preview.removeAttribute('src');preview.load();}preview.hidden=true;}
  const example=root.VocabularyCourseAudio.create(message=>{if(!destroyed&&message)feedback.textContent=message;},{onEnded:()=>{if(active&&!destroyed&&!completed){listened=true;feedback.textContent='示范已听完。请录音并完整回听，再确认已练习。';render();}}});
  const capture=root.VocabularyReadAloudRecorder.create(value=>{
   if(destroyed)return;const clip=capture.recording();
   if(clip){if(preview.getAttribute('src')!==clip.url){clearPreview();preview.src=clip.url;}preview.hidden=false;}else clearPreview();
   feedback.textContent=value.error||({requesting:'请在浏览器中允许麦克风，也可取消。',recording:'正在录音，最长30秒；点击结束录音后回听。',stopping:'正在整理录音…',ready:'录音已就绪，请完整回听。',idle:'录音已清除；需要时请重新录制。'}[value.state]||'');render();
  });
  function render(){const state=capture.snapshot().state,busy=['requesting','recording','stopping'].includes(state),locked=!active||completed;demo.disabled=locked||busy;record.disabled=locked||busy;record.textContent=capture.recording()?'重新录音':'开始录音';finish.hidden=state!=='recording';finish.disabled=locked;cancel.hidden=!busy;cancel.disabled=locked;confirm.disabled=locked||!listened||!capture.recording()||!replayed;}
  demo.onclick=()=>{if(!active||completed||destroyed)return;preview.pause();example.play(activity.audio);};
  record.onclick=()=>{if(!active||completed||destroyed)return;example.stop();clearPreview();capture.start();};finish.onclick=()=>{if(active)capture.stop();};cancel.onclick=()=>capture.cancel();
  preview.onplay=()=>{if(destroyed)return;example.stop();replayed=false;render();};preview.onended=()=>{const clip=capture.recording();if(active&&!destroyed&&!completed&&clip&&preview.ended&&preview.currentSrc===clip.url){const heard=preview.played;replayed=preview.currentTime>0&&heard.length===1&&heard.start(0)<=0.02&&heard.end(0)>=preview.currentTime-0.02;feedback.textContent=replayed?'已回听。本次仅记录你确认已练习，不验证发音。':'还有未回听的片段，请从头完整回听后再确认。';render();}};preview.onerror=()=>{if(!destroyed){replayed=false;feedback.textContent='录音无法回放，请重新录制；不会记为已练习。';render();}};
  const values=()=>({listened,recorded:!!capture.recording(),replayed,confirmed:completed});
  function submit(event){event.preventDefault();if(!active||completed||destroyed)return;const report={...values(),confirmed:true};try{root.VocabularyReadAloud.report(item,activity,report,root.JQKAClozeEngine);}catch(_){feedback.textContent='请听完示范、录音并完整回听，再确认。';return;}completed=true;preview.pause();example.stop();feedback.textContent='已确认练习；这不是发音评分或掌握证明。';render();onComplete?.({values:report,inputMode:'speech',practiceType:'read-aloud'});}
  function discard(){example.stop();clearPreview();capture.cancel();}
  function stop(){active=false;discard();render();}
  function focus(){if(destroyed)return;active=true;render();if(!completed)demo.focus();}
  function visibility(){if(document.hidden)discard();}
  function destroy(){if(destroyed)return;destroyed=true;active=false;example.destroy();clearPreview();capture.destroy();for(const button of [demo,record,finish,cancel,confirm]){button.disabled=true;button.onclick=null;}preview.onplay=null;preview.onended=null;preview.onerror=null;form.removeEventListener('submit',submit);document.removeEventListener('visibilitychange',visibility);root.removeEventListener('pagehide',discard);}
  actions.append(demo,record,finish,cancel);form.append(target,privacy,actions,preview,confirm,feedback);form.addEventListener('submit',submit);document.addEventListener('visibilitychange',visibility);root.addEventListener('pagehide',discard);render();return {element:form,values,focus,stop,destroy};
 }
 root.VocabularyReadAloudView={create};
})(window);
