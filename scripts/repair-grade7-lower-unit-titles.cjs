'use strict';
// Explicitly scoped metadata release. Default is a rehearsal in a new temporary directory.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {unitTitles}=require('./lib/textbook-unit-titles.cjs');
const {sameContentExceptUnitTitles}=require('../server/services/wordbook-unit-titles');
const {createPublicWordbookVersions}=require('../server/services/public-wordbook-versions');
const {createVocabularyContent}=require('../server/services/vocabulary-content');
const {createWordbookPublisher}=require('../server/services/wordbook-publisher');
const root=path.resolve(__dirname,'..'),bookId='textbook-wordbook:pep-junior-grade7-lower-2024';
const publishedRoot=path.join(root,'server/data/wordbook-publications');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function services(directory){const versions=createPublicWordbookVersions({publishedRoot:directory}),content=createVocabularyContent({appRoot:root,publishedRoot:directory,versions});return {versions,content,publisher:createWordbookPublisher({appRoot:root,content,versions})};}
function files(directory){const found=[];for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isSymbolicLink())throw Error('Refusing symbolic link: '+file);if(entry.isDirectory())for(const row of files(file))found.push({path:entry.name+'/'+row.path,sha256:row.sha256});else found.push({path:entry.name,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});}return found.sort((a,b)=>a.path.localeCompare(b.path));}
async function main(){
 if(process.argv.slice(2).some(arg=>arg!=='--apply'))throw Error('Only --apply is supported');
 const live=services(publishedRoot),base=live.versions.current(bookId),source=require('../docs/source-materials/people-grade7-lower-2024.json'),lookup=unitTitles(source);
 const candidate=structuredClone(base.candidate),book=candidate.index.books[0];
 assert.equal(book.bookId,bookId);assert.equal(book.units.length,8);
 const changes=[];
 for(const unit of book.units){assert.match(unit.unitId,/^unit-[1-8]$/);const title=lookup('Unit '+unit.unitId.slice(5));if(title!==unit.title)changes.push({unitId:unit.unitId,before:unit.title,after:title});unit.title=title;}
 if(!changes.length){console.log(JSON.stringify({bookId,alreadyCurrent:true}));return;}
 book.structureRevision=hash(book.units);
 assert.ok(sameContentExceptUnitTitles(base.book,book));assert.deepEqual(candidate.items,base.candidate.items);
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'grade7-unit-titles-')),isolatedRoot=path.join(temp,'publications');fs.mkdirSync(isolatedRoot);
 const name=path.basename(live.versions.directory(bookId));fs.cpSync(live.versions.directory(bookId),path.join(isolatedRoot,name),{recursive:true,errorOnExist:true,force:false});
 const isolated=services(isolatedRoot),check=isolated.publisher.validate(candidate,{updateBaseReleaseId:base.releaseId});
 const receipt={importId:crypto.randomUUID(),packageFingerprint:check.fingerprint,review:{reviewId:crypto.randomUUID(),note:'Owner-authorized textbook contents metadata correction only; no course items or learning records changed.'}};
 const rehearsal=isolated.publisher.publishRevision(candidate,check.fingerprint,base.releaseId,receipt);
 assert.equal(isolated.content.resolveStructure(bookId,undefined,'unit-1',base.book.structureRevision),book.structureRevision);
 assert.deepEqual(isolated.content.book(bookId).items,base.book.items);
 const report={bookId,changes,unchangedItemCount:book.items.length,oldStructureRevision:base.book.structureRevision,structureRevision:book.structureRevision,baseReleaseId:base.releaseId,rehearsalReleaseId:rehearsal.releaseId,temp,applied:false};
 if(process.argv.includes('--apply')){
  const backup=path.join(root,'server/backups/unit-titles-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(backup,{recursive:false});
  const originalFiles=files(live.versions.directory(bookId));
  fs.cpSync(live.versions.directory(bookId),path.join(backup,name),{recursive:true,errorOnExist:true,force:false});assert.deepEqual(files(path.join(backup,name)),originalFiles);
  const Database=require('../server/node_modules/better-sqlite3'),database=path.join(root,'server/data/chunklab.db'),db=new Database(database,{readonly:true,fileMustExist:true});
  try{await db.backup(path.join(backup,'chunklab.db'));}finally{db.close();}
  const copy=new Database(path.join(backup,'chunklab.db'),{readonly:true,fileMustExist:true});try{assert.equal(copy.pragma('integrity_check',{simple:true}),'ok');}finally{copy.close();}
  fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify({bookId,database,baseReleaseId:base.releaseId,files:originalFiles,changes},null,2),{flag:'wx'});
  const published=live.publisher.publishRevision(candidate,check.fingerprint,base.releaseId,receipt);
  assert.equal(published.releaseId,rehearsal.releaseId);assert.deepEqual(live.content.book(bookId).units,book.units);
  Object.assign(report,{applied:true,backup,releaseId:published.releaseId});
 }
 console.log(JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
