'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
module.exports=function createLegacyCourseFixture(root,options={}){
  const items=options.items||[{cid:'legacy-item-one',sentence:'A synthetic legacy course sentence.',translation:'合成原课程句子。',chunks:['A synthetic','legacy course sentence.'],hints:['合成的','原课程句子']},
    {cid:'legacy-item-two',sentence:'Keep every original learning record.',translation:'保留原学习记录。',chunks:['Keep','every original learning record.'],hints:['保留','原学习记录']}];
  const write=(relative,data)=>{const file=path.join(root,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);};
  const reference=(url,doc)=>{const bytes=Buffer.from(JSON.stringify(doc));write(url,bytes);return {url,mode:'replace',bytes:bytes.length,count:doc.items.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};};
  const shard=reference('content/legacy/current.json',{items});
  const index=reference('content/legacy/index.json',{items:items.map((item,sourceOffset)=>({cid:item.cid,sentence:item.sentence,sourceUrl:shard.url,sourceOffset}))});
  const manifest={schemaVersion:1,contentVersion:'legacy-fixture',decks:[{id:'legacy-deck',name:'合成原课程',totalCount:items.length}],
    catalog:{schemaVersion:1,version:'legacy-catalog',courses:[{id:'legacy-course',title:'合成原课程',origin:'builtin',contentType:'sentence',outline:[{id:'legacy-lesson',kind:'lesson',title:'原课节',contentRef:{type:'sentence-deck',id:'legacy-deck'}}]}]}};
  write('content/manifest.json',JSON.stringify(manifest));
  write('server/content/shards.json',JSON.stringify({schemaVersion:1,contentVersion:manifest.contentVersion,decks:[{id:'legacy-deck',shards:[shard],indexShards:[index]}]}));
  write('content/legacy/old.json',JSON.stringify({items}));
  write('content/legacy/old.json.gz',zlib.gzipSync(JSON.stringify({items})));
  write('legacy-source.js','window.DATA='+JSON.stringify(items)+';throw new Error("Inventory must not execute scripts");');
  return {items,manifest};
};
