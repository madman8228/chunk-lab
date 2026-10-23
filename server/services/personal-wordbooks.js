'use strict';
// Private content revisions are append-only; learning records remain in the existing study engine.
const crypto=require('node:crypto'),draftModel=require('../../js/wordbook-draft');
const fs=require('node:fs'),path=require('node:path'),Catalog=require('../../js/course-catalog');
const {wordbookImageDelivery}=require('./wordbook-image-delivery');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const versionFail=message=>Object.assign(fail(message,409),{code:'CONTENT_VERSION_CHANGED'});
function createPersonalWordbooks({db,appRoot=path.resolve(__dirname,'../..'),library:courseLibrary=null}){
 let library=courseLibrary;
 function validateImages(items){
  const checked=new Set();let assetDirectory;
  for(const item of items){
   const images=item.images;
   if(!Array.isArray(images?.wide)||!Array.isArray(images?.mobile))throw fail('插图引用格式无效');
   if(!images.wide.length&&!images.mobile.length)continue;
   if(!images.wide.length||!images.mobile.length)throw fail('带插图的词条需同时提供宽屏和手机版图片');
   for(const url of [...images.wide,...images.mobile]){
    if(typeof url!=='string'||!/^assets\/[A-Za-z0-9._-]+\.(avif|webp)$/.test(url))throw fail('插图路径无效');
    if(checked.has(url))continue;
    try{
     if(!assetDirectory){assetDirectory=path.join(fs.realpathSync(appRoot),'assets');if(fs.realpathSync(assetDirectory)!==assetDirectory)throw fail('插图目录不能指向项目外部');}
     const file=fs.realpathSync(path.join(assetDirectory,path.basename(url)));
     if(path.dirname(file)!==assetDirectory)throw fail('插图不能指向资源目录外部');
     const stat=fs.statSync(file);
     if(!stat.isFile()||stat.size<=0||stat.size>=20000)throw fail('每张插图及备用格式必须小于 20000 bytes：'+url);
    }catch(error){if(error.status)throw error;throw fail('插图文件不存在或无法读取：'+url);}
    checked.add(url);
   }
  }
 }
 function availableCourses(owner){
  if(!Number.isSafeInteger(owner)||owner<=0)throw fail('请先登录',401);
  const userDecks=db.prepare('SELECT id,name,authoring_json FROM user_decks WHERE user_id=? AND deleted_at IS NULL').all(owner)
   .map(row=>({id:row.id,name:row.name,items:[],authoring:row.authoring_json?JSON.parse(row.authoring_json):undefined}));
  const storyPackages=db.prepare('SELECT data_json FROM user_courses WHERE user_id=? AND deleted_at IS NULL').all(owner).map(row=>JSON.parse(row.data_json));
  const logicalCourses=db.prepare("SELECT data_json FROM user_entity_rows WHERE user_id=? AND kind='logicalCourse' AND deleted_at IS NULL").all(owner).map(row=>JSON.parse(row.data_json));
  const manifest=JSON.parse(fs.readFileSync(path.join(appRoot,'content/manifest.json'),'utf8'));
  return Catalog.buildCatalog({manifest,userDecks,storyPackages,logicalCourses});
 }
 function courseOptions(owner){return availableCourses(owner).courses.filter(course=>course.available!==false).map(course=>({resourceId:'course:'+course.id,title:course.title}));}
 function relatedCourses(owner,id){
  const ids=book(id,owner).relatedCourseIds||[];if(!ids.length)return [];
  const courses=availableCourses(owner);
  return ids.map(id=>{const course=Catalog.getCourse(courses,id.slice(7));return course&&course.available!==false
   ?{title:course.title,available:true,href:'decks.html?courseView='+(course.origin==='builtin'?'discover':'joined')+'&course='+encodeURIComponent(course.id)+'&returnView=my-learning'}
   :{title:'原关联课程暂不可用',available:false};});
 }
 const row=(owner,id)=>db.prepare('SELECT package_json FROM personal_wordbook_versions WHERE user_id=? AND book_id=? ORDER BY version DESC LIMIT 1').get(owner,id);
 const independentId=(owner,id)=>library?.resolveLegacy(owner,'course','wordbook:'+id)||null;
 const packageFromLibrary=(owner,id)=>{const courseId=independentId(owner,id);if(!courseId)return null;const value=library.read(owner,courseId).content;if(value?.contentFamily!=='vocabulary-book'||value.contentFamilyVersion!==1||value.package?.index?.books?.[0]?.bookId!==id)throw versionFail('独立词书内容格式或身份无法核对');return value.package;};
 function historyPackages(owner,id){
  const courseId=independentId(owner,id);
  if(courseId)return library.history(owner,courseId).map(release=>({revision:release.content.package?.index?.books?.[0]?.revision,package_json:JSON.stringify(release.content.package)}));
  return db.prepare('SELECT revision,package_json FROM personal_wordbook_versions WHERE user_id=? AND book_id=? ORDER BY version').all(owner,id);
 }
 function materialDraft(source){
  if(source.schemaVersion===2)throw fail('个人教学编排保存尚未开放，原制作文件与课程保留',422);
  const prepared=require('../../scripts/lib/vocabulary-materials.cjs').prepareDraft(source);
  validateImages(prepared.draft.items);
  for(const delivery of source.deliveries){const bytes=fs.readFileSync(path.join(appRoot,delivery.url));if(bytes.length!==delivery.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==delivery.sha256)throw fail('材料交付图版本不一致');}
  return prepared;
 }
 function checkMaterialAppend(previous,next){
  if(!previous&&!next)return;
  if(!previous||!next||previous.libraryRef.libraryId!==next.libraryRef.libraryId||previous.courseRef.courseId!==next.courseRef.courseId)throw fail('不能替换已有课程的材料来源；原内容保留',409);
  for(const key of ['sources','senses','activities','applications']){const idKey={sources:'sourceId',senses:'senseId',activities:'itemId',applications:'materialId'}[key];if(previous.library[key].some(row=>!next.library[key].some(value=>value[idKey]===row[idKey]&&hash(value)===hash(row))))throw fail('不能改写原材料版本；原内容保留',409);}
  const old=previous.library.courses.find(course=>course.courseId===previous.courseRef.courseId),current=next.library.courses.find(course=>course.courseId===next.courseRef.courseId);
  if(old.units.some((unit,index)=>hash(unit)!==hash(current.units[index]))||previous.deliveries.some(value=>!next.deliveries.some(delivery=>delivery.itemId===value.itemId&&hash(delivery)===hash(value))))throw fail('不能改写原单元材料或交付图；原内容保留',409);
 }
 function read(owner,id){if(!Number.isSafeInteger(owner)||owner<=0)throw fail('请登录后读取个人单词本',401);const independent=packageFromLibrary(owner,id);if(independent)return independent;const found=row(owner,id);if(!found)throw fail('个人单词本不存在或无权访问',404);return JSON.parse(found.package_json);}
 async function save(owner,source,baseRevision){
  if(!Number.isSafeInteger(owner)||owner<=0)throw fail('请先登录',401);
  if(Buffer.byteLength(JSON.stringify(source||{}))>10000000)throw fail('单词本超过大小限制',413);
  const materialSource=source?.format==='vocabulary-material-course-draft'?structuredClone(source):null;
  if(materialSource)source=materialDraft(materialSource).draft;
  const errors=draftModel.validate(source,{requireImages:false});if(errors.length)throw fail(errors.slice(0,10).join('；'));
  validateImages(source.items);
  const draft=structuredClone(source),namespace=hash([owner,source.book.bookId]).slice(0,32);
  draft.book.bookId='personal-book:'+namespace;
  draft.items.forEach(item=>{item.itemId='personal-item:'+namespace+':'+hash(item.itemId).slice(0,32);});
  const result=await draftModel.compile(draft,{requireImages:false});
  if(materialSource)result.materialSource=materialSource;
  for(const item of result.items)require('./vocabulary-dictation-assets').validateDictationAssets(item,appRoot);
  const book=result.index.books[0];
  const prior=row(owner,book.bookId),independentCourseId=independentId(owner,book.bookId),previous=packageFromLibrary(owner,book.bookId)||(prior&&JSON.parse(prior.package_json)),old=previous?.index.books[0];
   if(previous&&hash(previous)===hash(result))return response(book);
   if(old){
    if(baseRevision!==old.revision)throw fail('单词本已被更新，请重新读取；旧内容保留',409);
    checkMaterialAppend(previous.materialSource,result.materialSource);
    if(hash(old.relatedCourseIds||[])!==hash(book.relatedCourseIds||[]))throw fail('追加单词时不能改写原课程关联；已有内容保留',409);
    if(previous.items.length>result.items.length||previous.items.some((item,i)=>hash(item)!==hash(result.items[i]))||old.units.some((unit,i)=>hash(unit)!==hash(book.units[i])))throw fail('只允许追加新单元，不能覆盖已有内容',409);
   }else if(baseRevision)throw fail('原版本不存在，未写入',409);
   if(library&&old&&!independentCourseId)throw fail('此词书尚未迁入独立内容库，当前保存未写入；请先完成词书迁移',503);
   if(!old&&book.relatedCourseIds?.length){
    const courses=availableCourses(owner);
    if(book.relatedCourseIds.some(id=>{const course=Catalog.getCourse(courses,id.slice(7));return !course||course.available===false;}))throw fail('关联课程不存在或不属于当前账号，未保存',404);
   }
   if(library){
    const content={contentFamily:'vocabulary-book',contentFamilyVersion:1,package:result,...(independentCourseId?{courseId:independentCourseId}:{})};
    const requestId='wordbook-'+hash([owner,book.bookId,book.revision]).slice(0,48);
    if(independentCourseId){const active=library.read(owner,independentCourseId);library.updateContent(owner,{courseId:independentCourseId,requestId,expectedRelease:active.releaseId,kind:'course',content});}
    else library.importContent(owner,{requestId,kind:'course',sourceMapping:{kind:'course',sourceId:'wordbook:'+book.bookId},content});
    return response(book);
   }
   return db.transaction(()=>{const version=db.prepare('SELECT COALESCE(MAX(version),0)+1 AS next FROM personal_wordbook_versions WHERE user_id=? AND book_id=?').get(owner,book.bookId).next;
    db.prepare('INSERT INTO personal_wordbook_versions(user_id,book_id,version,revision,package_json) VALUES(?,?,?,?,?)').run(owner,book.bookId,version,book.revision,JSON.stringify(result));return response(book);})();
 }
 function response(book){return {confirmed:true,bookId:book.bookId,revision:book.revision,title:book.title,itemCount:book.itemCount,href:'wordbook-details.html?book='+encodeURIComponent(book.bookId)};}
 function book(id,owner){return read(owner,id).index.books[0];}
 function materials(id,owner){
  const pkg=read(owner,id),book=pkg.index.books[0];if(!pkg.materialSource)return {bookId:id,revision:book.revision,units:[]};
  const prepared=materialDraft(pkg.materialSource);
  const senses=new Map(pkg.materialSource.library.senses.map(sense=>[sense.senseId,sense]));
  return {bookId:id,revision:book.revision,units:prepared.applications.map(unit=>({unitId:unit.unitId,materials:unit.materials.map(material=>({materialId:material.materialId,revision:material.revision,kind:material.kind,title:material.title,lines:material.lines.map(line=>({...line,targets:line.senseRefs.map(ref=>{const sense=senses.get(ref.senseId);return {senseId:sense.senseId,word:sense.word,meaning:sense.meaning};})}))}))}))};
 }
 function historicalBook(id,owner,revision){
  const latest=book(id,owner);
  const found=historyPackages(owner,id).find(row=>row.revision===revision);
  if(!found)throw versionFail('无法核对旧内容版本，待保存记录保留');
  const old=JSON.parse(found.package_json).index.books[0];
  if(old.items.length>latest.items.length||old.items.some((ref,i)=>hash(ref)!==hash(latest.items[i]))||old.units.some((unit,i)=>hash(unit)!==hash(latest.units[i])))throw versionFail('旧内容不是当前内容的完整前缀，待保存记录保留');
  return old;
 }
 function versions(id,owner){
  const latest=book(id,owner);
  const rows=historyPackages(owner,id);
  return rows.map(row=>{
   const prior=JSON.parse(row.package_json).index.books[0];
   if(prior.revision!==row.revision||prior.bookId!==id)throw versionFail('课程历史版本校验失败；原记录保留');
   if(prior.revision!==latest.revision)historicalBook(id,owner,prior.revision);
   return prior;
  });
 }
 function resolveStructure(id,owner,unitId,revision){
  const latest=book(id,owner);if(revision===latest.structureRevision)return revision;
  const rows=historyPackages(owner,id).slice().reverse();
  const old=rows.map(row=>JSON.parse(row.package_json).index.books[0]).find(b=>b.structureRevision===revision);
  if(!old)throw versionFail('单元结构版本无法核对，原记录保留');
  historicalBook(id,owner,old.revision);
  const prior=old.units.find(u=>u.unitId===unitId),current=latest.units.find(u=>u.unitId===unitId);
  if(!prior||!current||hash(prior)!==hash(current))throw versionFail('原单元发生变化，原记录保留');
  return latest.structureRevision;
 }
 // Read-only projection across a proven append-only revision; the next normal
 // study operation persists it with the existing resume concurrency check.
 function projectResume(id,owner,cursor,unitId){
  if(!cursor)return cursor;
  const latest=book(id,owner);if(cursor.bookRevision===latest.revision)return cursor;
  const historical=historyPackages(owner,id).find(row=>row.revision===cursor.bookRevision);
  if(!historical)throw fail('无法核对旧版本，原学习位置保留',409);
  const old=JSON.parse(historical.package_json).index.books[0];
  if(old.items.some((ref,i)=>hash(ref)!==hash(latest.items[i])))throw fail('原教学内容已变化，学习位置未迁移',409);
  const prior=unitId?old.units.find(unit=>unit.unitId===unitId):old;
  const current=unitId?latest.units.find(unit=>unit.unitId===unitId):latest;
  if(!prior||!current||unitId&&hash(prior)!==hash(current))throw fail('原单元已变化，学习位置未迁移',409);
  const priorIds=unitId?prior.itemIds:prior.items.map(ref=>ref.itemId),ids=unitId?current.itemIds:current.items.map(ref=>ref.itemId);
  if(cursor.status!=='completed'&&!priorIds.includes(cursor.itemId))throw fail('旧学习位置无效，原记录保留',409);
  const next=cursor.status==='completed'?ids[priorIds.length]:cursor.itemId;
  return {...cursor,itemId:next||null,status:next?'active':'completed',bookRevision:latest.revision,title:latest.title,...(unitId?{structureRevision:latest.structureRevision}:{})};
 }
 function item(id,revision,owner){
  const match=/^personal-item:([a-f0-9]{32}):[a-f0-9]{32}$/.exec(id);if(!match)throw fail('项目编号无效');
  const bookId='personal-book:'+match[1],courseId=independentId(owner,bookId);
  let value=read(owner,bookId).items.find(item=>item.itemId===id);
  const images=courseId&&library.read(owner,courseId).content.imageDelivery?.[id];
  if(value&&images)value={...value,images:structuredClone(images)};
  if(!value)throw fail('教学项目不存在或无权访问',404);if(revision&&revision!==value.contentRevision)throw fail('教学内容版本已变化',409);validateImages([value]);require('./vocabulary-dictation-assets').validateDictationAssets(value,appRoot);return value;
 }
 function resources(owner){
  if(!Number.isSafeInteger(owner)||owner<=0)throw fail('请先登录',401);
  const books=new Map();
  for(const mapping of library?.legacyMappings(owner,'course','wordbook:')||[]){const id=mapping.sourceId.slice('wordbook:'.length);try{const b=library.read(owner,mapping.courseId).content.package.index.books[0];books.set(id,{b,independent:true});}catch{}}
  for(const row of db.prepare('SELECT package_json FROM personal_wordbook_versions p WHERE user_id=? AND version=(SELECT MAX(version) FROM personal_wordbook_versions WHERE user_id=p.user_id AND book_id=p.book_id)').all(owner)){
   const b=JSON.parse(row.package_json).index.books[0];if(!books.has(b.bookId))books.set(b.bookId,{b,independent:false});
  }
  return [...books.values()].map(({b})=>({resourceId:'wordbook:'+b.bookId,kind:'wordbook',title:b.title,description:b.catalog?.description||b.itemCount+' 个词 · 文字练习',facets:b.catalog?.facets||{},origin:'created',visibility:'private',relatedCourseIds:b.relatedCourseIds||[],sourceRefs:[{type:'vocabulary-book',id:b.bookId}],available:true}));
 }
 function archive(owner){
  if(!Number.isSafeInteger(owner)||owner<=0)throw fail('请先登录',401);
  const rows=new Map();
  for(const row of db.prepare('SELECT book_id,version,revision,package_json,created_at FROM personal_wordbook_versions WHERE user_id=? ORDER BY book_id,version').all(owner)){
   const key=row.book_id;if(!rows.has(key))rows.set(key,[]);rows.get(key).push(row);
  }
  for(const mapping of library?.legacyMappings(owner,'course','wordbook:')||[]){
   const bookId=mapping.sourceId.slice('wordbook:'.length),releases=library.history(owner,mapping.courseId);
   const versions=releases.map((release,index)=>{const pkg=release.content?.package,book=pkg?.index?.books?.[0];if(release.content?.contentFamily!=='vocabulary-book'||book?.bookId!==bookId)throw versionFail('独立词书归档身份无法核对');
    return {book_id:bookId,version:index+1,revision:book.revision,package_json:JSON.stringify(pkg),created_at:release.createdAt||new Date(0).toISOString()};});
   rows.set(bookId,versions);
  }
  return {format:'personal-wordbooks-archive',version:1,owner,rows:[...rows.values()].flat().sort((a,b)=>a.book_id.localeCompare(b.book_id)||a.version-b.version)};
 }
 async function checkArchive(owner,value){
  if(!Number.isSafeInteger(owner)||owner<=0)throw fail('请先登录',401);
  if(!value||value.format!=='personal-wordbooks-archive'||value.version!==1||value.owner!==owner||Object.keys(value).some(k=>!['format','version','owner','rows'].includes(k))||!Array.isArray(value.rows)||!value.rows.length||value.rows.length>1000||Buffer.byteLength(JSON.stringify(value))>20000000)throw fail('备份格式、账号归属或大小无效');
  const versions=new Map(),prior=new Map(),rows=[];
  for(const row of value.rows){
   if(!row||Object.keys(row).some(k=>!['book_id','version','revision','package_json','created_at'].includes(k))||!/^personal-book:[a-f0-9]{32}$/.test(row.book_id)||row.version!==(versions.get(row.book_id)||0)+1||typeof row.package_json!=='string'||row.package_json.length>10000000||typeof row.created_at!=='string'||row.created_at.length>100)throw fail('备份版本序列或内容字段无效');
   const pkg=JSON.parse(row.package_json),b=pkg?.index?.books?.[0];
   if(!b||pkg.index.books.length!==1||b.bookId!==row.book_id||b.revision!==row.revision||!Array.isArray(pkg.items)||!pkg.items.length||pkg.items.length>10000||!Array.isArray(b.units)||b.units.length>1000)throw fail('备份内容与编号不一致');
   const namespace=row.book_id.slice('personal-book:'.length),units=new Map();
   for(const unit of b.units){if(!Array.isArray(unit.itemIds))throw fail('备份单元无效');for(const id of unit.itemIds){if(units.has(id))throw fail('备份单元重复分配项目');units.set(id,unit.unitId);}}
   const reconstructed={schemaVersion:1,book:{bookId:b.bookId,title:b.title,catalog:b.catalog,units:b.units.map(u=>({unitId:u.unitId,title:u.title}))},items:pkg.items.map(item=>{
    if(!new RegExp('^personal-item:'+namespace+':[a-f0-9]{32}$').test(item?.itemId)||!Array.isArray(item.images?.wide)||!Array.isArray(item.images?.mobile))throw fail('备份项目身份或插图引用格式无效');
    require('./vocabulary-dictation-assets').validateDictationAssets(item,appRoot);
    return {itemId:item.itemId,unitId:units.get(item.itemId),word:item.word,meaning:item.meaning,scene:item.scene,translation:item.translation,exercise:item.exercise,images:item.images,...(item.learning?.guidedExpression?{guidedSteps:item.learning.guidedExpression.steps}:{}),...(item.learning?.wordDictation?{dictation:{audio:item.learning.wordDictation.audio,answers:item.learning.wordDictation.answers}}:{}),...(item.learning?.sentenceAudio?{sentenceAudio:{audio:item.learning.sentenceAudio.audio,text:item.learning.sentenceAudio.text}}:{}),...(item.learning?.wordChoice?{wordChoice:{field:item.learning.wordChoice.field,options:item.learning.wordChoice.options,correctOptionId:item.learning.wordChoice.correctOptionId}}:{}),...(item.learning?.chunkOrder?{chunkOrder:{chunks:item.learning.chunkOrder.chunks,correctOrder:item.learning.chunkOrder.correctOrder}}:{}),...(item.learning?.readAloud?{readAloud:{target:item.learning.readAloud.target,text:item.learning.readAloud.text,audio:item.learning.readAloud.audio}}:{})};
   })};
   if(b.relatedCourseIds!==undefined)reconstructed.book.relatedCourseIds=b.relatedCourseIds;
   const delivery=library?wordbookImageDelivery(pkg,appRoot):[];
   validateImages(reconstructed.items.map(item=>{const override=delivery.find(value=>value.itemId===item.itemId);return override?{...item,images:override.images}:item;}));
   const compiled=await draftModel.compile(reconstructed,{requireImages:false});
   if(pkg.materialSource){const prepared=materialDraft(pkg.materialSource),namespace=hash([owner,prepared.draft.book.bookId]).slice(0,32);prepared.draft.book.bookId='personal-book:'+namespace;prepared.draft.items.forEach(item=>{item.itemId='personal-item:'+namespace+':'+hash(item.itemId).slice(0,32);});const original=await draftModel.compile(prepared.draft,{requireImages:false});if(hash(original)!==hash(compiled))throw fail('备份材料来源与课程内容不一致');compiled.materialSource=pkg.materialSource;}
   if(hash(compiled)!==hash(pkg))throw fail('备份内容校验失败，不能静默丢弃字段');
   const previous=prior.get(row.book_id);
   if(previous)checkMaterialAppend(previous.materialSource,pkg.materialSource);
   if(previous&&hash(previous.index.books[0].relatedCourseIds||[])!==hash(b.relatedCourseIds||[]))throw fail('备份版本改写了原课程关联');
   if(previous&&(previous.items.length>pkg.items.length||previous.items.some((item,i)=>hash(item)!==hash(pkg.items[i]))||previous.index.books[0].units.some((unit,i)=>hash(unit)!==hash(b.units[i]))))throw fail('备份版本改写了旧内容');
   versions.set(row.book_id,row.version);prior.set(row.book_id,pkg);rows.push({...row,...(delivery.length?{imageDelivery:Object.fromEntries(delivery.map(value=>[value.itemId,value.images]))}:{})});
  }
  return {rows,fingerprint:hash(value),bookCount:versions.size,versionCount:rows.length};
 }
 function isEmpty(owner){return !db.prepare('SELECT 1 FROM personal_wordbook_versions WHERE user_id=? LIMIT 1').get(owner)&&!(library?.legacyMappings(owner,'course','wordbook:').length);}
 async function previewRestore(owner,value){const checked=await checkArchive(owner,value);return {fingerprint:checked.fingerprint,bookCount:checked.bookCount,versionCount:checked.versionCount,eligible:isEmpty(owner),reason:isEmpty(owner)?'':'个人单词本库已有内容，不会整体覆盖'};}
 async function restore(owner,value,fingerprint,confirmed){
  if(confirmed!==true)throw fail('请先预览并确认恢复');
  const checked=await checkArchive(owner,value);if(checked.fingerprint!==fingerprint)throw fail('备份内容已变化，请重新预览',409);
  if(library){
   return db.transaction(()=>{
    if(!isEmpty(owner))throw fail('个人单词本库已有内容，恢复未执行；当前内容保留',409);
    const groups=new Map();for(const row of checked.rows){if(!groups.has(row.book_id))groups.set(row.book_id,[]);groups.get(row.book_id).push(row);}
    for(const [bookId,rows] of groups)library.restoreVocabularyHistory(owner,bookId,rows.map(row=>({revision:row.revision,createdAt:row.created_at,package:JSON.parse(row.package_json),...(row.imageDelivery?{imageDelivery:row.imageDelivery}:{})})));
    return {confirmed:true,bookCount:checked.bookCount,versionCount:checked.versionCount};
   }).immediate();
  }
  return db.transaction(()=>{
   if(!isEmpty(owner))throw fail('个人单词本库已有内容，恢复未执行；当前内容保留',409);
   const insert=db.prepare('INSERT INTO personal_wordbook_versions(user_id,book_id,version,revision,package_json,created_at) VALUES(?,?,?,?,?,?)');
   for(const row of checked.rows)insert.run(owner,row.book_id,row.version,row.revision,row.package_json,row.created_at);
   return {confirmed:true,bookCount:checked.bookCount,versionCount:checked.versionCount};
  })();
 }
 function practiceSummary(id,owner){const pkg=read(owner,id);return require('./vocabulary-practice-summary').build(pkg.index.books[0],pkg.items).summary;}
 return {setLibrary(value){library=value||null;},save,book,item,materials,resources,archive,projectResume,previewRestore,restore,historicalBook,versions,resolveStructure,courseOptions,relatedCourses,practiceSummary};
}
module.exports={createPersonalWordbooks};
