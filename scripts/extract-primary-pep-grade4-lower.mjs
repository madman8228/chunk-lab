import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {checkTranscription} from './extract-primary-grade3.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
export const sourceFile=path.join(root,'docs/source-materials/primary-pep-grade4-lower-20261014.json');

export function checkPepGrade4Lower(data){
  assert.equal(data.textbook.series,'PEP');assert.equal(data.textbook.grade,'四年级');assert.equal(data.textbook.volume,'下册');
  const checked=checkTranscription(data);
  checked.records=checked.records.map((record,index)=>{
    const printed=data.phonetics[record.unitId]?.[record.term]||'';
    return {...record,phonetic:printed,phoneticScope:printed?(printed.includes(';')||printed.startsWith('out ')||printed.startsWith('bean ')||printed.startsWith('set ')?'as-printed':'term'):'not-printed'};
  });
  assert.equal(data.usefulExpressions.units.length,6);
  const expressions=[];
  data.usefulExpressions.units.forEach((group,index)=>{
    assert.equal(group.unitId,data.units[index].unitId);
    group.entries.forEach((row,i)=>{
      assert.equal(row.length,3);assert.ok(row[0]&&row[1]);
      expressions.push({expressionId:group.unitId+':expression:'+String(i+1).padStart(3,'0'),unitId:group.unitId,
        unit:data.units[index].title,order:i+1,english:row[0],chinese:row[1],sourceNote:row[2],appendixPage:group.printedPage,
        sourceImage:group.printedPage===86?9:10});
    });
  });
  const numbers=data.numberWords.entries.map((row,index)=>{assert.equal(row.length,3);return {entryId:'numbers:'+String(index+1).padStart(3,'0'),
    term:row[0],phonetic:row[1],meaning:row[2],sourceTextPage:data.numberWords.printedPage,sourceImage:data.numberWords.sourceImage};});
  checked.expressions=expressions;checked.numbers=numbers;
  checked.summary.expressionRows=expressions.length;checked.summary.numberWords=numbers.length;
  checked.summary.expressionCounts=data.usefulExpressions.units.map((group,index)=>({unit:data.units[index].title,entries:group.entries.length}));
  checked.summary.phoneticRows=checked.records.filter(row=>row.phonetic).length;
  return checked;
}

const esc=value=>String(value??'').replaceAll('|','\\|').replaceAll('\n',' ');
export function reviewMarkdown(data,checked){
  const lines=['# 人教 PEP 英语四年级下册：图片提取审看稿','',
    '用户确认为 PEP 四年级下册；封面 2024 标记仅记录为审定年份，具体出版版次/印次待版权页确认。','',
    `提取 ${checked.summary.entries} 条六单元词汇记录；另收录数词栏 ${checked.summary.numberWords} 项、常用表达 ${checked.summary.expressionRows} 条。原图中可见音标 ${checked.summary.phoneticRows} 条；未标音者留空。`,'',
    '| 单元 | 正文起页 | 词汇记录 | 常用表达 |','|---|---:|---:|---:|',...data.units.map((unit,index)=>`| ${unit.title} | ${unit.contentsStartPage} | ${unit.entries.length} | ${data.usefulExpressions.units[index].entries.length} |`),'',
    '## 原表标记与待核对','','星号与黑/白体分别保留；词表和 A–Z 索引的标记冲突不擅自统一。音标按图转录，只标在原图有音标处。','',
    ...data.reviewIssues.map(issue=>'- '+(issue.term?issue.term+'：':'')+issue.note),
    ...(checked.summary.conflicts.length?checked.summary.conflicts.map(row=>`- ${row.term}：单元表和 A–Z 索引星号不一致，分别保留。`):[]),'',
    '页码为教材正文页码；目录起页另列。来源 10 张图片原样复制到 source-images，不压缩、不改画，也不作为学习插图发布。',''];
  for(const unit of data.units){
    lines.push('## '+unit.title,'','| 顺序 | 词头 | 音标 | 原表释义 | 正文页码 | 星号 | 字体 |','|---:|---|---|---|---:|---|---|');
    for(const row of checked.records.filter(item=>item.unitId===unit.unitId))lines.push(`| ${row.order} | ${esc(row.term)} | ${esc(row.phonetic)} | ${esc(row.meaning)} | ${row.sourceTextPage} | ${row.starred?'*':'—'} | ${row.bold?'黑体':'白体'} |`);
    lines.push('');
  }
  lines.push('## 数词','','| 顺序 | 词 | 音标 | 释义 | 页码 |','|---:|---|---|---|---:|',...checked.numbers.map((row,index)=>`| ${index+1} | ${row.term} | ${row.phonetic} | ${row.meaning} | ${row.sourceTextPage} |`),'',
    '## 常用表达','','| 单元 | 顺序 | 英文 | 中文 | 附录页码 |','|---|---:|---|---|---:|',...checked.expressions.map(row=>`| ${esc(row.unit)} | ${row.order} | ${esc(row.english)} | ${esc(row.chinese)} | ${row.appendixPage} |`),'',
    '## 目录中的其他内容','','| 项目 | 页码 |','|---|---:|',...data.otherContents.map(row=>`| ${esc(row.title)} | ${row.page} |`),'','Revision、歌曲和 Pronunciation 附录正文未提供，未据目录补造。','');
  return lines.join('\n');
}

