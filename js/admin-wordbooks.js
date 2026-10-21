(function(){
 'use strict';
 const root=document.getElementById('systemWordbooksPanel');if(!root||!window.ContentStudio)return;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const categories={image:'图片',sentence:'例句',translation:'翻译',audio:'声音',practice:'练习'};
 const states={'needs-assets':'素材待补齐','needs-validation':'待检查',validated:'待审看',reviewed:'已审看',published:'已发布'};
 const speaker='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>';
 let drafts=[],courses=[],activeId='',detail=null,items=[],position=0,pageOffset=0,mode='',validation=null,validationError='',previewUrls=[],activePreview=null,activeAudio=null,openVersion=0,renderVersion=0,practiceVersion=0,audioVersion=0;
 const issueNotes=new Map(),assetBlobs=new Map();
 root.innerHTML='<div class="sw-head"><h1>系统单词课程</h1><button class="btn" id="swRefresh">刷新</button></div><p id="swStatus" class="sw-message" role="status" aria-live="polite" hidden></p><details id="swImportArea" class="sw-import-area" open><summary>导入整本教材</summary><form class="sw-import" id="swImport"><label>选择整本教材包 JSON<input id="swFile" class="field" type="file" accept="application/json,.json" required></label><button class="btn primary">导入整本教材</button></form><p class="sw-muted">一本教材导入一次，按单元审看，整本发布。缺少单元会自动提示。</p></details><div class="sw-draft-list" id="swDrafts"></div><section class="sw-detail" id="swDetail" hidden></section>';
 const $=id=>root.querySelector('#'+id),base='/api/admin/system-wordbooks';
 function status(message,error=false){$('swStatus').hidden=!message;$('swStatus').textContent=message;$('swStatus').classList.toggle('sw-error',error);}
 function api(path,options){return window.ContentStudio.request(base+path,options||{});}
 function cleanUrls(){++practiceVersion;++audioVersion;activeAudio?.pause();activeAudio=null;activePreview?.destroy?.();activePreview=null;previewUrls.forEach(url=>URL.revokeObjectURL(url));previewUrls=[];}
 function list(){const published=courses.map(c=>`<article class="sw-draft"><div><h2>${esc(c.title)}</h2><p>${c.itemCount} 词 · 已上架 · 当前版本 ${esc(c.releaseId.slice(0,10))}…</p><div class="sw-course-actions"><button class="btn" data-revise="${esc(c.bookId)}">导入修正版</button><input type="file" data-revision-file="${esc(c.bookId)}" accept="application/json,.json" aria-label="选择 ${esc(c.title)} 修正版 JSON" style="position:fixed;left:-10000px;width:1px;height:1px;opacity:.01"><button class="btn" data-versions="${esc(c.bookId)}">版本记录</button></div><div class="sw-versions" data-history="${esc(c.bookId)}" hidden></div></div></article>`).join('');const pending=drafts.map(d=>`<article class="sw-draft"><div><h2>${esc(d.title)}</h2><p>${d.unitCount} 单元 · ${d.itemCount} 词 · ${esc(states[d.status]||d.status)}${d.operation==='update'?' · 修正版':''} · ${new Date(d.updatedAt||d.createdAt).toLocaleString()}</p></div><button class="btn" data-open="${esc(d.importId)}">查看与继续</button></article>`).join('');$('swDrafts').innerHTML=(published?'<h2>已上架教材</h2>'+published:'')+(pending?'<h2>导入草稿</h2>'+pending:'')||'<p class="sw-empty">还没有教材。请选择整本教材包导入。</p>';}
 async function load(){status('');try{const [data,live]=await Promise.all([api(''),api('/published')]);drafts=data.drafts;courses=live.courses;list();if(activeId)await open(activeId);}catch(e){status('读取失败：'+e.message,true);}}
 function close(){++openVersion;++renderVersion;cleanUrls();assetBlobs.clear();activeId='';detail=null;$('swDetail').hidden=true;root.classList.remove('sw-reading');status('');}
 async function open(id){
  const version=++openVersion;status('正在检查课程…');
  try{
   let next=await api('/'+encodeURIComponent(id));let checked=null,error='';
   if(!next.published&&!next.assets.some(a=>a.missing)){
    try{checked=await api('/'+encodeURIComponent(id)+'/validate',{method:'POST',body:JSON.stringify({revision:next.revision})});next=await api('/'+encodeURIComponent(id));}catch(e){error=e.message;}
   }
   const page=await api('/'+encodeURIComponent(id)+'/items?offset=0&limit=20');if(version!==openVersion)return;
   if(activeId!==id)assetBlobs.clear();activeId=id;detail=next;validation=checked;validationError=error;items=page.items;position=0;pageOffset=0;mode='';
   root.classList.add('sw-reading');status('');root.scrollTop=0;await render();
  }catch(e){if(version===openVersion)status('读取草稿失败：'+e.message,true);}
 }
 async function moveItem(delta){
  const next=Math.max(0,Math.min(detail.itemCount-1,position+delta)),offset=Math.floor(next/20)*20,id=activeId,version=++openVersion;
  try{if(offset!==pageOffset){const page=await api('/'+encodeURIComponent(id)+'/items?offset='+offset+'&limit=20');if(version!==openVersion)return;items=page.items;pageOffset=offset;}position=next;await render();}catch(e){if(version===openVersion)status('词条读取失败：'+e.message,true);}
 }
 function previewModeOptions(item){const learning=item.learning||{},modes=[];if(item.exercise)modes.push(['sentence-cloze','句子填空']);if(learning.wordChoice)modes.push(['word-choice','选词填空']);if(learning.chunkOrder)modes.push(['chunk-order','词序拼块']);if(learning.guidedExpression)modes.push(['guided-expression','中文引导']);if(learning.wordDictation)modes.push(['word-dictation','单词听写']);if(!modes.some(x=>x[0]===mode))mode=modes[0]?.[0]||'';return modes;}
 async function assetUrl(asset,version){
  const key=activeId+':'+asset.sha256;let blob=assetBlobs.get(key);
  if(!blob)blob=await window.ContentStudio.requestAsset(base+'/'+encodeURIComponent(activeId)+(asset.previous?'/previous-assets/':'/assets/')+encodeURIComponent(asset.url.split('/').pop()));
  if(version!==renderVersion)return '';assetBlobs.delete(key);assetBlobs.set(key,blob);if(assetBlobs.size>8)assetBlobs.delete(assetBlobs.keys().next().value);
  const url=URL.createObjectURL(blob);previewUrls.push(url);return url;
 }
 async function renderPractice(item,version){
  const host=$('swPractice'),practice=++practiceVersion;if(!host||version!==renderVersion)return;activePreview?.destroy?.();activePreview=null;host.replaceChildren();
  const complete=()=>{if(version===renderVersion)$('swPreviewFeedback').textContent='正确';},callbacks={onAttempt:function(){},onComplete:complete};
  try{
   if(mode==='sentence-cloze')activePreview=window.JQKAClozeView.create(item.exercise,callbacks);
   else if(mode==='word-choice')activePreview=window.VocabularyWordChoiceView.create(item,callbacks);
   else if(mode==='chunk-order')activePreview=window.VocabularyChunkOrderView.create(item,callbacks);
   else if(mode==='guided-expression')activePreview=window.GuidedSentenceView.create(item,item.learning.guidedExpression.steps,callbacks);
   else if(mode==='word-dictation'){
    const copy=structuredClone(item),asset=detail.assets.find(a=>a.url===copy.learning.wordDictation.audio.url);if(!asset||asset.missing)throw Error('单词音频尚未补齐');
    const url=await assetUrl(asset,version);if(!url||version!==renderVersion||practice!==practiceVersion)return;copy.learning.wordDictation.audio.url=url;activePreview=window.VocabularyWordDictationView.create(copy,callbacks);
   }
   if(activePreview)host.append(activePreview.element);
  }catch(e){if(version===renderVersion&&practice===practiceVersion)host.textContent='练习暂时无法显示：'+e.message;}
 }
 async function render(){
  cleanUrls();const version=++renderVersion,item=items[position-pageOffset];if(!detail||!item)return;
  const missing=detail.assets.filter(a=>a.missing),issues=detail.issues||[],currentIssues=issues.filter(i=>i.itemId===item.itemId),modes=previewModeOptions(item),updateMode=detail.operation==='update',change=detail.changedItems?.find(row=>row.itemId===item.itemId);
  const audioOptions=[['wordDictation','听单词'],['sentenceAudio','听例句'],['readAloud','听跟读示范']].map(([key,label])=>({label,url:item.learning?.[key]?.audio?.url})).filter((a,index,all)=>a.url&&all.findIndex(other=>other.url===a.url)===index);
  const saved=issueNotes.get(item.itemId)||{category:'image',note:''};
  const units=detail.units||[],currentUnit=units.find(unit=>position>=unit.offset&&position<unit.offset+unit.itemCount),wholeBook=detail.sourceFormat==='textbook-wordbook-package';
  $('swDetail').hidden=false;
  $('swDetail').innerHTML=`<header class="sw-course-head"><button class="btn" id="swBack">返回课程列表</button><h2>${esc(detail.title)}</h2><span class="sw-check${missing.length||validationError?' sw-check-error':''}" role="status">${detail.published?'已发布':missing.length?'待补齐 '+missing.length+' 个素材':validationError?'检查未通过':validation?'技术检查通过':'待检查'}</span></header>
   ${updateMode?`<section class="sw-change-summary"><strong>修正版 · ${detail.changedItems?.length||0} 项内容有变化</strong><p>目录及词条编号保持不变；发布后旧版本和原学习记录仍保留。逐词切换可对照修订前后内容。</p><details><summary>变化词条目录</summary><ul>${(detail.changedItems||[]).map(row=>`<li>${esc(row.word)} · ${esc(row.unitId)} · ${row.fields.map(esc).join('、')}</li>`).join('')}</ul></details>${change?`<div class="sw-item-diff"><strong>${esc(change.word)} · 当前词条前后对照</strong>${[['释义','meaning'],['中文例句','translation'],['英文例句','example']].filter(([,key])=>change.before[key]!==change.after[key]).map(([label,key])=>`<div><span>${label}</span><del>${esc(change.before[key])}</del><b>→</b><span>${esc(change.after[key])}</span></div>`).join('')}${change.before.imageUrl&&change.before.imageUrl!==change.after.imageUrl?'<p>旧配图 / 新配图</p><div class="sw-image-diff"><div><small>修订前</small><div id="swPreviousPicture"></div></div><div><small>修订后</small><div id="swCurrentPicture"></div></div></div>':''}${change.before.audioUrl&&change.before.audioUrl!==change.after.audioUrl?'<button class="btn" id="swPreviousAudio">播放修订前声音</button>':''}</div>`:''}</section>`:''}
   ${validationError?`<p class="sw-message sw-error">${esc(validationError)} <button class="btn" id="swRetry">重新检查</button></p>`:''}
   ${units.length?`<nav class="sw-unit-nav" aria-label="教材单元"><label>单元目录 <select id="swUnit">${units.map(unit=>`<option value="${unit.offset}" ${currentUnit?.unitId===unit.unitId?'selected':''}>${esc(unit.title)} · ${unit.itemCount} 词</option>`).join('')}</select></label><span>${currentUnit?`本单元 ${position-currentUnit.offset+1} / ${currentUnit.itemCount} · `:''}全书 ${detail.itemCount} 词</span></nav>`:''}
   <section class="sw-preview" id="swPreview" aria-label="课程内容审看"><div id="swPicture" class="sw-picture"></div><div class="sw-word-row"><h3>${esc(item.word)}<span>${esc(item.meaning)}</span></h3><div class="sw-audio">${audioOptions.length?audioOptions.map(a=>`<button class="sw-audio-button" data-audio="${esc(a.url)}" type="button">${speaker}${esc(a.label)}</button>`).join(''):'<span class="sw-muted">暂无音频</span>'}</div></div><p class="sw-question" lang="en">${esc(item.example||'')}</p><p class="sw-translation">${esc(item.translation||'')}</p><p id="swAudioFeedback" class="sw-error" role="status"></p>
   ${modes.length?`<details id="swPracticeSection" class="sw-disclosure"><summary>试做练习</summary>${modes.length>1?`<label class="sw-mode-label">答题方式 <select id="swMode">${modes.map(([id,label])=>`<option value="${id}" ${id===mode?'selected':''}>${label}</option>`).join('')}</select></label>`:''}<div id="swPractice" class="sw-practice wordbook-study"></div><p id="swPreviewFeedback" role="status"></p></details>`:''}
   <div class="sw-preview-nav"><button class="btn" id="swPrev" ${position===0?'disabled':''}>上一词</button><span>${position+1} / ${detail.itemCount}</span><button class="btn" id="swNext" ${position===detail.itemCount-1?'disabled':''}>下一词</button></div>
   ${!detail.published?`<details class="sw-disclosure sw-issue-form" id="swIssueForm"><summary>标记问题${currentIssues.length?'（'+currentIssues.length+'）':''}</summary><form id="swIssueSave"><label>问题类型<select id="swIssueCategory">${Object.entries(categories).map(([key,label])=>`<option value="${key}" ${saved.category===key?'selected':''}>${label}</option>`).join('')}</select></label><label class="sw-issue-note">说明（选填）<input class="field" id="swIssueNote" maxlength="1000" value="${esc(saved.note)}"></label><button class="btn" type="submit">记录问题</button></form>${currentIssues.map(i=>`<p class="sw-current-issue">${esc(categories[i.category])}${i.note?'：'+esc(i.note):''}<button class="sw-text-button" data-resolve="${esc(i.category)}">撤销标记</button></p>`).join('')}</details>`:''}</section>
   ${issues.length?`<details class="sw-disclosure sw-pending" open><summary>待处理问题 · ${issues.length}</summary>${issues.map((i,index)=>`<button class="sw-issue-link" data-jump="${index}">${esc(i.word||i.itemId)} · ${esc(categories[i.category])}${i.note?' · '+esc(i.note):''}</button>`).join('')}</details>`:''}
   <details class="sw-disclosure sw-diagnostics" ${missing.length?'open':''}><summary>${missing.length?'素材待补齐 · '+missing.length:'技术明细 · '+detail.assets.length+' 个素材'}</summary><p class="sw-muted">课程编号：${esc(detail.bookId)}</p><div id="swAssets" class="sw-assets">${detail.assets.map(a=>`<div class="sw-asset"><span>${esc(a.url)}<small>${a.missing?'待补齐':(a.bytes||0)+' bytes'}</small></span>${a.missing&&!detail.published?`<input type="file" data-upload="${esc(a.url)}" accept="${a.kind==='illustration'?'.webp':a.kind==='audio'?'.mp3,.ogg,.wav':'.webp,.png,.jpg,.jpeg'}" aria-label="上传 ${esc(a.url)}">`:''}</div>`).join('')}</div></details>
   <footer class="sw-review" id="swReview"><span>${detail.published?'课程已发布':issues.length?'处理完已标记的问题后即可发布':validation?updateMode?'核对变化词条及图片、声音后更新整本教材':'内容审看完成后即可发布':missing.length?'补齐素材后将自动检查':'技术检查通过后可发布'}</span><button class="btn primary" id="swPublish" ${detail.published||!validation||issues.length?'disabled':''}>${detail.published?'已发布':updateMode?'确认更新整本教材':wholeBook?'发布整本教材':'发布课程'}</button><p id="swReviewStatus" role="status"></p></footer>`;
  $('swBack').onclick=close;$('swPrev').onclick=()=>moveItem(-1);$('swNext').onclick=()=>moveItem(1);if($('swRetry'))$('swRetry').onclick=()=>open(activeId);
  if($('swUnit'))$('swUnit').onchange=()=>moveItem(Number($('swUnit').value)-position);
  if($('swPracticeSection')){
   $('swPracticeSection').ontoggle=()=>{if($('swPracticeSection').open)renderPractice(item,version);};
   if($('swMode'))$('swMode').onchange=()=>{mode=$('swMode').value;$('swPreviewFeedback').textContent='';renderPractice(item,version);};
  }
  root.querySelectorAll('[data-audio]').forEach(button=>{button.onclick=async()=>{
   const playback=++audioVersion;button.disabled=true;$('swAudioFeedback').textContent='';activeAudio?.pause();
   try{const asset=detail.assets.find(a=>a.url===button.dataset.audio);if(!asset||asset.missing)throw Error();const url=await assetUrl(asset,version);if(!url||version!==renderVersion||playback!==audioVersion)return;activeAudio=new Audio(url);await activeAudio.play();}catch{if(version===renderVersion&&playback===audioVersion)$('swAudioFeedback').textContent='音频暂时无法播放，请检查素材。';}finally{button.disabled=false;}
  };});
  if($('swIssueSave')){
   $('swIssueSave').oninput=()=>issueNotes.set(item.itemId,{category:$('swIssueCategory').value,note:$('swIssueNote').value});
   $('swIssueSave').onsubmit=async e=>{e.preventDefault();await saveIssue(item,$('swIssueCategory').value,false,$('swIssueNote').value);};
   root.querySelectorAll('[data-resolve]').forEach(button=>button.onclick=()=>saveIssue(item,button.dataset.resolve,true,''));
  }
  root.querySelectorAll('[data-jump]').forEach(button=>button.onclick=()=>moveItem(issues[Number(button.dataset.jump)].position-position));
  $('swAssets').onchange=async e=>{
   const input=e.target.closest('[data-upload]'),file=input?.files?.[0];if(!file)return;input.disabled=true;
   try{await api('/'+encodeURIComponent(activeId)+'/assets/'+encodeURIComponent(input.dataset.upload.split('/').pop()),{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:file});await open(activeId);}catch(error){input.disabled=false;status('素材上传失败：'+error.message,true);}
  };
  $('swPublish').onclick=publish;
  const picture=detail.assets.find(a=>a.kind==='illustration'&&item.images?.wide?.includes(a.url));
  if(picture&&!picture.missing){try{const url=await assetUrl(picture,version);if(version!==renderVersion)return;if(url)$('swPicture').innerHTML=`<img src="${url}" alt="${esc(item.word)} 场景图">`;}catch{if(version===renderVersion)$('swPicture').textContent='图片暂时无法显示，请重新打开课程。';}}
  else $('swPicture').textContent='配图待补齐';
  if(change?.before.imageUrl&&change.before.imageUrl!==change.after.imageUrl){for(const [url,hostId,previous] of [[change.before.imageUrl,'swPreviousPicture',true],[change.after.imageUrl,'swCurrentPicture',false]]){const host=$(hostId),asset=(previous?detail.previousAssets:detail.assets).find(row=>row.url===url);if(!host||!asset)continue;try{const src=await assetUrl({...asset,previous},version);if(version!==renderVersion)return;if(src)host.innerHTML=`<img src="${src}" alt="${esc(item.word)} ${previous?'修订前':'修订后'}配图">`;}catch{if(version===renderVersion)host.textContent='图片暂不可用';}}}
  if(change?.before.audioUrl&&change.before.audioUrl!==change.after.audioUrl&&$('swPreviousAudio'))$('swPreviousAudio').onclick=async()=>{const audio=detail.previousAssets.find(row=>row.url===change.before.audioUrl);if(!audio)return;try{const src=await assetUrl({...audio,previous:true},version);if(!src||version!==renderVersion)return;activeAudio?.pause();activeAudio=new Audio(src);await activeAudio.play();}catch{if(version===renderVersion)status('修订前声音暂不可播放',true);}};
 }
 async function saveIssue(item,category,resolved,note){
  const id=activeId;try{const result=await api('/'+encodeURIComponent(id)+'/issues',{method:'POST',body:JSON.stringify({itemId:item.itemId,category,resolved,note})});if(activeId!==id)return;detail.issues=result.issues;detail.review=null;issueNotes.delete(item.itemId);await render();}catch(e){status('问题未保存：'+e.message,true);}
 }
 async function publish(){
  if(!validation||detail.published||(detail.issues||[]).length)return;
  const updating=detail.operation==='update';if(!window.confirm(updating?`确认已检查《${detail.title}》的 ${detail.changedItems?.length||0} 项变化及相关图片、声音，并拥有素材使用授权，更新整本教材？旧版本和学习记录会保留。`:detail.sourceFormat==='textbook-wordbook-package'?`确认已审看《${detail.title}》的 ${detail.unitCount} 个单元、${detail.itemCount} 个词，并拥有素材使用授权，将整本教材发布给用户？`:'确认已审看课程内容，并拥有素材使用授权，将此课程发布给用户？'))return;
  const id=activeId,checked=validation,button=$('swPublish');button.disabled=true;
  try{
   const receipt=await api('/'+encodeURIComponent(id)+'/review',{method:'POST',body:JSON.stringify({revision:checked.revision,fingerprint:checked.fingerprint,approved:true})});
   const result=await api('/'+encodeURIComponent(id)+'/publish',{method:'POST',body:JSON.stringify({reviewId:receipt.reviewId,revision:checked.revision,fingerprint:checked.fingerprint,confirmed:true,rightsConfirmed:true})});
   await load();status('已发布：'+result.title+'。');
  }catch(e){if(activeId===id&&$('swReviewStatus')){$('swReviewStatus').textContent='发布未完成：'+e.message;button.disabled=false;}}
 }
 $('swImport').onsubmit=async e=>{e.preventDefault();const file=$('swFile').files[0];if(!file)return;const button=$('swImport').querySelector('button');button.disabled=true;try{if(file.size>10000000)throw Error('课程 JSON 不能超过 10 MB');const source=JSON.parse(await file.text()),created=await api('',{method:'POST',body:JSON.stringify(source)});$('swFile').value='';await load();await open(created.importId);}catch(error){status('导入失败：'+error.message,true);}finally{button.disabled=false;}};
 async function startRevision(bookId){const course=courses.find(row=>row.bookId===bookId),input=root.querySelector(`[data-revision-file="${CSS.escape(bookId)}"]`);if(!course||!input)return;input.value='';input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{if(file.size>10000000)throw Error('课程 JSON 不能超过 10 MB');const source=JSON.parse(await file.text()),created=await api('/revisions',{method:'POST',body:JSON.stringify({bookId,baseReleaseId:course.releaseId,source})});await load();await open(created.importId);}catch(error){status('修正版导入失败：'+error.message,true);}};input.click();}
 async function showVersions(bookId){const host=root.querySelector(`[data-history="${CSS.escape(bookId)}"]`);if(!host)return;try{const data=await api('/published/'+encodeURIComponent(bookId)+'/versions');host.hidden=false;host.innerHTML=data.versions.map(row=>`<div class="sw-version-row"><span>${row.active?'当前版本':row.legacy?'首版':'历史版本'} · ${esc(row.releaseId.slice(0,10))}…</span>${row.active?'':`<button class="btn" data-rollback="${esc(bookId)}" data-release="${esc(row.releaseId)}">恢复此版本</button>`}</div>`).join('');}catch(error){status('版本记录读取失败：'+error.message,true);}}
 $('swDrafts').onclick=async e=>{const button=e.target.closest('[data-open],[data-revise],[data-versions],[data-rollback]');if(!button)return;if(button.dataset.open){open(button.dataset.open);return;}if(button.dataset.revise){startRevision(button.dataset.revise);return;}if(button.dataset.versions){showVersions(button.dataset.versions);return;}if(button.dataset.rollback){const course=courses.find(row=>row.bookId===button.dataset.rollback);if(!course||!window.confirm('恢复此教材版本？当前版本仍会保留，学习记录不会删除。'))return;try{await api('/published/'+encodeURIComponent(course.bookId)+'/rollback',{method:'POST',body:JSON.stringify({expectedBaseReleaseId:course.releaseId,releaseId:button.dataset.release,confirmed:true})});status('已恢复教材版本。');await load();await showVersions(course.bookId);}catch(error){status('恢复失败：'+error.message,true);}}};$('swRefresh').onclick=load;
 document.getElementById('systemWordbooksOpen').onclick=()=>{window.ContentStudio.showView('system-wordbooks');load();};
})();
