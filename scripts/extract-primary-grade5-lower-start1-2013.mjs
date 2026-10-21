import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
export const sourceFile=path.join(root,'docs/source-materials/primary-peoples-education-grade5-lower-start1-2013-20261014.json');
const esc=value=>String(value??'').replaceAll('|','\\|').replaceAll('\n',' ');
const key=value=>String(value).toLocaleLowerCase('en').replaceAll('’',"'").trim();
const csv=(columns,rows)=>'\ufeff'+[columns,...rows.map(row=>columns.map(c=>row[c]))].map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';

export function checkGrade5LowerStart1(data){
  assert.equal(data.textbook.grade,'五年级');assert.equal(data.textbook.volume,'下册');assert.equal(data.textbook.startingGrade,1);
  assert.equal(data.textbook.coverApprovalYear,2013);assert.equal(data.images.length,9);assert.equal(data.units.length,6);
  const records=[];
  data.units.forEach((unit,u)=>{
    assert.equal(unit.unitId,'unit-'+(u+1));
    unit.entries.forEach((row,i)=>{
      assert.equal(row.length,6);const [term,meaning,sourceTextPage,bold,type,sourceNote]=row;
      assert.ok(term&&meaning);assert.ok(Number.isInteger(sourceTextPage));assert.equal(typeof bold,'boolean');assert.ok(data.legend.types.includes(type));
      records.push({entryId:unit.unitId+':entry:'+String(i+1).padStart(3,'0'),unitId:unit.unitId,unit:unit.title,
        order:i+1,term,meaning,sourceTextPage,bold,type,sourceNote});
    });
  });
  const index=new Map();for(const row of records){const k=key(row.term);if(!index.has(k))index.set(k,{term:row.term,pages:[]});
    if(!index.get(k).pages.includes(row.sourceTextPage))index.get(k).pages.push(row.sourceTextPage);}
  const summary={unitCounts:data.units.map(u=>({unit:u.title,entries:u.entries.length})),entries:records.length,uniqueTerms:index.size,
    boldEntries:records.filter(r=>r.bold).length,phraseEntries:records.filter(r=>r.type==='phrase').length};
  assert.equal(records.length,96);return {records,alphabeticalIndex:[...index.values()].sort((a,b)=>a.term.localeCompare(b.term,'en')),summary};
}

export function generateExtraction(directory){
  const data=JSON.parse(fs.readFileSync(sourceFile,'utf8')),checked=checkGrade5LowerStart1(data);
  if(fs.existsSync(directory))throw new Error('输出目录已存在，未覆盖原稿。');
  for(const image of data.images)if(!fs.existsSync(image.path))throw new Error('缺少来源图：'+image.id);
  fs.mkdirSync(path.join(directory,'source-images'),{recursive:true});
  const sourceImages=data.images.map(image=>{const file='source-images/image-'+image.id+'.png';fs.copyFileSync(image.path,path.join(directory,file),fs.constants.COPYFILE_EXCL);
    return {id:image.id,role:image.role,printedPage:image.printedPage||null,file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,file))).digest('hex')};});
  const artifact={format:'textbook-vocabulary-extraction',version:1,status:'review-only',textbook:data.textbook,contents:data.contents,
    legend:data.legend,summary:checked.summary,units:data.units.map(({entries,...unit})=>unit),records:checked.records,
    alphabeticalIndex:{entries:checked.alphabeticalIndex,transcriptionNote:'由附录二单元词表派生；未独立逐项转录附录三总词汇表。'},
    sourceImages,reviewIssues:data.reviewIssues,limitations:data.limitations};
  fs.writeFileSync(path.join(directory,'extracted-vocabulary.json'),JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
  const typeName={word:'单词',phrase:'短语'};
  const lines=['# 人教社英语五年级下册（一年级起点，封面审定2013）：图片词表提取审看稿','',
    '独立版本：封面未见 PEP 标识，系列/地区归属未确认；按用户要求与 PEP 版及其他五年级下册版本分别保留。',
    `共转录 ${checked.summary.entries} 条单元词汇记录（${checked.summary.uniqueTerms} 个不同词头）。附录三总词汇表原图已保留，但未独立逐词转录。`,'',
    '| 单元 | 目录起页 | 词条数 |','|---|---:|---:|',...data.units.map(u=>`| ${u.title} | ${u.contentsStartPage} | ${u.entries.length} |`),'',
    '## 待审说明','',...data.reviewIssues.map(i=>'- '+i.term+'：'+i.note),
    '未导入账号、课程索引或学习记录。9张来源图原样保存，并附 SHA-256。',''];
  for(const unit of data.units){lines.push('## '+unit.title,'','| 顺序 | 词语 | 释义 | 正文页码 | 粗体重点词 | 类型 |','|---:|---|---|---:|---|---|');
    for(const row of checked.records.filter(r=>r.unitId===unit.unitId))lines.push(`| ${row.order} | ${esc(row.term)} | ${esc(row.meaning)} | ${row.sourceTextPage} | ${row.bold?'是':'否'} | ${typeName[row.type]} |`);lines.push('');}
  fs.writeFileSync(path.join(directory,'review.md'),lines.join('\n'),{flag:'wx'});
  fs.writeFileSync(path.join(directory,'vocabulary.csv'),csv(['entryId','unit','order','term','meaning','sourceTextPage','bold','type','sourceNote'],checked.records),{flag:'wx'});
  return checked.summary;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const data=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
  if(process.argv[2]==='--check')console.log(JSON.stringify(checkGrade5LowerStart1(data).summary,null,2));
  else{const directory=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'output/textbook-extractions/primary-peoples-education-grade5-lower-start1-2013-20261014');
    console.log(JSON.stringify({directory,...generateExtraction(directory)},null,2));}
}
