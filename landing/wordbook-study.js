(function(){
  'use strict';
  const bookId=new URLSearchParams(location.search).get('book')||'pilot-six-v1',root=document.getElementById('studyRoot'),status=document.getElementById('bookStatus');
  const params=new URLSearchParams(location.search),unitId=params.get('unit')||undefined,structureRevision=params.get('structureRevision')||undefined;
  if(params.has('reviewSession')){VocabularyTargetedReview.start({bookId,practiceType:params.get('practice'),sessionId:params.get('reviewSession')});return;}
  CourseReturn.bind(document.getElementById('bookBack'),{href:CourseReturn.bookParent(bookId),label:'返回',beforeLeave:async()=>{
    await VocabularyStudyStore.waitForLocalWrites();
    clearTimeout(retryTimer);form?.stop?.();courseAudio?.stop();if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel();
  },onError:error=>showStatus(error.message)});
  const views={'word-dictation':VocabularyWordDictationView,'word-choice':VocabularyWordChoiceView,'chunk-order':VocabularyChunkOrderView,'read-aloud':VocabularyReadAloudView};
  const requestedPractice=params.get('practice'),dictation=requestedPractice==='word-dictation',choice=requestedPractice==='word-choice',readAloud=requestedPractice==='read-aloud',separate=Object.hasOwn(views,requestedPractice),learningKey=separate?VocabularyCourseContract.modes[requestedPractice].learningKey:null;
  const recognition=bookId.startsWith('textbook-wordbook:')&&!requestedPractice;let listeningAutoplay=true,listeningRate=1;
  const scope={...(unitId?{unitId,structureRevision}:{}),...(separate?{practiceType:requestedPractice}:{})};let practiceType=separate?requestedPractice:'sentence-cloze';
  const pageUrl=offset=>'/api/wordbooks/'+encodeURIComponent(bookId)+(unitId?'/units/'+encodeURIComponent(unitId):'')+'/items?offset='+offset+'&limit=20';
  let unitContent=null;
  const contentPage=async offset=>unitContent?unitContent.page(offset):ChunkAPI.request(pageUrl(offset));
  const practiceFields=()=>state?.features?.practiceTypes?{practiceType}:{};
  let page=null,state=null,item=null,position=0,sessionId=crypto.randomUUID(),owner='',generation=0,busy=false,form=null,complete=false,courseAudio=null,retryTimer=null,loadFailed=false,noticeMessage='',previewOnly=false,temporaryPractice=false;
  window.studyUsageContext=()=>!recognition&&item&&form&&!complete&&!loadFailed?
    {kind:'wordbook',resourceId:'wordbook:'+bookId}:null;
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const cacheStatus=node('p');cacheStatus.id='unitOfflineStatus';cacheStatus.className='book-meta';cacheStatus.setAttribute('role','status');root.before(cacheStatus);
  const button=(text,action)=>{const el=node('button',text);el.type='button';el.onclick=action;return el;};
  const setTitle=text=>CourseLearningHeader.setTitle(document.getElementById('bookHeader'),text);
  function showStatus(message,quiet=false,onAction){
    status.textContent=quiet?message:'';
    const rail=document.getElementById('noticeBannerRail');
    if(quiet||!message){noticeMessage='';rail.replaceChildren();return;}
    if(noticeMessage===message)return;
    noticeMessage=message;
    const notice=NoticeBanner.create({message,actionLabel:'重试',onAction});
    const action=notice.querySelector('.notice-banner-action');if(action)action.id='bookRetry';
    rail.replaceChildren(notice);
  }
  function showLoginRequired(){
    loadFailed=true;
    document.getElementById('bookPosition')?.replaceChildren();
    const panel=node('section');panel.className='course-access-panel';
    panel.append(node('p','登录后即可开始单词本练习；登录后会返回当前课程。'));
    const login=button('登录',async()=>{
      if(!window.ChunkAuthUI)return;
      try{const config=await ChunkAPI.getConfig();ChunkAuthUI.phoneMode=config.authMode==='phone';}catch(_){ }
      ChunkAuthUI.showLogin(()=>location.reload(),{dismissible:false});
    });login.className='btn';panel.append(login);root.replaceChildren(panel);showStatus('');
  }
  function current(ticket){return ticket===generation&&owner===LearningSessionBootstrap.identity();}
  function speak(text){if(typeof speechSynthesis==='undefined')return;speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang='en-US';speechSynthesis.speak(utterance);}
  function writePayload(action){return {bookId,bookRevision:page.revision,itemId:state.resume?.itemId||item?.itemId||page.items[0].itemId,sessionId,action,expectedResumeRev:state.resumeRev,...scope,...practiceFields()};}
  async function readState(){if(state?.canPersist){const ticket=generation,next=await VocabularyStudyStore.state(bookId,Math.floor(position/20)*20,scope);if(!current(ticket))return;
    if(next.resumeRev>=state.resumeRev){state=next;if(unitId&&next.structureRevision)scope.structureRevision=next.structureRevision;
      if(next.bookRevision!==page.revision){if(unitContent)throw Error('课程已更新，请完成当前待保存记录后重新进入。');const offset=Math.floor(Math.max(0,next.resumePosition)/20)*20,updated=await contentPage(offset);if(!current(ticket))return;page={...updated,offset};setTitle(page.title);}}
  }}
  async function loadCurrent(){
    courseAudio?.stop();
    const ticket=generation;
    if(state?.canPersist){await readState();if(!current(ticket))return;position=state.resumePosition;}
    if(position>=page.itemCount||state?.resume?.status==='completed'){complete=true;form?.destroy?.();courseAudio?.destroy();document.getElementById('studyTools')?.replaceChildren();root.replaceChildren(node('h2',recognition?'本单元浏览完成':unitId?'本单元完成':'本轮完成'),node('p',recognition?'听读浏览不计为答题正确或练习完成。':readAloud?'已记录本轮跟读自报，不代表发音正确或已经掌握。':'这些记录是辅助练习，不代表已经掌握。'));return;}
    if(!Number.isSafeInteger(position)||position<0)position=0;
    const offset=Math.floor(position/20)*20;
    if(page.offset!==offset)page={...await contentPage(offset),offset};
    const ref=page.items[position-offset];if(!ref)throw Error('当前项目暂不可用，请重新读取单词本');
    const data=unitContent?unitContent.item(ref.itemId,ref.contentRevision):await ChunkAPI.request('/api/vocabulary-items/'+encodeURIComponent(ref.itemId)+'?revision='+ref.contentRevision);
    if(!current(ticket))return;item=data;practiceType=separate?requestedPractice:GuidedSentenceContent.forItem(item)?'guided-expression':'sentence-cloze';
    if(state?.canPersist&&(state.resume?.sessionId!==sessionId||state.features?.practiceTypes&&state.resume?.practiceType!==practiceType)){
      if(state.features?.practiceTypes&&state.resume&&state.resume.practiceType!==practiceType)sessionId=crypto.randomUUID();
      await VocabularyStudyStore.submit('vocabulary.session',writePayload('start'));if(!current(ticket))return;await readState();if(!current(ticket))return;
    }
    complete=false;render();
  }
  function render(){
    form?.destroy?.();courseAudio?.destroy();
    root.replaceChildren();document.getElementById('bookPosition').textContent=(position+1)+' / '+page.itemCount;
    if(recognition){
      document.getElementById('bookPosition').hidden=false;
      document.body.classList.add('recognition-page');
      const back=document.getElementById('bookBack');back.setAttribute('aria-label','返回课程目录');back.title='返回课程目录';
      back.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>';
      form=VocabularyListenWordView.create(item,{autoplay:listeningAutoplay,rate:listeningRate,onRateChange:value=>{listeningRate=value;},getFavorite:()=>LearningWorkspaceStore.word(bookId,item.itemId),onFavorite:()=>LearningWorkspaceStore.word(bookId,item.itemId,true),positionLabel:(position+1)+' / '+page.itemCount,hasPrevious:position>0,onPrevious:()=>{if(busy||position<=0)return;busy=true;position--;loadCurrent().catch(showError).finally(()=>{busy=false;});},onAutoplayChange:value=>{listeningAutoplay=value;},onNext:()=>{if(busy)return;busy=true;position++;loadCurrent().catch(showError).finally(()=>{busy=false;});}});
      root.append(form.element);document.getElementById('studyTools')?.replaceChildren(cacheStatus,form.settings);return;
    }
    const area=node('section'),figure=node('figure'),picture=node('picture'),copy=node('div');
    area.className='wordbook-exercise';if(choice)area.classList.add('wordbook-choice-exercise');if(!separate)area.classList.add('wordbook-sentence-exercise');copy.className='wordbook-answer';
    const hasImage=!dictation&&!!item.images?.wide?.length;
    const wide=item.images?.wide||[],mobile=item.images?.mobile||[];
    const shared=wide.length===1&&mobile.length===1&&wide[0]===mobile[0]&&wide[0].endsWith('.webp');
    if(hasImage){
      const image=node('img');image.src=wide.find(url=>url.endsWith('.webp'))||wide[0];image.alt=item.scene;image.loading='lazy';image.decoding='async';
      image.onerror=()=>{image.hidden=true;figure.append(node('p',navigator.onLine===false?'图片尚未缓存，联网后可加载。':'图片暂时无法加载，可继续文字学习。'));};
      // New content uses one WebP for every viewport. Keep <picture> sources only
      // for already-published legacy books that still have distinct variants.
      if(!shared)for(const profile of ['mobile','wide'])for(const url of item.images?.[profile]||[]){const source=node('source');source.srcset=url;source.type='image/'+(url.endsWith('.avif')?'avif':'webp');if(profile==='mobile')source.media='(max-width:700px)';picture.append(source);}
      picture.append(image);figure.append(picture);
    }else{if(!dictation)figure.append(node('p',item.scene));else figure.hidden=true;area.classList.add('wordbook-text-exercise');}
    const steps=separate?null:GuidedSentenceContent.forItem(item),heading=node('h2',dictation?'单词听写':readAloud?(item.learning?.readAloud?.target==='word'?'单词跟读':'例句跟读'):separate||steps?item.meaning:item.word+' · '+item.meaning);
    const shortcut=node('div');shortcut.className='study-shortcut-hint';if(steps)shortcut.append(node('kbd','Shift'),document.createTextNode('切换输入方式'));if(!previewOnly)root.append(shortcut);
    const sceneCaption=hasImage&&(choice||!separate);
    const target=node('div');target.className='wordbook-target';target.append(heading);copy.append(target);if(!dictation){const translation=node(sceneCaption?'figcaption':'p',item.translation);translation.className=sceneCaption?'wordbook-scene-caption':'wordbook-translation';(sceneCaption?figure:copy).append(translation);}area.append(figure,copy);
    if(previewOnly){
      copy.append(button('本次不保存练习',()=>{previewOnly=false;render();showStatus('临时练习：本次作答和进度不保存。');}));
      root.append(area);document.getElementById('studyTools')?.replaceChildren();
      showStatus('学习记录暂未确认。可查看课程，或选择本次不保存练习。');return;
    }
    const next=button('下一词',()=>loadCurrent().catch(showError));next.hidden=true;
    const audioFeedback=node('p');audioFeedback.className='wordbook-audio-feedback';audioFeedback.setAttribute('role','status');audioFeedback.setAttribute('aria-live','polite');copy.append(audioFeedback);
    courseAudio=readAloud?null:VocabularyCourseAudio.create(message=>{audioFeedback.textContent=message;});
    const attemptTasks=[],attemptTicket=generation;
    const options={onAttempt:result=>{
      if(!state?.canPersist||!state.features?.attempts||!current(attemptTicket))return;
      const answers=result.values||form?.values?.();if(!answers||Object.values(answers).some(value=>typeof value==='string'&&!value.trim()))return;
      const payload={bookId,bookRevision:page.revision,itemId:item.itemId,contentRevision:item.contentRevision,sessionId,...scope,...practiceFields(),answers:structuredClone(answers),inputMode:result.inputMode||'typing',...(result.stepIndex===undefined?{}:{stepIndex:result.stepIndex})};
      const task=VocabularyStudyStore.submit('vocabulary.attempt',payload);attemptTasks.push(task);task.catch(()=>{if(current(attemptTicket))showStatus('作答过程记录待保存，请连接后重试；原完成记录保留。');});
    },onComplete:async result=>{
      if(busy)return;complete=true;next.hidden=false;heading.textContent=item.word+' · '+item.meaning;if(!dictation&&!readAloud){if(!steps&&!separate)copy.append(node('p',result.sentence));const listen=button('听句子',()=>item.learning?.sentenceAudio?courseAudio.play(item.learning.sentenceAudio.audio):speak(result.sentence));if(requestedPractice==='chunk-order'){listen.textContent='';listen.className='sentence-audio-icon';listen.setAttribute('aria-label','听句子');listen.title='听句子';const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');icon.innerHTML='<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>';listen.append(icon);form.element.querySelector('.chunk-order-selected').append(listen);}else copy.append(listen);}
      if(!state?.canPersist){position++;showStatus(readAloud?'体验模式：仅本机临时练习，不保存到账号。':'体验模式：本轮练习不保存到账号。');return;}
      const ticket=generation;busy=true;next.disabled=true;showStatus(readAloud?'正在保存练习自报…':'正在保存辅助练习…');
      const timer=setTimeout(()=>{if(current(ticket)&&busy)showStatus('待保存，连接恢复后会自动重试。');},250);
      try{await Promise.all(attemptTasks);if(!current(ticket))return;const receipt=await VocabularyStudyStore.submit(readAloud?'vocabulary.rehearse':'vocabulary.complete',{bookId,bookRevision:page.revision,itemId:item.itemId,contentRevision:item.contentRevision,sessionId,...(readAloud?{report:result.values}:{answers:result.values}),...scope,...practiceFields(),...(state.features?.practiceTypes?{inputMode:result.inputMode||'typing'}:{})});
        if(!current(ticket))return;await readState();if(!current(ticket))return;
        showStatus(receipt.durable?'练习已保存在本机，联网后自动同步。':receipt.operation?.outcome==='resume-stale'?(readAloud?'练习自报已保存；其他设备更新了位置，将继续当前确认位置。':'练习已保存；其他设备更新了位置，将继续当前确认位置。'):(readAloud?'练习自报与下一词位置已保存（未验证发音）。':'辅助练习与下一词位置已保存。'),!receipt.durable&&receipt.operation?.outcome!=='resume-stale');next.disabled=false;
      }catch(error){if(current(ticket))showError(error);}finally{clearTimeout(timer);if(current(ticket))busy=false;}
    }};
    form=separate?(item.learning?.[learningKey]?views[requestedPractice].create(item,options):null):steps?GuidedSentenceView.create(item,steps,options):JQKAClozeView.create(item.exercise,options);
    if(form){if(!separate&&!steps)form.element.querySelector('.cloze-actions button').textContent='确认';copy.append(form.element);}else copy.append(node('p',choice?'当前词条没有选词素材，可跳过或返回原练习；不会记为完成。':dictation?'当前词条没有课程听写音频，可跳过或返回原练习；不会记为完成。':readAloud?'当前词条没有跟读示范素材，可跳过或返回原练习；不会记为已练习。':'当前词条没有拼块素材，可跳过或返回原练习；不会记为完成。'));root.append(area);
    const controls=node('div');controls.className='wordbook-controls';
    if(!separate){const listen=button('听单词',()=>item.learning?.wordDictation?courseAudio.play(item.learning.wordDictation.audio):speak(item.word));listen.className='study-listen';target.append(listen);}
    const methods=node('details'),methodSummary=node('summary',dictation?'单词听写':choice?'选词填空':requestedPractice==='chunk-order'?'词序拼块':readAloud?'跟读练习':'句子练习'),methodLinks=node('div');methods.className='study-methods';methods.setAttribute('aria-label','学习方式');methodLinks.className='study-menu';methods.append(methodSummary,methodLinks);
    const skip=button('跳过',async()=>{if(busy||complete)return;const ticket=generation;let timer;
      if(unitContent&&VocabularyStudyStore.offline()){showStatus('离线时请完成当前练习；跳过位置需联网确认。');return;}
      try{busy=true;form?.stop?.();courseAudio?.stop();if(state?.canPersist){showStatus('正在保存跳过位置…');timer=setTimeout(()=>{if(current(ticket)&&busy)showStatus('位置待保存，连接恢复后会自动重试。');},250);await VocabularyStudyStore.submit('vocabulary.session',writePayload('skip'));await readState();}else position++;
        if(!current(ticket))return;showStatus(state?.canPersist?'已跳过，未记为成功练习。':'已跳过；本轮体验不保存。',!!state?.canPersist);await loadCurrent();
      }catch(error){if(current(ticket))showError(error);}finally{clearTimeout(timer);if(current(ticket))busy=false;}});
    const practiceLink=(label,mode)=>{const link=node('a',label),url=new URL(location.href);if(mode)url.searchParams.set('practice',mode);else url.searchParams.delete('practice');link.href=url.pathname+url.search;link.onclick=event=>{if(busy){event.preventDefault();return;}form?.stop?.();courseAudio?.stop();};methodLinks.append(link);};
    if(separate)practiceLink('返回句子练习');
    if(!dictation&&state?.features?.wordDictation&&item.learning?.wordDictation)practiceLink('单词听写','word-dictation');
    if(!choice&&state?.features?.wordChoice&&item.learning?.wordChoice)practiceLink('选词填空','word-choice');
    if(requestedPractice!=='chunk-order'&&state?.features?.chunkOrder&&item.learning?.chunkOrder)practiceLink('词序拼块','chunk-order');
    if(!readAloud&&state?.features?.readAloud&&item.learning?.readAloud)practiceLink('跟读练习','read-aloud');
    if(!methodLinks.children.length)methods.hidden=true;
    else methodLinks.prepend(node('p','当前：'+methodSummary.textContent));
    skip.id='studySkip';skip.setAttribute('aria-label','跳过');skip.setAttribute('aria-keyshortcuts','Alt+S');skip.prepend(node('kbd','Alt + S'));shortcut.append(skip);
    document.getElementById('studyTools')?.replaceChildren(methods);controls.append(next);next.className='study-next';root.append(controls);form?.focus();
  }
  function showError(error,retries=2){
    loadFailed=true;
    clearTimeout(retryTimer);
    const conflict=['SERVER_SEQ_ROLLBACK','LEARNING_STATE_UNCONFIRMED'].includes(error.code);
    if(conflict){document.getElementById('bookRetry')?.remove();showStatus('学习记录需要核对，暂时无法开始练习。原记录已保留。');return;}
    const temporary=error.message==='Failed to fetch'||error.name==='AbortError'||error.code==='REQUEST_TIMEOUT'||error.status>=500;
    if(temporary&&retries<2){showStatus('连接暂时中断，正在自动重试…');const ticket=generation;retryTimer=setTimeout(()=>{if(current(ticket))boot(retries+1);},750*(retries+1));return;}
    showStatus(temporary?'暂时连接不上服务，恢复连接后可重试。原记录已保留。':(error.message||'读取失败')+'；原记录已保留。',false,()=>boot());
  }
  async function boot(retries=0){clearTimeout(retryTimer);loadFailed=false;previewOnly=false;temporaryPractice=false;const ticket=++generation;form?.destroy?.();courseAudio?.destroy();form=null;root.replaceChildren();document.getElementById('studyTools')?.replaceChildren();owner=LearningSessionBootstrap.identity();busy=false;
    if(!ChunkAPI.getToken()){showLoginRequired();return;}
    showStatus('正在读取单词本…');
    try{if(requestedPractice&&!separate)throw Error('当前练习方式不可用');
      unitContent=await VocabularyUnitCache.create({bookId,unitId,structureRevision,onStatus:message=>{if(current(ticket)){cacheStatus.title=message;cacheStatus.textContent=recognition?message.includes('失败')?'离线保存失败':message.includes('更新')?'更新未完成':message.includes('已保存')?'离线已保存':'本机内容':message;}}});if(!current(ticket))return;VocabularyStudyStore.useUnit(unitContent);
      page={...await contentPage(0),offset:0};if(!current(ticket))return;
      setTitle(page.title);
      if(unitId&&unitContent?.priorStructureRevision===structureRevision)scope.structureRevision=page.structureRevision;
      if(recognition){if(unitId&&structureRevision&&page.structureRevision!==structureRevision&&unitContent?.priorStructureRevision!==structureRevision)throw Error('单元目录已更新，请返回课程重新进入');state={canPersist:false,resume:null,resumeRev:0};position=0;showStatus('');await loadCurrent();return;}
      let auth;
      try{auth=await LearningSessionBootstrap.ready({allowConfirmedOffline:!!unitContent});}catch(error){
        if(!['SERVER_SEQ_ROLLBACK','LEARNING_STATE_UNCONFIRMED'].includes(error.code))throw error;
        if(!current(ticket))return;
        const details=await ChunkAPI.request('/api/wordbooks/'+encodeURIComponent(bookId)+'/details');if(!current(ticket))return;
        if(separate&&!details.features?.[learningKey])throw Error('当前服务尚未开放所选练习，请返回原练习');
        state={canPersist:false,resume:null,resumeRev:0,features:details.features};previewOnly=true;temporaryPractice=true;position=0;
        await loadCurrent();return;
      }
      if(!current(ticket))return;
      state=auth.loggedIn?await VocabularyStudyStore.state(bookId,0,scope):{canPersist:false,resume:null,resumeRev:0};if(!current(ticket))return;
      if(separate){if(!auth.loggedIn){const details=await ChunkAPI.request('/api/wordbooks/'+encodeURIComponent(bookId)+'/details');if(!current(ticket))return;state.features=details.features;}if(!state.features?.[learningKey])throw Error('当前服务尚未开放所选练习，请返回原练习');}
      if(unitId&&state.structureRevision)scope.structureRevision=state.structureRevision;
      if(state.canPersist){
        const queued=await VocabularyStudyStore.pending(bookId,unitId,scope.practiceType),actionable=queued.filter(row=>row.status!=='deferred-version');
        const staleVersion=actionable.filter(row=>row.operation?.payload?.bookRevision&&row.operation.payload.bookRevision!==page.revision);
        if(staleVersion.length){root.replaceChildren(node('p',`${staleVersion.length} 条待保存练习属于旧版。它们不会用新版答案重放，也不会删除。你可以先将原记录留在本机，再开始新版。`),button('保留旧版记录并继续新版',async()=>{
          try{await ServerStore.deferVocabularyVersionOperations(bookId,page.revision);state=await VocabularyStudyStore.state(bookId,0,scope);if(current(ticket))boot();}catch(error){if(current(ticket))showError(error);}}),button('导出旧版待保存记录',async()=>{
          try{const rows=await ServerStore.exportDeferredVocabularyVersionOperations(bookId);if(!rows.length)throw Error('当前没有已保留的旧版记录');const url=URL.createObjectURL(new Blob([JSON.stringify(rows,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='wordbook-old-version-pending-'+Date.now()+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){if(current(ticket))showStatus(error.message);}}));showStatus('新版课程已更新；请选择如何保留旧版待保存记录。');return;}
        const conflicts=actionable.filter(row=>row.status==='blocked'&&row.lastError==='RESUME_CONFLICT'&&row.operation.type==='vocabulary.session');
        if(conflicts.length){root.replaceChildren(node('p','其他设备已更新学习位置。选择后会继续当前已保存的位置，已保存练习保留。'),button('使用已保存位置',async()=>{
          try{for(const row of conflicts)await ServerStore.discardRejectedVocabularySession(row.requestId);if(current(ticket))boot();}catch(error){if(current(ticket))showError(error);}}));showStatus('学习位置冲突，请选择当前已保存位置。');return;}
        if(actionable.length&&!state.offline){showStatus('有待保存的练习，正在恢复确认…');await ServerStore.retryPending();state=await VocabularyStudyStore.state(bookId,0,scope);}
        if(!state.offline&&(await VocabularyStudyStore.pending(bookId,unitId,scope.practiceType)).some(row=>row.status!=='deferred-version'))throw Error('练习仍在待保存队列中');
        if(state.resume&&state.resume.bookRevision!==page.revision)throw Error('单词本版本已变化，旧位置已保留');
        if(state.resume?.status!=='completed'){
          sessionId=state.offline&&state.resume?.sessionId?state.resume.sessionId:crypto.randomUUID();
        }
        showStatus('学习位置已保存。',true);
      }else showStatus('体验模式：绑定手机号后可保存单词本练习与续学位置。');
      if(!current(ticket))return;position=state.resumePosition||0;await loadCurrent();
    }catch(error){if(current(ticket))showError(error,retries);}
  }
  window.addEventListener('storage',()=>{try{if(owner!==LearningSessionBootstrap.identity()){generation++;form?.destroy?.();courseAudio?.destroy();root.replaceChildren();document.getElementById('studyTools')?.replaceChildren();showStatus('账号已变化，请重新打开单词本；原记录保留。');}}catch(_){generation++;form?.destroy?.();courseAudio?.destroy();root.replaceChildren();document.getElementById('studyTools')?.replaceChildren();}});
  document.addEventListener('keydown',event=>{if(event.defaultPrevented||event.repeat||event.isComposing||!event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.code!=='KeyS'||document.hidden||busy||complete||loadFailed||owner!==LearningSessionBootstrap.identity())return;const skip=document.getElementById('studySkip');if(!skip||!root.querySelector('.wordbook-exercise'))return;event.preventDefault();skip.click();});
  window.addEventListener('online',()=>{if(!temporaryPractice&&!busy&&(!form||complete))boot();});boot();
})();
