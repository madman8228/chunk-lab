'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createVocabularyContent}=require('./services/vocabulary-content');
const {createPublicWordbookVersions}=require('./services/public-wordbook-versions');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'published-index-scale-'));
const nativeRead=fs.readFileSync;
try{
 const contentDir=path.join(temp,'content/vocabulary'),publishedRoot=path.join(temp,'publications');
 fs.mkdirSync(contentDir,{recursive:true});fs.writeFileSync(path.join(contentDir,'index.json'),JSON.stringify({schemaVersion:1,books:[]}));
 const versions=createPublicWordbookVersions({publishedRoot});
 for(let n=0;n<3;n++){
  const bookId='published-scale-'+n,body={itemId:'published-item-'+n,word:'word'};
  const item={...body,contentRevision:hash(body)},refs=[{itemId:item.itemId,contentRevision:item.contentRevision}];
  const index={schemaVersion:1,books:[{bookId,title:'隔离规模夹具',revision:hash(refs),itemCount:1,items:refs}]};
  const dir=versions.directory(bookId);fs.mkdirSync(path.join(dir,'items'),{recursive:true});
  fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(index));
  fs.writeFileSync(path.join(dir,'items',item.itemId+'.json'),JSON.stringify(item));
  const before=versions.current(bookId),nextBody={...body,word:'updated'},nextItem={...nextBody,contentRevision:hash(nextBody)},nextIndex=structuredClone(index);
  nextIndex.books[0].items[0].contentRevision=nextItem.contentRevision;nextIndex.books[0].revision=hash(nextIndex.books[0].items);
  const installed=versions.install({format:'wordbook-prepared-package',schemaVersion:1,index:nextIndex,items:[nextItem],published:false},{reviewId:'temporary-fixture'});
  versions.activate({bookId,expectedBaseReleaseId:before.releaseId,releaseId:installed.releaseId});
 }
 let bodyReads=0;
 fs.readFileSync=function(file,...args){if(path.basename(String(file))==='package.json'||path.basename(path.dirname(String(file)))==='items'){bodyReads++;throw Error('Metadata page eagerly reads whole published course bodies');}return nativeRead(file,...args);};
 const content=createVocabularyContent({appRoot:temp,publishedRoot,versions});
 const first=content.page('published-scale-0',0,20);
 assert.equal(first.items.length,1);assert.equal(content.page('published-scale-2',0,20).items.length,1);assert.equal(bodyReads,0);
 fs.readFileSync=nativeRead;
 const id='published-scale-0',active=versions.current(id),packageFile=path.join(versions.directory(id),'releases',active.releaseId,'package.json');
 const saved=fs.readFileSync(packageFile);fs.writeFileSync(packageFile,'{}');
 assert.throws(()=>content.item(first.items[0].itemId,first.items[0].contentRevision),/摘要或身份校验失败/,'Selected course must still undergo full integrity validation');
 fs.writeFileSync(packageFile,saved);
 const legacy=versions.readLegacy(id,versions.directory(id));
 versions.activate({bookId:id,expectedBaseReleaseId:active.releaseId,releaseId:legacy.releaseId,action:'rollback'});
 assert.equal(content.page(id,0,20).items[0].contentRevision,legacy.book.items[0].contentRevision,'Activation changes must invalidate metadata caches');
 console.log('published metadata pages: zero legacy or release body reads passed');
}finally{
 fs.readFileSync=nativeRead;
 // Preserve the isolated fixture for debugging; never use application data here.
 console.log('Isolated fixture: '+temp);
}
