'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const key=word=>word.replace(/[’‘]/g,"'").toLowerCase().replace(/\s+/g,' ').replace(/^[\s.,!?;:]+|[\s.,!?;:]+$/g,'');
function tokens(word){return key(word).replace(/\b\d+(?:st|nd|rd|th)\b/g,' ').replace(/\.{2,}|…/g,' ').replace(/\bsb(?:'s)?\.?/g,match=>match.includes("'")?"somebody's":'somebody').replace(/\bsth\.?/g,'something').replace(/[()/–—-]/g,' ').split(/\s+/).map(value=>value.replace(/^[.,!?;:]+|[.,!?;:]+$/g,'')).filter(Boolean);}
async function collect({base,output}){
 if(fs.existsSync(output))throw Error('请选择新的补充输出目录');
 const response=await fetch('https://api.github.com/repos/open-dict-data/ipa-dict/commits/master',{headers:{'User-Agent':'ChunkPracticePhonetics/1.0'},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('词典版本读取失败 '+response.status);
 const {sha}=await response.json();if(!/^[a-f0-9]{40}$/.test(sha))throw Error('词典版本身份无效');
 const read=async file=>{const url='https://raw.githubusercontent.com/open-dict-data/ipa-dict/'+sha+'/'+file,res=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!res.ok)throw Error('词典下载失败 '+res.status);return {url,bytes:Buffer.from(await res.arrayBuffer())};};
 const [data,american,license,readme]=await Promise.all([read('data/en_UK.txt'),read('data/en_US.txt'),read('LICENSE'),read('README.md')]);
 const dictionary=new Map();for(const line of data.bytes.toString('utf8').split(/\r?\n/)){const tab=line.indexOf('\t');if(tab<1)continue;dictionary.set(key(line.slice(0,tab)),line.slice(tab+1).trim());}
 const usDictionary=new Map();for(const line of american.bytes.toString('utf8').split(/\r?\n/)){const tab=line.indexOf('\t');if(tab<1)continue;usDictionary.set(key(line.slice(0,tab)),line.slice(tab+1).trim());}
 const report=JSON.parse(fs.readFileSync(path.join(base,'report.json'))),missing=new Map(),words=new Map();
 for(const book of report.books)for(const item of book.unresolved){const term=key(item.word);if(words.has(term))continue;const direct=dictionary.get(term)||usDictionary.get(term);const parts=tokens(item.word);const absent=direct?[]:parts.filter(part=>!dictionary.has(part)&&!usDictionary.has(part));for(const part of absent)missing.set(part,(missing.get(part)||0)+1);words.set(term,{word:item.word,direct:direct||null,dialect:dictionary.has(term)?'en-GB':usDictionary.has(term)?'en-US':null,parts,missing:absent});}
 fs.mkdirSync(output,{recursive:true});
 fs.writeFileSync(path.join(output,'en_UK.txt'),data.bytes,{flag:'wx'});fs.writeFileSync(path.join(output,'LICENSE'),license.bytes,{flag:'wx'});
 fs.writeFileSync(path.join(output,'en_US.txt'),american.bytes,{flag:'wx'});fs.writeFileSync(path.join(output,'README-source.md'),readme.bytes,{flag:'wx'});
 const metadata={format:'wordbook-phonetics-supplement-sources',schemaVersion:1,createdAt:new Date().toISOString(),dictionary:{name:'ipa-dict English UK',commit:sha,url:data.url,sha256:hash(data.bytes),license:'GPL-3.0 (ipacards dataset; upstream project code MIT)',licenseUrl:'https://github.com/leoboiko/ipacards'},americanDictionary:{name:'ipa-dict English US',commit:sha,url:american.url,sha256:hash(american.bytes),license:'MIT',licenseUrl:license.url},base:path.resolve(base),uniqueTerms:words.size,direct:[...words.values()].filter(row=>row.direct).length,composable:[...words.values()].filter(row=>!row.direct&&!row.missing.length).length,missing:[...missing].sort((a,b)=>b[1]-a[1]),words:[...words.values()]};
 fs.writeFileSync(path.join(output,'source-plan.json'),JSON.stringify(metadata,null,2)+'\n',{flag:'wx'});return metadata;
}
if(require.main===module){const args=process.argv.slice(2),value=key=>args[args.indexOf(key)+1];collect({base:value('--base'),output:value('--output')}).then(result=>console.log(JSON.stringify({unique:result.uniqueTerms,direct:result.direct,composable:result.composable,missingTokens:result.missing.length}))).catch(error=>{console.error(error);process.exitCode=1;});}
module.exports={collect,key,tokens};
