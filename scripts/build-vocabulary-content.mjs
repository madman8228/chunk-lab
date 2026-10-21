import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {validateIndex} from '../src/vocabulary-study/content-model.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),require=createRequire(import.meta.url);
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
// This already published pilot predates the shared-WebP delivery policy.
// Rebuilding code must not silently migrate its artwork or revision identity.
// New words still use the single shared 16:9 WebP delivery format.
const legacyPilotWords=new Set(['decide','borrow','advice','avoid','explain','enough']);
export function buildVocabularyContent(outDir=path.join(root,'content/vocabulary')) {
  const {lessons}=require('../landing/practice-content.js'),cloze=require('../landing/sentence-cloze-engine.js');
  const entries=lessons.map(lesson=>{
    cloze.validate(lesson.exercise);
    const url='assets/vocabulary-'+lesson.w+'-wide-v3.webp';
    const images=legacyPilotWords.has(lesson.w)
      ? {wide:['assets/vocabulary-'+lesson.w+'-wide-v2.avif','assets/vocabulary-'+lesson.w+'-wide-v2.webp'],
        mobile:['assets/vocabulary-'+lesson.w+'-mobile-v2.avif','assets/vocabulary-'+lesson.w+'-mobile-v2.webp']}
      : {wide:[url],mobile:[url]};
    for(const image of new Set([...images.wide,...images.mobile])){
      const bytes=fs.statSync(path.join(root,image)).size;
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
