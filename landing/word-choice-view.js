(function(root){
 'use strict';
 let sequence=0;
 function create(item,{onAttempt,onComplete}={}){
  const model=root.VocabularyWordChoice,engine=root.JQKAClozeEngine,activity=item.learning?.wordChoice;model.validate(item,activity,engine);
  const node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
  const form=node('form'),sentence=node('p'),fields=node('fieldset'),legend=node('legend','选择合适的单词'),feedback=node('p');
  const name='word-choice-'+(++sequence),radios=[];let completed=false,destroyed=false,active=true;
  form.className='word-choice-practice';sentence.className='word-choice-sentence';sentence.lang='en';fields.className='word-choice-options';legend.className='word-choice-legend';
  feedback.className='guided-feedback word-choice-feedback';feedback.id=name+'-feedback';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');fields.setAttribute('aria-describedby',feedback.id);
  let blank;
  for(const part of item.exercise.parts){if(Object.hasOwn(part,'text'))sentence.append(document.createTextNode(part.text));else{blank=node('span','______');blank.className='word-choice-blank';blank.setAttribute('aria-label','待选单词');sentence.append(blank);}}
  const options=activity.options.slice(),random=new Uint32Array(1);
  for(let i=options.length-1;i>0;i--){root.crypto.getRandomValues(random);const j=random[0]%(i+1);[options[i],options[j]]=[options[j],options[i]];}
  fields.append(legend);
  for(const option of options){
   const label=node('label'),input=node('input'),text=node('span',option.text);input.type='radio';input.name=name;input.value=option.id;text.lang='en';label.append(input,text);fields.append(label);radios.push(input);
   input.onchange=()=>{fields.removeAttribute('aria-invalid');feedback.textContent='';submit();};
  }
  form.append(sentence,fields,feedback);form.noValidate=true;
  const values=()=>({optionId:radios.find(input=>input.checked)?.value||''});
  function submit(event){
   event?.preventDefault();if(destroyed||completed||!active)return;
   const selected=values(),result=model.evaluate(item,activity,selected,engine);
   if(selected.optionId)onAttempt?.({values:selected,inputMode:'choice'});
   if(!result.correct){fields.setAttribute('aria-invalid','true');feedback.textContent=result.feedback;(radios.find(input=>input.checked)||radios[0]).focus();return;}
   completed=true;fields.disabled=true;fields.removeAttribute('aria-invalid');blank.textContent=item.exercise.parts.find(part=>part.id===activity.field).answers[0];blank.removeAttribute('aria-label');feedback.textContent=result.feedback+' 选词正确；这是辅助识别练习，不代表独立掌握。';
   onComplete?.({values:selected,inputMode:'choice',practiceType:'word-choice',practiceRevision:activity.revision,sentence:engine.sentence(item.exercise)});
  }
  form.addEventListener('submit',submit);
  function stop(){active=false;}
  function focus(){if(destroyed)return;active=true;if(!completed)(radios.find(input=>input.checked)||radios[0]).focus();}
  function destroy(){if(destroyed)return;destroyed=true;stop();fields.disabled=true;form.removeEventListener('submit',submit);for(const input of radios)input.onchange=null;}
  return {element:form,focus,values,stop,destroy};
 }
 root.VocabularyWordChoiceView={create};
})(window);
