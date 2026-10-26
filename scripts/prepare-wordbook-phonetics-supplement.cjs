'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {key}=require('./supplement-wordbook-phonetics.cjs');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex'),jsonHash=value=>hash(JSON.stringify(value));
function dictionary(bytes){const result=new Map();for(const line of bytes.toString('utf8').split(/\r?\n/)){const tab=line.indexOf('\t');if(tab>0)result.set(key(line.slice(0,tab)),[...line.slice(tab+1).matchAll(/\/([^/]+)\//g)].map(match=>match[1]));}return result;}
function notation(ipa){
 ipa=ipa.replaceAll('ɹ','r').replaceAll('ɫ','l');
 const vowels=ipa.match(/eɪ|aɪ|ɔɪ|aʊ|oʊ|əʊ|[aeiouɑɒæəɛɝɪʊɔʌɚɜ]/g)||[];
 return vowels.length===1?ipa.replace(/[ˈˌ]/g,''):ipa;
}
const contextual={use:'juːz',perfect:'ˈpɝfɪkt',excuse:'ɪkˈskjuːz',progress:'ˈprɑɡres',wind:'wɪnd',record:'rɪˈkɔrd',subject:'ˈsʌbdʒɪkt',minute:'ˈmɪnɪt',tear:'tɪr',object:'ˈɑbdʒekt',desert:'ˈdezərt',refuse:'rɪˈfjuːz',bow:'baʊ',live:'lɪv',windy:'ˈwɪndi',contest:'ˈkɑntest',nice:'naɪs',africa:'ˈæfrɪkə',african:'ˈæfrɪkən',america:'əˈmerɪkə',american:'əˈmerɪkən',antarctica:'ænˈtɑrktɪkə',kenya:'ˈkenjə',moscow:'ˈmɑskoʊ',cali:'ˈkɑli',un:'ˌjuːˈen',dr:'ˈdɑktər',as:'æz',job:'dʒɑb',are:'ɑr',am:'æm',"i'm":'aɪm',"don't":'doʊnt',"what's":'wʌts',"it's":'ɪts'};
Object.assign(contextual,{lead:'liːd',used:'juːzd',close:'kloʊz',reuse:'ˌriːˈjuːz',reading:'ˈriːdɪŋ',lower:'ˈloʊər',museum:'mjuˈziːəm',between:'bɪˈtwiːn',kilometre:'kɪˈlɑmətər',located:'ˈloʊkeɪtɪd',differently:'ˈdɪfrəntli',effect:'ɪˈfekt',piano:'piˈænoʊ',regular:'ˈreɡjələr',calm:'kɑm',palm:'pɑm',advice:'ədˈvaɪs',advise:'ədˈvaɪz',around:'əˈraʊnd',last:'læst',most:'moʊst',next:'nekst',thousand:'ˈθaʊzənd',dentist:'ˈdentɪst',twenty:'ˈtwenti',twentieth:'ˈtwentiəθ',postcard:'ˈpoʊstkɑrd',plenty:'ˈplenti',fantasy:'ˈfæntəsi',recently:'ˈriːsəntli',international:'ˌɪntərˈnæʃənəl',enter:'ˈentər',gentle:'ˈdʒentəl',gentleman:'ˈdʒentəlmən',question:'ˈkwestʃən',somebody:'ˈsʌmbədi',new:'nuː',news:'nuːz',duty:'ˈduːti',what:'wʌt',which:'wɪtʃ',where:'wer',why:'waɪ',white:'waɪt',whale:'weɪl',when:'wen',whether:'ˈweðər',enough:'ɪˈnʌf',tomato:'təˈmeɪtoʊ',tomatoes:'təˈmeɪtoʊz',february:'ˈfebruˌeri',july:'dʒuˈlaɪ',august:'ˈɔɡəst',secret:'ˈsiːkrɪt',good:'ɡʊd',tv:'ˌtiːˈviː'});
const letters={a:'eɪ',b:'biː',c:'siː',d:'diː',e:'iː',f:'ef',g:'dʒiː',h:'eɪtʃ',i:'aɪ',j:'dʒeɪ',k:'keɪ',l:'el',m:'em',n:'en',o:'oʊ',p:'piː',q:'kjuː',r:'ɑr',s:'es',t:'tiː',u:'juː',v:'viː',w:'ˈdʌbəljuː',x:'eks',y:'waɪ',z:'ziː'};
function transcribe(item,{us,gb,manual}){
 const word=key(item.word),evidence=[];
 function lookup(raw,dialect){
  const token=key(raw),context=item.word+' '+(item.meaning||'')+' '+(item.example||'');
  if(dialect==='en-US'){
   let selected=contextual[token];
   if(token==='read')selected=/过去|yesterday|last\s+(?:night|week|year)|\bhad\b/i.test(context)?'red':'riːd';
   if(token==='lead')selected=/铅/.test(item.meaning)?'led':'liːd';
   if(token==='used'&&/\bused to\b/.test(word))selected='juːst';
   if(token==='close')selected=/draw to a close/.test(word)||/近|亲密/.test(item.meaning)?'kloʊs':'kloʊz';
   if(token==='use'&&/make use of/i.test(item.word))selected='juːs';
   if(selected){evidence.push({token,kind:'editorial-sense-selection',reference:'https://en.wiktionary.org/wiki/'+encodeURIComponent(token),context:item.meaning,status:'pending-content-review'});return selected;}
   if(manual[token]){const [ipa,kind,reference]=manual[token];evidence.push({token,kind,reference,status:'pending-content-review'});return ipa;}
  }
  const values=(dialect==='en-US'?us:gb).get(token);
  if(!values?.length)throw Error('缺少 '+dialect+' 词项：'+token);
  evidence.push({token,kind:'dictionary-entry',dialect,variants:values});return notation(values[0]);
 }
 const special={
  'separate':'adj. /ˈsepərət/；v. /ˈsepəreɪt/',
  'present':'n./adj. /ˈprezənt/；v. /prɪˈzent/',
  'foot (feet)':'/fʊt/（复数 feet /fiːt/）',
  're (email)':'/riː/',
  "would ('d) like to":'/wʊd (d) laɪk tuː/',
  'sham el-nessim':'/ˌʃæm el nəˈsiːm/'
 };
 if(['IT','AI','US','UN','TV','USA','UK','NBA','CBA','PRC','VR','CPC','PLA','RSVP','OK'].includes(item.word))return {phonetic:'美 /'+[...item.word.toLowerCase()].map(letter=>letters[letter]).join(' ')+'/',dialect:'en-US',method:'initialism',evidence:[{token:item.word,reference:'https://en.wiktionary.org/wiki/'+item.word,status:'pending-content-review'}]};
 if(item.word==='AM'||/^a\.m\.?$/i.test(item.word))return {phonetic:'美 /ˌeɪˈem/',dialect:'en-US',method:'abbreviation-expansion',evidence:[{reference:'https://en.wiktionary.org/wiki/a.m.'}]};
 if(item.word==='PM'||/^p\.m\.?$/i.test(item.word))return {phonetic:'美 /ˌpiːˈem/',dialect:'en-US',method:'abbreviation-expansion',evidence:[{reference:'https://en.wiktionary.org/wiki/p.m.'}]};
 if(special[word])return {phonetic:'美 '+special[word],dialect:'en-US',method:'editorial-context-transcription',evidence:[{reference:'https://en.wiktionary.org/wiki/'+encodeURIComponent(word.split(' ')[0]),context:item.meaning,status:'pending-content-review'}]};
 let text=word.replace(/\s*\(\d+(?:st|nd|rd|th)\)/g,'').replace(/\bsb(?:'s)?\.?/g,value=>value.includes("'")?"somebody's":'somebody').replace(/\bsth\.?/g,'something');
 const aliases=text.match(/^(father|mother|grandfather|grandmother)\s*\(([^)]+)\)$/);
 let variants=aliases?[aliases[1],aliases[2]]:text.split(/\s+\/\s+/);
 for(let at=0;at<variants.length;at++){
  const match=variants[at].match(/[^\s()/]+(?:\/[^\s()/]+)+/);if(!match)continue;
  const current=variants.splice(at,1)[0];variants.splice(at,0,...match[0].split('/').map(option=>current.replace(match[0],option)));at--;
  if(variants.length>8)throw Error('短语替代形式过多：'+item.word);
 }
 function phrase(value,dialect){
  const direct=(dialect==='en-US'?us:gb).get(value);
  if(direct?.length&&!contextual[value]&&value!=='read'&&!manual[value]){evidence.push({token:value,kind:'dictionary-entry',dialect,variants:direct});return notation(direct[0]);}
  return value.replace(/\.{2,}|…/g,' … ').replace(/([()])/g,' $1 ').replace(/[–—-]/g,' ').split(/\s+/).filter(Boolean).map(token=>{
   if(['(',')','…'].includes(token))return token;
   return lookup(token.replace(/^[.,!?;:]+|[.,!?;:]+$/g,''),dialect);
  }).join(' ').replace(/\(\s+/g,'(').replace(/\s+\)/g,')');
 }
 for(const dialect of ['en-US','en-GB']){
  evidence.length=0;
  try{const values=variants.map(value=>phrase(value,dialect)),phonetic=(dialect==='en-US'?'美 ':'英 ')+values.map(value=>'/'+value+'/').join('；');if(phonetic.length>200)throw Error('音标超过200字符');return {phonetic,dialect,method:variants.length>1?'alternative-forms':word.includes(' ')?'phrase-citation-transcription':'dictionary-entry',evidence:[...evidence]};}catch(error){if(dialect==='en-GB')return {error:error.message};}
 }
}
function prepare({sources,output,editorial,publishedRoot,appRoot=path.resolve(__dirname,'..')}){
 throw Error('旧版逐词拼接/默认美式补充流程已停用。请使用 repair-textbook-phonetics-standard.cjs 保留教材原标，并逐课程核验缺项；不得发布旧补充稿。');
 if(fs.existsSync(output))throw Error('请选择新的完整修订输出目录');
 const plan=JSON.parse(fs.readFileSync(path.join(sources,'source-plan.json'))),baseReport=JSON.parse(fs.readFileSync(path.join(plan.base,'report.json')));
 const usBytes=fs.readFileSync(path.join(sources,'en_US.txt')),gbBytes=fs.readFileSync(path.join(sources,'en_UK.txt'));
 if(hash(usBytes)!==plan.americanDictionary.sha256||hash(gbBytes)!==plan.dictionary.sha256)throw Error('音标词典摘要不一致');
 const lookup={us:dictionary(usBytes),gb:dictionary(gbBytes),manual:JSON.parse(fs.readFileSync(editorial)).entries};
 const versions=require('../server/services/public-wordbook-versions').createPublicWordbookVersions({publishedRoot}),books=[],packages=[];
 for(const prior of baseReport.books){
  let candidate;
  if(prior.baseReleaseId){const base=versions.current(prior.bookId);if(base.releaseId!==prior.baseReleaseId)throw Error('课程版本已变化，请重新核查：'+prior.bookId);candidate=structuredClone(base.candidate);}
  else{const index=JSON.parse(fs.readFileSync(path.join(appRoot,'content/vocabulary/index.json'))),book=index.books.find(row=>row.bookId===prior.bookId);candidate={format:'wordbook-prepared-package',schemaVersion:1,index:{schemaVersion:1,books:[book]},items:book.items.map(ref=>JSON.parse(fs.readFileSync(path.join(appRoot,'content/vocabulary/items',ref.itemId.replace(/:/g,'_')+'.json')))),published:false};}
  const book=candidate.index.books[0],restored=new Map(prior.changes.map(change=>[change.itemId,change])),changes=[],unresolved=[];
  for(const item of candidate.items){
   if(item.phonetic?.trim())continue;
   const source=restored.get(item.itemId),result=source?{phonetic:source.phonetic,method:'restored-textbook-or-approved-source',evidence:[source]}:transcribe(item,lookup);
   if(result.error){unresolved.push({itemId:item.itemId,word:item.word,meaning:item.meaning,error:result.error});continue;}
   const priorRevision=item.contentRevision;item.phonetic=result.phonetic;
   const {contentRevision,...body}=item;item.contentRevision=jsonHash(body);book.items.find(ref=>ref.itemId===item.itemId).contentRevision=item.contentRevision;
   changes.push({itemId:item.itemId,word:item.word,meaning:item.meaning,example:item.example,phonetic:item.phonetic,priorRevision,contentRevision:item.contentRevision,...result,status:source?'previously-source-verified':'pending-content-review'});
  }
  book.revision=jsonHash(book.items);candidate.published=false;
  packages.push({directory:jsonHash(prior.bookId),candidate});
  books.push({bookId:prior.bookId,title:book.title,total:book.itemCount,baseReleaseId:prior.baseReleaseId||null,changes,unresolved});
 }
 const report={format:'wordbook-phonetics-complete-draft',schemaVersion:1,published:false,sourcePlan:path.resolve(sources,'source-plan.json'),editorial:{file:path.resolve(editorial),sha256:hash(fs.readFileSync(editorial))},convention:'教材原标保留；新增优先美式，与现有 en-US 音频口音一致。短语为逐词词典式转写，不冒充连读听写；专名适应读法为待审草稿。',books,totals:{books:books.length,items:books.reduce((sum,book)=>sum+book.total,0),restored:books.reduce((sum,book)=>sum+book.changes.filter(row=>row.status==='previously-source-verified').length,0),supplemented:books.reduce((sum,book)=>sum+book.changes.filter(row=>row.status==='pending-content-review').length,0),unresolved:books.reduce((sum,book)=>sum+book.unresolved.length,0)}};
 fs.mkdirSync(output,{recursive:true});for(const entry of packages){fs.mkdirSync(path.join(output,entry.directory));fs.writeFileSync(path.join(output,entry.directory,'candidate.json'),JSON.stringify(entry.candidate,null,2)+'\n',{flag:'wx'});}
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 fs.writeFileSync(path.join(output,'review.md'),'# 全课程音标补充审看稿\n\n'+report.convention+'\n\n尚未发布；课程原件及学习记录未修改。\n\n| 课程 | 单词/短语 | 释义 | 音标 | 核对状态 |\n|---|---|---|---|---|\n'+books.flatMap(book=>book.changes.map(row=>'| '+[book.title,row.word,row.meaning,row.phonetic,row.status].map(value=>String(value).replaceAll('|','\\|')).join(' | ')+' |')).join('\n')+'\n',{flag:'wx'});
 const focus=books.flatMap(book=>book.changes.filter(row=>row.status==='pending-content-review'&&(row.method!=='dictionary-entry'||row.evidence.some(entry=>entry.status==='pending-content-review'||entry.variants?.length>1))).map(row=>({book:book.title,...row})));
 fs.writeFileSync(path.join(output,'priority-review.md'),'# 音标重点审看\n\n'+report.convention+'\n\n以下为专名、句义相关读法、缩写和短语组配；均未将新增内容标记为用户已批准。\n\n| 课程 | 单词/短语 | 释义 | 音标 | 方法 |\n|---|---|---|---|---|\n'+focus.map(row=>'| '+[row.book,row.word,row.meaning,row.phonetic,row.method].map(value=>String(value).replaceAll('|','\\|')).join(' | ')+' |').join('\n')+'\n',{flag:'wx'});
 return report;
}
if(require.main===module){const args=process.argv.slice(2),value=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;try{const report=prepare({sources:value('--sources'),output:value('--output'),editorial:value('--editorial','docs/source-materials/wordbook-phonetics-editorial-20261025.json'),publishedRoot:value('--published-root','server/data/wordbook-publications')});console.log(JSON.stringify(report.totals));if(report.totals.unresolved)process.exitCode=2;}catch(error){console.error(error);process.exitCode=1;}}
module.exports={prepare,transcribe,dictionary,notation};
