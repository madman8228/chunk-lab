(function(global){
  'use strict';
  function operationId(){return global.crypto&&typeof global.crypto.randomUUID==='function'?global.crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);}
  function start({bookId,practiceType,sessionId}){
    const root=document.getElementById('studyRoot'),status=document.getElementById('bookStatus');
    const params=new URLSearchParams(location.search);let returnTo='main.html?view=stats&tab=wrong';
    try{const target=new URL(params.get('returnTo')||returnTo,location.href);if(target.origin===location.origin&&/\/main\.html$/.test(target.pathname)&&target.searchParams.get('view')==='stats')returnTo=target.pathname+target.search;}catch(_){}
    const back=document.getElementById('bookBack');if(back){back.href=returnTo;back.textContent='返回错题与复习';}
    document.getElementById('bookTitle').textContent='单词专项复习';
    let state=null,page=null,item=null,form=null,pending=Promise.resolve(),busy=false;
    const views={'word-choice':global.VocabularyWordChoiceView,'chunk-order':global.VocabularyChunkOrderView,'word-dictation':global.VocabularyWordDictationView};
    const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
    const button=(text,fn)=>{const el=node('button',text);el.type='button';el.className='btn';el.onclick=fn;return el;};
    const showError=error=>{root.replaceChildren(node('p',error.message||'专项复习暂时无法继续，请返回记录页重试。'));status.textContent='';};
    const request=()=>global.ChunkAPI.request('/api/learning-archive/vocabulary/review-sessions/'+encodeURIComponent(sessionId));
    const dailyMode=(()=>{try{return !!new URL(returnTo,location.href).searchParams.get('dailyReview');}catch(_){return false;}})();
    const submit=(payload)=>global.ChunkAPI.submitOperation({protocol:3,requestId:operationId(),type:'vocabulary.review.attempt',payload});
    async function load(){
      if(!global.ChunkAPI.isLoggedIn()||navigator.onLine===false)throw Error('专项复习需要登录并保持联网；原有学习进度不会受影响。');
      state=await request();
      if(state.status==='stale')throw Error('课程内容已更新，请返回列表重新开始专项复习。');
      if(state.status==='completed'){form?.destroy?.();root.replaceChildren(node('h2','本轮专项复习完成'),node('p','专项结果已保存；普通课程位置与进度保持不变。'),button('返回错题与复习',()=>location.href=returnTo));return;}
      if(state.status!=='in-progress')throw Error('专项复习已暂停，请返回列表重新开始。');
      const entry=state.queue[state.index];if(!entry)throw Error('专项复习队列为空，请返回列表重新开始。');
      page=await global.ChunkAPI.request('/api/wordbooks/'+encodeURIComponent(bookId)+'/items?offset=0&limit=50');
      if(page.revision!==state.bookRevision)throw Error('课程内容已更新，请返回列表重新开始。');
      item=await global.ChunkAPI.request('/api/vocabulary-items/'+encodeURIComponent(entry.itemId)+'?revision='+encodeURIComponent(entry.contentRevision));
      render(entry);
    }
    function render(entry){
      form?.destroy?.();root.replaceChildren();const title=node('h2',item.word+' · '+item.meaning);root.append(title,node('p','专项复习 · '+(state.index+1)+' / '+state.queue.length));
      const area=node('section');area.className='wordbook-exercise';root.append(area);
      const options={onAttempt:value=>{pending=pending.then(async()=>{
        if(busy)return;busy=true;
        const answers=value.values||form?.values?.()||value, payload={sessionId,bookId,bookRevision:state.bookRevision,itemId:entry.itemId,
          contentRevision:entry.contentRevision,practiceType,inputMode:value.inputMode||'typing',answers,
          expectedIndex:state.index,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',...(value.stepIndex===undefined?{}:{stepIndex:value.stepIndex})};
        const response=await submit(payload);state=await request();busy=false;return response;
      }).catch(error=>{busy=false;showError(error);});},onComplete:()=>{pending=pending.then(()=>{if(state?.status==='completed')return load();return load();});}};
      if(practiceType==='sentence-cloze')form=global.JQKAClozeView.create(item.exercise,options);
      else if(practiceType==='guided-expression')form=global.GuidedSentenceView.create(item,global.GuidedSentenceContent.forItem(item),options);
      else form=views[practiceType]?.create(item,options);
      if(!form){showError(Error('该练习方式暂不可用。'));return;}
      area.append(form.element);status.textContent='仅记录专项练习结果，不移动普通课程位置。';
      const leave=button('结束并返回',async()=>{leave.disabled=true;try{await pending;
        await global.ChunkAPI.submitOperation({protocol:3,requestId:operationId(),type:'vocabulary.review.session',
          payload:{action:dailyMode?'pause':'finish',sessionId,bookId,bookRevision:state.bookRevision,practiceType,expectedSessionRev:state.revision}});
        location.href=returnTo;
      }catch(error){leave.disabled=false;showError(error);}});root.append(leave);
    }
    load().catch(showError);
  }
  global.VocabularyTargetedReview={start};
})(window);
