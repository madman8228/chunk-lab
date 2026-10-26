'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os'),assert=require('node:assert/strict');
const {createPublicWordbookVersions}=require('../server/services/public-wordbook-versions');
const {createWordbookPublisher}=require('../server/services/wordbook-publisher');
const root=path.resolve(__dirname,'..'),source=path.join(root,'output/wordbook-us-ipa-full-coverage-20261026-v2'),output=path.join(root,'output/wordbook-us-ipa-full-coverage-publication-20261026-v1');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex'),jh=v=>hash(JSON.stringify(v)),read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const write=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
async function main(){
 require('../server/loadenv');if(fs.existsSync(output))throw Error('Inspect previous receipts before retrying');
 const publishedRoot=path.join(path.resolve(process.env.CHUNKLAB_DATA_DIR||path.join(root,'server/data')),'wordbook-publications'),versions=createPublicWordbookVersions({publishedRoot});
 const report=read(path.join(source,'report.json')),changes=read(path.join(source,'changes.json')),byKey=new Map(changes.map(x=>[x.bookId+'\n'+x.itemId,x]));assert.equal(byKey.size,changes.length);
 const entries=[];let validatedChanges=0;
 for(const b of report.books){
  const meta=versions.metadata(b.bookId);assert.equal(meta.releaseId,b.baseReleaseId,'Published course changed: '+b.bookId);
  const baseFile=path.join(versions.directory(b.bookId),'releases',meta.releaseId,'package.json'),bytes=fs.readFileSync(baseFile),original=JSON.parse(bytes);assert.equal(jh(original),meta.releaseId);
  const candidateBytes=fs.readFileSync(path.join(source,b.path)),candidate=JSON.parse(candidateBytes);assert.equal(hash(candidateBytes),b.candidateSha256);assert.equal(original.items.length,candidate.items.length);
  const prior=new Map(original.items.map(x=>[x.itemId,x]));
  for(const item of candidate.items){
   const old=prior.get(item.itemId);assert.ok(old);
   const strip=x=>{const v=structuredClone(x);delete v.contentRevision;delete v.phonetics['en-US'];return v;};assert.deepEqual(strip(item),strip(old));
   const {contentRevision,...body}=item;assert.equal(jh(body),contentRevision);
   if(old.phonetics?.['en-US'])assert.equal(item.phonetics['en-US'],old.phonetics['en-US']);
   if(item.phonetics?.['en-US']!==old.phonetics?.['en-US']){
    assert.ok(!old.phonetics?.['en-US']);const change=byKey.get(b.bookId+'\n'+item.itemId);assert.ok(change);assert.equal(change.cambridgeUsDisplay,item.phonetics['en-US']);assert.equal(change.cambridgeUsRaw.replace(/\./g,''),change.cambridgeUsDisplay);
    assert.equal(hash(fs.readFileSync(change.sourcePath)),change.sourceSha256);if(change.definitionPath)assert.equal(hash(fs.readFileSync(change.definitionPath)),change.definitionSha256);validatedChanges++;
   }
  }
  entries.push({b,meta,original,candidate,bytes});
 }
 assert.equal(validatedChanges,changes.length);fs.mkdirSync(output);fs.mkdirSync(path.join(output,'backup'));
 const backups=[];for(const e of entries){const name=jh(e.b.bookId)+'.json';fs.writeFileSync(path.join(output,'backup',name),e.bytes,{flag:'wx'});assert.equal(hash(fs.readFileSync(path.join(output,'backup',name))),hash(e.bytes));backups.push({bookId:e.b.bookId,releaseId:e.meta.releaseId,path:'backup/'+name,sha256:hash(e.bytes)});}
 write('backup-manifest.json',{publishedRoot,accountTarget:null,databaseAccess:false,files:backups});write('authorization.json',read(path.join(source,'authorization.json')));
 console.log('Verified source-bound changes and recoverable backups: '+validatedChanges);
 const content={publicationDirectory:publishedRoot,index:()=>({schemaVersion:1,books:entries.map(e=>e.original.index.books[0])}),invalidate(){}},cachedVersions={current:id=>{const e=entries.find(e=>e.b.bookId===id);return {releaseId:e.meta.releaseId,candidate:e.original,book:e.original.index.books[0]};}};
 const publisher=createWordbookPublisher({appRoot:root,content,versions:cachedVersions}),buffers=new Map();
 const readAsset=ref=>{assert.match(ref,/^assets\/[A-Za-z0-9._-]+\.[a-z0-9]+$/i);if(!buffers.has(ref))buffers.set(ref,fs.readFileSync(path.join(root,ref)));return buffers.get(ref);};
 for(const e of entries){publisher.validate(e.candidate,{readAsset,updateBaseReleaseId:e.meta.releaseId});console.log('Publisher validated: '+e.b.bookId);}
 buffers.clear();
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'us-coverage-install-')),trial=createPublicWordbookVersions({publishedRoot:temp});
 for(const e of entries.filter(e=>e.b.additions>0)){
  const dir=trial.directory(e.b.bookId);fs.mkdirSync(path.join(dir,'items'),{recursive:true});fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(e.original.index));for(const i of e.original.items)fs.writeFileSync(path.join(dir,'items',i.itemId.replaceAll(':','_')+'.json'),JSON.stringify(i));
  const before=trial.current(e.b.bookId),installed=trial.install(e.candidate,{reviewId:'isolated-source-check'});trial.activate({bookId:e.b.bookId,expectedBaseReleaseId:before.releaseId,releaseId:installed.releaseId});assert.deepEqual(trial.current(e.b.bookId).candidate.items,e.candidate.items);trial.activate({bookId:e.b.bookId,expectedBaseReleaseId:installed.releaseId,releaseId:before.releaseId,action:'rollback'});
 }
 write('rehearsal.json',{status:'passed',temporaryDataDirectory:temp,books:entries.length,installAndRollback:true});
 if(!process.argv.includes('--publish')){console.log('Checks passed; --publish not supplied');return;}
 const receipts=[];
 try{for(const e of entries.filter(e=>e.b.additions>0)){
  const installed=versions.install(e.candidate,{reviewId:'cambridge-source-verified-full-coverage-20261026',sourceReportSha256:hash(fs.readFileSync(path.join(source,'report.json'))),authorization:'全部补充上；仅用剑桥原标，未收录项保留'});
  const active=versions.activate({bookId:e.b.bookId,expectedBaseReleaseId:e.meta.releaseId,releaseId:installed.releaseId,reviewId:'cambridge-source-verified-full-coverage-20261026'});
  const receipt={bookId:e.b.bookId,previousReleaseId:e.meta.releaseId,releaseId:active.releaseId,added:e.b.additions};receipts.push(receipt);write('receipt-'+jh(e.b.bookId)+'.json',receipt);assert.deepEqual(versions.current(e.b.bookId).candidate.items,e.candidate.items);console.log('Published: '+e.b.bookId+' (+'+e.b.additions+')');
 }}catch(error){const recovery=[];for(const row of [...receipts].reverse()){try{versions.activate({bookId:row.bookId,expectedBaseReleaseId:row.releaseId,releaseId:row.previousReleaseId,action:'rollback',reviewId:'failed-batch-recovery'});recovery.push({bookId:row.bookId,restored:true});}catch(e){recovery.push({bookId:row.bookId,error:e.message});}}write('failure.json',{error:error.message,recovery});throw error;}
 write('result.json',{status:'published-and-verified',summary:report.summary,books:receipts,backups:backups.length,remainingPolicy:'Cambridge original only; unconfirmed entries retained',accountDataChanged:false,serviceRestarted:false});console.log(JSON.stringify({published:true,...report.summary}));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
