'use strict';
// Derived availability only: not course content, learning progress or a feature gate.
const crypto=require('node:crypto'),contract=require('../../js/vocabulary-course-contract'),engine=require('../../landing/sentence-cloze-engine');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function build(book,items){
 const index=new Map(items.map(item=>[item.itemId,item])),refs=new Map(book.items.map(ref=>[ref.itemId,ref])),available=new Map();if(index.size!==book.itemCount||items.length!==book.itemCount)throw Error('学习方式摘要项目数量不一致');
 function practices(ids){const counts=new Map();for(const id of ids){const item=index.get(id),ref=refs.get(id);if(!item||item.contentRevision!==ref?.contentRevision)throw Error('学习方式摘要引用版本不一致');if(!available.has(id))available.set(id,contract.capabilities(item,engine).filter(mode=>contract.separatePractice(mode.practiceType)&&item.learning?.[contract.modes[mode.practiceType].learningKey]));for(const mode of available.get(id))counts.set(mode.practiceType,(counts.get(mode.practiceType)||0)+1);}
  return [...counts].map(([practiceType,itemCount])=>({practiceType,itemCount}));}
 const summary={schemaVersion:1,bookId:book.bookId,bookRevision:book.revision,structureRevision:book.structureRevision||null,practices:practices(book.items.map(ref=>ref.itemId)),units:(book.units||[]).map(unit=>({unitId:unit.unitId,practices:practices(unit.itemIds)}))};return {summary,sha256:hash(summary)};
}
function validate(value,book){
 const summary=value?.summary;if(!summary||value.sha256!==hash(summary)||summary.schemaVersion!==1||summary.bookId!==book.bookId||summary.bookRevision!==book.revision||summary.structureRevision!==(book.structureRevision||null))throw Error('学习方式摘要版本无效');
 if(Object.keys(value).some(key=>!['summary','sha256'].includes(key))||Object.keys(summary).some(key=>!['schemaVersion','bookId','bookRevision','structureRevision','practices','units'].includes(key)))throw Error('学习方式摘要字段无效');
 function counts(rows,limit){if(!Array.isArray(rows))throw Error('学习方式摘要无效');const seen=new Set();for(const row of rows){if(!row||Object.keys(row).some(key=>!['practiceType','itemCount'].includes(key))||!contract.separatePractice(row.practiceType)||seen.has(row.practiceType)||!Number.isSafeInteger(row.itemCount)||row.itemCount<=0||row.itemCount>limit)throw Error('学习方式摘要数量无效');seen.add(row.practiceType);}}
 counts(summary.practices,book.itemCount);const units=book.units||[];if(!Array.isArray(summary.units)||summary.units.length!==units.length)throw Error('学习方式摘要单元无效');
 summary.units.forEach((unit,index)=>{if(!unit||Object.keys(unit).some(key=>!['unitId','practices'].includes(key))||unit.unitId!==units[index].unitId)throw Error('学习方式摘要单元不一致');counts(unit.practices,units[index].itemIds.length);});
 if(units.length)for(const mode of Object.keys(contract.modes).filter(contract.separatePractice))if(summary.units.reduce((sum,unit)=>sum+(unit.practices.find(row=>row.practiceType===mode)?.itemCount||0),0)!==(summary.practices.find(row=>row.practiceType===mode)?.itemCount||0))throw Error('学习方式摘要总量不一致');
 return summary;
}
module.exports={build,validate};
