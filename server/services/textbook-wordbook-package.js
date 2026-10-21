'use strict';
const draftModel=require('../../js/wordbook-draft');
const fail=message=>Object.assign(Error(message),{status:422});
const isTextbook=book=>!!book?.catalog?.facets?.publisherId||String(book?.bookId||'').startsWith('textbook-wordbook:');
function assemble(source){
 if(source?.format!=='textbook-wordbook-package'||source.schemaVersion!==1||!source.book||!Array.isArray(source.units)||!source.units.length||!Array.isArray(source.drafts)||!source.drafts.length)throw fail('请选择整本教材包，包含教材信息、完整单元目录和课程内容');
 if(Object.keys(source).some(key=>!['format','schemaVersion','book','units','drafts'].includes(key)))throw fail('教材包包含不支持的字段');
 const facets=source.book.catalog?.facets;
 if(!facets||['publisherId','seriesId','edition','volume'].some(key=>typeof facets[key]!=='string'||!facets[key].trim()))throw fail('整本教材需注明出版社、系列、版次和册别');
 const expected=new Map(),seenItems=new Set();
 for(const unit of source.units){
  if(!unit||typeof unit.unitId!=='string'||typeof unit.title!=='string'||!unit.title.trim()||!Array.isArray(unit.itemIds)||!unit.itemIds.length||expected.has(unit.unitId))throw fail('完整教材目录的单元无效或重复');
  for(const itemId of unit.itemIds){if(typeof itemId!=='string'||seenItems.has(itemId))throw fail('完整教材目录的词条编号无效或重复');seenItems.add(itemId);}
  expected.set(unit.unitId,unit);
 }
 const items=[],units=new Map();
 for(const draft of source.drafts){
  const errors=draftModel.validate(draft,{requireImages:false});if(errors.length)throw fail(errors.join('；'));
  const actual=draft.book.catalog?.facets;
  for(const key of ['publisherId','seriesId','edition','volume','grades','schoolStages']){
   if(JSON.stringify(actual?.[key])!==JSON.stringify(facets[key]))throw fail('混入了其他教材的单元：'+draft.book.title);
  }
  for(const unit of draft.book.units){
   const wanted=expected.get(unit.unitId);
   if(!wanted||units.has(unit.unitId)||wanted.title!==unit.title)throw fail('单元不在完整目录中、名称不符或重复：'+unit.title);
   units.set(unit.unitId,unit);
   const entries=draft.items.filter(item=>item.unitId===unit.unitId);
   if(JSON.stringify(entries.map(item=>item.itemId))!==JSON.stringify(wanted.itemIds))throw fail('单元词条缺失、多出或顺序不符：'+unit.title);
   items.push(...entries);
  }
 }
 const missing=source.units.filter(unit=>!units.has(unit.unitId));
 if(missing.length)throw fail('教材尚未齐全，缺少：'+missing.map(unit=>unit.title).join('、'));
 const book={...source.book,units:source.units.map(({unitId,title})=>({unitId,title}))};
 const itemMap=new Map(items.map(item=>[item.itemId,item]));
 const result={schemaVersion:1,book,items:source.units.flatMap(unit=>unit.itemIds.map(id=>itemMap.get(id)))};
 const errors=draftModel.validate(result,{requireImages:false});if(errors.length)throw fail(errors.join('；'));
 return result;
}
module.exports={assemble,isTextbook};
