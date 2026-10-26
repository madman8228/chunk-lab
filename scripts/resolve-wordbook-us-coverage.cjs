'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),source=path.join(root,'output/wordbook-us-ipa-full-coverage-20261026-v1'),output=path.join(root,'output/wordbook-us-ipa-full-coverage-20261026-v2');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),hash=v=>crypto.createHash('sha256').update(v).digest('hex'),jh=v=>hash(JSON.stringify(v));
const choices={
 use:['juːz','verb: 用；使用'],or:['ɔːr','conjunction: 或者，不是 OR 缩写'],
 'jump rope':[['ˈdʒʌmp ˌroʊp','ˌdʒʌmp ˈroʊp'],'保留教材所列名词与动词两种用法'],
 perfect:['ˈpɝː.fekt','adjective: 完美的'],excuse:['ɪkˈskjuːz','verb: 原谅'],progress:['ˈprɑː.ɡres','noun: 进步'],wind:['wɪnd','noun: 风'],
 inside:['ˌɪnˈsaɪd','preposition: 在……里面'],process:['ˈprɑː.ses','noun: 过程'],record:['rɪˈkɔːrd','verb: 记录'],subject:['ˈsʌb.dʒekt','noun: 学科'],minute:['ˈmɪn.ɪt','noun: 分钟'],
 increase:['ɪnˈkriːs','verb: 增加'],direct:['dɪˈrekt','adjective: 直接的；使用该分区首列美式读音'],address:['ˈæd.res','noun: 地址'],wound:['wuːnd','伤口/受伤，不是 wind 的过去式'],recall:['rɪˈkɑːl','verb: 回忆起'],bow:['baʊ','鞠躬，不是蝴蝶结'],Cali:['ˈkɑː.li','哥伦比亚城市，不是加州昵称'],rather:['ˈræð.ɚ','adverb: 相当'],graduate:['ˈɡrædʒ.u.eɪt','verb: 毕业'],project:['ˈprɑː.dʒekt','noun: 项目'],because:['bɪˈkʌz','conjunction: 因为；使用该分区首列美式读音'],close:['kloʊz','verb: 关闭'],tear:['tɪr','noun: 眼泪'],essay:['ˈes.eɪ','noun: 文章'],object:['ˈɑːb.dʒekt','noun: 物品；宾语'],upset:['ʌpˈset','adjective: 难过的'],desert:['ˈdez.ɚt','noun: 沙漠'],refuse:['rɪˈfjuːz','verb: 拒绝'],live:['lɪv','verb: 居住'],contest:['ˈkɑːn.test','noun: 比赛']
};
function run(){
 if(fs.existsSync(output))throw Error('Use a new resolution version');fs.mkdirSync(output);
 const report=read(path.join(source,'report.json')),unresolved=read(path.join(source,'unresolved.json')),ordinals=read(path.join(source,'ordinal-lookups.json'));
 const priorChanges=read(path.join(source,'changes.json')).map(x=>({...x,sourcePath:path.resolve(source,x.sourcePath)})),extra=[],books=[],remaining=[];
 for(const b of report.books){
  const candidate=read(path.join(source,b.path));let additions=0;
  for(const item of candidate.items){
   if(item.phonetics?.['en-US'])continue;
   let row=unresolved.find(x=>x.bookId===b.bookId&&x.itemId===item.itemId),choice=choices[item.word],rationale,definition;
   if(item.word==='read')choice=[item.phonetics?.['en-GB']==='/red/'?'red':'riːd','教材将原形与过去式分项，保持教材词义及已确认英式读音的时态区别'];
   if(item.word==='present')choice=[item.meaning.includes('展现')?['ˈprez.ənt','prɪˈzent']:'ˈprez.ənt','保留教材列出的名词/形容词与动词用法'];
   if(item.word==='separate')choice=[['ˈsep.ɚ.ət','ˈsep.ə.reɪt'],'保留教材列出的形容词与动词用法'];
   const ordinal=ordinals.find(x=>x.word===item.word);
   if(ordinal){row=ordinal.lookup;choice=row.status==='single-us-reading'?[row.readings[0],ordinal.normalization]:ordinal.term==='second'?['ˈsek.ənd','ordinal number: second；不取动词 second 的不同读音']:undefined;definition=path.join(source,'sources','definition-'+ordinal.term+'.html.gz');}
   else definition=path.join(source,'sources','definition-'+item.word.replaceAll(' ','-')+'.html.gz');
   if(!choice||!row?.sameHeadword||(!ordinal&&!fs.existsSync(definition))){remaining.push({...row,bookId:b.bookId,itemId:item.itemId,word:item.word,meaning:item.meaning,example:item.example});continue;}
   const raws=Array.isArray(choice[0])?choice[0]:[choice[0]];for(const raw of raws)assert.ok(row.readings.includes(raw),item.word+': selected reading must be present in the exact source');
   const sourceFile=path.resolve(source,row.sourcePath);assert.equal(hash(fs.readFileSync(sourceFile)),row.sourceSha256);
   const previousRevision=item.contentRevision,raw=raws.map(x=>'/'+x+'/').join('; ');item.phonetics={...item.phonetics,'en-US':raw.replace(/\./g,'')};
   const {contentRevision,...body}=item;item.contentRevision=jh(body);candidate.index.books[0].items.find(x=>x.itemId===item.itemId).contentRevision=item.contentRevision;
   extra.push({bookId:b.bookId,itemId:item.itemId,word:item.word,meaning:item.meaning,example:item.example,sourceURL:row.url,sourcePath:sourceFile,sourceSha256:row.sourceSha256,...(fs.existsSync(definition)?{definitionPath:definition,definitionSha256:hash(fs.readFileSync(definition))}:{}),cambridgeUsRaw:raw,cambridgeUsDisplay:item.phonetics['en-US'],rationale:choice[1],sourceContentRevision:previousRevision,contentRevision:item.contentRevision});additions++;
  }
  candidate.index.books[0].revision=jh(candidate.index.books[0].items);require('../js/vocabulary-study.cjs').validateIndex(candidate.index);for(const item of candidate.items)require('../js/vocabulary-course-contract').validateLearning(item,require('../landing/sentence-cloze-engine'));
  const folder=path.dirname(b.path);fs.mkdirSync(path.join(output,folder),{recursive:true});const bytes=JSON.stringify(candidate,null,2)+'\n';fs.writeFileSync(path.join(output,b.path),bytes,{flag:'wx'});books.push({...b,additions:b.additions+additions,semanticAdditions:additions,candidateSha256:hash(bytes)});
 }
 const changes=[...priorChanges,...extra],summary={books:books.length,items:4214,missingBefore:1638,added:changes.length,missingAfter:remaining.length,usPhonetics:4214-remaining.length,semanticOrOrdinalAdditions:extra.length};
 const write=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 write('report.json',{...report,summary,books,status:'source-verified-corrective-supplement',sourcePolicy:'Cambridge original only; owner explicitly retained unlisted entries'});write('changes.json',changes);write('semantic-review.json',extra);write('unresolved.json',remaining);write('authorization.json',{ownerStatements:['全部补充上？有什么困难么？','仅用剑桥原标，未收录项保留'],scope:'Correct missing US phonetics in the 20 system built-in textbook courses; no generated phonetics, no account changes',date:'2026-10-26'});
 console.log(JSON.stringify(summary));
}
if(require.main===module)run();
