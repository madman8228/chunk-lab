(function(){
  'use strict';
  var panel=document.getElementById('libraryMetadataPanel'),revision=0,fields={},loadedId='';
  var dirty=false,busy=false,loading=false,loadGeneration=0,actions=[];
  function sync(){form.inert=busy||loading;picker.disabled=busy;actions.forEach(function(button){button.disabled=busy||loading;});}
  function canDiscard(){return !dirty||confirm('目录有未保存修改，确定放弃并切换？');}
  function node(tag,text){var result=document.createElement(tag);if(text!==undefined)result.textContent=text;return result;}
  function action(text,fn){var button=node('button',text);button.type='button';button.className='btn';actions.push(button);button.onclick=async function(){if(busy||loading)return;busy=true;sync();try{await fn();}catch(error){message.textContent=error.message+'；表单内容保留。';}finally{busy=false;sync();}};return button;}
  async function request(path,options){var token=localStorage.getItem('chunklab_admin_token');var response=await fetch(path,{...options,headers:{'content-type':'application/json','authorization':'Bearer '+token}});var data=await response.json();if(!response.ok)throw Error(data.error||'请求失败');return data;}
  var heading=node('h2','目录分类');heading.id='libraryMetadataTitle';panel.append(heading,node('p','管理发现页的标题、封面与分类。多个值用逗号分隔。'));
  var message=node('p');message.setAttribute('role','status');panel.append(message);
  var picker=node('select');picker.setAttribute('aria-label','已有目录内容');panel.append(picker);
  picker.onchange=function(){if(busy){picker.value=loadedId;return;}if(!picker.value){picker.value=loadedId;return;}load(picker.value);};
  var form=node('form');form.className='library-metadata-form';form.onsubmit=function(event){event.preventDefault();};panel.append(form);
  form.addEventListener('input',function(){dirty=true;});
  form.addEventListener('change',function(){dirty=true;});
  window.addEventListener('beforeunload',function(event){if(dirty||busy){event.preventDefault();event.returnValue='';}});
  function field(key,label,multiple){var wrap=node('label',label);var input=node(key==='kind'?'select':multiple?'textarea':'input');input.className='field';input.name=key;
    if(key==='kind')[['course','课程'],['wordbook','单词本'],['textbook','教材']].forEach(function(item){var option=node('option',item[1]);option.value=item[0];input.append(option);});
    if(multiple)input.rows=2;wrap.append(input);form.append(wrap);fields[key]=input;return input;
  }
  field('resourceId','稳定内容编号');field('kind','内容类型');field('title','标题');field('description','简介',true);field('coverUrl','封面路径（可留空）');
  field('relatedCourseIds','关联课程编号',true);
  Object.keys(LearningWorkspace.FACET_LABELS).forEach(function(key){field(key,LearningWorkspace.FACET_LABELS[key]);});
  var refs=node('select');refs.multiple=true;refs.size=6;refs.className='field';refs.setAttribute('aria-label','公开素材引用');var refLabel=node('label','公开素材引用（可多选）');refLabel.append(refs);form.append(refLabel);
  var preview=node('pre');panel.append(preview);
  function metadata(){var result={resourceId:fields.resourceId.value.trim(),kind:fields.kind.value,title:fields.title.value.trim(),description:fields.description.value.trim(),coverUrl:fields.coverUrl.value.trim(),relatedCourseIds:[...new Set(fields.relatedCourseIds.value.split(/[,，\n]/).map(function(value){return value.trim();}).filter(Boolean))],facets:{},sourceRefs:[...refs.selectedOptions].map(function(option){return JSON.parse(option.value);})};
    Object.keys(LearningWorkspace.FACET_LABELS).forEach(function(key){var text=fields[key].value.trim();result.facets[key]=['seriesId','publisherId','edition','volume'].includes(key)?text||null:[...new Set(text.split(/[,，]/).map(function(value){return value.trim();}).filter(Boolean))];});return result;}
  function fill(resource){Object.keys(fields).forEach(function(key){var value=resource[key]===undefined?(resource.facets||{})[key]:resource[key];fields[key].value=Array.isArray(value)?value.join(', '):value||'';});if(!resource.kind)fields.kind.value='course';
    [...refs.options].forEach(function(option){var ref=JSON.parse(option.value);option.selected=(resource.sourceRefs||[]).some(function(item){return item.type===ref.type&&item.id===ref.id;});});}
  async function load(id){
    if(!canDiscard()){picker.value=loadedId;return;}
    var generation=++loadGeneration;loading=true;sync();message.textContent='正在读取内容…';
    try{
      var data=await request('/api/admin/library/resources/'+encodeURIComponent(id));
      if(generation!==loadGeneration)return;
      loadedId=id;revision=data.revision;fill(data.resource||{resourceId:id,kind:'course'});savedForm=JSON.stringify(metadata());dirty=false;picker.value=id;message.textContent='版本 '+revision+' · '+data.status;preview.textContent='';
    }catch(error){if(generation===loadGeneration){picker.value=loadedId;message.textContent=error.message+'；表单内容保留。';}}
    finally{if(generation===loadGeneration){loading=false;sync();}}
  }
  var savedForm='';
  panel.append(action('新建引用集合',function(){if(!canDiscard())return;loadGeneration++;loadedId='';revision=0;picker.value='';dirty=true;fill({resourceId:'collection:'+crypto.randomUUID(),kind:'course'});message.textContent='新集合，尚未保存';}),action('预览分类',function(){var model=LearningWorkspace.normalizeResource(metadata());preview.textContent=JSON.stringify({标题:model.title,类型:model.kind,分类:model.facets,实际活动:model.activities},null,2);}),action('保存目录草稿',async function(){var resource=metadata();if(loadedId&&resource.resourceId!==loadedId)throw Error('既有内容编号不能更改，请新建集合');var data=await request('/api/admin/library/resources/'+encodeURIComponent(resource.resourceId)+'/draft',{method:'PUT',body:JSON.stringify({baseRevision:revision,resource:resource})});loadedId=resource.resourceId;revision=data.revision;savedForm=JSON.stringify(resource);dirty=false;message.textContent='目录草稿已保存 · 版本 '+revision;}),action('发布目录分类',async function(){if(!loadedId||fields.resourceId.value!==loadedId)throw Error('请先保存目录草稿');if(savedForm!==JSON.stringify(metadata()))throw Error('表单有未保存更改，请先保存草稿');var data=await request('/api/admin/library/resources/'+encodeURIComponent(loadedId)+'/publish',{method:'POST',body:JSON.stringify({revision:revision})});revision=data.revision;message.textContent='目录分类已发布 · 版本 '+revision+'；课程正文未修改';}),action('返回编辑',function(){window.ContentStudio.showView('editor');}));
  var catalogLoaded=false,catalogLoading=false;
  document.getElementById('libraryMetadataOpen').onclick=async function(){window.ContentStudio.showView('catalog');if(catalogLoaded||catalogLoading)return;catalogLoading=true;message.textContent='正在读取目录…';try{var data=await request('/api/admin/library/resources');picker.replaceChildren(node('option','选择已有内容'));picker.firstChild.value='';var unique=new Map();data.resources.forEach(function(resource){var option=node('option',resource.title);option.value=resource.resourceId;picker.append(option);resource.sourceRefs.forEach(function(ref){unique.set(JSON.stringify(ref),ref);});});refs.replaceChildren();unique.forEach(function(ref){var option=node('option',ref.type+' · '+ref.id);option.value=JSON.stringify(ref);refs.append(option);});catalogLoaded=true;message.textContent='选择内容，或新建引用集合。';}catch(error){message.textContent=error.message;}finally{catalogLoading=false;}};
})();
