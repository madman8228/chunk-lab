import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
export const sourceFile=path.join(root,'docs/source-materials/primary-jingtong-grade6-lower-2013-20261014.json');
const key=value=>String(value).toLocaleLowerCase('en').replaceAll('’',"'").trim();
const esc=value=>String(value??'').replaceAll('|','\\|').replaceAll('\n',' ');
const csv=(columns,rows)=>'\ufeff'+[columns,...rows.map(row=>columns.map(c=>row[c]))].map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';

export function checkJingtongGrade6Lower(data){
  assert.equal(data.textbook.series,'精通');assert.equal(data.textbook.grade,'六年级');assert.equal(data.textbook.volume,'下册');
  assert.equal(data.textbook.coverApprovalYear,2013);assert.equal(data.images.length,6);assert.equal(data.units.length,3);
  const records=[];
  data.units.forEach((unit,u)=>{
    assert.equal(unit.unitId,'unit-'+(u+1));
    unit.entries.forEach((row,i)=>{
      assert.equal(row.length,6);const [term,meaning,bold,type,phonetic,sourceNote]=row;
      assert.ok(term&&meaning);assert.equal(typeof bold,'boolean');assert.ok(data.legend.types.includes(type));
      records.push({entryId:unit.unitId+':entry:'+String(i+1).padStart(3,'0'),unitId:unit.unitId,unit:unit.title,order:i+1,
        term,meaning,bold,type,sourceAppendixPage:unit.sourceImages.includes(3)?61:62,phonetic,phoneticSource:phonetic?'as-printed':'not-transcribed',sourceNote});
    });
  });
  const index=new Map();for(const row of records){const k=key(row.term);if(!index.has(k))index.set(k,{term:row.term,phonetic:row.phonetic,meaning:row.meaning,unitId:row.unitId});}
  const summary={unitCounts:data.units.map(u=>({unit:u.title,entries:u.entries.length})),entries:records.length,uniqueTerms:index.size,
    boldEntries:records.filter(r=>r.bold).length,phraseEntries:records.filter(r=>r.type==='phrase').length};
  assert.equal(records.length,86);return {records,alphabeticalIndex:[...index.values()].sort((a,b)=>a.term.localeCompare(b.term,'en')),summary};
}

export function generateExtraction(directory){
  const data=JSON.parse(fs.readFileSync(sourceFile,'utf8')),checked=checkJingtongGrade6Lower(data);
  if(fs.existsSync(directory))throw new Error('输出目录已存在，未覆盖原稿。');
  for(const image of data.images)if(!fs.existsSync(image.path))throw new Error('缺少来源图：'+image.id);
  fs.mkdirSync(path.join(directory,'source-images'),{recursive:true});
  const sourceImages=data.images.map(image=>{const file='source-images/image-'+image.id+'.png';fs.copyFileSync(image.path,path.join(directory,file),fs.constants.COPYFILE_EXCL);
    return {id:image.id,role:image.role,printedPage:image.printedPage||null,file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,file))).digest('hex')};});
  const artifact={format:'textbook-vocabulary-extraction',version:1,status:'review-only',textbook:data.textbook,contents:data.contents,legend:data.legend,
    summary:checked.summary,units:data.units.map(({entries,...unit})=>unit),records:checked.records,
    alphabeticalIndex:{entries:checked.alphabeticalIndex,transcriptionNote:'由附录二单元词汇表派生；附录三原图已保留，音标未逐项独立转录。'},
    sourceImages,reviewIssues:data.reviewIssues,limitations:data.limitations};
  fs.writeFileSync(path.join(directory,'extracted-vocabulary.json'),JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
  const typeName={word:'单词',phrase:'短语'};
  const lines=['# 人教精通英语六年级下册（封面审定2013）：图片词表提取审看稿','',
    '按用户确认的精通六年级下册单独建档；封面可见三年级起点、教育部审定2013。未与其他册次/系列合并。',
    `共转录 ${checked.summary.entries} 条单元词汇记录（${checked.summary.uniqueTerms} 个词头）。Appendix 3的音标未逐项录入，A–Z原图保留。`,'',
    '| 单元 | 目录起页 | 条目数 |','|---|---:|---:|',...data.units.map(u=>`| ${u.title} | ${u.contentsStartPage} | ${u.entries.length} |`),'',
    '## 待审说明','',...data.reviewIssues.map(i=>'- '+i.term+'：'+i.note),
    '单元词汇表附录页码用于定位原图；正文页码未在所给单元词表中标注。未导入账号、课程索引或学习记录。',''];
  for(const unit of data.units){lines.push('## '+unit.title,'','| 顺序 | 词语 | 释义 | 黑体 | 类型 | 附录页 |','|---:|---|---|---|---|---:|');
    for(const row of checked.records.filter(r=>r.unitId===unit.unitId))lines.push(`| ${row.order} | ${esc(row.term)} | ${esc(row.meaning)} | ${row.bold?'是':'否'} | ${typeName[row.type]} | ${row.sourceAppendixPage} |`);lines.push('');}
  fs.writeFileSync(path.join(directory,'review.md'),lines.join('\n'),{flag:'wx'});
  fs.writeFileSync(path.join(directory,'vocabulary.csv'),csv(['entryId','unit','order','term','meaning','bold','type','sourceAppendixPage','phonetic','phoneticSource','sourceNote'],checked.records),{flag:'wx'});
  return checked.summary;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const data=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
  if(process.argv[2]==='--check')console.log(JSON.stringify(checkJingtongGrade6Lower(data).summary,null,2));
  else{const directory=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'output/textbook-extractions/primary-jingtong-grade6-lower-2013-20261014');
    console.log(JSON.stringify({directory,...generateExtraction(directory)},null,2));}
}
