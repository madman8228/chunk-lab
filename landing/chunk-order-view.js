(function(root){
 'use strict';
 let sequence=0;
 function create(item,{onAttempt,onComplete}={}){
  const model=root.VocabularyChunkOrder,engine=root.JQKAClozeEngine,activity=item.learning?.chunkOrder;
  model.validate(item,activity,engine);
  const node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
  const form=node('form'),feedback=node('p'),name='chunk-order-'+(++sequence),chunks=activity.chunks.slice();
  let completed=false,destroyed=false,active=true;
  form.className='chunk-order-practice';feedback.className='guided-feedback chunk-order-feedback';feedback.id=name+'-feedback';
  feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');form.setAttribute('aria-describedby',feedback.id);form.noValidate=true;
  for(let i=chunks.length-1;i>0;i--){const random=new Uint32Array(1);root.crypto.getRandomValues(random);const j=random[0]%(i+1);[chunks[i],chunks[j]]=[chunks[j],chunks[i]];}
  const selection=root.ChunkSelection.createChunkSelection({mode:'sequence',className:'wordbook-chunk-selection',
   selectedClass:'chunk-order-selected',poolClass:'chunk-order-pool',buttonClass:'chunk-selection-button',poolLabel:'待选词块',
   tokens:chunks.map(chunk=>({id:chunk.id,text:chunk.text})),onSubmit:tokens=>{
    if(destroyed||completed||!active)return 'blocked';
    const answer={chunkIds:tokens.map(token=>token.id)},result=model.evaluate(item,activity,answer,engine);
    onAttempt?.({values:answer,inputMode:'chunks'});
    if(!result.correct)return {status:'incorrect',message:'词块顺序还不对，点已选词块撤回后重排。'};
    completed=true;feedback.textContent='';
    onComplete?.({values:answer,inputMode:'chunks',practiceType:'chunk-order',practiceRevision:activity.revision,sentence:engine.sentence(item.exercise)});
    return 'success';
   }});
  form.append(selection,feedback);
  form.addEventListener('submit',event=>event.preventDefault());
  const values=()=>({chunkIds:selection.getSelection().map(token=>token.id)});
  function stop(){active=false;selection.setActive(false);}
  function focus(){if(destroyed)return;active=true;selection.setActive(true);(selection.querySelector('.chunk-order-pool button')||selection.querySelector('.chunk-order-selected button'))?.focus();}
  function destroy(){if(destroyed)return;destroyed=true;stop();selection.destroy();}
  return {element:form,focus,values,stop,destroy};
 }
 root.VocabularyChunkOrderView={create};
})(window);
