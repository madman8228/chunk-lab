(function(root){
  'use strict';
  const engine=root.JQKAActionEngine,task=root.JQKAChargerQuest;
  const host=document.getElementById('wordAdventure'),library=document.getElementById('wordLibrary'),toggle=document.getElementById('toggleLibrary');
  let state=engine.start(task),paused=false,started=false,draft={};
  function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
  function button(text,callback,cls='btn btn-white'){const node=el('button',cls,text);node.type='button';node.onclick=callback;return node;}
  const heading=el('header','adventure-heading');
  const speechStatus=el('p','quest-audio-status');speechStatus.setAttribute('role','status');
  function speak(text){
    if(!('speechSynthesis' in root)){speechStatus.textContent='此浏览器不支持朗读，请阅读例句。';return;}
    root.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang='en-GB';
    utterance.onerror=()=>{speechStatus.textContent='暂时无法朗读，请稍后再试。';};root.speechSynthesis.speak(utterance);
  }
  const scene=el('picture','quest-scene');
  const source=el('source'),image=el('img');source.type='image/avif';image.alt=task.image.alt;image.width=320;image.height=180;image.decoding='async';scene.append(source,image);
  // The current task's artwork is requested only when the game is actually opened.
  function loadImage(){if(image.hasAttribute('src'))return;source.srcset=task.image.avif;image.src=task.image.webp;}
  const stage=el('div','quest-stage');
  const controls=el('footer','quest-controls');
  const pauseButton=button('暂停 / 退出',()=>{paused=true;render(true);});
  const restartButton=button('重新开始',()=>{
    if(started&&!root.confirm('重新开始这次任务？当前轮的进度将重置。'))return;
    state=engine.start(task);paused=false;started=false;draft={};render(true);
  });
  controls.append(pauseButton,restartButton);
  host.append(heading,scene,stage,controls,el('p','quest-session-note','本轮表达仅在当前页面保留，不计入已掌握。'));
  function render(focus=false){
    const node=task.nodes[state.node];host.dataset.sessionActive=String(started&&!node.terminal);
    host.dataset.complete=String(!!node.terminal);scene.hidden=!!node.terminal;heading.hidden=!!node.terminal;controls.hidden=!!node.terminal;
    heading.replaceChildren();
    if(node.learning){
      const learn=node.learning;
      const wordRow=el('div','quest-word-row'),word=el('h2','quest-word',learn.word);word.lang='en';
      const audio=button('',()=>speak(learn.word),'quest-audio');audio.setAttribute('aria-label','听发音');audio.title='听发音';
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M11 5 6 9H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14');svg.append(path);audio.append(svg);wordRow.append(word,audio);
      heading.append(wordRow,el('p','quest-meaning',learn.phonetic+' · '+learn.meaning),speechStatus);
    }
    stage.replaceChildren();
    pauseButton.hidden=paused||node.terminal;restartButton.hidden=!started;
    if(paused){
      const title=el('h3','','任务已暂停');title.tabIndex=-1;
      stage.append(title,el('p','','你可以离开；留在此页，随时继续。'),button('继续任务',()=>{paused=false;render(true);},'btn quest-primary'));
      const home=el('a','quest-home','回首页');home.href='index.html';stage.append(home);
      if(focus)title.focus({preventScroll:true});return;
    }
    const prompt=el('h3','quest-prompt',node.prompt);prompt.tabIndex=-1;
    if(!node.learning&&!node.terminal)stage.append(prompt);
    if(node.exercise){
      const view=root.JQKAInitialsView.create(node.exercise,{
        translation:node.learning?.translation,
        saved:draft[state.node],
        onChange:values=>{draft[state.node]=values;started=true;host.dataset.sessionActive='true';restartButton.hidden=false;},
        onComplete:answer=>{started=true;state=engine.submit(task,state,answer.values).state;render(true);}
      });
      stage.append(view.element);
      view.refresh();
      // Mobile users keep control of the soft keyboard; desktop can continue with Enter.
      if(focus&&root.matchMedia('(pointer:fine)').matches)view.focus();else if(focus)prompt.focus({preventScroll:true});
    }else if(node.terminal){
      const list=el('ul','quest-earned');for(const id of state.earned){const item=el('li');item.append(el('span','',id),el('p','',task.expressions[id]));list.append(item);}
      const resultHeading=el('h3','quest-result-title','这轮用过的表达');resultHeading.tabIndex=-1;
      stage.append(resultHeading,list,button('再练一次',()=>{state=engine.start(task);started=false;draft={};render(true);},'btn quest-primary'));
      if(focus)resultHeading.focus({preventScroll:true});
    }else{
      const actions=el('div','quest-actions');
      for(const action of node.actions||[]){const control=button('',()=>{started=true;state=engine.choose(task,state,action.id);render(true);},'quest-action');control.append(el('strong','',action.label),el('span','',action.detail));actions.append(control);}
      stage.append(actions);if(focus)prompt.focus({preventScroll:true});
    }
  }
  function showLibrary(value){library.hidden=!value;host.hidden=value;toggle.textContent=value?'返回任务':'打开词库';toggle.setAttribute('aria-expanded',String(value));if(!value)loadImage();}
  toggle.onclick=()=>showLibrary(library.hidden);
  const query=new URLSearchParams(location.search);
  showLibrary(query.get('library')==='1'||query.has('level'));
  render(!host.hidden&&root.matchMedia('(pointer:fine)').matches);
})(window);
