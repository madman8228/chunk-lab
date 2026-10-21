(function(root){
  'use strict';
  function create(exercise,{saved,translation,onChange,onAttempt,onComplete}={}){
    const engine=root.JQKAInitialsEngine,model=engine.prepare(exercise);let state=engine.start(model,saved),complete=false,composing=false,replaceNext=false;
    function el(tag,cls,text){const node=document.createElement(tag);node.className=cls||'';if(text!==undefined)node.textContent=text;return node;}
    const form=el('form','cloze-form initials-form');form.noValidate=true;
    if(translation){const meaning=el('p','initials-translation',translation);meaning.lang='zh-CN';form.append(meaning);}
    const row=el('div','cloze-sentence');row.lang='en';const inputs=[];
    const feedback=el('p','practice-feedback');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
    const hints=el('p','initials-help','按首字母选词 · 重复按切换 · 退格修改 · 填完按空格 / 回车确认');
    const choices=el('div','initials-candidates');choices.setAttribute('aria-label','待选词块');
    const bank=[...model.tokens.map((token,index)=>({id:token.id,word:token.word,index})),...model.vocabulary.filter(word=>!model.tokens.some(token=>token.word.toLowerCase()===word.toLowerCase())).map((word,index)=>({id:'extra-'+index,word,index:model.tokens.length+index}))].sort((a,b)=>a.word.toLowerCase().localeCompare(b.word.toLowerCase())||a.index-b.index);
    for(const group of model.groups){
      const wrapper=el('span','cloze-token initials-group'),words=el('span','initials-words');
      for(const index of group.indices){
        const token=model.tokens[index],input=el('input','cloze-blank initials-word');input.type='text';input.autocomplete='off';input.spellcheck=false;input.autocapitalize='off';input.enterKeyHint='next';input.name=token.id;input.setAttribute('aria-label',token.label);
        input.addEventListener('focus',()=>{state.active=index;render(false);});
        input.addEventListener('pointerdown',()=>{state.active=index;replaceNext=true;});
        input.addEventListener('keydown',event=>{
          if(event.isComposing||event.keyCode===229||composing||event.ctrlKey||event.metaKey||event.altKey)return;
          if(event.key==='Enter'||event.key===' '){event.preventDefault();if(event.repeat)return;if(state.words.every(Boolean))submit();else act(event.key);return;}
          if(/^[a-z]$/i.test(event.key)||event.key===' '||event.key==='Backspace'){event.preventDefault();act(event.key);}
        });
        input.addEventListener('compositionstart',()=>{composing=true;});
        input.addEventListener('compositionend',event=>{composing=false;if(/^[a-z]+$/i.test(event.data||''))for(const letter of event.data)act(letter);else{feedback.textContent='请切换到英文键盘。';render(false);}});
        input.addEventListener('input',event=>{
          if(composing||event.isComposing)return;
          if(event.inputType==='deleteContentBackward'){act('Backspace');return;}
          if(event.inputType==='insertCompositionText'){render(false);return;}
          const data=event.data||'';if(data)for(const letter of data)act(letter);else render(false);
        });
        inputs.push(input);words.append(input);if(token.punctuation)words.append(el('span','initials-punctuation',token.punctuation));
      }
      wrapper.append(words,el('span','cloze-gloss',group.meaning));row.append(wrapper);
    }
    const actions=el('div','initials-selection-row'),check=el('button','btn practice-primary','确认');check.type='submit';check.setAttribute('aria-keyshortcuts','Space Enter');check.title='空格 / 回车确认';actions.append(choices,check);form.append(row,actions,hints,feedback);
    function snapshot(){return {active:state.active,words:[...state.words]};}
    function render(move){
      inputs.forEach((input,index)=>{
        const token=model.tokens[index],value=state.words[index];input.value=value;input.dataset.active=String(index===state.active);
        // Detached controls have no inherited font yet. Measure only after mounting.
        if(!input.isConnected)return;
        // A chosen chunk can be longer than the answer slot (including an incorrect choice).
        const context=document.createElement('canvas').getContext('2d'),style=getComputedStyle(input);context.font=style.font;
        const size=parseFloat(style.fontSize)||20;
        const wordWidth=Math.max(size*1.4,context.measureText(token.word).width);
        input.style.setProperty('--blank-width',(Math.max(wordWidth,context.measureText(value).width)/size+.6)+'em');
        input.scrollLeft=0;
      });
      choices.replaceChildren();const value=state.words[state.active],seen=new Map();
      for(const chunk of bank){
        const normalized=chunk.word.toLowerCase(),occurrence=(seen.get(normalized)||0)+1;seen.set(normalized,occurrence);
        const used=state.words.filter((word,index)=>index!==state.active&&word.toLowerCase()===normalized).length>=occurrence;
        const selected=chunk.word===value&&!used;
        const button=el('button','initials-option',chunk.word);button.type='button';button.dataset.chunkId=chunk.id;button.dataset.initial=normalized[0];button.dataset.used=String(used);button.disabled=used;button.setAttribute('aria-pressed',String(selected));
        button.onclick=()=>{
          state.words[state.active]=chunk.word;
          if(state.active<model.tokens.length-1)state.active++;
          replaceNext=true;feedback.textContent='';changed();render(true);
        };
        choices.append(button);
      }
      if(move&&document.activeElement!==inputs[state.active])inputs[state.active].focus({preventScroll:true});
    }
    function changed(){if(onChange)onChange(snapshot());}
    function act(key){if(complete)return;if(replaceNext&&/^[a-z]$/i.test(key)&&state.words[state.active]?.[0].toLowerCase()!==key.toLowerCase())state.words[state.active]='';replaceNext=false;const response=engine.input(model,state,key);state=response.state;feedback.textContent=response.message||'';inputs.forEach(input=>input.removeAttribute('aria-invalid'));changed();render(true);}
    function submit(){
      if(complete)return;const result=engine.evaluate(model,state);if(onAttempt)onAttempt(result);
      inputs.forEach((input,index)=>{if(result.fields[index].state==='correct')input.removeAttribute('aria-invalid');else input.setAttribute('aria-invalid','true');});
      if(!result.correct){state.active=model.tokens.findIndex(token=>token.id===result.firstInvalid);replaceNext=true;feedback.textContent=result.fields[state.active].message;render(true);return;}
      complete=true;check.disabled=true;inputs.forEach(input=>input.readOnly=true);if(onComplete)onComplete({values:result.values});
    }
    form.onsubmit=event=>{event.preventDefault();submit();};render(false);
    return {element:form,refresh:()=>render(false),focus:()=>inputs[state.active].focus({preventScroll:true}),values:snapshot};
  }
  root.JQKAInitialsView={create};
})(window);
