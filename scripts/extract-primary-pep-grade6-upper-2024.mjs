import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
export const sourceFile=path.join(root,'docs/source-materials/primary-pep-grade6-upper-2024-20261014.json');
const key=value=>String(value).toLocaleLowerCase('en').replaceAll('’',"'").trim();
const esc=value=>String(value??'').replaceAll('|','\\|').replaceAll('\n',' ');
const csv=(columns,rows)=>'\ufeff'+[columns,...rows.map(row=>columns.map(c=>row[c]))].map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';

export function checkPepGrade6Upper(data){
  assert.equal(data.textbook.series,'PEP');assert.equal(data.textbook.grade,'六年级');assert.equal(data.textbook.volume,'上册');
  assert.equal(data.textbook.coverApprovalYear,2024);assert.equal(data.images.length,14);assert.equal(data.units.length,6);
  const records=[];
  data.units.forEach((unit,u)=>{
    assert.equal(unit.unitId,'unit-'+(u+1));
    unit.entries.forEach((row,i)=>{
      assert.equal(row.length,8);const [term,meaning,sourceTextPage,starred,bold,type,phonetic,sourceNote]=row;
      assert.ok(term&&meaning);assert.ok(Number.isInteger(sourceTextPage));assert.equal(typeof starred,'boolean');assert.equal(typeof bold,'boolean');
      assert.ok(data.legend.types.includes(type));
      records.push({entryId:unit.unitId+':entry:'+String(i+1).padStart(3,'0'),unitId:unit.unitId,unit:unit.title,order:i+1,
        term,meaning,sourceTextPage,starred,bold,type,phonetic,sourceNote});
    });
  });
  const index=new Map();for(const row of records){const k=key(row.term);if(!index.has(k))index.set(k,{term:row.term,pages:[],starred:row.starred});
    if(!index.get(k).pages.includes(row.sourceTextPage))index.get(k).pages.push(row.sourceTextPage);
    assert.equal(index.get(k).starred,row.starred,'同词头星号标记不一致：'+row.term);}
  const expressions=[];
  data.usefulExpressions.units.forEach((group,i)=>{
    assert.equal(group.unitId,data.units[i].unitId);
    group.entries.forEach(([english,chinese],j)=>expressions.push({expressionId:group.unitId+':expression:'+String(j+1).padStart(3,'0'),
      unitId:group.unitId,unit:data.units[i].title,order:j+1,english,chinese,appendixPage:group.printedPage,
      sourceImage:group.printedPage===89?11:group.printedPage===90?12:13}));
  });
  const summary={unitCounts:data.units.map(u=>({unit:u.title,entries:u.entries.length})),entries:records.length,uniqueTerms:index.size,
    starredEntries:records.filter(r=>r.starred).length,boldEntries:records.filter(r=>r.bold).length,
    expressionRows:expressions.length,expressionCounts:data.usefulExpressions.units.map(g=>({unit:g.unitId,entries:g.entries.length})),
    irregularVerbRows:data.irregularVerbs.length};
  assert.equal(records.length,143);assert.equal(expressions.length,54);assert.equal(data.irregularVerbs.length,47);
  return {records,expressions,alphabeticalIndex:[...index.values()].sort((a,b)=>a.term.localeCompare(b.term,'en')),summary};
}

