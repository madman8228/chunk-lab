(function(g){
 'use strict';let sequence=0;
 function create(item,steps,{onAttempt,onComplete}={}){
  const engine=g.JQKAClozeEngine,id='guided-'+(++sequence);
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,fn)=>{const n=el('button',text);n.type='button';n.onclick=fn;return n;};
  const root=el('div',undefined,'guided-practice'),toolbar=el('div',undefined,'guided-toolbar'),progress=el('span'),mode=el('div',undefined,'guided-modes');
  const typing=button('拼写输入',()=>setMode('typing')),choice=button('意群选择',()=>setMode('chunks')),shortcut=button('Shift 切换',()=>toggle());
  mode.setAttribute('aria-label','输入方式');shortcut.title='单独按 Shift，循环切换输入方式';shortcut.className='guided-shortcut';
  mode.append(typing,choice);toolbar.append(progress,mode,shortcut);
  const built=el('div',undefined,'guided-built');built.lang='en';built.setAttribute('aria-label','已完成的英文');
  const prompt=el('strong',undefined,'guided-prompt');prompt.id=id+'-prompt';prompt.setAttribute('aria-live','polite');
  const form=el('form',undefined,'guided-form'),input=el('input');input.type='text';input.autocomplete='off';input.spellcheck=false;input.autocapitalize='off';input.maxLength=200;input.setAttribute('aria-labelledby',prompt.id);
  const check=el('button','确认','guided-confirm');check.type='submit';
  const options=el('div',undefined,'guided-options'),feedback=el('p','','guided-feedback');feedback.id=id+'-feedback';feedback.setAttribute('role','status');input.setAttribute('aria-describedby',feedback.id);
  form.append(input,check);root.append(toolbar,built,prompt,form,options,feedback);
  let index=0,currentMode='typing',complete=false,destroyed=false,soloShift=false;const values={},drafts=[],accepted=[];
  function visible(){return !destroyed&&root.isConnected&&!root.closest('[hidden]');}
  function focus(){if(!visible()||complete)return;(currentMode==='typing'?input:options.querySelector('button'))?.focus({preventScroll:true});}
  function setMode(next){if(complete)return;drafts[index]=input.value;currentMode=next;render();focus();}
  function toggle(){setMode(currentMode==='typing'?'chunks':'typing');}
  function render(){
   progress.textContent=complete?'整句完成':(index+1)+' / '+steps.length;
   typing.setAttribute('aria-pressed',currentMode==='typing');choice.setAttribute('aria-pressed',currentMode==='chunks');
   built.textContent=accepted.join(' ');built.hidden=accepted.length===0;
   if(complete){prompt.textContent='整句完成';form.hidden=true;options.hidden=true;typing.disabled=true;choice.disabled=true;shortcut.disabled=true;return;}
   prompt.textContent=steps[index].prompt;form.hidden=currentMode!=='typing';options.hidden=currentMode!=='chunks';input.value=drafts[index]||'';input.removeAttribute('aria-invalid');feedback.textContent='';
   options.replaceChildren();const offset=index%steps[index].choices.length;
   steps[index].choices.slice(offset).concat(steps[index].choices.slice(0,offset)).forEach(value=>options.append(button(value,()=>submit(value,true))));
  }
  function submit(value,showError){
   if(complete||!visible())return;const step=steps[index];
   if(engine.normalize(value)!==engine.normalize(step.answer)){
    if(!showError)return;
    if(value.trim())onAttempt?.({values:{text:value},stepIndex:index,inputMode:currentMode});
    input.setAttribute('aria-invalid','true');
    const field=step.field&&engine.evaluate(item.exercise,{...values,[step.field]:value}).fields.find(f=>f.id===step.field);
    feedback.textContent=field?.message||'请根据“'+step.prompt+'”表达对应的意思，再试一次。';return;
   }
   onAttempt?.({values:{text:value},stepIndex:index,inputMode:currentMode});
   if(step.field){
    const field=engine.blanks(item.exercise).find(part=>part.id===step.field);
    const answer=field?.answers.find(value=>engine.normalize(value)===engine.normalize(step.answer));
    if(answer===undefined)throw Error('引导步骤与课程答案不一致');
    values[step.field]=answer;
   }
   accepted.push(step.answer);index++;
   if(index===steps.length){
    const result=engine.evaluate(item.exercise,values);if(!result.correct)throw Error('引导步骤与课程答案不一致');
    complete=true;render();destroy();if(onComplete)onComplete({values:{...values},sentence:engine.sentence(item.exercise,values),inputMode:currentMode==='chunks'?'chunks':'typing'});return;
   }
   render();focus();
  }
  form.onsubmit=e=>{e.preventDefault();submit(input.value,true);};
  input.oninput=e=>{drafts[index]=input.value;feedback.textContent='';input.removeAttribute('aria-invalid');if(!e.isComposing)submit(input.value,false);};
  input.oncompositionend=()=>submit(input.value,false);
  function keydown(e){if(!visible())return;if(e.key==='Shift'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.isComposing)soloShift=true;else soloShift=false;}
  function keyup(e){if(e.key!=='Shift')return;const solo=soloShift;soloShift=false;if(solo&&visible()&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!e.isComposing)toggle();}
  function blur(){soloShift=false;}
  function destroy(){destroyed=true;document.removeEventListener('keydown',keydown,true);document.removeEventListener('keyup',keyup,true);g.removeEventListener('blur',blur);}
  document.addEventListener('keydown',keydown,true);document.addEventListener('keyup',keyup,true);g.addEventListener('blur',blur);render();
  return {element:root,focus,destroy,values:()=>({...values})};
 }
 g.GuidedSentenceView={create};
})(window);
