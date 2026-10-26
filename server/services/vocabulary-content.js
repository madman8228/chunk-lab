'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const model=require('../../js/vocabulary-study.cjs'),cloze=require('../../landing/sentence-cloze-engine');
const contract=require('../../js/vocabulary-course-contract');
const fail=(message,status=404)=>Object.assign(new Error(message),{status});
function createVocabularyContent({appRoot,publishedRoot,personal,versions}) {
  const directory=path.join(appRoot,'content/vocabulary');
  const publicationDirectory=path.resolve(publishedRoot||path.join(directory,'published'));
  let cached=null,signature='',publishedPaths=new Map(),publishedItems=new Map(),publicBooks=new Map();const practiceCache=new Map();
  function index(){const file=path.join(directory,'index.json');if(!fs.existsSync(file))return {schemaVersion:1,books:[]};
    const published=publicationDirectory,entries=fs.existsSync(published)?fs.readdirSync(published).filter(name=>/^[a-f0-9]{64}$/.test(name)).sort():[];
    const stat=fs.statSync(file),activationSignature=versions?entries.map(name=>{const bookDir=path.join(publicationDirectory,name),activationDir=path.join(bookDir,'activations');if(!fs.existsSync(activationDir))return name+':';return name+':'+fs.readdirSync(activationDir).filter(fileName=>/^\d{12}-[a-f0-9]{64}\.json$/.test(fileName)).sort().map(fileName=>{const bytes=fs.readFileSync(path.join(activationDir,fileName));return fileName+':'+crypto.createHash('sha256').update(bytes).digest('hex');}).join(',');}).join('|'):'';
    const next=stat.mtimeMs+':'+stat.size+':'+entries.join(',')+':'+activationSignature;if(cached&&signature===next)return cached;
    const data=model.validateIndex(JSON.parse(fs.readFileSync(file,'utf8')));
    const locations=new Map(),items=new Map(),books=new Map();
    for(const name of entries){const folder=path.join(published,name),manifest=model.validateIndex(JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8')));
      for(const entry of manifest.books){const active=versions?(versions.metadata?versions.metadata(entry.bookId):versions.current(entry.bookId)):{book:entry,candidate:null,legacy:true,releaseId:entry.revision};const row=active.book;
        data.books.push(row);books.set(row.bookId,active);
        for(const ref of row.items){const key=ref.itemId+'\n'+ref.contentRevision;if(!items.has(key)){
          const candidateItem=active.candidate?.items?.find(value=>value.itemId===ref.itemId);
          const location=active.legacy?path.join(folder,'items',ref.itemId.replace(/:/g,'_')+'.json'):path.join(folder,'releases',active.releaseId,'items',ref.itemId.replace(/:/g,'_')+'.json');
          if(!candidateItem&&(!location||!fs.existsSync(location)))throw fail('单词本项目缺失',503);
          items.set(key,candidateItem||location);
        }locations.set(key,items.get(key));}
      }
    }
    model.validateIndex(data,{allowItemVersions:true});
    for(const row of data.books)if(row.units&&crypto.createHash('sha256').update(JSON.stringify(row.units)).digest('hex')!==row.structureRevision)throw fail('单元结构版本校验失败',409);
    publishedPaths=locations;publishedItems=items;publicBooks=books;cached=data;signature=next;return data;
  }
  function itemPath(id){if(!model.validId(id))throw fail('教学项目编号无效',400);return path.join(directory,'items',id.replace(/:/g,'_')+'.json');}
  function book(id,owner){if(id.startsWith('personal-book:')){if(!personal)throw fail('个人内容服务尚未就绪',503);return personal.book(id,owner);}const row=index().books.find(row=>row.bookId===id);if(!row)throw fail('单词本暂不可用');return row;}
  function resolveStructure(id,owner,unitId,revision){
    if(id.startsWith('personal-book:'))return personal.resolveStructure(id,owner,unitId,revision);
    const current=book(id,owner);
    if(revision===current.structureRevision)return revision;
    const historical=versions?.history(id).find(row=>row.book.structureRevision===revision)?.book;
    return historical&&historical.units?.some(unit=>unit.unitId===unitId)&&require('./wordbook-unit-titles').sameLearningStructure(historical,current)?current.structureRevision:revision;
  }
  function item(id,revision,owner){
    if(id.startsWith('personal-item:')){if(!personal)throw fail('个人内容服务尚未就绪',503);return personal.item(id,revision,owner);}
    const refs=[];for(const row of index().books)for(const ref of row.items)if(ref.itemId===id)refs.push(ref);
    for(const active of publicBooks.values())for(const ref of active.book.items)if(ref.itemId===id)refs.push(ref);
    if(versions&&(!revision||!refs.some(ref=>ref.contentRevision===revision)))for(const active of publicBooks.values())for(const historic of versions.history(active.book.bookId))for(const ref of historic.book.items)if(ref.itemId===id)refs.push(ref);
    const matching=[...new Map(refs.map(ref=>[ref.contentRevision,ref])).values()].filter(ref=>!revision||ref.contentRevision===revision);
    if(!matching.length)throw fail(revision?'教学内容版本已变化或暂不可用':'教学项目暂不可用',revision?409:404);
    if(!revision&&matching.length>1)throw fail('教学内容版本存在歧义，请提供课程版本',409);
    const ref=matching[0];
    // Validate the selected course before serving its bodies; directory pages need only metadata.
    if(versions)for(const active of publicBooks.values())if(!active.candidate&&active.book.items.some(item=>item.itemId===id&&item.contentRevision===ref.contentRevision)){
      const verified=versions.current(active.book.bookId);
      if(verified.releaseId!==active.releaseId)throw fail('课程版本已更新，请重新读取目录',409);
      Object.assign(active,verified);
      for(const item of verified.candidate.items)publishedItems.set(item.itemId+'\n'+item.contentRevision,item);
    }
    let source=publishedItems.get(id+'\n'+ref.contentRevision);
    if(!source&&versions){for(const active of publicBooks.values()){const historical=versions.history(active.book.bookId).find(row=>row.book.items.some(item=>item.itemId===id&&item.contentRevision===ref.contentRevision));if(historical){source=historical.candidate?.items?.find(item=>item.itemId===id)||path.join(versions.directory(active.book.bookId),'items',id.replace(/:/g,'_')+'.json');break;}}}
    if(!source)source=itemPath(id);
    const result=typeof source==='string'?JSON.parse(fs.readFileSync(source,'utf8')):structuredClone(source);
    const {contentRevision,...content}=result;
    if(result.itemId!==id||contentRevision!==ref.contentRevision||crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex')!==contentRevision)throw fail('教学内容版本校验失败',409);
    cloze.validate(result.exercise);contract.validateLearning(result,cloze);
    require('./vocabulary-dictation-assets').validateDictationAssets(result,appRoot);
    const guided=result.learning?.guidedExpression;
    if(guided&&crypto.createHash('sha256').update(JSON.stringify(guided.steps)).digest('hex')!==guided.revision)throw fail('引导练习版本校验失败',409);
    const choice=result.learning?.wordChoice;
    if(choice&&crypto.createHash('sha256').update(JSON.stringify({field:choice.field,options:choice.options,correctOptionId:choice.correctOptionId})).digest('hex')!==choice.revision)throw fail('选词任务版本校验失败',409);
    const order=result.learning?.chunkOrder;
    if(order&&crypto.createHash('sha256').update(JSON.stringify({chunks:order.chunks,correctOrder:order.correctOrder})).digest('hex')!==order.revision)throw fail('拼块任务版本校验失败',409);
    for(const profile of ['wide','mobile']){
      if(!Array.isArray(result.images?.[profile])||!result.images[profile].length)throw fail('教学图片引用无效',503);
      for(const url of result.images[profile]){
        if(typeof url!=='string'||!/^assets\/[A-Za-z0-9._-]+\.(avif|webp)$/.test(url))throw fail('教学图片路径无效',503);
        const size=fs.statSync(path.join(appRoot,url)).size;if(size<=0||size>=20000)throw fail('教学图片超过大小限制',503);
      }
    }
    return result;
  }
  function resources(){const retiredFile=path.join(directory,'retired-books.json');let retired=[];
    if(fs.existsSync(retiredFile)){const value=JSON.parse(fs.readFileSync(retiredFile,'utf8'));if(value.schemaVersion!==1||!Array.isArray(value.bookIds)||value.bookIds.some(id=>!model.validId(id)))throw fail('单词本下架配置无效',503);retired=value.bookIds;}
    return index().books.filter(row=>!retired.includes(row.bookId)).map(row=>({resourceId:'wordbook:'+row.bookId,kind:'wordbook',title:row.title,
    description:row.catalog?.description||row.itemCount+' 个教学项目 · 辅助练习',coverUrl:row.catalog?.coverUrl,facets:row.catalog?.facets,
    unitCount:Array.isArray(row.units)?row.units.length:null,itemCount:row.itemCount,
    sourceRefs:[{type:'vocabulary-book',id:row.bookId}],available:true}));}
  function unitPage(id,unitId,offset,limit,owner){
    const row=book(id,owner),unit=row.units?.find(unit=>unit.unitId===unitId);if(!unit)throw fail('单元暂不可用');
    const bounds=model.pageBounds(offset,limit),start=row.items.findIndex(ref=>ref.itemId===unit.itemIds[0]);
    return {bookId:id,revision:row.revision,title:row.title+' · '+unit.title,itemCount:unit.itemIds.length,structureRevision:row.structureRevision,unitId,items:row.items.slice(start+bounds.offset,start+Math.min(unit.itemIds.length,bounds.offset+bounds.limit)),nextOffset:bounds.offset+bounds.limit<unit.itemIds.length?bounds.offset+bounds.limit:null};
  }
  function materials(id,owner){
    const row=book(id,owner);if(id.startsWith('personal-book:'))return personal.materials(id,owner);
    const active=publicBooks.get(id),folder=path.join(publicationDirectory,crypto.createHash('sha256').update(JSON.stringify(id)).digest('hex')),file=active?.legacy===false?null:path.join(folder,'materials.json');
    let release=active?.candidate?.materialRelease;
    if(!release){if(!file||!fs.existsSync(file))return {bookId:id,revision:row.revision,units:[]};
      const stored=JSON.parse(fs.readFileSync(file,'utf8')),hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
      if(stored.bookRevision!==row.revision||stored.releaseRevision!==hash(stored.release))throw fail('课程材料版本检查失败；原记录保留',503);release=stored.release;
    }
    const library=release.library,course=library.courses.find(course=>course.courseId===id);
    if(!course||course.revision!==release.courseRef.revision)throw fail('课程材料引用不一致',503);
    const applications=new Map(library.applications.map(material=>[material.materialId,material])),senses=new Map(library.senses.map(sense=>[sense.senseId,sense]));
    // Never expose raw sources, other arrangements or the private review receipt.
    return {bookId:id,revision:row.revision,level:course.levelProposal,levelStatus:'reviewed',units:course.units.map(unit=>({unitId:unit.unitId,materials:unit.materialRefs.map(ref=>{
      const material=applications.get(ref.materialId);if(!material||material.revision!==ref.revision)throw fail('应用材料版本不一致',503);
      return {materialId:material.materialId,revision:material.revision,kind:material.kind,title:material.title,lines:material.lines.map(line=>({...line,senseRefs:line.senseRefs.map(ref=>({senseId:ref.senseId,revision:ref.revision})),targets:line.senseRefs.map(ref=>{
        const sense=senses.get(ref.senseId);if(!sense||sense.revision!==ref.revision)throw fail('材料词义版本不一致',503);return {senseId:sense.senseId,word:sense.word,meaning:sense.meaning};
      })}))};
    })}))};
  }
  function details(id,owner){
    const row=book(id,owner),summary=practiceSummary(row,owner),result={...contract.details(row),practiceOptions:summary.practices};result.units=result.units.map((unit,index)=>({...unit,practiceOptions:summary.units[index].practices}));
    if(id.startsWith('personal-book:'))return {...result,relatedCourses:personal.relatedCourses(owner,id),materialKinds:[...new Set(materials(id,owner).units.flatMap(unit=>unit.materials.map(material=>material.kind)))]};
    const material=materials(id,owner),kinds=new Set(material.units.flatMap(unit=>unit.materials.map(material=>material.kind)));
    return {...result,materialKinds:[...kinds],...(material.level?{level:{value:material.level,status:material.levelStatus}}:{})};
  }
  function practiceSummary(row,owner){
    if(row.bookId.startsWith('personal-book:'))return personal.practiceSummary(row.bookId,owner);
    const key=JSON.stringify([row.bookId,row.revision,row.structureRevision]);if(practiceCache.has(key))return practiceCache.get(key);
    const summaryModel=require('./vocabulary-practice-summary'),active=publicBooks.get(row.bookId),file=active?.legacy===false?null:path.join(publicationDirectory,crypto.createHash('sha256').update(JSON.stringify(row.bookId)).digest('hex'),'practices.json');let summary;
    if(file&&fs.existsSync(file))summary=summaryModel.validate(JSON.parse(fs.readFileSync(file,'utf8')),row);
    else{const items=row.items.map(ref=>{const source=publishedItems.get(ref.itemId+'\n'+ref.contentRevision)||publishedPaths.get(ref.itemId+'\n'+ref.contentRevision)||itemPath(ref.itemId),value=typeof source==='string'?JSON.parse(fs.readFileSync(source,'utf8')):structuredClone(source),{contentRevision,...body}=value;if(value.itemId!==ref.itemId||contentRevision!==ref.contentRevision||crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex')!==contentRevision)throw fail('教学内容版本校验失败',409);return value;});summary=summaryModel.build(row,items).summary;}
    practiceCache.set(key,summary);return summary;
  }
  return {index,book,item,resources,personal,publicationDirectory,materials,details,resolveStructure,versions:(id,owner)=>id.startsWith('personal-book:')?personal.versions(id,owner):versions?versions.history(id):[{book:book(id),releaseId:book(id).revision}],invalidate:()=>{cached=null;signature='';practiceCache.clear();},unitPage,page:(id,offset,limit,owner)=>model.pageBook(book(id,owner),offset,limit)};
}
module.exports={createVocabularyContent};
