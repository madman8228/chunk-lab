/* Shared authoring contract; no persistence, publishing or learning writes. */
(function(root){
 'use strict';
 const text=value=>typeof value==='string'&&!!value.trim()&&value.length<=4000;
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 function fields(value,allowed,label){check(value&&typeof value==='object'&&!Array.isArray(value),label+'必须为对象');check(Object.keys(value).every(key=>allowed.includes(key)),label+'包含未知字段');}
 function validate(material,resolveSense){
  fields(material,['materialId','revision','kind','authorship','title','lines'],'应用材料');
  check(typeof resolveSense==='function','应用材料需要词义版本解析器');
  check(['dialogue','reading'].includes(material.kind)&&material.authorship==='original'&&text(material.title)&&Array.isArray(material.lines)&&material.lines.length>0&&material.lines.length<=100,'应用材料类型、来源或内容无效');
  for(const line of material.lines){
   fields(line,['speaker','en','zh','senseRefs'],'应用句子');check(text(line.en)&&text(line.zh),'应用句子需要双语正文');
   if(material.kind==='dialogue')check(text(line.speaker),'对话缺少说话人');else check(line.speaker===undefined,'短文不能混入说话人字段');
   check(Array.isArray(line.senseRefs),'应用目标引用无效');const seen=new Set();
   for(const ref of line.senseRefs){
    fields(ref,['senseId','revision'],'应用词义引用');
    check(typeof ref.senseId==='string'&&typeof ref.revision==='string'&&/^[a-f0-9]{64}$/.test(ref.revision),'应用词义引用无效');
    const sense=resolveSense(ref);check(sense&&sense.senseId===ref.senseId&&sense.revision===ref.revision&&text(sense.word),'应用词义引用不存在或版本不匹配');
    check(!seen.has(sense.senseId),'应用词义重复');seen.add(sense.senseId);
    const escaped=sense.word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');check(new RegExp('(^|[^A-Za-z])'+escaped+'(?=$|[^A-Za-z])','i').test(line.en),'应用正文未出现目标词');
   }
  }
  return material;
 }
 const api={validate};root.VocabularyApplicationMaterial=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
