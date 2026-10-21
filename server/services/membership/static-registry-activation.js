'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {ContentRegistry}=require('./content-registry');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const fail=code=>Object.assign(new Error(code),{code,status:409});

/** Installs only verified, explicitly reviewed private artifacts. Original files and learning rows are untouched. */
function createStaticRegistryActivation({db,registry,now=Date.now}){
  function activate({candidateRoot,expectedRegistryVersion,requestId,review},adminId){
    if(!/^[A-Za-z0-9_-]{12,100}$/.test(requestId||''))throw fail('INVALID_REQUEST');
    const sourceRoot=fs.realpathSync(candidateRoot);
    const read=name=>{
      if(!/^[A-Za-z0-9._-]+$/.test(name)||name==='.'||name==='..')throw fail('INVALID_ARTIFACT_PATH');
      const target=path.join(sourceRoot,name),stat=fs.lstatSync(target);
      if(stat.isSymbolicLink()||!stat.isFile()||stat.size>20*1024*1024)throw fail('INVALID_ARTIFACT_FILE');
      return fs.readFileSync(target);
    };
    const candidateBytes=read('candidate.json'),candidateHash=hash(candidateBytes),candidate=JSON.parse(candidateBytes.toString('utf8'));
    if(candidate.schemaVersion!==2||!Array.isArray(candidate.courses)||!candidate.courses.length)throw fail('INVALID_CANDIDATE');
    if(!review||review.candidateHash!==candidateHash||review.publicSourcesVerified!==true||review.runtimeVerified!==true||
      typeof review.evidence!=='string'||!review.evidence.trim())throw fail('ACTIVATION_REVIEW_REQUIRED');
    const {backup,...reviewIdentity}=review;void backup;
    const payloadHash=hash(JSON.stringify({candidateHash,expectedRegistryVersion,review:reviewIdentity}));
    return db.transaction(()=>{
      const prior=db.prepare('SELECT payload_hash,manifest_json FROM membership_static_activations WHERE request_id=?').get(requestId);
      if(prior){if(prior.payload_hash!==payloadHash)throw fail('IDEMPOTENCY_CONFLICT');return {activated:true,replay:true,courseCount:JSON.parse(prior.manifest_json).courses.length};}
      const before=registry.snapshot();
      if(before.version!==expectedRegistryVersion)throw fail('REGISTRY_CHANGED');
      const selectedIds=new Set(candidate.courses.map(course=>course.courseId));
      // A full activation must preserve every currently installed course; adding legacy courses is allowed.
      if(before.courses.some(course=>!selectedIds.has(course.courseId)))throw fail('EXISTING_COURSE_MISSING');
      for(const previous of before.courses){
        const next=candidate.courses.find(course=>course.courseId===previous.courseId);
        if(previous.units.some(unit=>{
          const found=next.units.find(entry=>entry.unitId===unit.unitId);
          const identity=unit.recordIdentity||require('./assessment-content').deckIdentity(previous.courseId,unit.unitId);
          return !found||JSON.stringify(found.itemIds)!==JSON.stringify(unit.itemIds)||
            (typeof identity==='string'?found.recordIdentity.deckId!==identity:JSON.stringify(found.recordIdentity)!==JSON.stringify(identity));
        }))throw fail('COURSE_IDENTITY_CHANGED');
      }
      fs.mkdirSync(registry.protectedRoot,{recursive:true});
      const folder='activation-'+candidateHash;
      const output=path.join(registry.protectedRoot,folder);fs.mkdirSync(output,{recursive:true});
      if(fs.lstatSync(output).isSymbolicLink())throw fail('INVALID_ACTIVATION_DIRECTORY');
      const files=[];
      const copy=(name,expected)=>{
        const bytes=read(name);if(expected&&hash(bytes)!==expected)throw fail('CONTENT_INTEGRITY_FAILURE');
        const target=path.join(output,name);
        if(fs.existsSync(target)){if(fs.lstatSync(target).isSymbolicLink()||hash(fs.readFileSync(target))!==hash(bytes))throw fail('OUTPUT_FILE_CONFLICT');}
        else fs.writeFileSync(target,bytes,{flag:'wx'});
        files.push({file:folder+'/'+name,sha256:hash(bytes),size:bytes.length});return folder+'/'+name;
      };
      const courses=candidate.courses.map(course=>({...course,units:course.units.map(unit=>({...unit,
        ...(unit.file?{file:copy(unit.file)}:{}),
        fragments:unit.fragments.map(fragment=>({...fragment,file:copy(fragment.file,fragment.sha256)})),
        assets:unit.assets.map(asset=>({...asset,file:copy(asset.file,asset.sha256)}))
      }))}));
      const manifest={schemaVersion:2,courses};
      const validationName=folder+'/manifest.json',validationFile=path.join(output,'manifest.json'),manifestBytes=Buffer.from(JSON.stringify(manifest));
      if(fs.existsSync(validationFile)){if(fs.lstatSync(validationFile).isSymbolicLink()||hash(fs.readFileSync(validationFile))!==hash(manifestBytes))throw fail('OUTPUT_FILE_CONFLICT');}
      else fs.writeFileSync(validationFile,manifestBytes,{flag:'wx'});
      const validated=new ContentRegistry({appRoot:registry.appRoot,protectedRoot:registry.protectedRoot,activeManifest:()=>({body:registry.file(validationName)&&manifestBytes.toString()})});
      validated.snapshot();
      for(const course of courses)for(const unit of course.units)for(const fragment of unit.fragments)validated.load(course.courseId,unit.unitId,fragment.cursor);
      if(registry.snapshot().version!==before.version)throw fail('REGISTRY_CHANGED');
      db.prepare('INSERT INTO membership_static_activations(request_id,payload_hash,previous_registry_hash,manifest_json,evidence_json,changed_by,created_at) VALUES(?,?,?,?,?,?,?)')
        .run(requestId,payloadHash,before.version,JSON.stringify(manifest),JSON.stringify({review,files,candidateHash}),adminId,now());
      return {activated:true,replay:false,courseCount:courses.length};
    }).immediate();
  }
  return {activate};
}
module.exports={createStaticRegistryActivation};
