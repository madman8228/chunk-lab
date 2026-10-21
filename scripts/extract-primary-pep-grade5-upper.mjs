import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {checkTranscription} from './extract-primary-grade3.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
export const sourceFile=path.join(root,'docs/source-materials/primary-pep-grade5-upper-20261014.json');
const key=value=>value.toLocaleLowerCase('en').replaceAll('’',"'").trim();
const regularTypeface=new Set(['team','player','hard-working','rope','Australia','matter','project','centre','agree','finish','both','afraid','laugh','yours',
  'usually','weekend','sometimes','visit','grandparent','flu','else','enough','if','habit','twice','coconut','pull','lotus','round','different',
  'nature','wind','trip','dangerous','hotel','raincoat','fog','go hiking']);

export function checkPepGrade5Upper(data){
  assert.equal(data.textbook.series,'PEP');assert.equal(data.textbook.grade,'五年级');assert.equal(data.textbook.volume,'上册');
  assert.equal(data.units.length,6);assert.equal(data.images.length,11);
  assert.equal(data.usefulExpressions.units.length,6);
  const supplemental=new Set(data.alphabeticalIndex.supplementalEntries.map(row=>key(row.split('@')[0].replace(/^\*/,''))));
  const pages=new Map(),terms=new Map();
  for(const unit of data.units)for(const row of unit.entries){
    const term=row[0],k=key(term);if(!pages.has(k))pages.set(k,new Set());pages.get(k).add(row[2]);
    if(!terms.has(k))terms.set(k,{term,starred:row[3]});
  }
  const indexEntries=[...terms.values()].map(({term,starred})=>`${starred?'*':''}${term}@${[...pages.get(key(term))].sort((a,b)=>a-b).join(',')}`);
  const core={...data,alphabeticalIndex:{entries:indexEntries}};
  const checked=checkTranscription({...core,units:data.units.map(unit=>({...unit,entries:unit.entries.map(row=>{
    assert.equal(row.length,8,'词表项需保留原图音标：'+row[0]);assert.ok(row[7]||row[6].includes('原图未标注音标'),'音标或原图无音标说明不能为空：'+row[0]);
    return [...row.slice(0,4),!regularTypeface.has(row[0]),...row.slice(5,7)];
  })}))});
  assert.equal(supplemental.size,data.alphabeticalIndex.supplementalEntries.length);
  assert.deepEqual([...supplemental],['everything']);
  assert.equal(checked.summary.entries,119);assert.equal(checked.summary.uniqueTerms,119);
  const expressions=[];
  data.usefulExpressions.units.forEach((group,index)=>{
    assert.equal(group.unitId,data.units[index].unitId);
    for(const [i,row] of group.entries.entries()){
      assert.equal(row.length,3);assert.ok(row[0]&&row[1]);
      expressions.push({expressionId:group.unitId+':expression:'+String(i+1).padStart(3,'0'),unitId:group.unitId,
        unit:data.units[index].title,order:i+1,english:row[0],chinese:row[1],sourceNote:row[2],appendixPage:group.printedPage,
        sourceImage:group.printedPage===87?10:11});
    }
  });
  checked.records=checked.records.map((record,index)=>({...record,phonetic:data.units.flatMap(unit=>unit.entries)[index][7],
    phoneticScope:record.sourceNote.includes('原图未标注')?'not-printed':record.sourceNote.includes('原图音标标注')?'as-printed':'term'}));
  checked.expressions=expressions;checked.summary.expressionRows=expressions.length;
  checked.summary.expressionCounts=data.usefulExpressions.units.map((group,index)=>({unit:data.units[index].title,entries:group.entries.length}));
  checked.summary.indexOnlyEntries=supplemental.size;checked.summary.indexOnlyTerms=[...supplemental];
  checked.summary.alphabeticalIndexEntries=indexEntries.length+supplemental.size;
  assert.equal(expressions.length,38);return checked;
}

