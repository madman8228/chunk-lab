import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
export const sourceFile=path.join(root,'docs/source-materials/primary-pep-grade5-lower-2013-20261014.json');
const esc=value=>String(value??'').replaceAll('|','\\|').replaceAll('\n',' ');
const key=value=>String(value).toLocaleLowerCase('en').replaceAll('’',"'").trim();
const csv=(columns,rows)=>'\ufeff'+[columns,...rows.map(row=>columns.map(c=>row[c]))].map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';

export function checkPepGrade5Lower2013(data){
  assert.equal(data.textbook.series,'PEP');assert.equal(data.textbook.grade,'五年级');assert.equal(data.textbook.volume,'下册');
  assert.equal(data.textbook.coverApprovalYear,2013);assert.equal(data.images.length,13);assert.equal(data.units.length,6);
  const records=[];
  data.units.forEach((unit,u)=>{
    assert.equal(unit.unitId,'unit-'+(u+1));
    unit.entries.forEach((row,i)=>{
      assert.equal(row.length,7);const [term,meaning,bold,type,printedAppendixPage,phonetic,sourceNote]=row;
      assert.ok(term&&meaning);assert.equal(typeof bold,'boolean');assert.ok(data.legend.types.includes(type));
      records.push({entryId:unit.unitId+':entry:'+String(i+1).padStart(3,'0'),unitId:unit.unitId,unit:unit.title,order:i+1,
        term,meaning,bold,type,sourceAppendixPage:printedAppendixPage,phonetic,sourceNote});
    });
  });
  const expressions=[];
  data.usefulExpressions.units.forEach((group,index)=>{
    assert.equal(group.unitId,data.units[index].unitId);
    for(const [i,row] of group.entries.entries())expressions.push({expressionId:group.unitId+':expression:'+String(i+1).padStart(3,'0'),
      unitId:group.unitId,unit:data.units[index].title,order:i+1,english:row[0],chinese:row[1],sourceNote:row[2],appendixPage:group.printedPage});
  });
  const index=new Map();for(const row of records){const k=key(row.term);if(!index.has(k))index.set(k,{term:row.term,pages:[]});
    const item=index.get(k);if(!item.pages.includes(row.sourceAppendixPage))item.pages.push(row.sourceAppendixPage);}
  const summary={unitCounts:data.units.map(u=>({unit:u.title,entries:u.entries.length})),entries:records.length,
    uniqueTerms:index.size,expressionRows:expressions.length,songCount:data.songs.length,proverbCount:data.proverbs.length,
    boldEntries:records.filter(r=>r.bold).length};
  assert.equal(expressions.length,28);assert.equal(data.songs.length,6);assert.equal(data.proverbs.length,6);
  return {records,expressions,alphabeticalIndex:[...index.values()].sort((a,b)=>a.term.localeCompare(b.term,'en')),summary};
}

export function generateExtraction(directory){
  const data=JSON.parse(fs.readFileSync(sourceFile,'utf8')),checked=checkPepGrade5Lower2013(data);
  if(fs.existsSync(directory))throw new Error('输出目录已存在，未覆盖原稿。');
  for(const image of data.images)if(!fs.existsSync(image.path))throw new Error('缺少来源图：'+image.id);
  fs.mkdirSync(path.join(directory,'source-images'),{recursive:true});
  const sourceImages=data.images.map(image=>{const file='source-images/image-'+image.id+'.png';fs.copyFileSync(image.path,path.join(directory,file),fs.constants.COPYFILE_EXCL);
    return {id:image.id,role:image.role,printedPage:image.printedPage||null,file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,file))).digest('hex')};});
  const artifact={format:'textbook-vocabulary-extraction',version:1,status:'review-only',textbook:data.textbook,contents:data.contents,
    legend:data.legend,summary:checked.summary,units:data.units.map(({entries,...unit})=>unit),records:checked.records,
    usefulExpressions:checked.expressions,alphabeticalIndex:{entries:checked.alphabeticalIndex,
      transcriptionNote:'词头及页码由单元词表派生，未作为A–Z原页的独立逐项转录；请对照附录原图审看。'},
    songs:data.songs,proverbs:data.proverbs,sourceImages,reviewIssues:data.reviewIssues,limitations:data.limitations};
  fs.writeFileSync(path.join(directory,'extracted-vocabulary.json'),JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
  const typeName={word:'单词',phrase:'短语',expression:'表达'};
  const lines=['# 人教 PEP 英语五年级下册（封面审定2013）：图片词表提取审看稿','',
    '独立于封面审定2024版建档；本批为待审提取材料，不是已导入课程。具体版次/印次待版权页核实。',
    `转录 ${checked.summary.entries} 条单元词表记录、${checked.summary.expressionRows} 条常用表达、${data.songs.length} 首歌曲及 ${data.proverbs.length} 条谚语。`,
    'A–Z页未独立逐项转录音标和词头；结构化索引由单元表派生。原图共13张，按原样复制并附SHA-256。','',
    '| 单元 | 目录起页 | 词条数 |','|---|---:|---:|',...data.units.map(u=>`| ${u.title} | ${u.contentsStartPage} | ${u.entries.length} |`),'',
    '## 待审说明','',...data.reviewIssues.map(i=>'- '+(i.term?i.term+'：':'')+i.note),
    '黑体按截图的字形粗略记录；类型是整理标注，不是教材原印标签。原图中音标等细节请以附图核对。',''];
  for(const unit of data.units){lines.push('## '+unit.title,'','| 顺序 | 词语 | 原表释义 | 黑体 | 类型 | 附录页 |','|---:|---|---|---|---|---:|');
    for(const row of checked.records.filter(r=>r.unitId===unit.unitId))lines.push(`| ${row.order} | ${esc(row.term)} | ${esc(row.meaning)} | ${row.bold?'是':'否'} | ${typeName[row.type]} | ${row.sourceAppendixPage} |`);lines.push('');}
  lines.push('## 常用表达','','| 单元 | 英文 | 中文 | 教材页 |','|---|---|---|---:|',...checked.expressions.map(r=>`| ${esc(r.unit)} | ${esc(r.english)} | ${esc(r.chinese)} | ${esc(r.sourceNote)} |`),'',
    '## Songs in each unit','',...data.songs.flatMap(s=>['### '+s.title,'',...s.lines,'']),
    '## Proverbs','','| 英文 | 中文 |','|---|---|',...data.proverbs.map(r=>`| ${esc(r[0])} | ${esc(r[1])} |`),'',
    '目录中的 Recycle 1、Recycle 2 正文未提供，未据目录补写。未导入账号、课程索引或学习记录。','');
  fs.writeFileSync(path.join(directory,'review.md'),lines.join('\n'),{flag:'wx'});
  fs.writeFileSync(path.join(directory,'vocabulary.csv'),csv(['entryId','unit','order','term','meaning','bold','type','sourceAppendixPage','phonetic','sourceNote'],checked.records),{flag:'wx'});
  fs.writeFileSync(path.join(directory,'expressions.csv'),csv(['expressionId','unit','order','english','chinese','appendixPage','sourceNote'],checked.expressions),{flag:'wx'});
  return checked.summary;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const data=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
  if(process.argv[2]==='--check')console.log(JSON.stringify(checkPepGrade5Lower2013(data).summary,null,2));
  else{const directory=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'output/textbook-extractions/primary-pep-grade5-lower-2013-20261014');
    console.log(JSON.stringify({directory,...generateExtraction(directory)},null,2));}
}
