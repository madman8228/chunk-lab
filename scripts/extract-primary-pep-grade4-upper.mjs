import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {checkTranscription} from './extract-primary-grade3.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
export const pepGrade4SourceFile=path.join(root,'docs/source-materials/primary-pep-grade4-upper-20261014.json');
const key=value=>value.toLocaleLowerCase('en').replaceAll('’',"'").trim();

export function checkPepGrade4Transcription(data){
  assert.equal(data.textbook.series,'PEP');assert.equal(data.textbook.grade,'四年级');assert.equal(data.textbook.volume,'上册');
  assert.equal(data.units.length,6);
  const supplement=new Set(data.alphabeticalIndex.supplementalEntries.map(row=>key(row.split('@')[0].replace(/^\*/,''))));
  const allTerms=new Set(data.units.flatMap(unit=>unit.entries.map(row=>key(row[0]))));
  assert.equal(supplement.size,data.alphabeticalIndex.supplementalEntries.length,'索引补充项不能重复');
  assert.ok(data.alphabeticalIndex.supplementalEntries.every(row=>/^\*?[^@]+@\d+(,\d+)*$/.test(row)));
  assert.ok(data.alphabeticalIndex.entries.every(row=>!supplement.has(key(row.split('@')[0].replace(/^\*/,'')))),
    '索引补充项应与可交叉核对词条分开保存');
  const core={...data,alphabeticalIndex:{...data.alphabeticalIndex,entries:data.alphabeticalIndex.entries.filter(row=>!supplement.has(key(row.split('@')[0].replace(/^\*/,''))))},
    units:data.units.map(unit=>({...unit,entries:unit.entries.map(row=>{assert.equal(row.length,8);assert.ok(row[7],'音标或原表音标范围说明不能为空：'+row[0]);return row.slice(0,7);})}))};
  const checked=checkTranscription(core);
  checked.records=checked.records.map((record,index)=>({...record,phonetic:data.units.flatMap(unit=>unit.entries)[index][7],
    phoneticScope:record.sourceNote.includes('仅给')||record.sourceNote.includes('分别给')?'as-printed':'term'}));
  const expressions=[];
  assert.equal(data.usefulExpressions.units.length,6);
  data.usefulExpressions.units.forEach((group,index)=>{
    assert.equal(group.unitId,data.units[index].unitId);
    for(const [i,row] of group.entries.entries()){
      assert.equal(row.length,3);assert.ok(row[0]&&row[1]);
      expressions.push({expressionId:group.unitId+':expression:'+String(i+1).padStart(3,'0'),unitId:group.unitId,
        unit:data.units[index].title,order:i+1,english:row[0],chinese:row[1],sourceNote:row[2],appendixPage:group.printedPage,
        sourceImage:group.printedPage===86?9:10});
    }
  });
  checked.expressions=expressions;checked.summary.expressionRows=expressions.length;
  checked.summary.expressionCounts=data.usefulExpressions.units.map((group,index)=>({unit:data.units[index].title,entries:group.entries.length}));
  checked.summary.indexOnlyEntries=data.alphabeticalIndex.supplementalEntries.length;
  checked.summary.indexOnlyTerms=data.alphabeticalIndex.supplementalEntries.map(row=>row.split('@')[0].replace(/^\*/,''));
  assert.equal(checked.summary.uniqueTerms,allTerms.size);
  return checked;
}

