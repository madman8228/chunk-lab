(function(){
  'use strict';
  const content=window.JQKAPracticeContent,api=window.ChunkAPI;
  const section=document.getElementById('vocabularyPractice'),start=document.getElementById('btnPracticeSix');
  let identity=null,progress={},queue=[],index=0,phase='build',assisted=false,results=[],token='',sending=false;
  let reviewMode=false,round=[],paused=false;
  window.studyUsageContext=()=>!section.hidden&&!paused&&index<queue.length&&phase!=='complete'?
    {kind:'vocabulary',resourceId:'vocabulary-pilot'}:null;
  function node(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
  function button(text,action){const b=node('button',text,'btn btn-white');b.type='button';b.onclick=action;return b;}
  function key(kind){return 'jqka.practice.'+kind+'.v1:'+identity;}
  function read(kind,fallback){try{return JSON.parse(localStorage.getItem(key(kind)))||fallback;}catch(_){return fallback;}}
  function same(){return identity&&api.getToken()===token;}
  async function flush(){
    if(!same()||sending)return;sending=true;
    try{
      let pending=read('pending',[]);
      while(pending.length&&same()){
        const r=await api.request('/api/vocabulary-practice',{method:'POST',body:JSON.stringify(pending[0])});
        if(!same())break;
        progress=r.progress;localStorage.setItem(key('cache'),JSON.stringify(progress));
        pending=read('pending',[]).filter(x=>x.eventId!==pending[0].eventId);
        localStorage.setItem(key('pending'),JSON.stringify(pending));
      }
    }catch(_){/* Durable account-scoped outbox retries automatically, no manual sync. */}
    finally{sending=false;}
  }
  function record(word,independent){
    if(!same())return;
    const pending=read('pending',[]);
    pending.push({eventId:crypto.randomUUID(),word,independent});
    try{localStorage.setItem(key('pending'),JSON.stringify(pending));flush();}catch(_){/* No false cloud-success claim. */}
  }
  async function launch(){
    if(paused&&api.getToken()===token){paused=false;section.dataset.paused='false';section.hidden=false;document.getElementById('deck').classList.add('practice-active');start.textContent='开始本轮练习';section.scrollIntoView({block:'start',behavior:'instant'});const field=section.querySelector('input');if(field)field.focus({preventScroll:true});return;}
    start.disabled=true;start.textContent='准备练习…';identity=null;progress={};token=api.getToken();
    try{
      if(token){const me=await api.request('/api/auth/me');if(api.getToken()!==token)return;
        // Unverified temporary accounts remain experience mode; binding never migrates data here.
        if(me.user&&me.user.phone){identity=String(me.user.id);progress=read('cache',{});await flush();
          try{const r=await api.request('/api/vocabulary-practice');if(same()){progress=r.progress;localStorage.setItem(key('cache'),JSON.stringify(progress));}}catch(_){}
        }
      }
      beginRound(content.select(progress,Date.now()));section.hidden=false;document.getElementById('deck').classList.add('practice-active');render();
      section.scrollIntoView({block:'start',behavior:'instant'});
    }catch(_){beginRound(content.lessons);section.hidden=false;document.getElementById('deck').classList.add('practice-active');render();section.scrollIntoView({block:'start'});}
    finally{start.disabled=false;start.textContent='开始本轮练习';}
  }
  function beginRound(lessons){round=lessons.map(lesson=>({lesson,retry:false,review:!!(progress[lesson.w]&&progress[lesson.w].lastAt)}));restartRound();}
  function restartRound(){queue=round.map(x=>({...x}));index=0;results=[];paused=false;section.dataset.paused='false';prepareWord();}
  function exit(discard=false){paused=!discard&&queue.length>0&&index<queue.length&&api.getToken()===token;section.dataset.paused=String(paused);section.hidden=true;document.getElementById('deck').classList.remove('practice-active');start.textContent=paused?'继续本轮练习':'开始本轮练习';if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel();start.focus();}
  function skipWord(){
    if(index>=queue.length||phase==='complete')return;
    const entry=queue[index];
    if(!entry.retry)results.push({word:entry.lesson.w,skipped:true});
    else{const previous=results.find(x=>x.word===entry.lesson.w);if(previous)previous.retrySkipped=true;}
    index++;prepareWord();render();const next=section.querySelector('input, .practice-actions button, .practice-controls button');if(next)next.focus({preventScroll:true});
  }
  function renderControls(){
    const controls=node('nav',null,'practice-controls');controls.setAttribute('aria-label','练习控制');
    const leave=button('退出练习',()=>exit()),skip=button('跳过这个词',skipWord),restart=button('重新开始本轮',()=>{restartRound();render();});
    skip.disabled=!queue.length||index>=queue.length||phase==='complete';restart.disabled=!round.length;
    controls.append(leave,skip,restart);section.append(controls);
  }
  function prepareWord(){
    const entry=queue[index];assisted=false;
    reviewMode=!!(entry&&!entry.retry&&entry.review);
    phase='build';
  }
  function scene(lesson){
    const figure=node('figure',null,'practice-visual'),art=node('div',null,'practice-illustration');
    for(const profile of ['wide','mobile']){
      const version='v2';
      const url=new URL('assets/vocabulary-'+lesson.w+'-'+profile+'-'+version,document.baseURI).href;
      let source='url("'+url+'.webp")';
      if(CSS.supports('background-image','image-set(url("x.avif") type("image/avif"), url("x.webp") type("image/webp"))'))source='image-set(url("'+url+'.avif") type("image/avif"), url("'+url+'.webp") type("image/webp"))';
      art.style.setProperty('--scene-'+profile,source);
    }
    art.setAttribute('role','img');art.setAttribute('aria-label',lesson.scene);
    figure.append(art);return figure;
  }
  function render(){
    section.replaceChildren();
    const header=node('div',null,'practice-header');header.append(node('h3','把词用起来'));section.append(header);
    if(!queue.length){section.classList.remove('is-complete');section.append(node('p','这些词暂未到复习时间。可以自由翻卡，或再练一轮。'));section.append(button('再练一轮',()=>{beginRound(content.lessons);render();}));renderControls();return;}
    if(index>=queue.length){
      section.classList.add('is-complete');
      const completed=results.filter(x=>!x.skipped),skipped=results.filter(x=>x.skipped),independent=completed.filter(x=>x.independent).length;
      section.append(node('h4',skipped.length?'本轮已结束':'这一轮完成了'),node('p','完成 '+completed.length+' 个词'+(skipped.length?'，跳过 '+skipped.length+' 个词':'')+'。'+(independent?'其中 '+independent+' 个词在复习时独立拼出了关键结构。':'')));
      if(skipped.length)section.append(node('p','跳过的词未计入完成或掌握。','practice-note'));
      section.append(node('p',identity?'系统会按表现自动安排下次复习；今天答对不等于已经掌握。':'这是体验练习。登录后，练习记录和复习安排会跟随你的账号。','practice-note'));
      if(results.some(x=>x.retried))section.append(node('p','答错的词已在本轮末尾再练了一次。'));
      const review=node('ul',null,'practice-results');results.forEach(r=>{const li=node('li');li.append(node('strong',r.word),node('span',r.skipped?'已跳过':r.retrySkipped?'完成练习；巩固已跳过':r.retried?'已再练':'完成填空练习'));review.append(li);});section.append(review);
      const done=button('结束本轮',()=>exit());done.classList.add('practice-primary');section.append(done);renderControls();return;
    }
    section.classList.remove('is-complete');
    const entry=queue[index],l=entry.lesson,d=ITEM_INDEX['word:'+l.w]||{};
    const total=queue.filter(x=>!x.retry).length;
    const progressBar=node('div',null,'practice-progress');progressBar.append(node('span',entry.retry?'巩固刚才答错的词':'第 '+Math.min(index+1,total)+' 个词 / 共 '+total+' 个词'));
    const dots=node('span',null,'practice-dots');for(let n=0;n<total;n++){const dot=node('span',null,n<index?'done':n===index?'current':'');dot.setAttribute('aria-hidden','true');dots.append(dot);}progressBar.append(dots);header.append(progressBar);
    const body=node('div',null,'practice-content has-scene');section.append(body);
    body.classList.toggle('is-composing',phase==='build');
    body.append(scene(l));const teaching=node('div',null,'practice-teaching');body.append(teaching);
    section.append(node('p',identity?'练习结果自动记录，复习按表现安排。':'可直接体验；登录后自动保存练习记录。','practice-session-note'));
    if(phase==='complete'){
      teaching.append(node('h4','这句话拼好了','practice-question'),node('p',l.example,'built-sentence'),node('p',l.translation,'sentence-translation'),node('p',l.pattern,'practice-collocation'));
      const actions=node('div',null,'practice-actions');actions.append(button('听整句',()=>{if(typeof speak==='function')speak(l.example);}));
      const next=button('下一个词',()=>{index++;prepareWord();render();});next.classList.add('practice-primary');actions.append(next);teaching.append(actions);renderControls();next.focus({preventScroll:true});return;
    }
    if(!reviewMode){
      const word=node('div',null,'practice-word-inline');word.append(node('strong',l.w),node('span',(d.ph?d.ph+' · ':'')+l.meaning,'practice-phonetic'));
      const listen=button('听发音',()=>{if(typeof speak==='function')speak(l.w);});listen.className='practice-audio';word.append(listen);teaching.append(word);
    }
    const translation=node('p',l.translation,'cloze-translation');teaching.append(translation);
    if(l.context)translation.append(node('span','（'+l.context+'）','cloze-context'));
    const composer=window.JQKAClozeView.create(l.exercise,{
      onAttempt(result){if(result.fields.some(field=>field.state==='incorrect'))assisted=true;},
      onComplete(){
        if(phase!=='build')return;
        if(!entry.retry){
          // Sentence context is supplied. Cloze success is practice, not free recall.
          const independent=false;
          results.push({word:l.w,independent,assisted});record(l.w,independent);
          if(assisted)queue.push({lesson:l,retry:true});
        }else{const previous=results.find(result=>result.word===l.w);if(previous)previous.retried=true;}
        phase='complete';render();
      }
    });
    teaching.append(composer.element);renderControls();composer.focus();
  }
  start.onclick=launch;
  window.addEventListener('online',flush);setInterval(()=>{if(same())flush();},30000);
  window.addEventListener('storage',e=>{if(e.key===api.TOKEN_KEY||e.key===api.SESSION_KEY){identity=null;progress={};paused=false;section.dataset.paused='false';start.textContent='开始本轮练习';if(!section.hidden)exit(true);}});
})();
