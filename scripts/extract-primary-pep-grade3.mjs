import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {checkTranscription} from './extract-primary-grade3.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
export const pepSourceFile=path.join(root,'docs/source-materials/primary-pep-grade3-upper-20261014.json');

export function checkPepTranscription(data){
  assert.equal(data.textbook.series,'PEP');
  const core={...data,units:data.units.map(unit=>({...unit,entries:unit.entries.map(row=>{
    assert.equal(row.length,8);assert.ok(/^\/[^/]+\/$/.test(row[7]),'图片音标不能为空：'+row[0]);
    return row.slice(0,7);
  })}))};
  const checked=checkTranscription(core);
  const flattened=data.units.flatMap(unit=>unit.entries);
  checked.records=checked.records.map((record,index)=>({...record,phonetic:flattened[index][7],
    phoneticScope:record.term==='red panda'?'red-only':'term'}));
  const expressions=[];
  assert.equal(data.usefulExpressions.units.length,6);
  data.usefulExpressions.units.forEach((group,index)=>{
    assert.equal(group.unitId,data.units[index].unitId);
    for(const [i,row] of group.entries.entries()){
      assert.equal(row.length,3);assert.ok(row[0]&&row[1]);
      expressions.push({expressionId:group.unitId+':expression:'+String(i+1).padStart(3,'0'),unitId:group.unitId,
        unit:data.units[index].title,order:i+1,english:row[0],chinese:row[1],sourceNote:row[2],
        appendixPage:group.printedPage,sourceImage:group.printedPage===89?10:11});
    }
  });
  checked.expressions=expressions;
  checked.summary.expressionRows=expressions.length;
  checked.summary.expressionCounts=data.usefulExpressions.units.map((group,index)=>({unit:data.units[index].title,entries:group.entries.length}));
  return checked;
}

const escape=value=>String(value).replaceAll('|','\\|').replaceAll('\n',' ');
export function pepReviewMarkdown(data,checked){
  const lines=['# 人教 PEP 英语三年级上册：图片提取审看稿','',
    '本批内封明确标注 PEP，封面有 2024 审定标志。出版版次和印次尚未取得；与前一批 136 条、系列未确认的词表独立保存，不合并、不替换。','',
    `提取 ${checked.summary.entries} 条单元词汇记录，${checked.summary.uniqueTerms} 个不同词头/短语；orange 在两个单元分别保留水果义和颜色义。另有 ${checked.summary.expressionRows} 条常用表达（其中一条以斜线列两个道谢表达），不计入词汇数。`,'',
    '| 单元 | 正文起页 | 词汇记录 | 常用表达 |','|---|---:|---:|---:|',
    ...data.units.map((unit,index)=>`| ${unit.title} | ${unit.contentsStartPage} | ${unit.entries.length} | ${data.usefulExpressions.units[index].entries.length} |`),'',
    '## 标记与范围','',
    '原表星号表示课标二级词；黑体表示要求理解、运用，白体表示只要求在语境中理解。二者分别保留：无星号不代表非重点。词汇页码是正文页码，表达的 89/90 页是附录页码，单元目录起页另列。音标来自图片，重音符号统一为 ˈ；没有生成或校验发音音频。','',
    '## 待核对','',...data.reviewIssues.map(issue=>'- '+issue.note),'',
    '用户图片中的“仅供个人学习使用，未经授权不得另做他用”标记原样记录。本次只制作个人审看资料，没有公开发布、写入账号或生成课程索引。',''];
  for(const unit of data.units){
    lines.push('## '+unit.title,'','| 顺序 | 词头 | 图片音标 | 释义 | 正文页码 | 星号 | 字体 | 备注 |','|---:|---|---|---|---:|---|---|---|');
    for(const row of checked.records.filter(row=>row.unitId===unit.unitId))lines.push(`| ${row.order} | ${escape(row.term)} | ${escape(row.phonetic)} | ${escape(row.meaning)} | ${row.sourceTextPage} | ${row.starred?'*':'—'} | ${row.bold?'黑体':'白体'} | ${escape(row.sourceNote)} |`);
    lines.push('','### 常用表达','','| 顺序 | 原表英文 | 原表中文 | 附录页码 | 备注 |','|---:|---|---|---:|---|');
    for(const row of checked.expressions.filter(row=>row.unitId===unit.unitId))lines.push(`| ${row.order} | ${escape(row.english)} | ${escape(row.chinese)} | ${row.appendixPage} | ${escape(row.sourceNote)} |`);
    lines.push('');
  }
  lines.push('## 其余目录','','| 项目 | 页码 |','|---|---:|',...data.otherContents.map(row=>`| ${escape(row.title)} | ${row.page} |`),'',
    '复习、歌曲、歌谣及字母表这里只记录目录项；未提供对应正文，不能据目录编造内容。','',
    '11 张原图原样归档在 source-images，未改画、压缩或作为词汇学习插图发布。A–Z 词头与单元表正文页码已交叉核对，人工识读仍需审看。','');
  return lines.join('\n');
}

const csv=(columns,records)=>'\ufeff'+[columns,...records.map(record=>columns.map(column=>record[column]))]
  .map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';

export function generatePepExtraction(directory){
  const data=JSON.parse(fs.readFileSync(pepSourceFile,'utf8')),checked=checkPepTranscription(data);
  if(fs.existsSync(directory))throw new Error('输出目录已存在，未覆盖原稿。');
  for(const image of data.images)if(!fs.existsSync(image.path))throw new Error('缺少本批原图：'+image.id);
  fs.mkdirSync(path.join(directory,'source-images'),{recursive:true});
  const images=data.images.map(image=>{
    const file='source-images/image-'+image.id+'.png';
    fs.copyFileSync(image.path,path.join(directory,file),fs.constants.COPYFILE_EXCL);
    return {id:image.id,role:image.role,printedPage:image.printedPage||null,file,
      sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,file))).digest('hex')};
  });
  const artifact={format:'textbook-vocabulary-extraction',version:1,status:'review-only',textbook:data.textbook,
    legend:data.legend,units:data.units.map(({entries,...unit})=>unit),summary:checked.summary,
    records:checked.records,usefulExpressions:checked.expressions,otherContents:data.otherContents,
    alphabeticalIndex:data.alphabeticalIndex,sourceImages:images,reviewIssues:data.reviewIssues,limitations:data.limitations};
  fs.writeFileSync(path.join(directory,'extracted-vocabulary.json'),JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(directory,'review.md'),pepReviewMarkdown(data,checked),{flag:'wx'});
  fs.writeFileSync(path.join(directory,'vocabulary.csv'),csv(['entryId','unit','order','term','phonetic','phoneticScope','meaning','sourceTextPage','starred','bold','sourceNote'],checked.records),{flag:'wx'});
  fs.writeFileSync(path.join(directory,'expressions.csv'),csv(['expressionId','unit','order','english','chinese','appendixPage','sourceNote'],checked.expressions),{flag:'wx'});
  return checked.summary;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='--check')console.log(JSON.stringify(checkPepTranscription(JSON.parse(fs.readFileSync(pepSourceFile,'utf8'))).summary,null,2));
  else{const directory=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'output/textbook-extractions/primary-pep-grade3-upper-20261014');console.log(JSON.stringify({directory,...generatePepExtraction(directory)},null,2));}
}
