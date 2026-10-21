'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createVocabularyContent}=require('./services/vocabulary-content');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'wordbook-index-scale-'));
const nativeExists=fs.existsSync,nativeRead=fs.readFileSync;
try{
  const directory=path.join(temp,'content/vocabulary');fs.mkdirSync(directory,{recursive:true});
  const items=Array.from({length:10000},(_,i)=>({itemId:'sense-'+i,contentRevision:'b'.repeat(64)}));
  fs.writeFileSync(path.join(directory,'index.json'),JSON.stringify({schemaVersion:1,books:[{bookId:'scale-fixture',revision:'a'.repeat(64),title:'隔离规模夹具',itemCount:items.length,items}]}));
  // Virtual item files let this fixture prove lazy body access without creating
  // ten thousand artifacts. Any attempt to read a body fails the test.
  let indexReads=0,bodyReads=0;
  fs.existsSync=function(file){return path.dirname(String(file))===path.join(directory,'items')||nativeExists(file);};
  fs.readFileSync=function(file,...args){if(path.dirname(String(file))===path.join(directory,'items')){bodyReads++;throw Error('A metadata request must not read project bodies');}if(String(file)===path.join(directory,'index.json'))indexReads++;return nativeRead(file,...args);};
  const content=createVocabularyContent({appRoot:temp});
  const first=content.page('scale-fixture',0,20),last=content.page('scale-fixture',9980,20);
  assert.equal(first.items.length,20);assert.equal(first.nextOffset,20);assert.equal(last.nextOffset,null);assert.equal(last.items.length,20);
  assert.ok(first.items.every(ref=>!('exercise' in ref)&&!('images' in ref)));assert.equal(bodyReads,0);assert.equal(indexReads,1);
  assert.throws(()=>content.page('scale-fixture',0,51));
  console.log('vocabulary content scale: temporary 10000-project index, bounded metadata pages and zero body reads passed');
}finally{
  fs.existsSync=nativeExists;fs.readFileSync=nativeRead;
  assert.equal(path.dirname(temp),os.tmpdir());assert.ok(path.basename(temp).startsWith('wordbook-index-scale-'));fs.rmSync(temp,{recursive:true,force:true});
}