export function generateExtraction(directory){
  const data=JSON.parse(fs.readFileSync(sourceFile,'utf8')),checked=checkPepGrade6Upper(data);
  if(fs.existsSync(directory))throw new Error('输出目录已存在，未覆盖原稿。');
  for(const image of data.images)if(!fs.existsSync(image.path))throw new Error('缺少来源图：'+image.id);
  fs.mkdirSync(path.join(directory,'source-images'),{recursive:true});
  const sourceImages=data.images.map(image=>{const file='source-images/image-'+image.id+'.png';fs.copyFileSync(image.path,path.join(directory,file),fs.constants.COPYFILE_EXCL);
    return {id:image.id,role:image.role,printedPage:image.printedPage||null,file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,file))).digest('hex')};});
  const artifact={format:'textbook-vocabulary-extraction',version:1,status:'review-only',textbook:data.textbook,contents:data.contents,legend:data.legend,
    summary:checked.summary,units:data.units.map(({entries,...unit})=>unit),records:checked.records,usefulExpressions:checked.expressions,
    alphabeticalIndex:{entries:checked.alphabeticalIndex,transcriptionNote:'由Appendix 2单元词表派生；Appendix 3原页已保存，未独立逐项转录。'},
    irregularVerbs:data.irregularVerbs.map(([verb,past],i)=>({order:i+1,verb,past})),sourceImages,
    reviewIssues:data.reviewIssues,limitations:data.limitations};
  fs.writeFileSync(path.join(directory,'extracted-vocabulary.json'),JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
  const typeName={word:'单词',phrase:'短语',expression:'表达'};
  const lines=['# 人教 PEP 英语六年级上册（封面审定2024）：图片词表提取审看稿','',
    `根据用户标注PEP六年级上册独立建档。与另批目录为 Travelling / My feelings / Planting and growing 的六年级上册材料分开保存。`,
    `转录 ${checked.summary.entries} 条单元词表、${checked.summary.expressionRows} 条常用表达及 ${data.irregularVerbs.length} 条不规则动词。`,
    '星号及黑/白体照附录2记录；A–Z索引按单元词表派生，音标未转录。原图14张均原样保存并附SHA-256。','',
    '| 单元 | 目录起页 | 词条数 |','|---|---:|---:|',...data.units.map(u=>`| ${u.title} | ${u.contentsStartPage} | ${u.entries.length} |`),'',
    '## 原表标记及待审','','“*”及黑体/白体按原页记录，类型是整理标签。',...data.reviewIssues.map(i=>'- '+i.term+'：'+i.note),''];
  for(const unit of data.units){lines.push('## '+unit.title,'','| 顺序 | 词语 | 原表释义 | 正文页码 | 星号 | 字体 | 类型 |','|---:|---|---|---:|---|---|---|');
    for(const row of checked.records.filter(r=>r.unitId===unit.unitId))lines.push(`| ${row.order} | ${esc(row.term)} | ${esc(row.meaning)} | ${row.sourceTextPage} | ${row.starred?'*':'—'} | ${row.bold?'黑体':'白体'} | ${typeName[row.type]} |`);lines.push('');}
  lines.push('## 常用表达','','| 单元 | 英文 | 中文 | 附录页 |','|---|---|---|---:|',...checked.expressions.map(r=>`| ${esc(r.unit)} | ${esc(r.english)} | ${esc(r.chinese)} | ${r.appendixPage} |`),'',
    '## 不规则动词','','| 动词 | 过去式 |','|---|---|',...data.irregularVerbs.map(r=>`| ${esc(r[0])} | ${esc(r[1])} |`),'',
    '目录中的Revision及Appendix 1歌曲正文未提供，未据目录补写。未导入账号、课程索引或学习记录。','');
  fs.writeFileSync(path.join(directory,'review.md'),lines.join('\n'),{flag:'wx'});
  fs.writeFileSync(path.join(directory,'vocabulary.csv'),csv(['entryId','unit','order','term','meaning','sourceTextPage','starred','bold','type','phonetic','sourceNote'],checked.records),{flag:'wx'});
  fs.writeFileSync(path.join(directory,'expressions.csv'),csv(['expressionId','unit','order','english','chinese','appendixPage','sourceImage'],checked.expressions),{flag:'wx'});
  fs.writeFileSync(path.join(directory,'irregular-verbs.csv'),csv(['order','verb','past'],artifact.irregularVerbs),{flag:'wx'});
  return checked.summary;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const data=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
  if(process.argv[2]==='--check')console.log(JSON.stringify(checkPepGrade6Upper(data).summary,null,2));
  else{const directory=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'output/textbook-extractions/primary-pep-grade6-upper-2024-20261014');
    console.log(JSON.stringify({directory,...generateExtraction(directory)},null,2));}
}
