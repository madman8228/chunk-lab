import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {validateIndex} from '../src/vocabulary-study/content-model.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),require=createRequire(import.meta.url);
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
// The pilot now follows the shared-WebP delivery policy: one 16:9 WebP per word.
export function buildVocabularyContent(outDir=path.join(root,'content/vocabulary')) {
  const {lessons}=require('../landing/practice-content.js'),cloze=require('../landing/sentence-cloze-engine.js');
  const entries=lessons.map(lesson=>{
    cloze.validate(lesson.exercise);
    const url='assets/vocabulary-'+lesson.w+'-wide-v3.webp';
    const images={wide:[url],mobile:[url]};
    for(const image of new Set([...images.wide,...images.mobile])){
      const file=path.join(root,image);
      /* Course images live in the private chunk-lab-assets repository, not in
         the public checkout. Verify the budget wherever the asset is present;
         a clean CI checkout must still be able to build the content index. */
      if(!fs.existsSync(file))continue;
      const bytes=fs.statSync(file).size;
      if(bytes<=0||bytes>=20000)throw Error('词汇图片超预算：'+image+' '+bytes);
    }
    const item={itemId:'pilot-v1:'+lesson.w,word:lesson.w,meaning:lesson.meaning,scene:lesson.scene,example:lesson.example,
      translation:lesson.translation,exercise:lesson.exercise,images};
    return {...item,contentRevision:hash(item)};
  });
  const refs=entries.map(({itemId,contentRevision})=>({itemId,contentRevision}));
  const index=validateIndex({schemaVersion:1,books:[{bookId:'pilot-six-v1',revision:hash(refs),title:'六词练习',itemCount:refs.length,items:refs}]});
  fs.mkdirSync(path.join(outDir,'items'),{recursive:true});
  for(const item of entries)fs.writeFileSync(path.join(outDir,'items',item.itemId.replace(/:/g,'_')+'.json'),JSON.stringify(item,null,2)+'\n');
  fs.writeFileSync(path.join(outDir,'index.json'),JSON.stringify(index,null,2)+'\n');
  return index;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))buildVocabularyContent();
