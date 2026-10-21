'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {imageDimensions}=require('../../server/services/membership/image-dimensions');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const normalize=value=>String(value||'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
const sourceKey=(course,unit,itemId)=>course+'/'+unit+'/'+itemId;
const defaultTrackers=['primary-3-6-pep-jingtong-image-progress-20261016.md','people-grade7-8-image-progress-20261017.md'];
function currentCourses(root){return [...new Set(defaultTrackers.flatMap(name=>[...fs.readFileSync(path.join(root,'output/textbook-extractions',name),'utf8').matchAll(/^\|[^\r\n]*?`((?:primary-|people-grade)[^`]+)`/gm)].map(m=>m[1])))];}
function inspect(root,relative){
 if(typeof relative!=='string'||!/^assets\/[A-Za-z0-9._-]+\.webp$/.test(relative))throw Error('Expected a local WebP delivery reference');
 const base=fs.realpathSync(path.join(root,'assets')),file=fs.realpathSync(path.join(root,relative));
 if(path.dirname(file)!==base)throw Error('Image leaves assets directory');
 const bytes=fs.readFileSync(file),dim=imageDimensions(bytes,'image/webp');
 if(!bytes.length||bytes.length>=20000||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP'||!dim||dim[0]*9!==dim[1]*16)throw Error('Expected a complete 16:9 WebP strictly below 20000 bytes: '+relative);
 const sha256=hash(bytes);return {assetId:'sha256:'+sha256,path:relative,sha256,bytes:bytes.length,width:dim[0],height:dim[1],objectKey:'vocabulary/'+sha256+'.webp'};
}
function buildCatalog(root,{courses=currentCourses(root),reviews=[]}={}){
 const reviewed=new Map();for(const snapshot of reviews)for(const r of snapshot.entries||[])reviewed.set(sourceKey(r.bookId,r.unitId||r.unitKey,r.itemId),r);
 const assets=new Map(),aliases=new Map(),bindings=[];
 for(const course of courses){
  if(!/^[a-z0-9-]+$/.test(course))throw Error('Invalid course directory');
  const dir=path.join(root,'output/textbook-extractions',course);
  for(const unit of fs.readdirSync(dir).filter(n=>/^unit\d+(?:-starter)?-images$/.test(n)).sort()){
   const folder=path.join(dir,unit),latest=new Map();
   for(const name of fs.readdirSync(folder).filter(n=>/^batch-.*\.report\.json$/.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))){
    const report=JSON.parse(fs.readFileSync(path.join(folder,name),'utf8'));
    for(const cell of report.cells||[]){const old=latest.get(cell.itemId);if(!old||/-v\d+\.report\.json$/.test(name))latest.set(cell.itemId,{cell,report,name});}
   }
   for(const {cell,report,name} of latest.values()){
    const file=(cell.files||[]).find(f=>f.path.endsWith('.webp'));if(!file)continue;
    const asset=inspect(root,file.path);
    if(file.sha256&&file.sha256!==asset.sha256||file.bytes!==asset.bytes)throw Error('Report no longer matches image: '+file.path);
    if(!assets.has(asset.assetId))assets.set(asset.assetId,asset);
    aliases.set(asset.path,asset.assetId);
    const key=sourceKey(course,unit,cell.itemId),r=reviewed.get(key);
    const reviewMatches=r&&r.image?.replace(/^\//,'')===asset.path&&r.sha256===asset.sha256;
    bindings.push({sourceKey:key,course,unit,itemId:cell.itemId,word:cell.word,meaning:cell.meaning||'',assetId:asset.assetId,path:asset.path,stage:course.startsWith('primary-')?'primary':'junior',styleReference:report.styleReference||'',report:path.relative(root,path.join(folder,name)).replaceAll('\\','/'),review:reviewMatches?r.status:'pending'});
   }
  }
 }
 return {format:'vocabulary-illustration-catalog',schemaVersion:1,assets:[...assets.values()],aliases:Object.fromEntries(aliases),bindings};
}
function validateCatalog(catalog){
 if(catalog?.format!=='vocabulary-illustration-catalog'||catalog.schemaVersion!==1||!Array.isArray(catalog.assets)||!Array.isArray(catalog.bindings))throw Error('Invalid illustration catalog');
 const ids=new Set();for(const a of catalog.assets){if(!/^[a-f0-9]{64}$/.test(a.sha256)||a.assetId!=='sha256:'+a.sha256||ids.has(a.assetId)||!/^assets\/[A-Za-z0-9._-]+\.webp$/.test(a.path)||a.objectKey!=='vocabulary/'+a.sha256+'.webp'||!Number.isInteger(a.bytes)||a.bytes<=0||a.bytes>=20000||!Number.isInteger(a.width)||!Number.isInteger(a.height)||a.width<=0||a.height<=0||a.width*9!==a.height*16)throw Error('Invalid delivery record');ids.add(a.assetId);}
 for(const [alias,id] of Object.entries(catalog.aliases||{}))if(!/^assets\/[A-Za-z0-9._-]+\.webp$/.test(alias)||!ids.has(id))throw Error('Invalid catalog alias');
 for(const b of catalog.bindings)if(!ids.has(b.assetId)||catalog.aliases[b.path]!==b.assetId||!['pending','pass','issue'].includes(b.review))throw Error('Invalid catalog binding');
 return catalog;
}
function plan(catalog,manifest,{stage,styleReference=manifest.styleReference}={}){
 validateCatalog(catalog);
 if(!['primary','junior','adult'].includes(stage)||typeof styleReference!=='string'||!styleReference.trim()||!Array.isArray(manifest.cells))throw Error('Preflight requires an explicit primary/junior/adult stage, approved style reference and cells');
 return {format:'vocabulary-illustration-plan',schemaVersion:1,batchId:manifest.batchId,items:manifest.cells.map(cell=>{
  const sameWord=catalog.bindings.filter(b=>normalize(b.word)===normalize(cell.word));
  const exact=sameWord.filter(b=>normalize(b.meaning)===normalize(cell.meaning)&&b.stage===stage&&b.styleReference===styleReference);
  const candidates=exact.filter(b=>b.review==='pass');
  return {itemId:cell.itemId,word:cell.word,meaning:cell.meaning,action:candidates.length?'select-approved-image':sameWord.length?'review-existing-candidates':'generate',candidates,otherCandidates:sameWord.filter(b=>!candidates.includes(b))};
 })};
}
function applyReuse(root,{catalog,manifest,draft,selections,stage}){
 const proposed=plan(catalog,manifest,{stage}),next=structuredClone(draft),seen=new Set();
 if(!Array.isArray(selections)||!selections.length)throw Error('Select at least one reviewed illustration');
 for(const s of selections){
  if(seen.has(s.itemId)||s.sceneReviewed!==true)throw Error('Each selection needs a distinct item and explicit scene review');seen.add(s.itemId);
  const row=proposed.items.find(i=>i.itemId===s.itemId),b=row?.candidates.find(c=>c.assetId===s.assetId&&c.sourceKey===s.sourceKey);
  if(!b)throw Error('Selected image is not an approved matching candidate');
  const matches=next.items.filter(i=>i.itemId===s.itemId&&i.word===row.word&&i.meaning===row.meaning);
  if(matches.length!==1||matches[0].images?.wide?.length||matches[0].images?.mobile?.length)throw Error('Draft identity mismatch or references already populated');
  const actual=inspect(root,b.path);if(actual.assetId!==b.assetId)throw Error('Image changed since review');
  matches[0].images={wide:[b.path],mobile:[b.path]};
 }
 return next;
}
module.exports={hash,normalize,currentCourses,sourceKey,inspect,buildCatalog,validateCatalog,plan,applyReuse};
