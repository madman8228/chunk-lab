(function(){
 'use strict';
 const params=new URLSearchParams(location.search),bookId=params.get('book'),planRevision=params.get('plan'),unitId=params.get('unit')||undefined,root=document.getElementById('studyRoot'),status=document.getElementById('bookStatus');
 const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;},button=(text,action)=>{const el=node('button',text);el.type='button';el.onclick=action;return el;};
 let store,owner='',generation=0,data=null,state=null,paused=false,busy=false,form=null,audio=null,mode='word-choice',area,feedback,controls;
 document.getElementById('introReturn').replaceWith(CourseReturn.create({href:CourseReturn.bookParent(bookId),beforeLeave:async()=>{
   if(busy)throw Error('正在保存浏览位置，请稍后返回。');
   audio?.stop();form?.stop?.();
   if(store&&data&&state?.confirmed?.canPersist){const latest=await store.reconcile();if(latest.blocked||latest.cursor.stepId!==data.step.stepId)throw Error('浏览位置需要核对，请处理后返回。');state=await store.enqueue('pause');}
 },onError:error=>{status.textContent=error.message;}}));
 const current=ticket=>ticket===generation&&owner===LearningSessionBootstrap.identity();
 const errorStatus=node('p');errorStatus.id='introError';errorStatus.setAttribute('role','alert');status.after(errorStatus);
 const conflictArea=node('section'),archiveNotice=node('p');conflictArea.className='intro-conflict';conflictArea.hidden=true;errorStatus.after(conflictArea,archiveNotice);
 const history=node('details'),historyBody=node('div');history.className='intro-history';history.hidden=true;history.append(node('summary','本机冲突归档'),node('p','仅保存在此浏览器，不会同步到其他设备。包含本课程、当前学习范围的不同编排版本；日期仅供核对，列表不按时间排序。'),historyBody);archiveNotice.after(history);let historyTicket=0;
 history.ontoggle=()=>{if(history.open)loadHistory();else historyTicket++;};
 async function downloadArchive(key,ticket,errorTarget){
  try{const archive=await ServerStore.readVocabularyBrowseConflictArchive(key);if(!current(ticket))return;if(!archive)throw Error('归档暂不可读，请稍后重试');const url=URL.createObjectURL(new Blob([JSON.stringify(archive,null,2)],{type:'application/json'})),link=node('a');link.href=url;link.download='browse-conflict-'+archive.createdAt+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);if(errorTarget)errorTarget.textContent='';}
  catch(problem){if(current(ticket)){if(errorTarget)errorTarget.textContent=(problem.message||'下载失败')+' 原归档保留，可重新下载。';else message(problem);}}
 }
 async function loadHistory(after=null,trail=[],focus=false){
  const ticket=generation,attempt=++historyTicket,loading=node('p','正在读取本机归档…');loading.setAttribute('role','status');historyBody.replaceChildren(loading);
  try{const page=await ServerStore.listVocabularyBrowseConflictArchives({bookId,unitId,limit:10,after});if(!current(ticket)||attempt!==historyTicket||!history.open)return;
   const list=node('ul'),error=node('p'),actions=node('div');error.setAttribute('role','alert');actions.className='wordbook-controls';
   for(const row of page.entries){const item=node('li'),date=new Date(row.createdAt).toLocaleString('zh-CN'),description=node('span',date+' · '+(row.choice==='cloud'?'已选云端位置':'已选本机位置')+' · '+row.rowCount+' 条原记录'+(row.planRevision!==planRevision?' · 其他编排版本':''));description.id='archive-description-'+attempt+'-'+list.children.length;const download=button('下载归档',()=>downloadArchive(row.key,ticket,error));download.setAttribute('aria-describedby',description.id);item.append(description,download);list.append(item);}
   if(trail.length)actions.append(button('上一页归档',()=>loadHistory(trail.at(-1),trail.slice(0,-1),true)));
   if(page.nextAfter)actions.append(button('下一页归档',()=>loadHistory(page.nextAfter,[...trail,after],true)));
   actions.append(button('刷新归档列表',()=>loadHistory(null,[],true)));
   historyBody.replaceChildren(list,error,actions);if(!page.entries.length){const empty=node('p',page.nextAfter?'本页暂无匹配归档，可继续下一页。':after?'本页没有符合范围的归档。':'此浏览器还没有本课程的冲突归档。');historyBody.prepend(empty);}
   if(focus){const target=historyBody.querySelector('button');target?.focus();}
  }catch(problem){if(current(ticket)&&attempt===historyTicket){const error=node('p',(problem.message||'读取本机归档失败')+' 原归档保留。');error.setAttribute('role','alert');historyBody.replaceChildren(error,button('重试读取归档',()=>loadHistory(after,trail,true)));}}
 }
 let conflictOpen=false,conflictTicket=0;
 function conflictEntry(){conflictArea.replaceChildren(button('核对浏览位置',reviewConflict));conflictArea.hidden=!state?.blocked;}
 async function reviewConflict(){
  if(busy)return;const ticket=generation,attempt=++conflictTicket;conflictOpen=true;audio?.stop();form?.stop();
  conflictArea.hidden=false;conflictArea.replaceChildren(node('p','正在联网核对云端与本机位置…'));
  try{const review=await store.reviewConflict();if(!current(ticket)||attempt!==conflictTicket)return;
   const heading=node('h2','选择从哪里继续');heading.tabIndex=-1;const choices=node('fieldset'),legend=node('legend','请选择浏览位置'),hint=node('p','两种选择都会保留本机原记录为归档；不会更改答题或掌握记录。'),error=node('p'),actions=node('div');error.setAttribute('role','alert');actions.className='wordbook-controls';choices.append(legend);
   const confirm=button('请先选择位置',async()=>{
    const selected=choices.querySelector('input:checked');if(busy||!selected)return;busy=true;audio?.stop();for(const el of conflictArea.querySelectorAll('button,input'))el.disabled=true;confirm.textContent='正在保存选择…';
    try{const updated=await store.resolveConflict(review,selected.value,{confirmed:true});if(!current(ticket)||attempt!==conflictTicket)return;
     state=updated;conflictOpen=false;conflictTicket++;conflictEntry();archiveNotice.replaceChildren(document.createTextNode('本机原记录已保留为冲突归档。 '),button('下载本次归档',()=>downloadArchive(updated.archive.key,ticket)));if(history.open)loadHistory();
     paused=false;errorStatus.replaceChildren();if(updated.cursor.status==='browsed'){data=null;renderEnd();}else{const next=await store.step(updated.cursor.stepId);if(!current(ticket))return;data=next;render(true);}
    }catch(problem){if(current(ticket)&&attempt===conflictTicket){error.textContent=(problem.message||'保存选择失败')+' 请重新核对后再选择；原记录保留。';choices.disabled=true;actions.replaceChildren(button('重新核对位置',reviewConflict),button('暂不处理',()=>{conflictOpen=false;conflictTicket++;conflictEntry();conflictArea.querySelector('button')?.focus();}));}else if(current(ticket))message(problem);}
    finally{busy=false;if(current(ticket))await saveStatus();}
   });confirm.disabled=true;confirm.className='intro-primary';
   for(const [value,label,step,description] of [['cloud','使用云端位置',review.cloudStep,'保留云端位置，不新增位置写入。'],['local','使用本机位置',review.localStep,'将本机位置另存为新请求，从此处重新继续，不补记已浏览。']]){
    const option=node('label'),input=node('input'),copy=node('span'),title=node('strong',label),detail=node('span',step.step.presentation.text+' · '+step.step.presentation.title),note=node('small',description);input.type='radio';input.name='browse-conflict-choice';input.value=value;input.setAttribute('aria-label',label);input.onchange=()=>{confirm.disabled=false;confirm.textContent=value==='cloud'?'确认使用云端位置':'确认保存本机位置';};copy.append(title,detail,note);option.append(input,copy);choices.append(option);
   }
   const cancel=button('暂不处理',()=>{conflictOpen=false;conflictTicket++;conflictEntry();conflictArea.querySelector('button')?.focus();});actions.append(confirm,cancel);conflictArea.replaceChildren(heading,hint,choices,error,actions);heading.focus();
  }catch(problem){if(current(ticket)&&attempt===conflictTicket){const error=node('p',(problem.message==='Failed to fetch'?'需要联网才能核对浏览位置。':problem.message||'位置核对失败')+' 原记录保留。');error.setAttribute('role','alert');conflictArea.replaceChildren(error,button('重新核对位置',reviewConflict),button('暂不处理',()=>{conflictOpen=false;conflictTicket++;conflictEntry();}));}}
 }
 function message(error){errorStatus.replaceChildren(document.createTextNode((error.status===401?'请先登录后打开课程。':error.message==='Failed to fetch'?'当前步骤尚未离线缓存，请连接后重试。':error.message||'读取失败')+' 原课程与待保存记录保留。'),button('重新读取课程',boot));}
 async function saveStatus(){if(!store||!current(generation))return;try{const snapshot=await store.reconcile();if(!current(generation))return;state=snapshot;status.textContent=snapshot.blocked?'另一设备更新了浏览位置，请核对后选择；原记录已保留。':!snapshot.confirmed.canPersist?'体验模式：不保存浏览记录。':snapshot.pending?'浏览位置已在本机待保存，联网后自动提交；尚未云端确认。':'浏览位置已由云端确认。';if(!conflictOpen)conflictEntry();for(const control of controls?.children||[])if(control.dataset.advance)control.disabled=busy||paused||snapshot.blocked;}catch(error){message(error);}}
 async function act(action,target){
  if(busy)return;busy=true;audio?.stop();for(const control of controls?.children||[])control.disabled=true;const ticket=generation;
  try{const latest=await store.reconcile();if(data&&latest.cursor.stepId!==data.step.stepId)throw Error('云端位置已变化，请重新读取课程');
   let next=null;if(action!=='pause'&&!(action==='continue'&&data.nextStepId===null)){const id=action==='restart'?state.confirmed.plan.firstStepId:target;next=await store.step(id);}
   const updated=await store.enqueue(action,target);if(!current(ticket))return;state=updated;
   errorStatus.replaceChildren();if(action==='pause')return;
   if(updated.cursor.status==='browsed'){data=null;renderEnd();}else{data=next;paused=false;render(true);}
  }catch(error){if(current(ticket))message(error);}finally{busy=false;if(current(ticket)){for(const control of controls?.children||[])control.disabled=paused&&control.dataset.pause!=='true'||control.dataset.first==='true';await saveStatus();}}
 }
 async function directory(list,offset=0){const ticket=generation;try{const page=await store.catalog(offset);if(!current(ticket))return;list.replaceChildren();for(const row of page.steps){const link=button(row.text+' · '+row.title,()=>act('jump',row.stepId));if(row.stepId===data?.step.stepId)link.setAttribute('aria-current','step');list.append(link);}if(offset>0)list.append(button('上一页目录',()=>directory(list,Math.max(0,offset-20))));if(page.nextOffset!==null)list.append(button('下一页目录',()=>directory(list,page.nextOffset)));}catch(error){message(error);}}
 function render(focus=false){
  form?.destroy();form=null;audio?.destroy();root.replaceChildren();const p=data.step.presentation;document.getElementById('bookPosition').textContent=(data.position+1)+' / '+state.confirmed.plan.stepCount+' 步';
  const menu=node('details'),summary=node('summary','课程目录'),list=node('div');menu.className='intro-directory';list.className='wordbook-controls';menu.append(summary,list);menu.ontoggle=()=>{if(menu.open)directory(list);};root.append(menu);
  area=node('section');area.className='wordbook-exercise';const figure=node('figure'),image=node('img'),copy=node('div'),heading=node('h2',p.title);heading.tabIndex=-1;copy.className='wordbook-answer';image.src=data.deliveryImages?.wide?.[0]||data.item.images.wide[0];image.alt=data.item.scene||data.item.meaning;image.loading='lazy';image.decoding='async';image.onerror=()=>{image.hidden=true;figure.append(node('p','图片暂不可用，可继续阅读；不会加载大原图。'));};figure.append(image);
  const target=node('p',p.text);target.className='intro-target';target.lang='en';const meaning=node('p',p.meaning);meaning.className='wordbook-translation';const explanation=node('p',p.explanation);explanation.className='intro-explanation';feedback=node('p');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');audio=VocabularyCourseAudio.create(text=>{feedback.textContent=text;});copy.append(heading,target,meaning,explanation,button('听示范',()=>audio.play(p.audio)),feedback);
  if(data.step.stage==='sentence'){
   const practice=node('details'),summary=node('summary','试一试（可选）'),methods=node('div'),body=node('div'),result=node('p');result.setAttribute('role','status');methods.className='wordbook-controls';practice.className='intro-practice';practice.append(summary,node('p','辅助练习不评分、不写入答对或掌握记录。'),methods,body,result);
   const available=[['word-choice','选词',VocabularyWordChoiceView,'wordChoice'],['chunk-order','拼块',VocabularyChunkOrderView,'chunkOrder']].filter(row=>data.item.learning?.[row[3]]);if(available.length){
    function mount(){form?.destroy();result.textContent='';const row=available.find(row=>row[0]===mode)||available[0];mode=row[0];for(const control of methods.children)control.setAttribute('aria-pressed',String(control.dataset.mode===mode));form=row[2].create(data.item,{onComplete:()=>{result.textContent='本次辅助练习已做完，不代表掌握。';}});body.replaceChildren(form.element);}
    for(const row of available){const method=button(row[1],()=>{audio.stop();mode=row[0];mount();});method.dataset.mode=row[0];methods.append(method);}practice.ontoggle=()=>{if(practice.open&&!form)mount();};copy.append(practice);
   }
  }
  area.append(figure,copy);root.append(area);controls=node('div');controls.className='wordbook-controls browse-controls';const previous=button('上一步',()=>act('jump',data.previousStepId));previous.disabled=!data.previousStepId;previous.dataset.first=String(!data.previousStepId);const advance=button(data.nextStepId?'继续':'结束本节',()=>act('continue',data.nextStepId||data.step.stepId));advance.className='intro-primary';advance.dataset.advance='true';
  const pause=button('暂停',async()=>{if(busy)return;audio.stop();paused=!paused;area.hidden=paused;pause.textContent=paused?'恢复学习':'暂停';advance.disabled=paused;previous.disabled=paused||!data.previousStepId;menu.hidden=paused;if(paused){form?.stop();await act('pause');}else{heading.focus();await saveStatus();}});pause.dataset.pause='true';controls.append(previous,advance,pause);root.append(controls);if(focus)heading.focus();saveStatus();
 }
 function renderEnd(){form?.destroy();form=null;audio?.destroy();root.replaceChildren();document.getElementById('bookPosition').textContent='本次浏览结束';const heading=node('h2','本次浏览结束');heading.tabIndex=-1;root.append(heading,node('p','可回顾已浏览内容或稍后再练习。浏览结束不证明每一步都已看过，也不代表已经掌握。'));controls=node('div');controls.className='wordbook-controls browse-controls';const restart=button('再看一遍',()=>act('restart'));restart.className='intro-primary';restart.dataset.advance='true';controls.append(restart);root.append(controls);heading.focus();saveStatus();}
 async function boot(){const ticket=++generation;conflictTicket++;conflictOpen=false;conflictArea.hidden=true;archiveNotice.replaceChildren();historyTicket++;history.hidden=true;history.open=false;historyBody.replaceChildren();form?.destroy();audio?.destroy();root.replaceChildren();status.textContent='正在读取课程与浏览位置…';owner=LearningSessionBootstrap.identity();try{await LearningSessionBootstrap.ready({allowConfirmedOffline:true});if(!current(ticket))return;if(!bookId||!/^[a-f0-9]{64}$/.test(planRevision||''))throw Error('课程编排入口无效，请从课程详情重新进入');store=VocabularyBrowseStore.create({bookId,planRevision,unitId});state=await store.open();if(!current(ticket))return;history.hidden=!state.confirmed.canPersist;document.getElementById('bookTitle').textContent='认识词与表达';if(state.cursor.status==='browsed'){errorStatus.replaceChildren();data=null;renderEnd();}else{data=await store.step(state.cursor.stepId);if(current(ticket)){errorStatus.replaceChildren();render();}}}catch(error){if(current(ticket)){message(error);root.append(button('重新读取课程',boot));}}}
 ServerStore.onState(()=>{if(store)saveStatus();});window.addEventListener('online',()=>saveStatus());window.addEventListener('storage',event=>{if(event.key===null||['chunklab.session.v1','chunklab_token','chunklab_api_base'].includes(event.key)){generation++;conflictTicket++;conflictOpen=false;conflictArea.hidden=true;conflictArea.replaceChildren();archiveNotice.replaceChildren();historyTicket++;history.open=false;history.hidden=true;historyBody.replaceChildren();form?.destroy();audio?.destroy();root.replaceChildren(node('p','账号或服务已变化，原待保存记录保留。'),button('重新读取课程',boot));}});window.addEventListener('pagehide',()=>{generation++;audio?.destroy();form?.destroy();});boot();
})();
