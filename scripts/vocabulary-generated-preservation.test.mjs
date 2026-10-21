import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildVocabularyContent} from './build-vocabulary-content.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'chunklab-vocabulary-preservation-'));
try{
  buildVocabularyContent(temp);
  const files=['index.json',...fs.readdirSync(path.join(temp,'items')).map(name=>'items/'+name)];
  assert.equal(files.length,7,'the existing six-word pilot keeps its identity and item count');
  for(const name of files){
    assert.ok(fs.readFileSync(path.join(temp,name)).equals(fs.readFileSync(path.join(root,'content/vocabulary',name))),
      'rebuilding must not migrate existing course content or revisions: '+name);
    if(name==='index.json')continue;
    const item=JSON.parse(fs.readFileSync(path.join(temp,name),'utf8'));
    for(const image of new Set([...item.images.wide,...item.images.mobile])){
      const size=fs.statSync(path.join(root,image)).size;
      assert.ok(size>0&&size<20000,'each existing delivery, including fallback, stays under 20,000 bytes');
    }
  }
  console.log('Vocabulary build: existing pilot files/revisions preserved byte-for-byte; all legacy deliveries under 20,000 bytes');
}finally{
  assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep));
  fs.rmSync(temp,{recursive:true,force:true});
}
