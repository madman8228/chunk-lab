'use strict';
const crypto=require('node:crypto');
const {imageDimensions}=require('./membership/image-dimensions');
const model=require('../../scripts/lib/vocabulary-materials.cjs');
const {inspect}=require('../../scripts/lib/vocabulary-illustrations.cjs');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=message=>Object.assign(new Error(message),{status:422});
function fields(value,keys,label){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key))||keys.some(key=>value[key]===undefined))throw fail(label+'字段无效');}
function delivery(appRoot,url,readAsset){
 try{if(readAsset){const bytes=readAsset(url),size=imageDimensions(bytes,'image/webp');if(!size||bytes.length>=20000||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP'||size[0]*9!==size[1]*16)throw Error('Expected verified 16:9 WebP below 20000 bytes');return {url,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};}const asset=inspect(appRoot,url);return {url,bytes:asset.bytes,sha256:asset.sha256};}
 catch(error){throw fail('交付图校验失败：'+error.message);}
}
// Validate provenance against the actual compiled lesson, not just a caller's status flag.
function validateMaterialRelease(candidate,appRoot,readAsset){
 const release=candidate.materialRelease;
 fields(release,['format','schemaVersion','libraryRef','courseRef','library','review','deliveries'],'发布来源');
 if(release.format!=='vocabulary-material-release'||release.schemaVersion!==1)throw fail('发布来源格式无效');
 fields(release.libraryRef,['libraryId','revision'],'材料库引用');fields(release.courseRef,['courseId','revision'],'课程引用');
 if(!/^[A-Za-z0-9:._-]{1,160}$/.test(release.libraryRef.libraryId)||release.libraryRef.revision!==model.revisionOf(release.library))throw fail('材料库快照版本不匹配');
 let indexes;try{indexes=model.validate(release.library);}catch(error){throw fail(error.message);}
 const course=indexes.courses.get(release.courseRef.courseId),book=candidate.index.books[0];
 if(!course||course.revision!==release.courseRef.revision||book.bookId!==course.courseId||book.title!==course.title)throw fail('课程编排与发布目标不一致');
 const review=release.review;
 fields(review,['revision','content','level','assets','rights','reviewer','note'],'人工审核');
 if(review.revision!==release.libraryRef.revision||['content','level','assets','rights'].some(key=>review[key]!=='approved')||typeof review.reviewer!=='string'||!review.reviewer.trim()||review.reviewer.length>200||typeof review.note!=='string'||!review.note.trim()||review.note.length>4000)throw fail('发布须有针对本快照的内容、分级、图片及授权人工审核');
 const refs=course.units.flatMap(unit=>unit.activityRefs);
 if(!Array.isArray(release.deliveries)||release.deliveries.length!==refs.length||candidate.items.length!==refs.length)throw fail('交付图与任务数量不一致');
 const units=course.units.map(unit=>({unitId:unit.unitId,title:unit.title,itemIds:unit.activityRefs.map(ref=>ref.itemId)}));
 if(hash(book.units)!==hash(units)||hash(book.catalog)!==hash({facets:{levels:[course.levelProposal]}}))throw fail('发布单元或级别与审核编排不一致');
 refs.forEach((ref,index)=>{
  const activity=indexes.activities.get(ref.itemId),sense=indexes.senses.get(activity.senseRef.senseId),item=candidate.items[index],asset=release.deliveries[index];
  fields(asset,['itemId','url','bytes','sha256'],'交付图');
  if(item.itemId!==ref.itemId||asset.itemId!==ref.itemId||hash(item.images)!==hash({wide:[asset.url],mobile:[asset.url]}))throw fail('交付图或任务映射不一致');
  const actual=delivery(appRoot,asset.url,readAsset);if(hash(actual)!==hash({url:asset.url,bytes:asset.bytes,sha256:asset.sha256}))throw fail('交付图已改变，请重新审核');
  for(const [key,value] of Object.entries({word:sense.word,meaning:sense.meaning,scene:activity.scene,translation:activity.translation,exercise:activity.exercise}))if(hash(item[key])!==hash(value))throw fail('发布任务与原材料不一致：'+key);
  const steps=item.learning?.guidedExpression?.steps;
  if(hash(steps??null)!==hash(activity.guidedSteps??null))throw fail('发布引导与原材料不一致');
  const dictation=item.learning?.wordDictation;
  if(hash(dictation?{audio:dictation.audio,answers:dictation.answers}:null)!==hash(activity.dictation??null))throw fail('发布听写与原材料不一致');
  const sentence=item.learning?.sentenceAudio;
  if(hash(sentence?{audio:sentence.audio,text:sentence.text}:null)!==hash(activity.sentenceAudio?{audio:activity.sentenceAudio.audio,text:activity.sentenceAudio.text}:null))throw fail('发布例句音频与原材料不一致');
  const choice=item.learning?.wordChoice;
  if(model.revisionOf({choice:choice?{field:choice.field,options:choice.options,correctOptionId:choice.correctOptionId}:null})!==model.revisionOf({choice:activity.wordChoice??null}))throw fail('发布选词与原材料不一致');
  const order=item.learning?.chunkOrder;
  if(model.revisionOf({order:order?{chunks:order.chunks,correctOrder:order.correctOrder}:null})!==model.revisionOf({order:activity.chunkOrder??null}))throw fail('发布拼块与原材料不一致');
  const readAloud=item.learning?.readAloud;
  if(model.revisionOf({readAloud:readAloud?{target:readAloud.target,text:readAloud.text,audio:readAloud.audio}:null})!==model.revisionOf({readAloud:activity.readAloud??null}))throw fail('发布跟读与原材料不一致');
 });
 return release;
}
function createVocabularyMaterialRelease({service,publisher,appRoot}){
 async function prepare(libraryId,body){
  fields(body,['revision','courseId','review','images'],'发布准备');
  const preview=await service.preview(libraryId,body.revision,body.courseId),snapshot=service.read(libraryId,body.revision),candidate=preview.wordbookPackage;
  if(!Array.isArray(body.images)||body.images.length!==candidate.items.length)throw fail('请为每个任务明确指定一张交付图');
  const deliveries=candidate.items.map((item,index)=>{
   const mapping=body.images[index];fields(mapping,['itemId','url'],'图片映射');if(mapping.itemId!==item.itemId)throw fail('图片映射顺序或任务不匹配');
   const asset=delivery(appRoot,mapping.url);item.images={wide:[asset.url],mobile:[asset.url]};const {contentRevision,...content}=item;item.contentRevision=hash(content);return {itemId:item.itemId,...asset};
  });
  const book=candidate.index.books[0];book.items=candidate.items.map(({itemId,contentRevision})=>({itemId,contentRevision}));book.revision=hash(book.items);
  candidate.materialRelease={format:'vocabulary-material-release',schemaVersion:1,libraryRef:preview.libraryRef,courseRef:preview.courseRef,library:snapshot.library,review:body.review,deliveries};
  return {candidate,result:publisher.validate(candidate)};
 }
 return {validate:async(id,body)=>(await prepare(id,body)).result,
  publish:async(id,body,fingerprint,confirmed)=>{const prepared=await prepare(id,body);return publisher.publish(prepared.candidate,fingerprint,confirmed);}};
}
module.exports={createVocabularyMaterialRelease,validateMaterialRelease};
