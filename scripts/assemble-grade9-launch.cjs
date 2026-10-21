'use strict';
// Additive packaging only. Does not call the live app or alter approved drafts.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),base=path.join(root,'output/textbook-extractions/people-grade9-full-2013-20261015'),out=path.join(base,'whole-book-launch-v1');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8')),hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const source=read(path.join(out,'textbook-text-draft.json')),drafts=structuredClone(source.drafts),images=new Map(),audit=[];
for(let n=4;n<=14;n++){
 const folder=path.join(base,'unit'+n+'-images'),batches=new Map();
 for(const name of fs.readdirSync(folder).filter(n=>n.endsWith('.report.json'))){
  const report=read(path.join(folder,name)),key=name.match(/batch-(\d+)/)?.[1]||name,version=Number(report.batchId?.match(/-v(\d+)$/)?.[1]||1);
  if(!batches.has(key)||batches.get(key).version<version)batches.set(key,{report,version});
 }
 for(const {report} of batches.values())for(const cell of report.cells)images.set(cell.itemId,cell);
}
for(const n of [1,2]){
 const manifest=read(path.join(out,'repair-0'+n+'-manifest.json')),report=read(path.join(out,'repair-0'+n+'-manifest.report.json'));
 for(const cell of report.cells){
  const definition=manifest.cells.find(c=>c.itemId===cell.itemId&&c.word===cell.word&&c.position===cell.position);
  if(!definition)throw Error('Repair panel identity mismatch');
  images.set(cell.itemId,{...cell,scene:definition.scene,repair:true});
 }
}
// The retained scan p.169 lists first name Jason (p.98) and surname Hayes
// (p.102) separately; they are not one wrapped entry.
const unit13=drafts[12],jason=unit13.items.find(i=>i.word==='Jason Hayes');
if(!jason)throw Error('Expected retained Jason Hayes transcription');
jason.word='Jason';jason.meaning='贾森（男名）';jason.translation='他的名字是贾森。';jason.scene='教材名字识别；人物仅为示意插画。';
jason.exercise=require('../js/wordbook-draft').exercise('His first name is [Jason].');
const hayes={...structuredClone(jason),itemId:'pep-g9-2013-u13:49',word:'Hayes',meaning:'海斯（姓）',translation:'他的姓是海斯。',exercise:require('../js/wordbook-draft').exercise('His family name is [Hayes].')};
unit13.items.splice(unit13.items.indexOf(jason)+1,0,hayes);images.set(hayes.itemId,images.get(jason.itemId));
for(const draft of drafts)for(const item of draft.items){
 if(item.images.wide.length){for(const url of new Set([...item.images.wide,...item.images.mobile]))require('./lib/vocabulary-illustrations.cjs').inspect(root,url);continue;}
 const cell=images.get(item.itemId),file=cell?.files.find(f=>f.path.endsWith('.webp'));
 if(!file)throw Error('Missing illustration: '+item.word);
 const asset=require('./lib/vocabulary-illustrations.cjs').inspect(root,file.path);
 if(file.sha256&&asset.sha256!==file.sha256)throw Error('Illustration hash changed: '+item.word);
 item.images={wide:[file.path],mobile:[file.path]};if(cell.repair)item.scene=cell.scene;
 audit.push({itemId:item.itemId,word:item.word,path:file.path,sha256:asset.sha256,bytes:asset.bytes,repair:!!cell.repair,reviewer:'agent',reviewScope:'word-sense illustration; not a claim that every example action is depicted'});
}
const result={...source,drafts,units:drafts.flatMap(d=>d.book.units.map(u=>({...u,itemIds:d.items.filter(i=>i.unitId===u.unitId).map(i=>i.itemId)})))};
const assembled=require('../server/services/textbook-wordbook-package').assemble(result);
(async()=>{
 const prepared=await require('../js/wordbook-draft').compile(assembled,{requireImages:true});
 const files={'textbook-ready-v1.json':result,'illustration-bindings-v1.json':{sourceFingerprint:hash(fs.readFileSync(path.join(out,'textbook-text-draft.json'))),unitCount:14,itemCount:assembled.items.length,associations:audit,published:false},'prepared-validation-v1.json':{format:prepared.format,items:prepared.items.length,units:prepared.index.books[0].units.length,sourceCorrections:[{before:'Jason Hayes',after:['Jason','Hayes'],scan:'words-unit-p169.png',textbookPages:[98,102]}],published:false}};
 for(const name of Object.keys(files))if(fs.existsSync(path.join(out,name)))throw Error('Output already exists: '+name);
 for(const [name,value] of Object.entries(files))fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({items:prepared.items.length,units:14,associated:audit.length,package:path.join(out,'textbook-ready-v1.json'),published:false}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
