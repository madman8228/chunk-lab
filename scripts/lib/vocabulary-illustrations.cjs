'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {imageDimensions}=require('../../server/services/membership/image-dimensions');
const textbookPackages=require('./textbook-asset-package.cjs');
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
function mergeVerifiedPackage(root,catalog,packageRoot,{stage,styleReference}={}){
 validateCatalog(catalog);
 if(!['primary','junior','adult'].includes(stage)||typeof styleReference!=='string'||!styleReference.trim())throw Error('Package merge requires an explicit stage and approved style reference');
 const verified=textbookPackages.verifyPackage(packageRoot),manifest=verified.manifest;
 const snapshotPath=textbookPackages.inside(packageRoot,manifest.content.courseSnapshot),snapshot=JSON.parse(fs.readFileSync(snapshotPath,'utf8'));
 const items=new Map(snapshot.drafts.flatMap(draft=>draft.items||[]).map(item=>[item.itemId,item]));
 const approvalFile=manifest.files.find(file=>file.path.startsWith('reviews/')&&file.path.endsWith('.json')&&(()=>{try{return JSON.parse(fs.readFileSync(textbookPackages.inside(packageRoot,file.path),'utf8')).format==='textbook-review-approval';}catch{return false;}})());
 if(!approvalFile)throw Error('Package has no checksum-bound image review approval');
 const approval=JSON.parse(fs.readFileSync(textbookPackages.inside(packageRoot,approvalFile.path),'utf8'));
 if(approval.imageRepairs?.status!=='approved')throw Error('Package image review is not approved');
 const next=structuredClone(catalog),assetById=new Map(next.assets.map(asset=>[asset.assetId,asset])),bindingKeys=new Set(next.bindings.map(binding=>binding.sourceKey));
 const aliasesByHash=new Map();
 for(const name of fs.readdirSync(path.join(root,'assets')).filter(name=>name.endsWith('.webp')).sort()){
  const relative='assets/'+name,digest=hash(fs.readFileSync(path.join(root,relative))),id='sha256:'+digest;
  const aliases=aliasesByHash.get(id)||[];aliases.push(relative);aliasesByHash.set(id,aliases);
 }
 const course=path.posix.basename(manifest.provenance?.sourceRoot||manifest.book?.bookId||'');
 if(!/^[a-z0-9-]+$/.test(course))throw Error('Package has no stable course key');
 const repairs=new Map((manifest.repairs||[]).map(repair=>[repair.itemId,repair]));
 for(const binding of manifest.bindings){
  if(binding.imageAssetIds?.length!==1)throw Error('Expected exactly one shared illustration for '+binding.itemId);
  const item=items.get(binding.itemId),imageId=binding.imageAssetIds[0],image=manifest.assets.find(asset=>asset.assetId===imageId);
  if(!item||item.unitId!==binding.unitId||item.word!==binding.word||!image)throw Error('Package binding/source mismatch '+binding.itemId);
  const repair=repairs.get(binding.itemId);
  if(repair&&repair.replacementAssetId!==imageId)throw Error('Repaired image does not match package binding '+binding.itemId);
  const paths=aliasesByHash.get(imageId)||[];
  if(!paths.length)throw Error('Package image is not staged in the shared assets directory: '+binding.itemId);
  const sharedPath=paths[0],actual=inspect(root,sharedPath);
  if(actual.assetId!==imageId)throw Error('Shared image hash mismatch '+binding.itemId);
  if(!assetById.has(imageId)){assetById.set(imageId,actual);next.assets.push(actual);}
  next.aliases[sharedPath]=imageId;
  const sourceKey=sourceKeyForPackage(course,binding.unitId,binding.itemId);
  if(bindingKeys.has(sourceKey))throw Error('Duplicate package binding '+sourceKey);
  bindingKeys.add(sourceKey);
  next.bindings.push({sourceKey,course,unit:binding.unitId,itemId:binding.itemId,word:item.word,meaning:item.meaning||'',assetId:imageId,path:sharedPath,stage,styleReference,report:manifest.packageVersion,review:'pass',reviewEvidence:{packageVersion:manifest.packageVersion,packageManifestSha256:textbookPackages.hashFile(path.join(packageRoot,'manifest.json')),approvalPath:approvalFile.path,approvalSha256:approvalFile.sha256,reviewedAt:approval.reviewedAt}});
 }
 return validateCatalog(next);
}
const sourceKeyForPackage=(course,unit,itemId)=>course+'/'+unit+'/'+itemId;
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
  const reviews=cell.candidateReviews??[],rejected=new Set();
  if(!Array.isArray(reviews))throw Error('Target candidate reviews must be an array');
  for(const review of reviews){
   if(review.decision!=='unsuitable-for-target'||review.sceneReviewed!==true||typeof review.reason!=='string'||!review.reason.trim()||rejected.has(review.assetId)||!sameWord.some(b=>b.assetId===review.assetId))throw Error('Invalid hash-bound target candidate review');
   rejected.add(review.assetId);
  }
  const otherCandidates=sameWord.filter(b=>!candidates.includes(b)&&!rejected.has(b.assetId));
  return {itemId:cell.itemId,word:cell.word,meaning:cell.meaning,action:candidates.length?'select-approved-image':otherCandidates.length?'review-existing-candidates':'generate',candidates,otherCandidates,...(reviews.length?{targetCandidateReviews:reviews}: {})};
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
function applyReviewedReuse(root,{catalog,catalogSha256,state}){
 validateCatalog(catalog);
 if(typeof catalogSha256!=='string'||!/^([a-f0-9]{64})$/.test(catalogSha256))throw Error('A source catalog hash is required');
 if(state?.format!=='vocabulary-reuse-review-decisions'||state.schemaVersion!==1||!Number.isSafeInteger(state.revision)||!Array.isArray(state.events))throw Error('Unsupported or damaged reuse-review state');
 const groups=require('./vocabulary-reuse-review.cjs').makeGroups(catalog),byPath=new Map();
 const assertCurrentAsset=(assetId,message)=>{const asset=catalog.assets.find(row=>row.assetId===assetId);try{if(asset&&inspect(root,asset.path).assetId===assetId)return;}catch{}throw Error(message);};
 for(const binding of catalog.bindings){const rows=byPath.get(binding.path)||[];rows.push(binding);byPath.set(binding.path,rows);}
 const next=structuredClone(catalog),selected=new Map(),groupDecisions=[];
 for(const group of groups){
  const events=state.events.filter(event=>event.groupId===group.groupId&&event.catalogSha256===catalogSha256&&event.groupFingerprint===group.fingerprint);
  const event=events.at(-1);if(!event||event.decision!=='reuse')continue;
  if(event.sceneReviewed!==true)throw Error('Reuse decision has no explicit target-scene review: '+group.word);
  const candidate=group.candidates.find(row=>row.assetId===event.assetId);
  if(!candidate||candidate.bindings.some(binding=>!group.entries.some(entry=>entry.sourceKey===binding.sourceKey)))throw Error('Reuse candidate is not bound to the reviewed group: '+group.word);
  assertCurrentAsset(candidate.assetId,'Selected illustration hash changed: '+group.word);
  for(const entry of group.entries)assertCurrentAsset(entry.assetId,'Source illustration hash changed after review: '+entry.sourceKey);
  for(const entry of group.entries){
   const prior=selected.get(entry.path);
   if(prior&&prior.assetId!==event.assetId)throw Error('Conflicting reuse decisions share alias '+entry.path);
   const pathBindings=byPath.get(entry.path)||[];
   if(pathBindings.some(binding=>!group.entries.some(member=>member.sourceKey===binding.sourceKey)))throw Error('Selected alias is also used outside its reviewed group: '+entry.path);
   selected.set(entry.path,{assetId:event.assetId,group,event});
  }
  groupDecisions.push({groupId:group.groupId,word:group.word,meaning:group.meaning,assetId:event.assetId,revision:event.revision,entryCount:group.entries.length,crossStage:group.crossStage,crossStyle:group.crossStyle});
 }
 if(!groupDecisions.length)throw Error('No current, approved reuse decisions for this catalog');
 const entryBySource=new Map(next.bindings.map(binding=>[binding.sourceKey,binding])),updatedSources=new Set();
 for(const [alias,resolution] of selected){next.aliases[alias]=resolution.assetId;for(const entry of resolution.group.entries){if(entry.path!==alias||updatedSources.has(entry.sourceKey))continue;const binding=entryBySource.get(entry.sourceKey);binding.sourceAssetId=binding.assetId;binding.assetId=resolution.assetId;binding.reuseDecision={groupId:resolution.group.groupId,revision:resolution.event.revision,catalogSha256,sceneReviewed:true};updatedSources.add(entry.sourceKey);}}
 const reachable=new Set(Object.values(next.aliases));
 next.assets=next.assets.filter(asset=>reachable.has(asset.assetId));
 next.reuseResolution={format:'vocabulary-reuse-resolution',schemaVersion:1,sourceCatalogSha256:catalogSha256,decisionRevision:state.revision,appliedGroups:groupDecisions};
 validateCatalog(next);
 return {catalog:next,summary:{appliedGroups:groupDecisions.length,reusedBindings:groupDecisions.reduce((sum,row)=>sum+row.entryCount,0),assetsBefore:catalog.assets.length,assetsAfter:next.assets.length,groups:groupDecisions}};
}
module.exports={hash,normalize,currentCourses,sourceKey,inspect,buildCatalog,mergeVerifiedPackage,validateCatalog,plan,applyReuse,applyReviewedReuse};
