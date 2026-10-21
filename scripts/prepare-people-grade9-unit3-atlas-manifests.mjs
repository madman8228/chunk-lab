import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const relative='output/textbook-extractions/people-grade9-full-2013-20261015/unit3-pilot';
const draft=JSON.parse(fs.readFileSync(path.join(root,relative,'wordbook-draft.json'),'utf8'));
const slug=word=>word.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const batches=[];
for(let start=4;start<draft.items.length;start+=4){
  const cells=draft.items.slice(start,start+4).map((item,i)=>({position:['top-left','top-right','bottom-left','bottom-right'][i],word:item.word,itemId:item.itemId,slug:slug(item.word)}));
  const batchId=`unit3-batch${String(Math.floor(start/4)+1).padStart(2,'0')}-${cells.map(x=>x.slug).join('-')}-v1`;
  const file=`batch-${String(Math.floor(start/4)+1).padStart(2,'0')}-atlas.json`;
  const manifest={batchId,unit:3,version:1,styleReference:'ref/words-pic/split/masters/connect-with-v2.png',draft:`${relative}/wordbook-draft.json`,cells};
  const target=path.join(root,relative,file);
  fs.writeFileSync(target,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  batches.push({file,batchId,words:cells.map(x=>x.word)});
}
console.log(JSON.stringify({created:batches.length,batches},null,2));
