'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function audit({publishedRoot,allowlist,scope}){
 const versions=require('../server/services/public-wordbook-versions').createPublicWordbookVersions({publishedRoot});
 const allowed=new Map(allowlist.map(row=>[row.bookId+'\n'+row.itemId,row]));
 const books=[],unexpected=[],missing=[];let items=0,us=0,gb=0;
 for(const bookId of scope){
  const metadata=versions.metadata(bookId),directory=versions.directory(bookId);
  const file=metadata.legacy?null:path.join(directory,'releases',metadata.releaseId,'package.json');
  const candidate=file?JSON.parse(fs.readFileSync(file,'utf8')):versions.current(bookId).candidate;
  if(file)assert.equal(hash(JSON.stringify(candidate)),metadata.releaseId);
  let bookMissing=0;
  for(const item of candidate.items){items++;if(item.phonetics?.['en-GB'])gb++;if(item.phonetics?.['en-US']){us++;continue;}
   const row={bookId,itemId:item.itemId,word:item.word,meaning:item.meaning};missing.push(row);bookMissing++;
   const exception=allowed.get(bookId+'\n'+item.itemId);if(!exception||exception.word!==item.word)unexpected.push(row);
  }
  books.push({bookId,items:candidate.items.length,missingUs:bookMissing,releaseId:metadata.releaseId});
 }
 return {books,items,usPhonetics:us,gbPhonetics:gb,missingUs:missing.length,unexpectedMissing:unexpected,missing,passed:unexpected.length===0};
}
if(require.main===module){
 require('../server/loadenv');const source=path.resolve(process.argv[2]),output=path.resolve(process.argv[3]);
 const report=JSON.parse(fs.readFileSync(path.join(source,'report.json'))),allowlist=JSON.parse(fs.readFileSync(path.join(source,'unresolved.json')));
 const result=audit({publishedRoot:path.join(path.resolve(process.env.CHUNKLAB_DATA_DIR||path.join(root,'server/data')),'wordbook-publications'),allowlist,scope:report.books.map(b=>b.bookId)});
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({passed:result.passed,books:result.books.length,items:result.items,usPhonetics:result.usPhonetics,missingUs:result.missingUs,unexpectedMissing:result.unexpectedMissing.length}));if(!result.passed)process.exitCode=1;
}
module.exports={audit};