const esc=value=>String(value??'').replaceAll('|','\\|').replaceAll('\n',' ');
const csv=(columns,rows)=>'\ufeff'+[columns,...rows.map(row=>columns.map(c=>row[c]))].map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
export function generateExtraction(directory){
  const data=JSON.parse(fs.readFileSync(sourceFile,'utf8')),checked=checkPepGrade5Upper(data);
  if(fs.existsSync(directory))throw new Error('输出目录已存在，未覆盖原稿。');
  for(const image of data.images)if(!fs.existsSync(image.path))throw new Error('缺少本批原图：'+image.id);
  fs.mkdirSync(path.join(directory,'source-images'),{recursive:true});
  const images=data.images.map(image=>{const file='source-images/image-'+image.id+'.png';fs.copyFileSync(image.path,path.join(directory,file),fs.constants.COPYFILE_EXCL);
    return {id:image.id,role:image.role,printedPage:image.printedPage||null,file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,file))).digest('hex')};});
  const indexRows=new Map();for(const r of checked.records){const k=key(r.term);if(!indexRows.has(k))indexRows.set(k,{term:r.term,starred:r.starred,pages:new Set()});indexRows.get(k).pages.add(r.sourceTextPage);}
  const artifact={format:'textbook-vocabulary-extraction',version:1,status:'review-only',textbook:data.textbook,contents:data.contents,legend:data.legend,
    units:data.units.map(({entries,...unit})=>unit),summary:checked.summary,records:checked.records,usefulExpressions:checked.expressions,
    alphabeticalIndex:{entries:[...indexRows.values()].map(row=>({term:row.term,starred:row.starred,pages:[...row.pages].sort((a,b)=>a-b)})),
      supplementalEntries:data.alphabeticalIndex.supplementalEntries.map(term=>({term,meaning:data.alphabeticalIndex.supplementalMeanings[term.split('@')[0]]}))},
    otherContents:data.contents.slice(6),sourceImages:images,reviewIssues:data.reviewIssues,limitations:data.limitations};
  fs.writeFileSync(path.join(directory,'extracted-vocabulary.json'),JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
  const lines=['# 人教 PEP 英语五年级上册：图片提取审看稿','','用户明确确认为 PEP 五年级上册。封面 2024 为审定标记；具体版次/印次待版权页确认。',
    `提取 ${checked.summary.entries} 条单元词汇记录、${checked.summary.uniqueTerms} 个不同词头、${checked.summary.expressionRows} 条常用表达；另记录 ${checked.summary.indexOnlyEntries} 个仅见于 A–Z 页的补充词头。`, '',
    '| 单元 | 目录页 | 词条数 | 常用表达 |','|---|---:|---:|---:|',...data.units.map((u,i)=>`| ${u.title} | ${u.contentsStartPage} | ${u.entries.length} | ${data.usefulExpressions.units[i].entries.length} |`),'',
    '## 审核说明','','星号与黑/白体按词表截图分别转录；本稿的 A–Z 页码交叉核对是由单元词表记录生成，不代表对 A–Z 页每个字形和标记的独立校验。everything 仅见 A–Z 页，未推测单元归属。',
    ...data.reviewIssues.map(issue=>'- '+(issue.term?issue.term+'：':'')+issue.note),'','目录所列 Revision、Songs 正文未提供，未据目录补造。页脚注明“仅供个人学习使用，未经授权不得另做他用”；本稿供个人校对，公共发布前须核实授权。尚未导入账号、课程索引或学习记录。',''];
  for(const unit of data.units){lines.push('## '+unit.title,'','| 顺序 | 词头 | 音标 | 释义 | 正文页码 | 星号 | 字体 |','|---:|---|---|---|---:|---|---|');
    for(const row of checked.records.filter(r=>r.unitId===unit.unitId))lines.push(`| ${row.order} | ${esc(row.term)} | ${esc(row.phonetic)} | ${esc(row.meaning)} | ${row.sourceTextPage} | ${row.starred?'*':'—'} | ${row.bold?'黑体':'白体'} |`);
    lines.push('','### 常用表达','','| 顺序 | 英文 | 中文 | 附录页码 |','|---:|---|---|---:|');
    for(const row of checked.expressions.filter(r=>r.unitId===unit.unitId))lines.push(`| ${row.order} | ${esc(row.english)} | ${esc(row.chinese)} | ${row.appendixPage} |`);lines.push('');}
  lines.push('## A–Z 索引补充项','','- everything：每件事；所有事物；一切（仅见于索引截图）','','## 来源图','','11 张原图以原样副本保存，并附 SHA-256。机器校验不替代人工逐字、音标与字体审核。','');
  fs.writeFileSync(path.join(directory,'review.md'),lines.join('\n'),{flag:'wx'});
  fs.writeFileSync(path.join(directory,'vocabulary.csv'),csv(['entryId','unit','order','term','phonetic','phoneticScope','meaning','sourceTextPage','starred','bold','type','sourceNote'],checked.records),{flag:'wx'});
  fs.writeFileSync(path.join(directory,'expressions.csv'),csv(['expressionId','unit','order','english','chinese','appendixPage','sourceNote'],checked.expressions),{flag:'wx'});
  return checked.summary;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const data=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
  if(process.argv[2]==='--check')console.log(JSON.stringify(checkPepGrade5Upper(data).summary,null,2));
  else{const directory=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'output/textbook-extractions/primary-pep-grade5-upper-20261014');
    console.log(JSON.stringify({directory,...generateExtraction(directory)},null,2));}
}
