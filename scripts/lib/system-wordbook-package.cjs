'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {assemble}=require('../../server/services/textbook-wordbook-package');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const jsonHash=value=>hash(Buffer.from(JSON.stringify(value)));
function readImportPackage(directory) {
  const root=fs.realpathSync(directory),manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
  if(manifest.format!=='textbook-system-import-draft'||manifest.schemaVersion!==1||manifest.publishable!==false||!Array.isArray(manifest.files))throw Error('需要可验证的系统教材交付包');
  const files=new Map();
  for(const row of manifest.files){
    if(typeof row.path!=='string'||path.isAbsolute(row.path)||row.path.includes('\\')||row.path.split('/').some(p=>p==='..'||!p)||files.has(row.path))throw Error('交付包文件路径重复或越界');
    const file=fs.realpathSync(path.join(root,row.path)),relative=path.relative(root,file);
    if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('交付包文件链接越界');
    const bytes=fs.readFileSync(file);
    if(hash(bytes)!==row.sha256||bytes.length!==row.bytes)throw Error('交付包文件核验失败：'+row.path);
    files.set(row.path,{...row,file});
  }
  if(!files.has('import-source.json'))throw Error('清单缺少课程源文件');
  const source=JSON.parse(fs.readFileSync(files.get('import-source.json').file,'utf8'));
  if(source.book?.bookId!==manifest.bookId)throw Error('交付包教材身份不一致');
  const draft=assemble(source);
  return {root,manifest,source,draft,files};
}
function qualifyPackage(directory,output){
  const input=readImportPackage(directory),source=structuredClone(input.source),bookKey=source.book.bookId.replace(/^textbook-wordbook:/,'');
  if(!/^[a-z0-9-]+$/.test(bookKey))throw Error('教材编号不能用于全局词条限定');
  if(fs.existsSync(output))throw Error('请选择新的交付版本目录');
  const ids=new Map(),assets=new Map();
  for(const draft of source.drafts)for(const item of draft.items){
    const itemId='textbook-item:'+bookKey+':'+item.itemId;
    if(itemId.length>160)throw Error('全局词条编号超过160字符');
    ids.set(item.itemId,itemId);item.itemId=itemId;
  }
  for(const unit of source.units)unit.itemIds=unit.itemIds.map(id=>ids.get(id));
  function rewrite(value){
    if(typeof value==='string'&&value.startsWith('assets/')){
      const original=input.files.get(value);if(!original)throw Error('素材未登记在交付清单：'+value);
      const target='assets/'+original.sha256+path.extname(value).toLowerCase();
      assets.set(target,original);return target;
    }
    if(Array.isArray(value))return value.map(rewrite);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v)]));
    return value;
  }
  const rewritten=rewrite(source);assemble(rewritten);
  const parent=path.dirname(path.resolve(output));fs.mkdirSync(parent,{recursive:true});
  const staging=fs.mkdtempSync(path.join(parent,'.system-import-'));
  fs.mkdirSync(path.join(staging,'assets'));
  const files=[];
  const write=(relative,bytes,role)=>{fs.writeFileSync(path.join(staging,relative),bytes,{flag:'wx'});files.push({path:relative,bytes:bytes.length,sha256:hash(bytes),role});};
  write('import-source.json',Buffer.from(JSON.stringify(rewritten,null,2)+'\n'),'textbook-wordbook-import-source');
  for(const [target,original]of assets)write(target,fs.readFileSync(original.file),original.role);
  write('identity-map.json',Buffer.from(JSON.stringify({format:'textbook-publication-identity-map',schemaVersion:1,bookId:source.book.bookId,sourcePackage:input.root,sourceSha256:jsonHash(input.source),sourceToPublishedItems:[...ids].map(([sourceItemId,itemId])=>({sourceItemId,itemId})),policy:'Book-qualified teaching items; immutable content-hash asset names. Source review identities remain unchanged.'},null,2)+'\n'),'source-review-identity-map');
  const manifest={...input.manifest,createdAt:new Date().toISOString(),status:'draft-needs-content-review',publishable:false,counts:{...input.manifest.counts,assets:assets.size},files};
  fs.writeFileSync(path.join(staging,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  readImportPackage(staging);fs.renameSync(staging,path.resolve(output));return {output:path.resolve(output),bookId:source.book.bookId,items:ids.size,assets:assets.size};
}
async function stagePackage({directory,bookId,service,importsRoot,productionBook,audioConfirmation}){
  const input=readImportPackage(directory);
  if(input.manifest.bookId!==bookId)throw Error('目标教材与交付包不一致');
  let evidenceItems;
  if(productionBook){
    const mappingFile=input.files.get('identity-map.json');if(!mappingFile)throw Error('缺少来源词条对应表');
    const mapping=JSON.parse(fs.readFileSync(mappingFile.file,'utf8'));
    const identities=new Map(mapping.sourceToPublishedItems.map(row=>[row.itemId,row.sourceItemId]));
    const rows=new Map(productionBook.items.map(row=>[row.unitId+'\n'+row.itemId,row]));
    evidenceItems=input.draft.items.map(item=>{
      const sourceItemId=identities.get(item.itemId),row=rows.get(item.unitId+'\n'+sourceItemId);
      if(!row||row.term!==item.word||row.meaning!==item.meaning||row.english!==require('../../landing/sentence-cloze-engine').sentence(item.exercise)||row.chinese!==item.translation||row.reviewStatus!=='approved')throw Error('当前生产审核记录与交付内容不符：'+item.itemId);
      const image=input.files.get(item.images.wide[0]),word=item.dictation?.audio,sentence=item.sentenceAudio?.audio;
      if(!image||!row.imageHashes.includes(image.sha256)||word?.sha256!==row.wordAudio||sentence?.sha256!==row.sentenceAudio)throw Error('交付素材与已核验生产绑定不符：'+item.itemId);
      return {itemId:item.itemId,sourceItemId,unitId:item.unitId,sentenceFingerprint:row.sentenceFingerprint,reviewRevision:row.reviewRevision,imageSha256:image.sha256,wordAudioSha256:row.wordAudio,sentenceAudioSha256:row.sentenceAudio};
    });
    if(evidenceItems.length!==productionBook.items.length)throw Error('交付内容与当前词表条数不一致');
  }
  const existing=service.list().filter(row=>row.bookId===bookId&&!row.published&&!row.archived&&row.operation!=='update');
  const match=existing.find(row=>{const file=path.join(importsRoot,row.importId,'source.json');return fs.existsSync(file)&&jsonHash(JSON.parse(fs.readFileSync(file,'utf8')))===jsonHash(input.source);});
  const created=match||await service.importSource(input.source),id=created.importId;
  let detail=service.detail(id),added=0;
  const entries=detail.assets.filter(a=>a.missing).map(a=>{
    const original=input.files.get(a.url);if(!original)throw Error('素材没有对应交付文件：'+a.url);
    return {filename:path.basename(a.url),bytes:fs.readFileSync(original.file)};
  });
  for(let offset=0;offset<entries.length;offset+=100)added+=service.uploadBatch(id,entries.slice(offset,offset+100)).added;
  detail=service.detail(id);if(detail.assets.some(a=>a.missing))throw Error('暂存后仍有缺失素材');
  const checked=service.validate(id,detail.revision);
  if(productionBook){
    const evidence={format:'textbook-production-review-evidence',schemaVersion:1,bookId,packageFingerprint:checked.fingerprint,recordedAt:new Date().toISOString(),sourceSha256:productionBook.sourceSha256,
      counts:{sentences:evidenceItems.length,images:evidenceItems.length,wordAudio:evidenceItems.length,sentenceAudio:evidenceItems.length},
      audioReview:audioConfirmation?{status:'owner-sample-confirmed',confirmation:audioConfirmation,scope:'用户已确认抽查无问题；没有逐条抽听清单，不宣称全量逐条审听'}:null,
      practiceReview:'pending',items:evidenceItems};
    const target=path.join(importsRoot,id,'production-review.json');
    if(!fs.existsSync(target))fs.writeFileSync(target,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
    else if(JSON.parse(fs.readFileSync(target,'utf8')).packageFingerprint!==checked.fingerprint)throw Error('生产审核凭据版本变化，原凭据已保留');
  }
  return {importId:id,bookId,items:detail.itemCount,assets:detail.assets.length,added,status:service.detail(id).status,fingerprint:checked.fingerprint,published:false};
}
module.exports={readImportPackage,qualifyPackage,stagePackage};
