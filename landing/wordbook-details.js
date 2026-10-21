(function(){
 'use strict';
 const bookId=new URLSearchParams(location.search).get('book')||'pilot-six-v1',root=document.getElementById('detailsRoot'),status=document.getElementById('detailsStatus');
 const base='/api/wordbooks/'+encodeURIComponent(bookId),request=url=>ChunkAPI.request(url,{timeoutMs:12000});
 let generation=0,details,materialCache;
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
 const button=(text,action)=>{const el=node('button',text);el.type='button';el.onclick=action;return el;};
 function introduction(unit){const plan=details.features?.vocabularyBrowse&&(details.teachingOptions||[]).find(row=>row.unitId===(unit?.unitId||null));if(!plan)return null;const link=node('a','认识词与表达','book-start');link.href='wordbook-intro.html?book='+encodeURIComponent(bookId)+'&plan='+encodeURIComponent(plan.revision)+(unit?'&unit='+encodeURIComponent(unit.unitId):'');return link;}
 function practiceMenu(options,total,unit){
  const modes={'word-choice':{label:'选词填空',feature:'wordChoice'},'word-dictation':{label:'单词听写',feature:'wordDictation'},'chunk-order':{label:'词序拼块',feature:'chunkOrder'},'read-aloud':{label:'跟读练习',feature:'readAloud'}},available=(options||[]).filter(option=>modes[option.practiceType]&&details.features?.[modes[option.practiceType].feature]&&Number.isSafeInteger(option.itemCount)&&option.itemCount>0&&option.itemCount<=total);
  if(!available.length)return null;
  const menu=node('details',undefined,'book-methods'),summary=node('summary','其他学习方式'),links=node('div',undefined,'book-method-links');menu.setAttribute('aria-label',unit?unit.title+'的学习方式':'词书学习方式');
  for(const option of available){const row=node('div'),link=node('a',modes[option.practiceType].label,'book-method-link');link.href='wordbook.html?book='+encodeURIComponent(bookId)+(unit?'&unit='+encodeURIComponent(unit.unitId)+'&structureRevision='+encodeURIComponent(details.structureRevision):'')+'&practice='+encodeURIComponent(option.practiceType);row.append(link,node('span',option.itemCount+' / '+total+' 项有素材','book-meta'));links.append(row);}menu.append(summary,links);return menu;
 }
 function error(e){status.textContent=e.message==='Failed to fetch'?'暂时连接不上服务，请稍后重试；课程与记录保留。':(e.message||'读取失败')+'；课程与记录保留。';root.setAttribute('aria-busy','false');if(!root.querySelector('.book-retry')){const retry=button('重试读取',boot);retry.className='book-retry';root.append(retry);}}
 function highlighted(text,targets){
  const paragraph=node('p'),words=[...new Set((targets||[]).map(target=>target.word).filter(word=>typeof word==='string'&&word))].sort((a,b)=>b.length-a.length);
  if(!words.length){paragraph.textContent=text;return paragraph;}
  const pattern=new RegExp('(?<![A-Za-z])('+words.map(word=>word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')(?![A-Za-z])','gi');
  let start=0;for(const match of text.matchAll(pattern)){paragraph.append(document.createTextNode(text.slice(start,match.index)),node('mark',match[0]));start=match.index+match[0].length;}paragraph.append(document.createTextNode(text.slice(start)));return paragraph;
 }
 async function reading(panel,kind){
  const ticket=++generation;panel.setAttribute('aria-busy','true');status.textContent='正在读取阅读材料…';
  try{
   const data=materialCache||await request(base+'/materials');if(ticket!==generation)return;
   if(data.bookId!==bookId||data.revision!==details.revision)throw Object.assign(Error('课程材料版本已变化，请重新读取单词本'),{code:'MATERIAL_VERSION_CHANGED'});
   materialCache=data;panel.replaceChildren(node('h2',kind==='dialogue'?'对话':'短文'),node('p','阅读不计为答题完成；练习请从对应单元进入。','book-meta'));
   let count=0;for(const unit of data.units||[])for(const material of unit.materials||[]){if(material.kind!==kind)continue;count++;
    const article=node('article',undefined,'book-material');article.append(node('h3',material.title),node('p',details.units?.find(row=>row.unitId===unit.unitId)?.title||'','book-meta'));
    for(const line of material.lines){const turn=node('div',undefined,'book-material-line');if(line.speaker)turn.append(node('span',line.speaker,'book-speaker'));turn.append(highlighted(line.en,line.targets));
     const translation=node('details'),summary=node('summary','查看中文');translation.append(summary,node('p',line.zh));turn.append(translation);article.append(turn);
    }panel.append(article);
   }
   if(!count)panel.append(node('p','当前单词本没有这类阅读材料。'));
   status.textContent='';panel.setAttribute('aria-busy','false');
  }catch(e){if(ticket!==generation)return;panel.replaceChildren(node('p',(e.message||'材料读取失败')+'；原课程与学习记录保留。'),e.code==='MATERIAL_VERSION_CHANGED'?button('重新读取单词本',boot):button('重试读取材料',()=>reading(panel,kind)));panel.setAttribute('aria-busy','false');status.textContent='材料未能读取。';}
 }
 async function contents(panel,unit,offset=0){
  const ticket=++generation;panel.setAttribute('aria-busy','true');status.textContent='正在读取内容目录…';
  try{
   const page=await request(unit?base+'/units/'+encodeURIComponent(unit.unitId)+'/items?offset='+offset+'&limit=20':base+'/items?offset='+offset+'&limit=20');
   const items=await Promise.all(page.items.map(ref=>request('/api/vocabulary-items/'+encodeURIComponent(ref.itemId)+'?revision='+encodeURIComponent(ref.contentRevision))));
   if(ticket!==generation)return;panel.replaceChildren(node('h2',unit?unit.title:'内容目录'));
   if(unit)panel.append(button('返回单元目录',()=>{generation++;render();}));
   const list=node('ul',undefined,'book-list');items.forEach(item=>{const li=node('li'),copy=node('div');copy.append(node('strong',item.word+' · '+item.meaning),node('p',item.translation,'book-meta'));li.append(copy);list.append(li);});panel.append(list);
   if(!items.length)panel.append(node('p','当前目录没有教学项目。'));
   const pages=node('div',undefined,'book-pagination');if(offset>0)pages.append(button('上一页',()=>contents(panel,unit,Math.max(0,offset-20))));if(page.nextOffset!==null&&page.nextOffset!==undefined)pages.append(button('下一页',()=>contents(panel,unit,page.nextOffset)));panel.append(pages);
   status.textContent='';panel.setAttribute('aria-busy','false');
  }catch(e){if(ticket===generation){panel.setAttribute('aria-busy','false');error(e);}}
 }
 function render(){
  root.replaceChildren();const intro=node('header',undefined,'book-intro'),copy=node('div');
  const cover=details.catalog?.coverUrl;if(cover&&/^assets\/[A-Za-z0-9._-]+\.(avif|webp|png|jpg|svg)$/.test(cover)){const img=node('img');img.src=cover;img.alt='';intro.append(img);}
  const facets=details.catalog?.facets||{},labels=[facets.schoolStages,facets.grades,facets.publisherId,facets.edition,facets.volume].flat().filter(Boolean);
  copy.append(node('h1',details.title),node('p',details.itemCount+' 项教学内容','book-meta book-count'));
  const sourceDescription=details.catalog?.description||'浏览学习内容，再开始练习。',descriptionText=sourceDescription==='整本教材词汇课程；原创例句。'?'词汇课程，原创例句':sourceDescription;
  const info=node('details',undefined,'book-info'),summary=node('summary','课程信息'),description=node('p',descriptionText);
  info.append(summary,description);
  const meta=[details.units?.length>1?details.units.length+' 个单元':'',...labels].filter(Boolean);
  if(meta.length)info.append(node('p',meta.join(' · '),'book-meta'));
  if(details.level?.value)info.append(node('p','目标水平 '+details.level.value+(details.level.status==='reviewed'?'（已审核）':'（待审核）'),'book-meta'));
  if(details.relatedCourses?.length){const links=node('p','配套课程：','book-meta');details.relatedCourses.forEach((course,index)=>{if(index)links.append(document.createTextNode('、'));const valid=course.available&&typeof course.href==='string'&&/^decks\.html\?courseView=(joined|discover)&course=[A-Za-z0-9%._-]+&returnView=my-learning$/.test(course.href);const link=node(valid?'a':'span',course.title);if(valid)link.href=course.href;links.append(link);});info.append(links);}
  copy.append(info);
  intro.append(copy);root.append(intro);
  const panel=node('section',undefined,'book-catalog');
  const kinds=['dialogue','reading'].filter(kind=>details.materialKinds?.includes(kind));
  if(kinds.length){const nav=node('nav',undefined,'book-material-nav');nav.setAttribute('aria-label','内容形式');
   const select=selected=>{for(const control of nav.querySelectorAll('button'))control.setAttribute('aria-pressed',String(control===selected));};
   const directory=button('单元目录',()=>{generation++;render();});directory.setAttribute('aria-pressed','true');nav.append(directory);
   for(const kind of kinds){const control=button(kind==='dialogue'?'对话':'短文',()=>{select(control);reading(panel,kind);});control.setAttribute('aria-pressed','false');nav.append(control);}root.append(nav);
  }
  root.append(panel);root.setAttribute('aria-busy','false');status.textContent='';
  if(details.units?.length){panel.append(node('h2','单元目录'));const list=node('ul',undefined,'book-list book-unit-list');details.units.forEach((unit,index)=>{const li=node('li',undefined,'book-unit'),shared=LessonCard.create({title:unit.title,index:index+1,image:CourseCovers.fallback({id:unit.unitId,title:unit.title}),meta:unit.itemCount+' 项'}),actions=node('div',undefined,'book-unit-actions');actions.append(button('查看内容',()=>contents(panel,unit)));
    if(details.features?.unitSessions){const start=node('a','练习本单元','book-start');start.href='wordbook.html?book='+encodeURIComponent(bookId)+'&unit='+encodeURIComponent(unit.unitId)+'&structureRevision='+encodeURIComponent(details.structureRevision);actions.append(start);const introLink=introduction(unit);if(introLink)actions.append(introLink);const methods=practiceMenu(unit.practiceOptions,unit.itemCount,unit);if(methods)actions.append(methods);}shared.footer.append(actions);li.append(shared.card);list.append(li);});panel.append(list);}
  else contents(panel,null);
  root.querySelectorAll('a[href]').forEach(link=>{if(/^wordbook(?:-intro)?\.html\?/.test(link.getAttribute('href')))link.href=CourseReturn.forward(link.getAttribute('href'));});
 }
 async function boot(){generation++;materialCache=null;root.setAttribute('aria-busy','true');status.textContent='正在读取单词本…';const ticket=generation;
  try{
   try{details=await request(base+'/details');}catch(e){if(e.status!==404)throw e;const page=await request(base+'/items?offset=0&limit=20');details={...page,units:[],organization:'flat'};}
   if(ticket===generation)render();
  }catch(e){if(ticket===generation)error(e);}
 }
 window.addEventListener('storage',event=>{if(event.key!==null&&!['chunklab.session.v1','chunklab_token','chunklab_api_base'].includes(event.key))return;generation++;materialCache=null;root.replaceChildren();status.textContent='账号或服务设置可能已变化，请重新读取。';root.append(button('重新读取',boot));});window.addEventListener('cloud-config-changed',()=>{if(details)render();});boot();
})();
