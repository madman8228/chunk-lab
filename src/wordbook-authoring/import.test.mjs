import test from 'node:test';
import assert from 'node:assert/strict';
import {identifyImport} from './model.mjs';
test('single entry distinguishes batches from complete books without mutation',()=>{
 const book={schemaVersion:1,book:{title:'全一册',units:[],catalog:{facets:{edition:'2013'}}},items:[]};
 assert.deepEqual(identifyImport(JSON.stringify(book)),{kind:'book',value:book});
 const batch={format:'wordbook-ai-batch',version:1,requestId:'test'};
 assert.equal(identifyImport(JSON.stringify(batch)).kind,'batch');
 assert.equal(book.book.catalog.facets.edition,'2013');
});
test('invalid or unrelated files are rejected',()=>{for(const raw of ['not json','{}','[]','null'])assert.throws(()=>identifyImport(raw));});
test('material course files use a distinct source-preserving import path',()=>{const value={format:'vocabulary-material-course-draft',schemaVersion:1,libraryRef:{libraryId:'fixture'}};assert.deepEqual(identifyImport(JSON.stringify(value)),{kind:'material-course',value});});