const makeCsv=(columns,rows)=>'\ufeff'+[columns,...rows.map(row=>columns.map(column=>row[column]))].map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
export function generateExtraction(directory){
  const data=JSON.parse(fs.readFileSync(sourceFile,'utf8')),checked=checkPepGrade4Lower(data);
  if(fs.existsSync(directory))throw new Error('输出目录已存在，未覆盖原稿。');
  for(const image of data.images)if(!fs.existsSync(image.path))throw new Error('缺少本批原图：'+image.id);
  fs.mkdirSync(path.join(directory,'source-images'),{recursive:true});
  const images=data.images.map(image=>{const file='source-images/image-'+image.id+'.png';fs.copyFileSync(image.path,path.join(directory,file),fs.constants.COPYFILE_EXCL);
    return {id:image.id,role:image.role,printedPage:image.printedPage||null,file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,file))).digest('hex')};});
  const artifact={format:'textbook-vocabulary-extraction',version:1,status:'review-only',textbook:data.textbook,contents:data.contents,legend:data.legend,
    summary:checked.summary,units:data.units.map(({entries,...unit})=>unit),records:checked.records,numbers:checked.numbers,usefulExpressions:checked.expressions,
    alphabeticalIndex:data.alphabeticalIndex,sourceImages:images,otherContents:data.otherContents,reviewIssues:data.reviewIssues,limitations:data.limitations};
  fs.writeFileSync(path.join(directory,'extracted-vocabulary.json'),JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(directory,'review.md'),reviewMarkdown(data,checked),{flag:'wx'});
  fs.writeFileSync(path.join(directory,'vocabulary.csv'),makeCsv(['entryId','unit','order','term','phonetic','phoneticScope','meaning','sourceTextPage','starred','bold','type','sourceNote','alphabeticalIndexStarred'],checked.records),{flag:'wx'});
  fs.writeFileSync(path.join(directory,'numbers.csv'),makeCsv(['entryId','term','phonetic','meaning','sourceTextPage','sourceImage'],checked.numbers),{flag:'wx'});
  fs.writeFileSync(path.join(directory,'expressions.csv'),makeCsv(['expressionId','unit','order','english','chinese','appendixPage','sourceNote'],checked.expressions),{flag:'wx'});
  return checked.summary;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const data=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
  if(process.argv[2]==='--check')console.log(JSON.stringify(checkPepGrade4Lower(data).summary,null,2));
  else{const directory=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'output/textbook-extractions/primary-pep-grade4-lower-20261014');
    console.log(JSON.stringify({directory,...generateExtraction(directory)},null,2));}
}
