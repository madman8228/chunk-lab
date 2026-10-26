'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createPublicWordbookVersions}=require('../server/services/public-wordbook-versions');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const jsonHash=value=>hash(JSON.stringify(value));
function prepare({publishedRoot,sourceRoot,output,phoneticsPackages=[],appRoot=path.resolve(__dirname,'..')}){
 if(fs.existsSync(output))throw Error('请选择新的音标修复输出目录');
 const sources=new Map();
 for(const dir of fs.readdirSync(sourceRoot,{withFileTypes:true}).filter(entry=>entry.isDirectory())){
  const file=path.join(sourceRoot,dir.name,'extracted-vocabulary.json');if(!fs.existsSync(file))continue;
  const bytes=fs.readFileSync(file),source=JSON.parse(bytes);sources.set(hash(bytes),{file,records:source.records||[]});
 }
 const versions=createPublicWordbookVersions({publishedRoot}),books=[],packages=[];
 const approved=new Map();
 for(const folder of phoneticsPackages){
  const {manifest}=require('./lib/textbook-asset-package.cjs').verifyPackage(folder);
  const snapshot=JSON.parse(fs.readFileSync(path.join(folder,manifest.content.courseSnapshot)));
  const items=new Map(snapshot.drafts.flatMap(draft=>draft.items).map(item=>[item.itemId,item]));
  for(const row of manifest.phonetics.filter(entry=>entry.approval==='user-confirmed'&&entry.phonetic?.trim())){
   const item=items.get(row.itemId);if(!item||item.word!==row.word)throw Error('已审核音标的词条身份不一致');
   const binding=JSON.parse(fs.readFileSync(path.join(folder,row.path))).items.find(entry=>entry.itemId===row.itemId);
   if(binding?.word!==row.word||binding.phonetic!==row.phonetic)throw Error('音标审核与来源内容不一致');
   const key=row.itemId+'\n'+row.word+'\n'+item.meaning;
   if(approved.has(key)&&approved.get(key).phonetic!==row.phonetic)throw Error('已审核音标来源冲突');
   approved.set(key,{phonetic:row.phonetic,sourceFile:path.join(folder,row.path),sourceSha256:manifest.files.find(file=>file.path===row.path).sha256});
  }
 }
 for(const dir of fs.readdirSync(publishedRoot).filter(name=>/^[a-f0-9]{64}$/.test(name))){
  const folder=path.join(publishedRoot,dir),file=path.join(folder,'manifest.json');if(!fs.existsSync(file))continue;
  const id=JSON.parse(fs.readFileSync(file)).books[0].bookId,base=versions.current(id),candidate=structuredClone(base.candidate);
  const publicationFile=path.join(folder,'publication.json');
  const evidence=fs.existsSync(publicationFile)?JSON.parse(fs.readFileSync(publicationFile)).productionReview:null;
  const source=evidence&&sources.get(evidence.sourceSha256),book=candidate.index.books[0],changes=[],unresolved=[];
  for(const item of candidate.items){
   if(item.phonetic?.trim())continue;
   const localId=item.itemId.replace('textbook-item:'+id.replace(/^textbook-wordbook:/,'')+':','');
   const matches=(source?.records||[]).filter(record=>(record.entryId||record.itemId)===localId&&record.term===item.word&&record.meaning===item.meaning);
   const original=matches.length===1?matches[0]:null;
   const reviewed=approved.get(item.itemId+'\n'+item.word+'\n'+item.meaning);
   const phonetic=reviewed?.phonetic||(original&&(!original.phoneticScope||original.phoneticScope==='term')?original.phonetic?.trim():null);
   if(!phonetic){
    unresolved.push({itemId:item.itemId,word:item.word,reason:!source?'source-not-bound':!original?'source-identity-mismatch':original.phonetic&&original.phoneticScope&&original.phoneticScope!=='term'?'partial-phonetic-scope':'source-phonetic-missing'});continue;
   }
   const priorRevision=item.contentRevision;item.phonetic=phonetic;
   const {contentRevision,...body}=item;item.contentRevision=jsonHash(body);
   book.items.find(ref=>ref.itemId===item.itemId).contentRevision=item.contentRevision;
   changes.push({itemId:item.itemId,word:item.word,phonetic:item.phonetic,priorRevision,contentRevision:item.contentRevision,sourceFile:reviewed?.sourceFile||source.file,sourceSha256:reviewed?.sourceSha256||evidence.sourceSha256});
  }
  if(changes.length){book.revision=jsonHash(book.items);candidate.published=false;packages.push({directory:dir,candidate});}
  books.push({bookId:id,title:book.title,total:book.itemCount,missingBefore:changes.length+unresolved.length,recoverable:changes.length,sourceFile:source?.file||null,sourceSha256:evidence?.sourceSha256||null,baseReleaseId:base.releaseId,changes,unresolved});
 }
 const builtinIndex=path.join(appRoot,'content/vocabulary/index.json');
 if(fs.existsSync(builtinIndex))for(const book of JSON.parse(fs.readFileSync(builtinIndex)).books){
  if(books.some(row=>row.bookId===book.bookId))continue;
  const unresolved=book.items.map(ref=>JSON.parse(fs.readFileSync(path.join(appRoot,'content/vocabulary/items',ref.itemId.replace(/:/g,'_')+'.json')))).filter(item=>!item.phonetic?.trim()).map(item=>({itemId:item.itemId,word:item.word,reason:'source-not-bound'}));
  books.push({bookId:book.bookId,title:book.title,total:book.itemCount,missingBefore:unresolved.length,recoverable:0,changes:[],unresolved});
 }
 const report={format:'wordbook-phonetics-repair-draft',schemaVersion:1,published:false,books,totals:{books:books.length,items:books.reduce((n,b)=>n+b.total,0),missingBefore:books.reduce((n,b)=>n+b.missingBefore,0),recoverable:books.reduce((n,b)=>n+b.recoverable,0),unresolved:books.reduce((n,b)=>n+b.unresolved.length,0)}};
 fs.mkdirSync(output,{recursive:true});
 for(const entry of packages){const folder=path.join(output,entry.directory);fs.mkdirSync(folder);fs.writeFileSync(path.join(folder,'candidate.json'),JSON.stringify(entry.candidate,null,2)+'\n',{flag:'wx'});}
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 fs.writeFileSync(path.join(output,'report.md'),'# 单词课程音标核查与修复草稿\n\n未发布；现有课程、历史版本和学习记录均未修改。只恢复原始教材完整音标或已确认且通过哈希核验的资产包音标。\n\n| 课程 | 词条 | 缺失 | 可恢复 | 待补充/核验 |\n|---|---:|---:|---:|---:|\n'+books.map(book=>'| '+book.title+' | '+book.total+' | '+book.missingBefore+' | '+book.recoverable+' | '+book.unresolved.length+' |').join('\n')+'\n\n每项修改的来源、哈希、旧版与新版内容摘要详见 report.json。各目录中的 candidate.json 为独立修复包，未激活。\n',{flag:'wx'});
 return report;
}
if(require.main===module){
 const args=process.argv.slice(2),value=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
 try{const output=value('--output');if(!output)throw Error('需要 --output 新目录');const report=prepare({publishedRoot:path.resolve(value('--published-root','server/data/wordbook-publications')),sourceRoot:path.resolve(value('--source-root','output/textbook-extractions')),output:path.resolve(output),phoneticsPackages:args.flatMap((arg,i)=>arg==='--phonetics-package'?[path.resolve(args[i+1])]:[])});console.log(JSON.stringify(report.totals));}catch(error){console.error(error);process.exitCode=1;}
}
module.exports={prepare};
