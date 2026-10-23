'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createVocabularyContent}=require('./services/vocabulary-content');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'chunklab-retired-books-'));
try{
 const dir=path.join(root,'content/vocabulary');fs.mkdirSync(dir,{recursive:true});
 const book=id=>({bookId:id,title:id,revision:'a'.repeat(64),itemCount:1,items:[{itemId:id+'-item',contentRevision:'b'.repeat(64)}]});
 fs.writeFileSync(path.join(dir,'index.json'),JSON.stringify({schemaVersion:1,books:[book('keep'),book('retire')]}));
 const service=createVocabularyContent({appRoot:root});
 assert.equal(service.resources().length,2);
 fs.writeFileSync(path.join(dir,'retired-books.json'),JSON.stringify({schemaVersion:1,bookIds:['retire']}));
 assert.deepEqual(service.resources().map(row=>row.resourceId),['wordbook:keep']);
 assert.equal(service.book('retire').bookId,'retire','historical content remains readable for existing references');
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'index.json'))).books.length,2);
 console.log('wordbook retirement: directory removal and historical source preservation passed');
}finally{fs.rmSync(root,{recursive:true,force:true});}
