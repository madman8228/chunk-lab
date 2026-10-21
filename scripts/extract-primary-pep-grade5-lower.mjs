import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {checkTranscription} from './extract-primary-grade3.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
export const sourceFile=path.join(root,'docs/source-materials/primary-pep-grade5-lower-20261014.json');
const esc=value=>String(value??'').replaceAll('|','\\|').replaceAll('\n',' ');

export function checkPepGrade5Lower(data){
  assert.equal(data.textbook.series,'PEP');assert.equal(data.textbook.grade,'五年级');assert.equal(data.textbook.volume,'下册');
  assert.equal(data.units.length,6);assert.equal(data.alphabeticalIndex.entries.length,96);assert.equal(data.images.length,12);
  const checked=checkTranscription(data);
  assert.equal(checked.summary.entries,96);checked.summary.indexStarConflicts=checked.summary.conflicts.length;
  assert.equal(data.usefulExpressions.units.length,6);
  checked.expressions=[];
  data.usefulExpressions.units.forEach((group,index)=>{
    assert.equal(group.unitId,data.units[index].unitId);
    for(const [i,row] of group.entries.entries())checked.expressions.push({expressionId:group.unitId+':expression:'+String(i+1).padStart(3,'0'),
      unitId:group.unitId,unit:data.units[index].title,order:i+1,english:row[0],chinese:row[1],sourceNote:row[2],appendixPage:group.printedPage,
      sourceImage:group.printedPage===89?11:12});
  });
  assert.equal(checked.expressions.length,44);checked.summary.expressionRows=checked.expressions.length;
  return checked;
}

export function generateExtraction(directory){
  const data=JSON.parse(fs.readFileSync(sourceFile,'utf8')),checked=checkPepGrade5Lower(data);
  if(fs.existsSync(directory))throw new Error('输出目录已存在，未覆盖原提取稿。');
  for(const image of data.images)if(!fs.existsSync(image.path))throw new Error('缺少本批原图：'+image.id);
  fs.mkdirSync(path.join(directory,'source-images'),{recursive:true});
  const images=data.images.map(image=>{const file='source-images/image-'+image.id+'.png';fs.copyFileSync(image.path,path.join(directory,file),fs.constants.COPYFILE_EXCL);
    return {id:image.id,role:image.role,printedPage:image.printedPage||null,file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,file))).digest('hex')};});
  const artifact={format:'textbook-vocabulary-extraction',version:1,status:'review-only',textbook:data.textbook,contents:data.contents,legend:data.legend,
    summary:checked.summary,units:data.units.map(({entries,...unit})=>unit),records:checked.records,usefulExpressions:checked.expressions,alphabeticalIndex:data.alphabeticalIndex,
    sourceImages:images,reviewIssues:data.reviewIssues,limitations:data.limitations};
  fs.writeFileSync(path.join(directory,'extracted-vocabulary.json'),JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
  const typeNames={word:'单词',contraction:'缩写',phrase:'短语',expression:'表达'};
  const lines=['# 人教 PEP 英语五年级下册：图片词表提取审看稿','','用户标注为 PEP 五年级下册，封面册别相符；封面 2024 作为审定标记记录，具体版次/印次待版权页核实。',
    `提取 ${checked.summary.entries} 条单元词义记录、${checked.summary.expressionRows} 条常用表达。A–Z 索引页已独立转录并与单元词表交叉检查。`,'',
    '| 单元 | 目录起页 | 词条数 |','|---|---:|---:|',...data.units.map(u=>`| ${u.title} | ${u.contentsStartPage} | ${u.entries.length} |`),'',
    '## 原表标记与待审','','星号、黑/白体分别照图记录；词条类型为整理标注，不是教材印刷标签。页码沿用教材正文页码。',
    ...data.reviewIssues.map(issue=>'- '+(issue.term?issue.term+'：':'')+issue.note),
    ...checked.summary.conflicts.map(issue=>`- ${issue.term}：单元词表与 A–Z 表的星号不同，保留原图两种标记。`),''];
  for(const unit of data.units){lines.push('## '+unit.title,'','| 顺序 | 词语 | 释义 | 正文页码 | 星号 | 字体 | 类型 | 备注 |','|---:|---|---|---:|---|---|---|---|');
    for(const row of checked.records.filter(r=>r.unitId===unit.unitId))lines.push(`| ${row.order} | ${esc(row.term)} | ${esc(row.meaning)} | ${row.sourceTextPage} | ${row.starred?'*':'—'} | ${row.bold?'黑体':'白体'} | ${typeNames[row.type]} | ${esc(row.sourceNote)} |`);lines.push('');}
  lines.push('## 常用表达','','| 单元 | 英文 | 中文 | 页码 |','|---|---|---|---:|',...checked.expressions.map(row=>`| ${esc(row.unit)} | ${esc(row.english)} | ${esc(row.chinese)} | ${row.appendixPage} |`),'',
    '## A–Z 索引','','| 词头 | 正文页码 | 星号 |','|---|---:|---|',...data.alphabeticalIndex.entries.map(row=>{const [head,pages]=row.split('@');return `| ${esc(head.replace(/^\*/,''))} | ${pages} | ${head.startsWith('*')?'*':'—'} |`;}),'',
    '## 目录中的其他内容','','Revision、歌曲和 Pronunciation 正文未提供，未据目录补造。12 张来源图原样保存，并附 SHA-256。',
    `原图页脚声明：“${data.textbook.printedUsageNotice}”。本稿仅供个人审核；公共发布前须核实授权。没有导入账号、课程索引或学习记录。`,'');
  fs.writeFileSync(path.join(directory,'review.md'),lines.join('\n'),{flag:'wx'});
  const columns=['entryId','unit','order','term','meaning','sourceTextPage','starred','bold','type','sourceNote','alphabeticalIndexStarred'];
  const csv='\ufeff'+[columns,...checked.records.map(r=>columns.map(c=>r[c]))].map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
  fs.writeFileSync(path.join(directory,'vocabulary.csv'),csv,{flag:'wx'});
  const expColumns=['expressionId','unit','order','english','chinese','appendixPage','sourceNote','sourceImage'];
  const expCsv='\ufeff'+[expColumns,...checked.expressions.map(r=>expColumns.map(c=>r[c]))].map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
  fs.writeFileSync(path.join(directory,'expressions.csv'),expCsv,{flag:'wx'});return checked.summary;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const data=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
  if(process.argv[2]==='--check')console.log(JSON.stringify(checkPepGrade5Lower(data).summary,null,2));
  else{const directory=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'output/textbook-extractions/primary-pep-grade5-lower-20261014');
    console.log(JSON.stringify({directory,...generateExtraction(directory)},null,2));}
}
