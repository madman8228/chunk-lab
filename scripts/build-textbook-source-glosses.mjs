import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const appRoot=path.resolve(import.meta.dirname,'..');
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const normalized=x=>String(x).toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
const corrections={
 'highschool-pep-required2-2019-unit5-absorbed':{headword:'absorbed in sth/sb',issue:'原配图清单截断短语；需复核图片是否表达“专心致志”。'},
 'highschool-pep-required3-2019-u1-in-spite':{headword:'in spite of',issue:'原配图清单漏掉短语末尾 of；需复核图义。'},
};
function createNew(file,value){const text=JSON.stringify(value,null,2)+'\n';if(fs.existsSync(file)){if(fs.readFileSync(file,'utf8')!==text)throw Error('已有文件内容不同，需创建新版本：'+file);}else fs.writeFileSync(file,text,{flag:'wx'});}
for(const volume of [1,2,3]){
 const courseId=`highschool-pep-required${volume}-2019`,root=path.join(appRoot,'output/textbook-extractions',courseId+'-20261016');
 const sourceFile=path.join(root,'source-glosses-v1.txt'),sourceText=fs.readFileSync(sourceFile,'utf8');
 let section;const source=[];
 for(const [index,line] of sourceText.split(/\r?\n/).entries()){
  if(!line.trim()||line.startsWith('#'))continue;
  if(line.startsWith('[')){const [unit,image,page,region]=line.slice(1,-1).split(';');section={unit,image:'source-images/'+image,printedPage:/^\d+$/.test(page)?Number(page):null,region:region||null};continue;}
  const separator=line.indexOf('|');if(separator<1||!section)throw Error(`格式错误 ${sourceFile}:${index+1}`);
  if(!fs.existsSync(path.join(root,section.image)))throw Error('来源扫描缺失：'+section.image);
  source.push({sourceHeadword:line.slice(0,separator),meaning:line.slice(separator+1),...section,sourceLine:index+1});
 }
 const records=[];
 for(const dir of fs.readdirSync(root).filter(n=>/^(welcome|unit\d+)-illustrations$/.test(n))){
  for(const filename of fs.readdirSync(path.join(root,dir)).filter(n=>/^batch-.*-atlas\.json$/.test(n)).sort()){
   const batch=JSON.parse(fs.readFileSync(path.join(root,dir,filename),'utf8'));
   for(const raw of batch.items||[]){
    const exact=(batch.panels||[]).find(p=>p.itemId===raw.itemId);
    const candidates=exact?[exact]:(batch.panels||[]).filter(p=>p.slug&&raw.delivery&&path.basename(raw.delivery).endsWith(p.slug+'-wide-'+path.basename(raw.delivery).split('-wide-').at(-1)));
    const item={...(candidates.length===1?candidates[0]:{}),...raw},word=item.headword||item.word;
    if(!word)throw Error('词头无法对应：'+item.itemId);
    const lookup=corrections[item.itemId]?.headword||(normalized(word)==='consult'?'consulate':word);
    let matches=source.filter(s=>normalized(s.sourceHeadword)===normalized(lookup));
    if(matches.length>1)matches=matches.filter(s=>s.unit===(item.unit||batch.unit));
    if(matches.length!==1)throw Error(`释义未唯一对应 ${item.itemId} (${word}): ${matches.length}`);
    const s=matches[0],correction=corrections[item.itemId]||{},issue=correction.issue||'';
    const correctedHeadword=normalized(word)==='consult'?'consulate':correction.headword||s.sourceHeadword;
    records.push({itemId:item.itemId,originalHeadword:word,originalUnit:item.unit||batch.unit,headword:correctedHeadword,meaning:s.meaning.replace(/（原词头[^）]*）/g,'').replace(/（原短语[^）]*）/g,''),sourceUnit:s.unit,sourceImage:s.image,printedPage:s.printedPage,sourceRegion:s.region,sourceLine:s.sourceLine,sourceKind:'supplied-textbook-vocabulary-page',reviewIssue:normalized(word)==='consult'?'原配图清单将 consulate 错录为 consult；需重新核对或重做配图。':issue});
   }
  }
 }
 if(new Set(records.map(e=>e.itemId)).size!==records.length)throw Error('重复词条编号');
 const used=new Set(records.flatMap(e=>[normalized(e.originalHeadword),normalized(e.headword)]));
 const omitted=source.filter(s=>!used.has(normalized(s.sourceHeadword))).map(s=>({...s,status:'source-present-no-illustration-entry',note:'源页存在但未对应当前配图词条；保留待核，未新增配图或发布。'}));
 const scans=[...new Set(source.map(s=>s.image))].map(file=>({file,sha256:digest(fs.readFileSync(path.join(root,file)))}));
 const result={schemaVersion:1,courseId,publisher:'人民教育出版社',title:'普通高中教科书 英语',editionYear:2019,volume:`必修第${['','一','二','三'][volume]}册`,status:'source-transcribed-review-pending',sourceText:'source-glosses-v1.txt',sourceTextSha256:digest(sourceText),sourceScans:scans,entries:records};
 createNew(path.join(root,'source-glosses-v3.json'),result);
 createNew(path.join(root,'source-gloss-reconciliation-v2.json'),{courseId,illustratedEntries:records.length,matchedEntries:records.length,missingMeanings:records.filter(e=>!e.meaning).length,headwordCorrections:records.filter(e=>e.headword!==e.originalHeadword),sourceUnitCorrections:records.filter(e=>e.originalUnit&&e.originalUnit!==e.sourceUnit),unillustratedSourceEntries:omitted});
 const missing=omitted.filter(s=>!['Christmas carol','Merry Christmas!'].includes(s.sourceHeadword)).map(s=>{
  const unitNumber=s.unit.match(/\d+/)?.[0],unitKey=unitNumber?(volume===3?'u':'unit')+unitNumber:'welcome';
  const slug=s.sourceHeadword.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  return {itemId:`${courseId}-${unitKey}-${slug}`,headword:s.sourceHeadword,meaning:s.meaning,sourceUnit:s.unit,sourceImage:s.image,printedPage:s.printedPage,sourceRegion:s.region,sourceLine:s.sourceLine,sourceKind:'supplied-textbook-vocabulary-page',status:'illustration-pending'};
 });
 createNew(path.join(root,'source-missing-entries-v1.json'),{courseId,status:'source-transcribed-review-pending',entries:missing,deferredScope:omitted.filter(s=>['Christmas carol','Merry Christmas!'].includes(s.sourceHeadword))});
 console.log(JSON.stringify({courseId,matched:records.length,omitted:omitted.map(x=>x.sourceHeadword),correctedHeadwords:records.filter(e=>e.headword!==e.originalHeadword).map(e=>[e.originalHeadword,e.headword])}));
}
