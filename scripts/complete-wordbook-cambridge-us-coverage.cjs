'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {parseCambridgeUs,normalizeDisplay}=require('./build-wordbook-cambridge-us-ipa.cjs');
const contract=require('../js/vocabulary-course-contract'),model=require('../js/vocabulary-study.cjs'),engine=require('../landing/sentence-cloze-engine');
const root=path.resolve(__dirname,'..'),source=path.join(root,'output/wordbook-us-ipa-cambridge-20261026-v3'),output=path.join(root,'output/wordbook-us-ipa-full-coverage-20261026-v1');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex'),jsonHash=v=>hash(JSON.stringify(v));
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const write=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const text=h=>h.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&#39;|&#x27;/g,"'").replace(/&rsquo;/g,'’').trim();
const slug=w=>w.trim().replace(/['’]/g,'-').replace(/\s+/g,'-').replace(/[.!?]+$/,'').toLowerCase();
const matchingHeadword=(heading,word)=>{
 const normalized=w=>w.replace(/’/g,"'").replace(/[.!?]+$/,'').replace(/\s+/g,' ').trim();
 return normalized(heading).toLowerCase()===normalized(word).toLowerCase()&&(!/^[A-Z]{2,}$/.test(word)||heading===word);
};
async function lookup(word){
 const url='https://dictionary.cambridge.org/us/pronunciation/english/'+encodeURIComponent(slug(word));
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
   if(response.status===429||response.status>=500){await new Promise(r=>setTimeout(r,1000*(attempt+1)));continue;}
   if(!response.ok)return {word,url,status:'http-'+response.status,readings:[]};
   const html=await response.text(),heading=text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]||'').replace(/^English\s+pronunciation\s+of\s+/i,'');
   const sourceName=hash(word)+'.html.gz',compressed=zlib.gzipSync(html);
   fs.writeFileSync(path.join(output,'sources',sourceName),compressed,{flag:'wx'});
   const readings=parseCambridgeUs(html);
   const sameHeadword=matchingHeadword(heading,word);
   return {word,url,finalURL:response.url,heading,sourcePath:'sources/'+sourceName,sourceSha256:hash(compressed),sameHeadword,readings,status:!sameHeadword?'headword-mismatch':readings.length===1?'single-us-reading':readings.length?'multiple-us-readings':'no-us-reading'};
  }catch(error){if(attempt===2)return {word,url,status:'network-error',error:error.message,readings:[]};}
 }
 return {word,url,status:'retry-exhausted',readings:[]};
}
async function run(){
 const sourceReport=read(path.join(source,'report.json'));
 if(!fs.existsSync(output)){fs.mkdirSync(output);fs.mkdirSync(path.join(output,'sources'));write('run-state.json',{sourceReportSha256:hash(fs.readFileSync(path.join(source,'report.json'))),status:'running'});}
 const state=read(path.join(output,'run-state.json'));if(state.sourceReportSha256!==hash(fs.readFileSync(path.join(source,'report.json'))))throw Error('Source changed');
 if(state.status==='complete'){console.log(JSON.stringify(read(path.join(output,'report.json')).summary));return;}
 const books=sourceReport.books.map(book=>({...book,candidate:read(path.join(source,book.path))}));
 const missing=books.flatMap(b=>b.candidate.items.filter(i=>!i.phonetics?.['en-US']).map(i=>({bookId:b.bookId,itemId:i.itemId,word:i.word,meaning:i.meaning,example:i.example})));
 const words=[...new Set(missing.map(i=>i.word))],cacheFile=path.join(output,'lookups.jsonl'),cache=new Map();
 if(fs.existsSync(cacheFile))for(const line of fs.readFileSync(cacheFile,'utf8').split('\n').filter(Boolean)){const row=JSON.parse(line);cache.set(row.word,row);}
 const todo=words.filter(w=>!cache.has(w));let cursor=0,done=0;
 await Promise.all(Array.from({length:6},async()=>{while(cursor<todo.length){const word=todo[cursor++],row=await lookup(word);cache.set(word,row);fs.appendFileSync(cacheFile,JSON.stringify(row)+'\n');if(++done%50===0||done===todo.length)console.log('Whole-inventory lookups '+done+'/'+todo.length);await new Promise(r=>setTimeout(r,150));}}));
 const changes=[],unresolved=[],packages=[];
 for(const b of books){
  const c=b.candidate,original=structuredClone(c);let additions=0;
  for(const item of c.items){
   if(item.phonetics?.['en-US'])continue;
   const row=cache.get(item.word);
   if(row.status!=='single-us-reading'){unresolved.push({bookId:b.bookId,itemId:item.itemId,word:item.word,meaning:item.meaning,example:item.example,...row});continue;}
   const previousRevision=item.contentRevision,raw=row.readings[0];item.phonetics={...item.phonetics,'en-US':normalizeDisplay(raw)};
   const {contentRevision,...body}=item;item.contentRevision=jsonHash(body);c.index.books[0].items.find(x=>x.itemId===item.itemId).contentRevision=item.contentRevision;
   changes.push({bookId:b.bookId,itemId:item.itemId,word:item.word,meaning:item.meaning,example:item.example,sourceURL:row.url,sourcePath:row.sourcePath,sourceSha256:row.sourceSha256,cambridgeUsRaw:'/'+raw+'/',cambridgeUsDisplay:item.phonetics['en-US'],sourceContentRevision:previousRevision,contentRevision:item.contentRevision});additions++;
  }
  c.index.books[0].revision=jsonHash(c.index.books[0].items);c.published=false;model.validateIndex(c.index);for(const item of c.items)contract.validateLearning(item,engine);
  for(let n=0;n<c.items.length;n++){const strip=i=>{const x=structuredClone(i);delete x.contentRevision;delete x.phonetics['en-US'];return x;};if(JSON.stringify(strip(c.items[n]))!==JSON.stringify(strip(original.items[n])))throw Error('Unexpected non-US edit');}
  const dir='candidate-packages/'+jsonHash(b.bookId);fs.mkdirSync(path.join(output,dir),{recursive:true});const bytes=JSON.stringify(c,null,2)+'\n';fs.writeFileSync(path.join(output,dir,'candidate.json'),bytes,{flag:'wx'});
  packages.push({bookId:b.bookId,title:b.title,path:dir+'/candidate.json',candidateSha256:hash(bytes),baseCandidateSha256:hash(fs.readFileSync(path.join(source,b.path))),baseReleaseId:jsonHash(original),items:c.items.length,additions});
 }
 write('changes.json',changes);write('unresolved.json',unresolved);write('inventory.json',missing);
 const report={format:'wordbook-full-us-coverage-review',schemaVersion:1,published:false,source,scope:'Every actual missing en-US item in the 20 published textbook courses; no IPA-DICT eligibility filter',summary:{books:books.length,items:books.reduce((n,b)=>n+b.candidate.items.length,0),missingBefore:missing.length,uniqueWords:words.length,added:changes.length,missingAfter:unresolved.length,usPhonetics:4214-unresolved.length},books:packages};write('report.json',report);
 state.status='complete';fs.writeFileSync(path.join(output,'run-state.json'),JSON.stringify(state,null,2)+'\n');console.log(JSON.stringify(report.summary));
}
if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={slug,matchingHeadword,lookup,run};
