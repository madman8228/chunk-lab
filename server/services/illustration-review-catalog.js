'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Database=require('better-sqlite3');
const {validateCatalog}=require('../../scripts/lib/vocabulary-illustrations.cjs');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const defaultCatalog=root=>path.join(root,'output/vocabulary-illustrations/catalog-20261022-reviewed-v1.json');
function readCatalog(file){
 if(!fs.existsSync(file))return null;
 const catalog=validateCatalog(JSON.parse(fs.readFileSync(file,'utf8')));
 if(catalog.bindings.some(b=>!/^[a-z0-9-]+$/.test(b.course)||typeof b.sourceKey!=='string'||typeof b.itemId!=='string'||typeof b.word!=='string'||typeof b.meaning!=='string'||typeof b.unit!=='string'))throw Error('共享目录课程或词条身份无效');
 return catalog;
}
function bindingVersion(binding,sha256){return hash(JSON.stringify(['catalog-v1',binding.sourceKey,binding.word,binding.meaning,sha256]));}
function catalogCourses(root,catalog){
 if(!catalog)return [];
 return [...new Set(catalog.bindings.map(b=>b.course))].map(id=>{
  const file=path.join(root,'output/textbook-extractions',id,'extracted-vocabulary.json');
  const extraction=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
  const meta=extraction.textbook||extraction.edition||{};
  const legacy={'people-grade9-full-2013-20261015':'人教版英语 九年级全一册（2013）','primary-pep-grade6-lower-2013-20261015':'六年级 下册 PEP（2013）'};
  const title=meta.grade?[meta.grade,meta.volume,meta.series,meta.coverApprovalYear].filter(Boolean).join(' '):meta.titleZh||legacy[id]||meta.title||id;
  return {id,title,stage:catalog.bindings.find(b=>b.course===id).stage,source:'shared-catalog'};
 });
}
function catalogBook(root,catalog,course){
 const info=catalogCourses(root,catalog).find(c=>c.id===course);if(!info)return null;
 const assets=new Map(catalog.assets.map(a=>[a.assetId,a])),checked=new Map();
 const items=catalog.bindings.filter(b=>b.course===course).map(binding=>{
  const asset=assets.get(binding.assetId),checks=[];let actual=checked.get(binding.assetId);
  if(!actual){
   actual={bytes:0,sha256:null,delivery:null};
   try{
    const directory=fs.realpathSync(path.join(root,'assets')),file=fs.realpathSync(path.join(root,asset.path)),relative=path.relative(directory,file);
    if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('配图路径越界');
    const bytes=fs.readFileSync(file);actual={bytes:bytes.length,sha256:hash(bytes),delivery:asset.path,webp:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'};
   }catch{}
   checked.set(binding.assetId,actual);
  }
  if(!actual.delivery)checks.push('图片文件缺失');
  if(actual.sha256&&actual.sha256!==asset.sha256)checks.push('图片摘要与已审核版本不一致');
  if(actual.bytes!==asset.bytes)checks.push('图片大小与目录不一致');
  if(actual.bytes>=20000)checks.push('图片超过20KB限制');
  if(actual.delivery&&!actual.webp)checks.push('图片格式异常');
  const approved=binding.review==='pass'&&!checks.length;
  return {itemId:binding.itemId,word:binding.word,meaning:binding.meaning,unit:binding.unit,title:info.title,scene:'',sourcePages:[],
   delivery:actual.delivery,bytes:actual.bytes,version:bindingVersion(binding,actual.sha256),checks,
   approvalSource:approved?(binding.reuseDecision?'共享配图审批':'原配图审核'):'共享目录待确认',
   reviewEvidence:{sourceKey:binding.sourceKey,assetId:binding.assetId,reuseDecision:binding.reuseDecision||null,reviewEvidence:binding.reviewEvidence||null},
   inheritedReview:{revision:0,status:approved?'approved':binding.review==='issue'?'changes':'pending',note:'',reason:'',meaning:'',updated:''}};
 });
 if(new Set(items.map(i=>i.itemId)).size!==items.length)throw Error('共享配图目录含重复教材词条编号');
 return {...info,items,sourceGaps:[]};
}
function applyReviewOverrides(catalog,storePath){
 if(!fs.existsSync(storePath))return catalog;
 const database=new Database(storePath,{readonly:true,fileMustExist:true});let rows;
 try{if(!database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='reviews'").get())return catalog;rows=database.prepare('SELECT course,item,version,status FROM reviews').all();}finally{database.close();}
 const reviews=new Map(rows.map(r=>[[r.course,r.item,r.version].join('\n'),r.status]));
 const assets=new Map(catalog.assets.map(a=>[a.assetId,a]));
 return {...catalog,bindings:catalog.bindings.map(binding=>{
  const status=reviews.get([binding.course,binding.itemId,bindingVersion(binding,assets.get(binding.assetId).sha256)].join('\n'));
  return status?{...binding,review:status==='approved'?'pass':status==='changes'?'issue':'pending'}:binding;
 })};
}
module.exports={defaultCatalog,readCatalog,bindingVersion,catalogCourses,catalogBook,applyReviewOverrides};
