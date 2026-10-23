'use strict';
// One-time, explicitly scoped data correction; not a runtime publisher-name lookup.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createPublicWordbookVersions}=require('../server/services/public-wordbook-versions');
const {createVocabularyContent}=require('../server/services/vocabulary-content');
const {createWordbookPublisher}=require('../server/services/wordbook-publisher');
const {sameContentExceptCatalog}=require('../server/services/wordbook-unit-titles');
const root=path.resolve(__dirname,'..'),publishedRoot=path.join(root,'server/data/wordbook-publications');
const targets=[
 ['pep-junior-grade7-lower-2024','people-grade7-lower-2024'],
 ['pep-junior-grade7-upper-2024','people-grade7-upper-2024'],
 ['pep-junior-grade8-upper-2024','people-grade8-upper-2024'],
 ['pep-junior-grade8-lower-2024','people-grade8-lower-2024'],
 ['pep-junior-grade9-full-2013','people-grade9-full-2013']
];
function services(directory){const versions=createPublicWordbookVersions({publishedRoot:directory}),content=createVocabularyContent({appRoot:root,publishedRoot:directory,versions});return {versions,content,publisher:createWordbookPublisher({appRoot:root,content,versions})};}
function inventory(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
 const file=path.join(directory,entry.name);if(entry.isSymbolicLink())throw Error('Refusing symbolic link: '+file);
 return entry.isDirectory()?inventory(file).map(row=>({...row,path:entry.name+'/'+row.path})):[{path:entry.name,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}];
}).sort((a,b)=>a.path.localeCompare(b.path));}
async function main(){
 if(process.argv.slice(2).some(value=>value!=='--apply'))throw Error('Only --apply is supported; no argument rehearses in a temporary directory');
 const live=services(publishedRoot),temp=fs.mkdtempSync(path.join(os.tmpdir(),'textbook-version-metadata-')),isolatedRoot=path.join(temp,'publications');fs.mkdirSync(isolatedRoot);
 const plans=[];
 for(const [id,sourceName] of targets){
  const bookId='textbook-wordbook:'+id,base=live.versions.current(bookId),sourceFile=path.join(root,'docs/source-materials',sourceName+'.json'),source=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
  assert.equal(source.edition.publisher,'人民教育出版社');assert.equal(base.book.catalog.facets.publisherId,source.edition.publisher);assert.equal(base.book.catalog.facets.seriesId,'人教版英语');
  if(base.book.catalog.facets.textbookVersion==='人教版')continue;
  assert.equal(base.book.catalog.facets.textbookVersion,undefined,'do not overwrite an already-specified textbook version');
  const candidate=structuredClone(base.candidate);candidate.index.books[0].catalog.facets.textbookVersion='人教版';
  assert.ok(sameContentExceptCatalog(base.book,candidate.index.books[0]));assert.deepEqual(candidate.items,base.candidate.items);
  const directory=live.versions.directory(bookId),name=path.basename(directory);
  fs.cpSync(directory,path.join(isolatedRoot,name),{recursive:true,force:false,errorOnExist:true});
  plans.push({bookId,base,candidate,directory,name,sourceFile,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(sourceFile)).digest('hex')});
 }
 const isolated=services(isolatedRoot);
 for(const plan of plans){
  plan.check=isolated.publisher.validate(plan.candidate,{updateBaseReleaseId:plan.base.releaseId});
  plan.receipt={importId:crypto.randomUUID(),packageFingerprint:plan.check.fingerprint,review:{reviewId:crypto.randomUUID(),note:'Owner-authorized structured textbook-version correction only; publisher and source identity verified. No items or learning data modified.'}};
  plan.rehearsal=isolated.publisher.publishRevision(plan.candidate,plan.check.fingerprint,plan.base.releaseId,plan.receipt);
  assert.deepEqual(isolated.content.book(plan.bookId).units,plan.base.book.units);
  assert.equal(isolated.content.book(plan.bookId).revision,plan.base.book.revision);
 }
 const report={applied:false,temp,books:plans.map(plan=>({bookId:plan.bookId,baseReleaseId:plan.base.releaseId,releaseId:plan.rehearsal.releaseId,sourceFile:plan.sourceFile,sourceSha256:plan.sourceSha256,itemCount:plan.base.book.itemCount,change:{textbookVersion:'人教版'}}))};
 if(process.argv.includes('--apply')&&plans.length){
  const backup=path.join(root,'server/backups/textbook-version-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(backup);
  const files={};for(const plan of plans){files[plan.bookId]=inventory(plan.directory);fs.cpSync(plan.directory,path.join(backup,plan.name),{recursive:true,force:false,errorOnExist:true});assert.deepEqual(inventory(path.join(backup,plan.name)),files[plan.bookId]);}
  const Database=require('../server/node_modules/better-sqlite3'),database=path.join(root,'server/data/chunklab.db'),db=new Database(database,{readonly:true,fileMustExist:true});try{await db.backup(path.join(backup,'chunklab.db'));}finally{db.close();}
  const checked=new Database(path.join(backup,'chunklab.db'),{readonly:true,fileMustExist:true});try{assert.equal(checked.pragma('integrity_check',{simple:true}),'ok');}finally{checked.close();}
  fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify({...report,database,files},null,2),{flag:'wx'});
  // Check every base before the first activation. Each activation also performs its own CAS.
  for(const plan of plans)assert.equal(live.versions.current(plan.bookId).releaseId,plan.base.releaseId);
  for(const plan of plans){const result=live.publisher.publishRevision(plan.candidate,plan.check.fingerprint,plan.base.releaseId,plan.receipt);assert.equal(result.releaseId,plan.rehearsal.releaseId);}
  Object.assign(report,{applied:true,backup});
  fs.writeFileSync(path.join(backup,'result.json'),JSON.stringify(report,null,2),{flag:'wx'});
 }
 console.log(JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
