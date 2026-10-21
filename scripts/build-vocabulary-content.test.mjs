import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildVocabularyContent} from './build-vocabulary-content.mjs';
if(!fs.existsSync('assets/vocabulary-decide-wide-v2.avif')){console.log('SKIP: vocabulary pilot assets is not present in this checkout (private fixture)');process.exit(0);}

const root=fileURLToPath(new URL('..',import.meta.url));
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'vocabulary-content-test-'));
try{
  const index=buildVocabularyContent(temporary);
  const book=index.books.find(entry=>entry.bookId==='pilot-six-v1');
  assert.ok(book);
  assert.equal(book.itemCount,6);
  for(const ref of book.items){
    const item=JSON.parse(fs.readFileSync(path.join(temporary,'items',ref.itemId.replace(/:/g,'_')+'.json'),'utf8'));
    const existing=JSON.parse(fs.readFileSync(path.join(root,'content/vocabulary/items',ref.itemId.replace(/:/g,'_')+'.json'),'utf8'));
    assert.deepEqual(item,existing,'existing pilot artwork and revision identity must not be silently migrated');
    for(const image of new Set([...item.images.wide,...item.images.mobile])){
      const bytes=fs.statSync(path.join(root,image)).size;
      assert.ok(bytes>0&&bytes<20000,`${item.word} image and fallback must be below 20,000 bytes`);
    }
  }
  console.log('Vocabulary content builder: six existing lessons retain artwork/revisions; each delivery and fallback is budget-checked.');
}finally{
  fs.rmSync(temporary,{recursive:true,force:true});
}
