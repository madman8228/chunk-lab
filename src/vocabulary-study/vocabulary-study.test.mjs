import test from 'node:test';
import assert from 'node:assert/strict';
import {validateIndex,pageBook,pageBounds} from './content-model.mjs';
import {nextCursor} from './session-model.mjs';
import {selectHomeResume,resumeHref} from './home-resume.mjs';
test('ten thousand stable project references stay paginated without bodies',()=>{
  const book={bookId:'test',revision:'a'.repeat(64),title:'测试夹具',itemCount:10000,items:Array.from({length:10000},(_,i)=>({itemId:'sense-'+i,contentRevision:'b'.repeat(64)}))};
  validateIndex({schemaVersion:1,books:[book]});assert.equal(pageBook(book,0,20).items.length,20);assert.equal(pageBook(book,9980,20).nextOffset,null);
  assert.throws(()=>pageBounds(-1,20));assert.throws(()=>pageBounds(0,51));assert.deepEqual(nextCursor(book,'sense-9999'),{itemId:null,status:'completed'});
  assert.throws(()=>nextCursor(book,'unknown'));assert.throws(()=>validateIndex({schemaVersion:1,books:[book,book]}));
  const distinct={...book,itemCount:2,items:[{itemId:'sense-one:borrow',contentRevision:'a'.repeat(64)},{itemId:'sense-two:borrow',contentRevision:'b'.repeat(64)}]};
  validateIndex({schemaVersion:1,books:[distinct]});
  assert.throws(()=>validateIndex({schemaVersion:1,books:[{...distinct,items:[{itemId:'one:borrow',contentRevision:'a'.repeat(64)},{itemId:'one_borrow',contentRevision:'b'.repeat(64)}]}]}),/文件身份冲突/);
});
test('home resumes select confirmed activity time without treating completed books as active',()=>{
  assert.equal(selectHomeResume({serverTime:10},{a:{bookId:'six',itemId:'one',status:'active',serverTime:20}}).toolId,'vocabulary');
  assert.equal(selectHomeResume({serverTime:30},{a:{bookId:'six',itemId:null,status:'completed',serverTime:40}}).toolId,'chunks');
  const selected=selectHomeResume(null,{old:{bookId:'six',itemId:'one',status:'active',serverTime:20},dictation:{bookId:'six',itemId:'two',status:'active',serverTime:30,practiceType:'word-dictation',unitId:'u:1',structureRevision:'rev'}});
  assert.equal(selected.practiceType,'word-dictation');assert.equal(resumeHref(selected),'wordbook.html?book=six&unit=u%3A1&structureRevision=rev&practice=word-dictation');
  assert.equal(resumeHref({bookId:'six'}),'wordbook.html?book=six');assert.equal(resumeHref({bookId:'six',practiceType:'guided-expression'}),'wordbook.html?book=six');
  assert.equal(resumeHref({bookId:'six',practiceType:'word-choice'}),'wordbook.html?book=six&practice=word-choice');
  assert.equal(resumeHref({bookId:'six',unitId:'u1',structureRevision:'rev',practiceType:'chunk-order'}),'wordbook.html?book=six&unit=u1&structureRevision=rev&practice=chunk-order');
});
