'use strict';
// Read original course assets; write only a new, exclusive archive directory.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Database=require('../server/node_modules/better-sqlite3');
const root=path.resolve(__dirname,'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const destination=path.resolve(root,'../course-asset-backups','grade9-unit1-unit2-'+stamp);
fs.mkdirSync(destination,{recursive:true});
const files=new Set(),walk=relative=>{
  const absolute=path.join(root,relative);
  if(!fs.existsSync(absolute))return;
  if(fs.statSync(absolute).isDirectory())for(const name of fs.readdirSync(absolute))walk(path.join(relative,name));
  else files.add(relative.replace(/\\/g,'/'));
};
const db=new Database(path.join(root,'server/data/chunklab.db'),{readonly:true,fileMustExist:true});
const rows=db.prepare('SELECT user_id,book_id,version,revision,package_json,created_at FROM personal_wordbook_versions ORDER BY user_id,book_id,version').all();
const report={createdAt:new Date().toISOString(),archive:destination,sourceDatabase:path.join(root,'server/data/chunklab.db'),courses:[],privateCopies:[],files:[],publiclyRegistered:[]};
const checkImages=items=>{
  const refs=[...new Set(items.flatMap(i=>[...(i.images?.wide||[]),...(i.images?.mobile||[])]))];
  for(const ref of refs){if(!/^assets\/[A-Za-z0-9._-]+\.(avif|webp)$/.test(ref))throw Error('Invalid image path '+ref);const size=fs.statSync(path.join(root,ref)).size;if(size<=0||size>=20000)throw Error('Image size invalid '+ref);files.add(ref);}
  return {illustratedItems:items.filter(i=>i.images?.wide?.length&&i.images?.mobile?.length).length,deliveryFiles:refs.length,maxBytes:Math.max(...refs.map(ref=>fs.statSync(path.join(root,ref)).size))};
};
(async()=>{
 try{
  const base='output/textbook-extractions/people-grade9-full-2013-20261015';
  const content=require('../server/services/vocabulary-content').createVocabularyContent({appRoot:root,publishedRoot:path.join(root,'server/data/wordbook-publications')});
  const publisher=require('../server/services/wordbook-publisher').createWordbookPublisher({appRoot:root,content});
  for(const unit of [1,2]){
   const relative=base+'/unit'+unit+'-pilot/wordbook-draft.json',draft=JSON.parse(fs.readFileSync(path.join(root,relative),'utf8'));
   const prepared=await require('../js/wordbook-draft').compile(draft);
   const validation=publisher.validate(prepared);
   report.courses.push({unit,title:draft.book.title,bookId:draft.book.bookId,items:draft.items.length,...checkImages(draft.items),publicPackageValidation:validation});
   const out=path.join(destination,'prepared-unit'+unit+'.json');fs.writeFileSync(out,JSON.stringify(prepared,null,2),{flag:'wx'});
   walk(base+'/unit'+unit+'-pilot');
  }
  for(const row of rows){const pkg=JSON.parse(row.package_json);checkImages(pkg.items);report.privateCopies.push({userId:row.user_id,bookId:row.book_id,version:row.version,revision:row.revision,items:pkg.items.length,title:pkg.index.books[0].title,packageSha256:hash(row.package_json)});}
  fs.writeFileSync(path.join(destination,'personal-wordbook-rows.json'),JSON.stringify(rows,null,2),{flag:'wx'});
  report.publiclyRegistered=content.index().books.map(b=>({bookId:b.bookId,title:b.title,items:b.itemCount}));
  walk('ref/words-pic');walk('server/data/wordbook-publications');walk('content/vocabulary');
  for(const file of ['unit1-wordbook-preview.html','unit2-atlas-preview.html','scripts/build-people-grade9-full-2013-unit1-pilot.mjs','scripts/build-people-grade9-full-2013-unit2-pilot.mjs','server/backups/unit2-import-backup-record-20261015.json'])walk(file);
  for(const relative of [...files].sort()){
   const source=path.join(root,relative),target=path.join(destination,'project',relative);
   fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);
   const sourceHash=hash(fs.readFileSync(source)),copyHash=hash(fs.readFileSync(target));if(sourceHash!==copyHash)throw Error('Backup mismatch '+relative);
   report.files.push({path:relative,bytes:fs.statSync(target).size,sha256:copyHash});
  }
  const snapshot=path.join(destination,'chunklab.db');db.exec("VACUUM INTO '"+snapshot.replace(/'/g,"''")+"'");
  const backup=new Database(snapshot,{readonly:true,fileMustExist:true});
  try{report.database={file:'chunklab.db',sha256:hash(fs.readFileSync(snapshot)),integrity:backup.pragma('integrity_check',{simple:true}),privateRows:backup.prepare('SELECT COUNT(*) AS n FROM personal_wordbook_versions').get().n};if(report.database.integrity!=='ok'||report.database.privateRows!==rows.length)throw Error('Snapshot verification failed');}finally{backup.close();}
  report.verified=true;
  fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify({archive:destination,verified:report.verified,database:report.database,courses:report.courses,privateCopies:report.privateCopies,publiclyRegistered:report.publiclyRegistered,copiedFiles:report.files.length,copiedBytes:report.files.reduce((n,f)=>n+f.bytes,0)},null,2));
 }finally{db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
