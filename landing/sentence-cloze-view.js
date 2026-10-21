(function(root){
  'use strict';
  let sequence=0;
  function create(exercise,{onAttempt,onComplete,annotated=false}={}){
    const engine=root.JQKAClozeEngine;engine.validate(exercise);
    const form=document.createElement('form');form.className='cloze-form';form.noValidate=true;
    const row=document.createElement('div');row.className='cloze-sentence';row.lang='en';form.append(row);
    const fields=[],feedback=document.createElement('p');feedback.id='cloze-feedback-'+(++sequence);feedback.className='practice-feedback';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
    let complete=false;
    let tokenIndex=0;
    function appendToken(content){
      if(!annotated){row.append(content);return;}
      const token=document.createElement('span');token.className='cloze-token';
      const gloss=document.createElement('span');gloss.className='cloze-gloss';gloss.lang='zh-CN';gloss.textContent=(exercise.annotations||exercise.glosses)?.[tokenIndex++]||'';
      token.append(content,gloss);row.append(token);
    }
    for(const part of exercise.parts){
      if(Object.hasOwn(part,'text')){for(const value of annotated&&!exercise.annotations?(part.text.match(/\S+/g)||[]):[annotated?part.text.trim():part.text]){const text=document.createElement('span');text.className='cloze-text';text.textContent=value;appendToken(text);}continue;}
      const input=document.createElement('input');input.type='text';input.name=part.id;input.autocomplete='off';input.spellcheck=false;input.autocapitalize='off';input.maxLength=200;
      input.className='cloze-blank';input.setAttribute('aria-label',part.label);input.setAttribute('aria-describedby',feedback.id);
      input.style.setProperty('--blank-width',Math.min(24,Math.max(4,...part.answers.map(answer=>answer.length+1)))+'ch');
      fields.push(input);appendToken(input);
    }
    const actions=document.createElement('div');actions.className='cloze-actions';
    const check=document.createElement('button');check.type='submit';check.className='btn practice-primary';check.textContent='检查';actions.append(check);form.append(actions,feedback);
    function values(){return Object.fromEntries(fields.map(field=>[field.name,field.value]));}
    function focus(field){field.focus({preventScroll:true});}
    function submit(){
      if(complete)return;
      const result=engine.evaluate(exercise,values());
      if(onAttempt)onAttempt(result);
      for(const field of fields){const status=result.fields.find(status=>status.id===field.name);field.dataset.state=status.state;if(status.state!=='correct')field.setAttribute('aria-invalid','true');else field.removeAttribute('aria-invalid');}
      if(!result.correct){feedback.textContent=result.fields.filter(field=>field.message).map(field=>field.message).join(' ');focus(fields.find(field=>field.name===result.firstInvalid));return;}
      complete=true;check.disabled=true;fields.forEach(field=>field.readOnly=true);
      if(onComplete)onComplete({values:values(),sentence:engine.sentence(exercise,values())});
    }
    form.onsubmit=event=>{event.preventDefault();submit();};
    fields.forEach((field,index)=>{
      field.enterKeyHint=index<fields.length-1?'next':'done';
      field.onkeydown=event=>{
        if(event.key!=='Enter'||event.isComposing||event.keyCode===229)return;
        event.preventDefault();
        if(index<fields.length-1&&field.value.trim()){focus(fields[index+1]);return;}
        submit();
      };
      field.oninput=()=>{field.removeAttribute('aria-invalid');delete field.dataset.state;feedback.textContent='';};
    });
    return {element:form,focus:()=>focus(fields[0]),values};
  }
  root.JQKAClozeView={create};
})(window);
