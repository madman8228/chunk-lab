(function(){
 'use strict';
 const root=document.getElementById('textbookDraftsPanel');if(!root)return;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let books=[],active=null,position=0,generation=0;
 root.innerHTML='<div class="td-heading"><h1>教材草稿</h1><button class="btn" id="tdRefresh">刷新审核结果</button></div><p>人民教育出版社 · 普通高中教科书《英语》必修第一、二、三册（2019）。仅管理员预览，未上架。</p><p id="tdStatus" role="status" aria-live="polite"></p><div id="tdList" class="td-list"></div><section id="tdDetail" hidden aria-label="教材内容预览"></section>';
 const $=id=>root.querySelector('#'+id);
 async function request(route){let base='',token='';try{base=(localStorage.getItem('chunklab_api_base')||'').replace(/\/+$/,'');token=localStorage.getItem('chunklab_admin_token')||'';}catch{}
  const response=await fetch(base+'/api/admin/illustration-review'+route,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
  const data=await response.json();if(!response.ok)throw Error(data.error||'读取草稿失败');return data;
 }
 const imageReady=item=>item.review.status==='approved'&&item.checks.length===0&&!!item.delivery;
 function summary(book){const result={approved:0,changes:0,pending:0,images:0,missing:0};for(const item of book.items){result[item.review.status]++;if(imageReady(item))result.images++;if(!item.delivery)result.missing++;}return result;}
 function list(){
  $('tdList').innerHTML=books.map(book=>{const count=summary(book);return `<article class="td-row"><div><h2>${esc(book.title)}</h2><p>${book.items.length} 词 · ${new Set(book.items.map(i=>i.unit)).size} 单元 · 系统草稿</p></div><div><p>配图通过 ${count.images} · 待修改 ${count.changes} · 未审 ${count.pending} · 缺图 ${count.missing}</p><p class="td-blocker">待补齐例句练习及发布包校验</p></div><div class="td-actions"><button class="btn" data-preview="${esc(book.id)}">内容预览</button><button class="btn" data-report="${esc(book.id)}">导出制作清单</button></div></article>`;}).join('')||'<p>尚无教材草稿。</p>';
 }
 async function load(){const requestId=++generation;$('tdRefresh').disabled=true;$('tdStatus').textContent='读取教材和审核结果…';
  try{const directory=await request('');const results=await Promise.all(directory.courses.filter(c=>c.stage==='senior').map(c=>request('/'+encodeURIComponent(c.id))));if(requestId!==generation)return;books=results;list();$('tdStatus').textContent='已读取 '+books.length+' 册，共 '+books.reduce((n,b)=>n+b.items.length,0)+' 词。';if(active){active=books.find(b=>b.id===active.id)||null;if(active)detail();else $('tdDetail').hidden=true;}}
  catch(error){$('tdStatus').textContent='读取失败：'+error.message+'。请重试；原草稿和审核记录保持不变。';}
  finally{if(requestId===generation)$('tdRefresh').disabled=false;}
 }
 function visible(){const unit=$('tdUnit').value,q=$('tdSearch').value.trim().toLowerCase();return active.items.filter(i=>(!unit||i.unit===unit)&&(!q||(i.word+' '+i.meaning+' '+i.review.meaning).toLowerCase().includes(q)));}
 function detail(){
  $('tdDetail').hidden=false;
  $('tdDetail').innerHTML=`<h2>${esc(active.title)}</h2><div class="td-filters"><label>单元<select id="tdUnit"><option value="">全部单元</option>${[...new Set(active.items.map(i=>i.unit))].map(unit=>`<option>${esc(unit)}</option>`).join('')}</select></label><label>查找单词<input class="field" id="tdSearch" type="search" placeholder="单词或释义"></label></div><div id="tdWord" class="td-preview"></div><div class="td-readiness"><strong>上架前待完成</strong><ul><li>补齐并审核原创例句、译文和练习结构。</li><li>生成正式课程包并通过发布校验；当前只有词汇内容预览，不包含答题或学习进度。</li><li>待修改、未审核和缺失的图片暂不展示；图片审核结果不代表例句审核通过。</li></ul><button class="btn" disabled>上架（课程包尚未就绪）</button></div>`;
  $('tdUnit').onchange=$('tdSearch').oninput=()=>{position=0;word();};word();
 }
 function word(){const items=visible();position=Math.max(0,Math.min(position,items.length-1));const item=items[position];
  if(!item){$('tdWord').innerHTML='<p>没有匹配的词条，请调整单元或搜索词。</p>';return;}
  $('tdWord').innerHTML=`<figure>${imageReady(item)?`<img src="/${esc(item.delivery)}" alt="${esc(item.word)} 的配图" loading="lazy" decoding="async">`:'<p>配图待完善</p>'}</figure><h2>${esc(item.word)}</h2><p class="td-meaning">${esc(item.meaning||item.review.meaning||'释义待补充')}</p><p>${esc(item.unit)}</p><div class="td-preview-nav"><button class="btn" id="tdPrev"${position===0?' disabled':''}>上一词</button><span>${position+1} / ${items.length}</span><button class="btn" id="tdNext"${position===items.length-1?' disabled':''}>下一词</button></div>`;
  $('tdPrev').onclick=()=>{position--;word();};$('tdNext').onclick=()=>{position++;word();};
 }
 function report(book){const payload={format:'textbook-production-checklist',schemaVersion:1,createdAt:new Date().toISOString(),courseId:book.id,title:book.title,published:false,counts:summary(book),pending:['原创例句与译文','练习结构及人工审核','正式课程包与发布校验'],items:book.items.map(i=>({itemId:i.itemId,word:i.word,meaning:i.meaning,unit:i.unit,reviewStatus:i.review.status,version:i.version,note:i.review.note,reason:i.review.reason,checks:i.checks,images:imageReady(i)?{wide:i.delivery,mobile:i.delivery}:null}))};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=book.id+'-制作清单.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('tdStatus').textContent='已导出制作清单；这不是正式发布包。';
 }
 $('tdList').onclick=event=>{const preview=event.target.closest('[data-preview]'),download=event.target.closest('[data-report]');if(preview){active=books.find(b=>b.id===preview.dataset.preview);position=0;detail();$('tdDetail').scrollIntoView({block:'start'});}if(download)report(books.find(b=>b.id===download.dataset.report));};
 $('tdRefresh').onclick=load;
 document.getElementById('textbookDraftsOpen').onclick=()=>{window.ContentStudio.showView('textbooks');load();};
})();
