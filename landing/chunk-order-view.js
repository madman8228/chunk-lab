(function(root){
 'use strict';
 let sequence=0;
 function create(item,{onAttempt,onComplete}={}){
  const model=root.VocabularyChunkOrder,engine=root.JQKAClozeEngine,activity=item.learning?.chunkOrder;model.validate(item,activity,engine);
  const node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
  const form=node('form'),selected=node('div'),pool=node('div'),feedback=node('p');
  const name='chunk-order-'+(++sequence),order=[],chunks=activity.chunks.slice(),buttons=new Map(),random=new Uint32Array(1);let completed=false,destroyed=false,active=true;
  form.className='chunk-order-practice';selected.className='chunk-order-selected';pool.className='chunk-order-pool';feedback.className='guided-feedback chunk-order-feedback';feedback.id=name+'-feedback';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
  selected.setAttribute('role','group');selected.setAttribute('aria-label','已选排列');pool.setAttribute('role','group');pool.setAttribute('aria-label','待选词块');form.setAttribute('aria-describedby',feedback.id);
  const empty=node('span','在下方选择词块');empty.className='chunk-order-empty';selected.append(empty);
  for(let i=chunks.length-1;i>0;i--){root.crypto.getRandomValues(random);const j=random[0]%(i+1);[chunks[i],chunks[j]]=[chunks[j],chunks[i]];}
  for(const chunk of chunks){const button=node('button',chunk.text);button.type='button';button.lang='en';button.onclick=()=>move(chunk.id);buttons.set(chunk.id,button);pool.append(button);}
  form.append(selected,pool,feedback);form.noValidate=true;
  function render(){
   selected.replaceChildren();pool.replaceChildren();if(!order.length)selected.append(empty);
   for(const [index,id] of order.entries()){const button=buttons.get(id);button.setAttribute('aria-label','第'+(index+1)+'块：'+button.textContent+'，点此撤回');selected.append(button);}
   for(const chunk of chunks)if(!order.includes(chunk.id)){const button=buttons.get(chunk.id);button.setAttribute('aria-label','选择词块：'+chunk.text);pool.append(button);}
   selected.removeAttribute('aria-invalid');
  }
  function move(id){
   if(destroyed||completed||!active)return;const index=order.indexOf(id);if(index<0)order.push(id);else order.splice(index,1);render();feedback.textContent='';
   // Keep native keyboard focus on the moved control, including the last block.
   buttons.get(id).focus();
   if(order.length===chunks.length)submit();
  }
  const values=()=>({chunkIds:order.slice()});
  function submit(event){
   event?.preventDefault();if(destroyed||completed||!active||order.length!==chunks.length)return;const answer=values(),result=model.evaluate(item,activity,answer,engine);
   onAttempt?.({values:answer,inputMode:'chunks'});
   if(!result.correct){selected.setAttribute('aria-invalid','true');feedback.textContent='词块顺序还不对，点已选词块撤回后重排。';selected.querySelector('button')?.focus();return;}
   completed=true;for(const button of buttons.values())button.disabled=true;selected.removeAttribute('aria-invalid');feedback.textContent='';
   onComplete?.({values:answer,inputMode:'chunks',practiceType:'chunk-order',practiceRevision:activity.revision,sentence:engine.sentence(item.exercise)});
  }
  form.addEventListener('submit',submit);render();
  function stop(){active=false;}
  function focus(){if(destroyed)return;active=true;if(!completed)(pool.querySelector('button')||selected.querySelector('button')).focus();}
  function destroy(){if(destroyed)return;destroyed=true;stop();form.removeEventListener('submit',submit);for(const button of buttons.values()){button.onclick=null;button.disabled=true;}}
  return {element:form,focus,values,stop,destroy};
 }
 root.VocabularyChunkOrderView={create};
})(window);
