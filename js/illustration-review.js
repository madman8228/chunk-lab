(function(){
 'use strict';
 const root=document.getElementById('illustrationReviewPanel');if(!root)return;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const api='/api/admin/illustration-review';let book=null,visible=[],index=0,page=0,busy=false,undo=null,requestId=0;
 let saveChain=Promise.resolve(),saveCount=0,activeSavingIds=new Set();
 const pendingItems=new Set();
 const selectionKey='chunklab_illustration_review_selection_v1';
 let selections={};try{const saved=JSON.parse(sessionStorage.getItem(selectionKey)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))selections=saved;}catch{}
 function selected(i){return selections[book.id]?.[i.itemId]===i.version;}
 function rememberSelection(){try{sessionStorage.setItem(selectionKey,JSON.stringify(selections));}catch{}}
 function updateSelectionButton(){const count=book?visible.filter(selected).length:0;$('irBatch').textContent=count?`通过选中项（${count}）`:'通过选中项';$('irBatch').disabled=busy||saveCount>0||count===0;}
 let base='';try{base=(localStorage.getItem('chunklab_api_base')||'').replace(/\/+$/,'');}catch{}
 async function request(url,options={}){let token='';try{token=localStorage.getItem('chunklab_admin_token')||'';}catch{}const response=await fetch(base+url,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}});const data=await response.json();if(!response.ok)throw Error(data.error||'请求失败');return data;}
 root.innerHTML=`<div class="ir-heading"><h1>配图审核</h1><button class="btn" id="irReload">刷新清单</button></div>
 <div class="ir-filters"><label>教材<select class="field" id="irCourse"></select></label><label>单元<select class="field" id="irUnit"><option value="">全部单元</option></select></label><label>审核状态<select class="field" id="irFilter"><option value="all">全部</option><option value="pending">未审核</option><option value="changes">需要修改</option><option value="approved">已通过</option></select></label><label>查找单词<input class="field" id="irSearch" type="search" placeholder="输入单词或释义"></label></div>
 <div class="ir-toolbar" id="irReviewActions" role="group" aria-label="审核操作"><div class="ir-summary"><span id="irCounts"></span><span id="irMessage" role="status" aria-live="polite"></span></div><button class="btn" id="irContinue">继续上次审核</button><button class="btn" id="irBatch">通过选中项</button><button class="btn" id="irExport">导出待修改清单</button><button class="btn" id="irUndo" disabled>撤销上次操作</button></div>
 <div id="irGrid" class="ir-grid"></div><div class="ir-pager"><button class="btn" id="irPrevPage">上一页</button><span id="irPage"></span><button class="btn" id="irNextPage">下一页</button></div>
 <dialog id="irDialog" aria-labelledby="irWord"><div class="ir-dialog-head"><h2 id="irWord"></h2><button class="btn" id="irClose">关闭</button></div><div id="irDetail"></div><p id="irDetailMessage" role="status"></p><div class="ir-toolbar"><button class="btn" id="irPrevious">上一词</button><button class="btn" id="irNext">下一词</button><button class="btn primary" id="irApprove">通过</button><button class="btn" id="irChanges">需要修改</button><button class="btn" id="irSaveNote">保存意见</button></div></dialog>`;
 const $=id=>root.querySelector('#'+id),message=text=>{const label=text==='已保存'?'审核已保存':text;$('irMessage').textContent=label;$('irDetailMessage').textContent=label;};
 function updateStickyOffset(){root.style.setProperty('--ir-sticky-offset',matchMedia('(max-width:760px)').matches?(document.querySelector('.top')?.offsetHeight||0)+'px':'0px');}
 updateStickyOffset();window.addEventListener('resize',updateStickyOffset);
 if(window.ResizeObserver&&document.querySelector('.top'))new ResizeObserver(updateStickyOffset).observe(document.querySelector('.top'));
 const statusText={pending:'待你确认',approved:'已通过',changes:'需要修改'};
 function syncSavingUI(){
  if(busy)return;
  ['irCourse','irReload','irUnit','irFilter','irSearch','irContinue'].forEach(id=>$(id).disabled=saveCount>0);
  $('irUndo').disabled=!undo||saveCount>0;updateSelectionButton();
  $('irGrid').querySelectorAll('.ir-card').forEach(card=>{
   const pending=pendingItems.has(card.dataset.item);
   card.setAttribute('aria-busy',String(pending));
   card.querySelectorAll('button').forEach(button=>button.disabled=pending);
   const approve=card.querySelector('[data-approve]');
   approve.textContent=pending?(activeSavingIds.has(card.dataset.item)?'保存中…':'等待保存…'):'通过';
  });
  if($('irDialog').open){
   const pending=pendingItems.has(visible[index]?.itemId);
   $('irDialog').querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=pending);
   if(!pending){$('irPrevious').disabled=index===0;$('irNext').disabled=index===visible.length-1;}
  }
 }
 function setBusy(value){busy=value;root.querySelectorAll('button,select,input,textarea').forEach(el=>el.disabled=value);if(!value){$('irPrevPage').disabled=page===0;$('irNextPage').disabled=(page+1)*24>=visible.length;syncSavingUI();}}
 function selectedItems(){return visible.filter(selected);}
 function row(i){
  const meaning=i.meaning||i.review.meaning;
  const unit=i.unit==='Welcome Unit'?'预备单元':i.unit.replace(/^Unit (\d+)$/,'第 $1 单元');
  const needsChanges=i.review.status==='changes',issue=[i.review.reason,i.review.note].filter(Boolean).join('：');
  return `<article class="ir-card" data-item="${escape(i.itemId)}" data-status="${escape(i.review.status)}"><button class="ir-image" data-open="${escape(i.itemId)}" aria-label="放大查看 ${escape(i.word)}">${i.delivery?`<img src="/${escape(i.delivery)}" loading="lazy" decoding="async" alt="${escape(i.word)} 的配图">`:'<span>待配图</span>'}${needsChanges?'<span class="ir-image-issue">有问题 · 待处理</span>':''}</button><div class="ir-card-body"><div class="ir-card-top"><label class="ir-pick"><input class="ir-select" type="checkbox" value="${escape(i.itemId)}"${selected(i)?' checked':''} aria-label="选择 ${escape(i.word)}"><strong>${escape(i.word)}</strong></label><span class="ir-card-meta" title="${escape(i.unit)}：${statusText[i.review.status]}">${escape(unit)} · <strong class="ir-state-badge">${statusText[i.review.status]}</strong></span></div><div class="ir-card-bottom"><p class="ir-meaning" title="${escape(meaning)}">${meaning?escape(meaning):'<span class="ir-warning">释义待补充</span>'}</p><div class="ir-toolbar"><button class="btn" data-approve="${escape(i.itemId)}">通过</button><button class="btn" data-open="${escape(i.itemId)}" aria-label="${escape(i.word)} 有问题，查看并填写修改意见">${needsChanges?'查看问题':'有问题'}</button></div></div>${needsChanges&&issue?`<p class="ir-issue-summary" title="${escape(issue)}">问题：${escape(issue)}</p>`:''}${i.checks.length?`<p class="ir-warning">${escape(i.checks.join('；'))}</p>`:''}</div></article>`;
 }
 function draw(recompute=true){
  if(!book)return;const counts={pending:0,approved:0,changes:0};book.items.forEach(i=>counts[i.review.status]++);$('irCounts').innerHTML=`共 ${book.items.length} 词 · 未审 ${counts.pending} · 通过 ${counts.approved} · ${counts.changes?`<button type="button" id="irProblemCount" title="查看全部有问题的词条">有问题 ${counts.changes}</button>`:'有问题 0'}`;
  if(recompute){const q=$('irSearch').value.trim().toLowerCase();visible=book.items.filter(i=>(!$('irUnit').value||i.unit===$('irUnit').value)&&($('irFilter').value==='all'||i.review.status===$('irFilter').value)&&(!q||(i.word+' '+i.meaning+' '+i.review.meaning).toLowerCase().includes(q)));}
  else visible=visible.map(i=>book.items.find(x=>x.itemId===i.itemId)).filter(Boolean);
  page=Math.min(page,Math.max(0,Math.ceil(visible.length/24)-1));
  const pageItems=visible.slice(page*24,page*24+24),ids=new Set(pageItems.map(i=>i.itemId)),grid=$('irGrid');
  const existing=new Map([...grid.querySelectorAll('.ir-card')].map(el=>[el.dataset.item,el]));
  [...grid.children].forEach(el=>{if(!ids.has(el.dataset.item))el.remove();});
  pageItems.forEach(i=>{
   const markup=row(i);let card=existing.get(i.itemId);
   if(!card||card.dataset.rendered!==markup){const template=document.createElement('template');template.innerHTML=markup;const next=template.content.firstElementChild;next.dataset.rendered=markup;if(card)card.replaceWith(next);card=next;}
   if(i.checks.length&&i.review.status!=='changes'){
    const flag=card.querySelector('.ir-card-bottom [data-open]');
    if(flag){flag.removeAttribute('data-open');flag.dataset.flag=i.itemId;flag.textContent='标记待修改';flag.setAttribute('aria-label',i.word+' 标记待修改');}
    card.querySelector('[data-approve]').title='暂不能通过：'+i.checks.join('；')+'。可以先标记待修改。';
   }
   grid.append(card);
  });
  if(!pageItems.length)grid.innerHTML='<p>没有匹配的词条。可以调整单元或审核状态。</p>';
  $('irPage').textContent=`${page+1} / ${Math.max(1,Math.ceil(visible.length/24))} 页`;$('irUndo').disabled=!undo;$('irPrevPage').disabled=page===0;$('irNextPage').disabled=(page+1)*24>=visible.length;
  syncSavingUI();
 }
 async function load(){if(busy||saveCount)return;const id=++requestId,course=$('irCourse').value;if(!course)return;setBusy(true);message('正在读取教材清单…');try{const result=await request(api+'/'+encodeURIComponent(course));if(id!==requestId)return;book=result;page=0;undo=null;$('irUnit').innerHTML='<option value="">全部单元</option>'+[...new Set(book.items.map(i=>i.unit))].map(u=>`<option>${escape(u)}</option>`).join('');draw();message('清单已加载');}catch(e){message(e.message);}finally{setBusy(false);}}
 function open(itemId){index=visible.findIndex(i=>i.itemId===itemId);if(index<0||pendingItems.has(itemId))return;detail();if(!$('irDialog').open)$('irDialog').showModal();syncSavingUI();}
 function refreshAfterReview(updatedIds=null){
  const activeId=$('irDialog').open?visible[index]?.itemId:null;
  draw();
  if(!activeId)return;
  index=visible.findIndex(i=>i.itemId===activeId);
  if(index<0)$('irDialog').close();else if(!updatedIds||updatedIds.has(activeId))detail();
 }
 function detail(){
  const i=visible[index];$('irWord').textContent=i.word;const old=i.history.find(h=>h.version!==i.version);
  const sourceLink=i.sourceImage?`<a href="/output/textbook-extractions/${escape(book.id)}/${escape(i.sourceImage)}" target="_blank" rel="noopener">查看教材词汇原页</a>`:'';
  $('irDetail').innerHTML=`<div class="ir-detail-images"><figure>${i.delivery?`<img src="/${escape(i.delivery)}" alt="${escape(i.word)} 当前配图">`:'待配图'}</figure>${old?.delivery?`<figure><img loading="lazy" src="/${escape(old.delivery)}" alt="上一版本配图"><figcaption>上一版本 · ${escape(old.note||old.reason||statusText[old.status])}</figcaption></figure>`:''}</div>
   <p>${escape(i.meaning||i.review.meaning||'释义待补充')}</p>
   ${i.checks.length?`<p class="ir-warning">${escape(i.checks.join('；'))}</p>`:''}
   <div class="ir-detail-fields"><label class="label">补充释义<input id="irMeaning" class="field" title="审核补充释义，不作为教材原文" maxlength="1000" value="${escape(i.review.meaning)}"></label>
   <label class="label">问题类型<select class="field" id="irReason">${['','图义不符','动作不清','画面裁切','人物或物体异常','风格不一致','其他'].map(r=>`<option${r===i.review.reason?' selected':''}>${escape(r)}</option>`).join('')}</select></label>
   </div><label class="label ir-note-label">审核意见<textarea id="irNote" class="field" rows="1" maxlength="2000">${escape(i.review.note)}</textarea></label>
   <details><summary>来源与审核历史</summary><p>${escape(i.unit)} · ${escape(i.sourcePages.join('、')||'教材页码待核定')} ${escape(i.sourceRegion||'')}</p><p>${sourceLink}</p>${i.originalWord&&i.originalWord!==i.word?`<p>原清单词头：${escape(i.originalWord)}</p>`:''}<p>${escape(i.scene)}</p>${i.history.map(h=>`<p>${escape(h.updated)} · ${statusText[h.status]} · ${escape(h.note||h.reason)}</p>`).join('')}</details>`;
  $('irPrevious').disabled=index===0;$('irNext').disabled=index===visible.length-1;
 }
 function save(items,status,fields={},isUndo=false){
  if(busy||!items.length||items.some(i=>pendingItems.has(i.itemId)))return Promise.resolve(false);
  if(status==='approved'){
   const blocked=items.filter(i=>i.checks.length);
   if(blocked.length){message('暂不能通过：'+blocked.map(i=>i.word+'（'+i.checks.join('；')+'）').join('、')+'。请先标记待修改，处理后再审核。');return Promise.resolve(false);}
  }
  const courseId=book.id,targets=items.map(i=>({itemId:i.itemId,version:i.version})),updatedIds=new Set(targets.map(i=>i.itemId));
  targets.forEach(i=>pendingItems.add(i.itemId));saveCount++;syncSavingUI();
  const operation=saveChain.then(async()=>{
   activeSavingIds=updatedIds;syncSavingUI();message('保存中…');
   try{
    const current=targets.map(target=>{const item=book.items.find(i=>i.itemId===target.itemId);if(book.id!==courseId||item?.version!==target.version)throw Error('词条已更新，请刷新后重新审核');return item;});
    const prior=current.map(i=>({itemId:i.itemId,version:i.version,...i.review}));
    book=await request(api+'/'+encodeURIComponent(courseId),{method:'PUT',body:JSON.stringify({changes:current.map(i=>({itemId:i.itemId,version:i.version,baseRevision:i.review.revision,status:status||i.review.status,note:i.review.note,reason:i.review.reason,meaning:i.review.meaning,...fields}))})});
    undo=isUndo?null:prior;refreshAfterReview(updatedIds);message('已保存');return true;
   }catch(e){message(e.message+'；本次操作未保存。意见仍在输入框中。');return false;}
   finally{targets.forEach(i=>pendingItems.delete(i.itemId));saveCount--;activeSavingIds=new Set();syncSavingUI();}
  });
  saveChain=operation.then(()=>undefined,()=>undefined);return operation;
 }
 $('irGrid').onclick=e=>{const openButton=e.target.closest('[data-open]'),approve=e.target.closest('[data-approve]'),flag=e.target.closest('[data-flag]');if(openButton)open(openButton.dataset.open);if(approve)save([book.items.find(i=>i.itemId===approve.dataset.approve)],'approved');if(flag)save([book.items.find(i=>i.itemId===flag.dataset.flag)],'changes');};
 $('irCounts').onclick=e=>{if(!e.target.closest('#irProblemCount')||busy||saveCount)return;$('irUnit').value='';$('irSearch').value='';$('irFilter').value='changes';page=0;draw();};
 $('irGrid').addEventListener('change',e=>{
  if(!e.target.matches('.ir-select')||!book)return;
  const item=book.items.find(i=>i.itemId===e.target.value);if(!item)return;
  const state=selections[book.id]||(selections[book.id]={});
  if(e.target.checked)state[item.itemId]=item.version;else delete state[item.itemId];
  rememberSelection();updateSelectionButton();
 });
 function dirty(){if(!$('irDialog').open||!visible[index])return false;const r=visible[index].review;return ['meaning','note','reason'].some(key=>fields()[key]!==r[key]);}
 async function leave(action){if(busy)return;if(dirty()&&!await save([visible[index]],null,fields()))return;action();}
 $('irClose').onclick=()=>leave(()=>$('irDialog').close());
 $('irDialog').addEventListener('cancel',e=>{e.preventDefault();leave(()=>$('irDialog').close());});
 $('irPrevious').onclick=()=>leave(()=>{if(index>0){index--;detail();}});
 $('irNext').onclick=()=>leave(()=>{if(index<visible.length-1){index++;detail();}});
 window.addEventListener('beforeunload',e=>{if(busy||saveCount||dirty()){e.preventDefault();e.returnValue='';}});
 const fields=()=>({meaning:$('irMeaning').value,note:$('irNote').value,reason:$('irReason').value});
 $('irApprove').onclick=()=>save([visible[index]],'approved',fields());$('irChanges').onclick=()=>save([visible[index]],'changes',fields());$('irSaveNote').onclick=()=>save([visible[index]],null,fields());
 $('irBatch').onclick=()=>save(selectedItems(),'approved');
 $('irUndo').onclick=async()=>{if(!undo||busy||saveCount)return;const previous=undo;setBusy(true);try{book=await request(api+'/'+encodeURIComponent(book.id),{method:'PUT',body:JSON.stringify({changes:previous.map(r=>({...r,baseRevision:book.items.find(i=>i.itemId===r.itemId).review.revision}))})});undo=null;refreshAfterReview();message('已撤销并保存');}catch(e){message(e.message);}finally{setBusy(false);}};
 ['irUnit','irFilter','irSearch'].forEach(id=>$(id).addEventListener(id==='irSearch'?'input':'change',()=>{page=0;draw();}));$('irCourse').onchange=load;$('irReload').onclick=load;
 $('irPrevPage').onclick=()=>{page--;draw(false);};$('irNextPage').onclick=()=>{page++;draw(false);};
 $('irContinue').onclick=()=>{if(!book)return;const item=book.items.find(i=>i.itemId===book.cursor)||book.items.find(i=>i.review.status==='pending');if(!item){message('还没有审核记录');return;}$('irUnit').value='';$('irFilter').value='all';$('irSearch').value='';draw();open(item.itemId);};
 $('irExport').onclick=()=>{if(!book)return;const blob=new Blob([JSON.stringify({courseId:book.id,title:book.title,exportedAt:new Date().toISOString(),items:book.items.filter(i=>i.review.status==='changes').map(i=>({itemId:i.itemId,word:i.word,unit:i.unit,delivery:i.delivery,version:i.version,...i.review}))},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=book.id+'-待修改.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 document.getElementById('illustrationReviewOpen').onclick=async()=>{window.ContentStudio.showView('illustrations');if(book)return;message('正在读取教材目录…');try{const data=await request(api);$('irCourse').innerHTML=data.courses.map(c=>`<option value="${escape(c.id)}">${escape(c.title)}</option>`).join('');if(data.courses.length)await load();else message('暂无可审核的教材草稿');}catch(e){message(e.message);}};
})();
