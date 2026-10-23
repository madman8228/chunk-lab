#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),model=require('./lib/vocabulary-illustrations.cjs');
const root=path.resolve(__dirname,'..'),args=process.argv.slice(2),command=args.shift();
const value=key=>{const i=args.indexOf(key);return i<0?undefined:args[i+1];};
const read=key=>{const f=value(key);if(!f)throw Error('Required: '+key);return JSON.parse(fs.readFileSync(path.resolve(f),'utf8'));};
const write=(file,data)=>{if(!file)throw Error('Required: --out (new filename)');fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n',{flag:'wx'});};
if(command==='build'){
 const reviews=args.flatMap((x,i)=>x==='--reviews'?[JSON.parse(fs.readFileSync(args[i+1],'utf8'))]:[]),courses=args.flatMap((x,i)=>x==='--course'?[args[i+1]]:[]);
 let catalog=model.buildCatalog(root,{reviews,...(courses.length?{courses}:{})});
 if(value('--package'))catalog=model.mergeVerifiedPackage(root,catalog,path.resolve(value('--package')),{stage:value('--package-stage'),styleReference:value('--package-style')});
 write(value('--out'),catalog);
 console.log(JSON.stringify({catalog:value('--out'),assets:catalog.assets.length,bindings:catalog.bindings.length,approved:catalog.bindings.filter(b=>b.review==='pass').length}));
}else if(command==='plan'){
 const result=model.plan(read('--catalog'),read('--manifest'),{stage:value('--stage')});write(value('--out'),result);console.log(JSON.stringify(result.items.map(i=>({word:i.word,action:i.action,approvedCandidates:i.candidates.length,otherCandidates:i.otherCandidates.length}))));
}else if(command==='merge-package'){
 const catalog=model.mergeVerifiedPackage(root,read('--catalog'),path.resolve(value('--package')),{stage:value('--stage'),styleReference:value('--style')});write(value('--out'),catalog);console.log(JSON.stringify({catalog:value('--out'),assets:catalog.assets.length,bindings:catalog.bindings.length,merged:catalog.bindings.filter(binding=>binding.reviewEvidence?.packageVersion).length}));
}else if(command==='apply'){
 const draftFile=value('--draft'),output=value('--out');if(!output||path.resolve(output)===path.resolve(draftFile||''))throw Error('Output must be a new draft');
 const result=model.applyReuse(root,{catalog:read('--catalog'),manifest:read('--manifest'),draft:read('--draft'),selections:read('--selections'),stage:value('--stage')});write(output,result);console.log(JSON.stringify({draft:output,reused:read('--selections').length}));
}else if(command==='resolve-reviewed'){
 const catalogFile=value('--catalog'),output=value('--out');if(!output||path.resolve(output)===path.resolve(catalogFile||''))throw Error('Output must be a new catalog');
 const catalog=read('--catalog'),decisions=read('--decisions'),catalogSha256=model.hash(fs.readFileSync(path.resolve(catalogFile),'utf8'));
 const result=model.applyReviewedReuse(root,{catalog,catalogSha256,state:decisions});write(output,result.catalog);console.log(JSON.stringify({catalog:output,...result.summary}));
}else if(command==='export-oss'){
 const catalog=model.validateCatalog(read('--catalog')),destination=path.resolve(value('--out')||'');if(!value('--out')||fs.existsSync(destination))throw Error('Export requires a new directory');
 // Verify every source before creating the upload package. No network calls or credentials.
 for(const a of catalog.assets)if(model.inspect(root,a.path).assetId!==a.assetId)throw Error('Asset hash changed: '+a.path);
 fs.mkdirSync(destination,{recursive:true});const files=[];
 for(const a of catalog.assets){const file=path.join(destination,a.objectKey);fs.mkdirSync(path.dirname(file),{recursive:true});fs.copyFileSync(path.join(root,a.path),file,fs.constants.COPYFILE_EXCL);files.push({key:a.objectKey,bytes:a.bytes,sha256:a.sha256,headers:{'Content-Type':'image/webp','Cache-Control':'public, max-age=31536000, immutable'}});}
 write(path.join(destination,'upload-manifest.json'),{schemaVersion:1,files});console.log(JSON.stringify({directory:destination,files:files.length}));
}else throw Error('Commands: build | merge-package | plan | apply | resolve-reviewed | export-oss. Outputs are exclusive; existing drafts/assets are never overwritten.');
