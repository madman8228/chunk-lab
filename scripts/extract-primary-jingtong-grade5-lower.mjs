import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
export const sourceFile=path.join(root,'docs/source-materials/primary-jingtong-grade5-lower-20261014.json');
const key=s=>String(s).toLocaleLowerCase('en').replaceAll('’',"'").trim();
const esc=s=>String(s??'').replaceAll('|','\\|').replaceAll('\n',' ');
const csv=(columns,rows)=>'\ufeff'+[columns,...rows.map(row=>columns.map(c=>row[c]))].map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';

export function checkJingtongGrade5Lower(data){
  assert.equal(data.textbook.series,'精通');assert.equal(data.textbook.grade,'五年级');assert.equal(data.textbook.volume,'下册');
  assert.equal(data.images.length,6);assert.equal(data.units.length,6);
  const records=[],seen=new Set();
  data.units.forEach((unit,u)=>{
    assert.equal(unit.unitId,'unit-'+(u+1));
    unit.entries.forEach((row,i)=>{
      assert.equal(row.length,7);const [term,meaning,bold,type,appendixPage,phonetic,sourceNote]=row;
      assert.ok(term&&meaning);assert.equal(typeof bold,'boolean');assert.ok(data.legend.types.includes(type));
      assert.ok([86,87].includes(appendixPage));assert.ok(!seen.has(key(term)),'重复词头：'+term);seen.add(key(term));
      records.push({entryId:unit.unitId+':entry:'+String(i+1).padStart(3,'0'),unitId:unit.unitId,unit:unit.title,order:i+1,term,meaning,
        bold,type,sourceAppendixPage:appendixPage,phonetic:phonetic||'',phoneticSource:phonetic?'A–Z词汇表':'未标音',sourceNote,sourceImage:appendixPage===86?3:4});
    });
  });
  assert.equal(records.length,143);
  const expressions=records.filter(row=>row.type==='expression');
  const summary={unitCounts:data.units.map(u=>({unit:u.title,entries:u.entries.length})),entries:records.length,uniqueTerms:seen.size,
    boldEntries:records.filter(r=>r.bold).length,phoneticEntries:records.filter(r=>r.phonetic).length,
    phraseEntries:records.filter(r=>r.type==='phrase').length,expressionEntries:expressions.length};
  return {records,summary};
}

export function generateExtraction(directory){
  const data=JSON.parse(fs.readFileSync(sourceFile,'utf8')),checked=checkJingtongGrade5Lower(data);
  if(fs.existsSync(directory))throw new Error('输出目录已存在，未覆盖原稿。');
  for(const image of data.images)if(!fs.existsSync(image.path))throw new Error('缺少来源图：'+image.id);
  fs.mkdirSync(path.join(directory,'source-images'),{recursive:true});
  const sourceImages=data.images.map(image=>{const file='source-images/image-'+image.id+'.png';fs.copyFileSync(image.path,path.join(directory,file),fs.constants.COPYFILE_EXCL);
    return {id:image.id,role:image.role,printedPage:image.printedPage||null,file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,file))).digest('hex')};});
  const alphabet=new Map(checked.records.map(row=>[key(row.term),{term:row.term,phonetic:row.phonetic,meaning:row.meaning,unitId:row.unitId}]));
  const artifact={format:'textbook-vocabulary-extraction',version:1,status:'review-only',textbook:data.textbook,contents:data.contents,legend:data.legend,
    summary:checked.summary,units:data.units.map(({entries,...unit})=>unit),records:checked.records,
    alphabeticalIndex:{entries:[...alphabet.values()].sort((a,b)=>a.term.localeCompare(b.term,'en')),
      transcriptionNote:'词头来自 Appendix 2 单元词表，音标来自 Appendix 3 A–Z 图中有标注的项目；未独立逐项重录 A–Z 词头。'},
    otherContents:data.contents.filter(item=>!item.title.startsWith('Unit ')),sourceImages,reviewIssues:data.reviewIssues,limitations:data.limitations};
  fs.writeFileSync(path.join(directory,'extracted-vocabulary.json'),JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
  const typeName={word:'单词',phrase:'短语',expression:'表达'};
  const lines=['# 人教精通英语五年级下册：图片提取审看稿','','依据用户确认“精通5下”及封面“五年级下册”整理。封面标注“三年级起点”和“教育部审定2013”；具体版次/印次待版权页确认。',
    `共 ${checked.summary.entries} 条单元词条，其中 ${checked.summary.phoneticEntries} 条按 A–Z 页转录了音标。词表附录原页码为86–87；不推测单元课文中的具体页码。`,'',
    '| 单元 | 目录起页 | 条目数 |','|---|---:|---:|',...data.units.map(u=>`| ${u.title} | ${u.contentsStartPage} | ${u.entries.length} |`),'',
    '## 词表','','黑体/白体按附录单元词表的字形记录：黑体要求听、说、读、写；白体要求听、说、认读。音标只在 A–Z 附录实际标出的项目中填写。',
    ...data.reviewIssues.map(i=>'- '+(i.term?i.term+'：':'')+i.note),''];
  for(const unit of data.units){lines.push('## '+unit.title,'','| 顺序 | 词语 | 释义 | 黑体 | 类型 | 附录页 | 音标 |','|---:|---|---|---|---|---:|---|');
    for(const row of checked.records.filter(r=>r.unitId===unit.unitId))lines.push(`| ${row.order} | ${esc(row.term)} | ${esc(row.meaning)} | ${row.bold?'是':'否'} | ${typeName[row.type]} | ${row.sourceAppendixPage} | ${esc(row.phonetic)} |`);lines.push('');}
  lines.push('## 目录中的其他内容','','Fun Time 1、Fun Time 2 正文未提供，未据目录补写。A–Z词汇表保留在原图副本；结构化索引词头由单元词表生成，未将其描述为独立逐条转录。',
    `${data.textbook.printedUsageNotice?`原图使用声明：${data.textbook.printedUsageNotice}。`:'本批截图未见版权页或使用声明；外部传播前请确认授权。'} 本稿仅供个人审核。`,'');
  fs.writeFileSync(path.join(directory,'review.md'),lines.join('\n'),{flag:'wx'});
  fs.writeFileSync(path.join(directory,'vocabulary.csv'),csv(['entryId','unit','order','term','meaning','bold','type','sourceAppendixPage','phonetic','phoneticSource','sourceNote'],checked.records),{flag:'wx'});
  return checked.summary;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const data=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
  if(process.argv[2]==='--check')console.log(JSON.stringify(checkJingtongGrade5Lower(data).summary,null,2));
  else{const directory=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'output/textbook-extractions/primary-jingtong-grade5-lower-20261014');
    console.log(JSON.stringify({directory,...generateExtraction(directory)},null,2));}
}
