import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
export const sourceFile=path.join(root,'docs/source-materials/primary-jingtong-grade6-upper-2024-20261014.json');
const esc=value=>String(value??'').replaceAll('|','\\|').replaceAll('\n',' ');
const csv=(columns,rows)=>'\ufeff'+[columns,...rows.map(row=>columns.map(c=>row[c]))].map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
const key=value=>String(value).toLocaleLowerCase('en').replaceAll('’',"'").trim();

export function checkGrade6Upper(data){
  assert.equal(data.textbook.grade,'六年级');assert.equal(data.textbook.volume,'上册');assert.equal(data.textbook.series,'精通');
  assert.equal(data.textbook.coverApprovalYear,2024);assert.equal(data.images.length,10);assert.equal(data.units.length,6);
  const records=[];
  data.units.forEach((unit,u)=>{
    assert.equal(unit.unitId,'unit-'+(u+1));
    unit.entries.forEach((row,i)=>{
      assert.equal(row.length,7);const [term,meaning,sourceTextPage,starred,bold,type,sourceNote]=row;
      assert.ok(term&&meaning);assert.ok(Number.isInteger(sourceTextPage));assert.equal(typeof starred,'boolean');assert.equal(typeof bold,'boolean');assert.ok(data.legend.types.includes(type));
      records.push({entryId:unit.unitId+':entry:'+String(i+1).padStart(3,'0'),unitId:unit.unitId,unit:unit.title,order:i+1,
        term,meaning,sourceTextPage,starred,bold,type,sourceNote});
    });
  });
  const index=new Map();for(const row of records){const k=key(row.term);if(!index.has(k))index.set(k,{term:row.term,pages:[],starred:row.starred});
    if(!index.get(k).pages.includes(row.sourceTextPage))index.get(k).pages.push(row.sourceTextPage);}
  const summary={unitCounts:data.units.map(u=>({unit:u.title,entries:u.entries.length})),entries:records.length,uniqueTerms:index.size,
    starredEntries:records.filter(r=>r.starred).length,boldEntries:records.filter(r=>r.bold).length,
    irregularVerbRows:data.irregularVerbs.length,numberRows:data.numbers.length};
  assert.equal(records.length,112);assert.equal(data.irregularVerbs.length,47);assert.equal(data.numbers.length,29);
  return {records,alphabeticalIndex:[...index.values()].sort((a,b)=>a.term.localeCompare(b.term,'en')),summary};
}

export function generateExtraction(directory){
  const data=JSON.parse(fs.readFileSync(sourceFile,'utf8')),checked=checkGrade6Upper(data);
  if(fs.existsSync(directory))throw new Error('输出目录已存在，未覆盖原稿。');
  for(const image of data.images)if(!fs.existsSync(image.path))throw new Error('缺少来源图：'+image.id);
  fs.mkdirSync(path.join(directory,'source-images'),{recursive:true});
  const sourceImages=data.images.map(image=>{const file='source-images/image-'+image.id+'.png';fs.copyFileSync(image.path,path.join(directory,file),fs.constants.COPYFILE_EXCL);
    return {id:image.id,role:image.role,printedPage:image.printedPage||null,file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,file))).digest('hex')};});
  const artifact={format:'textbook-vocabulary-extraction',version:1,status:'review-only',textbook:data.textbook,contents:data.contents,legend:data.legend,
    summary:checked.summary,units:data.units.map(({entries,...unit})=>unit),records:checked.records,
    alphabeticalIndex:{entries:checked.alphabeticalIndex,transcriptionNote:'由附录1单元词表派生；附录2总词汇表原页保留，未逐项独立转录。'},
    irregularVerbs:data.irregularVerbs.map(([verb,past],i)=>({order:i+1,verb,past})),
    cardinalAndOrdinalNumbers:data.numbers.map(([number,cardinal,ordinal,ordinalWord])=>({number,cardinal,ordinal,ordinalWord})),
    sourceImages,reviewIssues:data.reviewIssues,limitations:data.limitations};
  fs.writeFileSync(path.join(directory,'extracted-vocabulary.json'),JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
  const escCell=esc,typeName={word:'单词',phrase:'短语',expression:'表达'};
  const lines=['# 六年级上册英语（用户标注“精通”）：图片词表提取审看稿','',
    '单独建档，未与其他年级或版本合并。用户系列标注为“精通”；封面实际可见人民教育出版社、六年级上册及2024标识，未见“精通”字样，系列对应关系待核。',
    `转录 ${checked.summary.entries} 条单元词表记录，另整理 ${data.irregularVerbs.length} 条不规则动词及 ${data.numbers.length} 组基数/序数词。A–Z索引由单元词表派生。`,'',
    '| 单元 | 目录起页 | 词条数 |','|---|---:|---:|',...data.units.map(u=>`| ${u.title} | ${u.contentsStartPage} | ${u.entries.length} |`),'',
    '## 待审说明','',...data.reviewIssues.map(i=>'- '+i.term+'：'+i.note),
    '目录中的 Revision 1/2 和歌曲正文未提供。10张来源图均原样保存并附 SHA-256；未导入账号、课程索引或学习记录。',''];
  for(const unit of data.units){lines.push('## '+unit.title,'','| 顺序 | 词语 | 原表释义 | 正文页码 | 星号 | 字体 | 类型 |','|---:|---|---|---:|---|---|---|');
    for(const row of checked.records.filter(r=>r.unitId===unit.unitId))lines.push(`| ${row.order} | ${escCell(row.term)} | ${escCell(row.meaning)} | ${row.sourceTextPage} | ${row.starred?'*':'—'} | ${row.bold?'黑体':'白体'} | ${typeName[row.type]} |`);lines.push('');}
  lines.push('## Appendix 3 Irregular verbs','','| 动词 | 过去式 |','|---|---|',...data.irregularVerbs.map(r=>`| ${escCell(r[0])} | ${escCell(r[1])} |`),'',
    '## Appendix 4 Cardinal and ordinal numbers','','| 数字 | 基数词 | 序数数字 | 序数词 |','|---:|---|---|---|',...data.numbers.map(r=>`| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} |`),'');
  fs.writeFileSync(path.join(directory,'review.md'),lines.join('\n'),{flag:'wx'});
  fs.writeFileSync(path.join(directory,'vocabulary.csv'),csv(['entryId','unit','order','term','meaning','sourceTextPage','starred','bold','type','sourceNote'],checked.records),{flag:'wx'});
  fs.writeFileSync(path.join(directory,'irregular-verbs.csv'),csv(['order','verb','past'],artifact.irregularVerbs),{flag:'wx'});
  fs.writeFileSync(path.join(directory,'cardinal-ordinal-numbers.csv'),csv(['number','cardinal','ordinal','ordinalWord'],artifact.cardinalAndOrdinalNumbers),{flag:'wx'});
  return checked.summary;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const data=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
  if(process.argv[2]==='--check')console.log(JSON.stringify(checkGrade6Upper(data).summary,null,2));
  else{const directory=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'output/textbook-extractions/primary-jingtong-grade6-upper-2024-20261014');
    console.log(JSON.stringify({directory,...generateExtraction(directory)},null,2));}
}