const esc=value=>String(value??'').replaceAll('|','\\|').replaceAll('\n',' ');
export function pepGrade4ReviewMarkdown(data,checked){
  const lines=['# 人教 PEP 英语四年级上册：图片提取审看稿','',
    '系列依据：用户明确确认为 PEP；封面为四年级上册，2024 只作为封面审定标记，具体出版版次/印次待版权页核实。','',
    `提取 ${checked.summary.entries} 条单元词汇记录、${checked.summary.uniqueTerms} 个不同词头/短语，并另录 ${checked.summary.indexOnlyEntries} 个仅见于 A–Z 索引的词头；另有 ${checked.summary.expressionRows} 条常用表达。`,'',
    '| 单元 | 正文起页 | 词汇记录 | 常用表达 |','|---|---:|---:|---:|',
    ...data.units.map((unit,index)=>`| ${unit.title} | ${unit.contentsStartPage} | ${unit.entries.length} | ${data.usefulExpressions.units[index].entries.length} |`),'',
    '## 标记和待核对事项','',
    '星号与黑/白体分别按原图记录，不将其混为单一重点标记。词汇来源页码与目录起页分开保存；音标按原图转录，未生成发音。','',
    ...data.reviewIssues.map(issue=>'- '+(issue.term?issue.term+'：':'')+issue.note),'',
    '页脚注明“仅供个人学习使用，未经授权不得另做他用”。本稿仅供个人校对，公共发布前须核实授权。尚未写入账号、课程索引或学习记录。',''];
  for(const unit of data.units){
    lines.push('## '+unit.title,'','| 顺序 | 词头 | 音标 | 释义 | 正文页码 | 星号 | 字体 | 备注 |','|---:|---|---|---|---:|---|---|---|');
    for(const row of checked.records.filter(item=>item.unitId===unit.unitId))lines.push(`| ${row.order} | ${esc(row.term)} | ${esc(row.phonetic)} | ${esc(row.meaning)} | ${row.sourceTextPage} | ${row.starred?'*':'—'} | ${row.bold?'黑体':'白体'} | ${esc(row.sourceNote)} |`);
    lines.push('','### 常用表达','','| 顺序 | 英文 | 中文 | 附录页码 |','|---:|---|---|---:|');
    for(const row of checked.expressions.filter(item=>item.unitId===unit.unitId))lines.push(`| ${row.order} | ${esc(row.english)} | ${esc(row.chinese)} | ${row.appendixPage} |`);
    lines.push('');
  }
  lines.push('## A–Z 索引补充项','','以下词头可在 A–Z 表中看到，但没有出现在本批按单元词表截图中；不推测所属单元。','',...data.alphabeticalIndex.supplementalEntries.map(row=>'- '+row),'',
    '## 来源图','','原始 10 张图片无损复制到 source-images，并附 SHA-256。当前程序仅检查结构、词头和页码对应；识字、音标、字体和权利范围仍需人工审核。','');
  return lines.join('\n');
}

const makeCsv=(columns,records)=>'\ufeff'+[columns,...records.map(record=>columns.map(column=>record[column]))]
  .map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';

export function generatePepGrade4Extraction(directory){
  const data=JSON.parse(fs.readFileSync(pepGrade4SourceFile,'utf8')),checked=checkPepGrade4Transcription(data);
  if(fs.existsSync(directory))throw new Error('输出目录已存在，未覆盖原稿。');
  for(const image of data.images)if(!fs.existsSync(image.path))throw new Error('缺少本批原图：'+image.id);
  fs.mkdirSync(path.join(directory,'source-images'),{recursive:true});
  const images=data.images.map(image=>{const file='source-images/image-'+image.id+'.png';fs.copyFileSync(image.path,path.join(directory,file),fs.constants.COPYFILE_EXCL);
    return {id:image.id,role:image.role,printedPage:image.printedPage||null,file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,file))).digest('hex')};});
  const artifact={format:'textbook-vocabulary-extraction',version:1,status:'review-only',textbook:data.textbook,legend:data.legend,
    units:data.units.map(({entries,...unit})=>unit),summary:checked.summary,records:checked.records,usefulExpressions:checked.expressions,
    otherContents:data.otherContents,alphabeticalIndex:data.alphabeticalIndex,sourceImages:images,reviewIssues:data.reviewIssues,limitations:data.limitations};
  fs.writeFileSync(path.join(directory,'extracted-vocabulary.json'),JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(directory,'review.md'),pepGrade4ReviewMarkdown(data,checked),{flag:'wx'});
  fs.writeFileSync(path.join(directory,'vocabulary.csv'),makeCsv(['entryId','unit','order','term','phonetic','phoneticScope','meaning','sourceTextPage','starred','bold','type','sourceNote'],checked.records),{flag:'wx'});
  fs.writeFileSync(path.join(directory,'expressions.csv'),makeCsv(['expressionId','unit','order','english','chinese','appendixPage','sourceNote'],checked.expressions),{flag:'wx'});
  return checked.summary;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='--check')console.log(JSON.stringify(checkPepGrade4Transcription(JSON.parse(fs.readFileSync(pepGrade4SourceFile,'utf8'))).summary,null,2));
  else{const directory=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'output/textbook-extractions/primary-pep-grade4-upper-20261014-r2');
    console.log(JSON.stringify({directory,...generatePepGrade4Extraction(directory)},null,2));}
}
