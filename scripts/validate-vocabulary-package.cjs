'use strict';
// Read-only preflight: deliberately no import, publishing, migration or file writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const model=require('../js/vocabulary-study.cjs'),contract=require('../js/vocabulary-course-contract.js'),engine=require('../landing/sentence-cloze-engine.js');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function validatePackage(directory,assetsRoot){
 const index=model.validateIndex(JSON.parse(fs.readFileSync(path.join(directory,'index.json'),'utf8'))),seen=new Map(),imageFiles=new Set();
 for(const book of index.books){
  if(book.units&&hash(book.units)!==book.structureRevision)throw Error('单元结构版本校验失败：'+book.bookId);
  if(book.catalog?.coverUrl&&!fs.statSync(path.join(assetsRoot,book.catalog.coverUrl)).isFile())throw Error('封面缺失');
  for(const ref of book.items){
   if(seen.has(ref.itemId))continue;
   const item=JSON.parse(fs.readFileSync(path.join(directory,'items',ref.itemId.replace(/:/g,'_')+'.json'),'utf8'));
   const {contentRevision,...body}=item;
   if(item.itemId!==ref.itemId||contentRevision!==ref.contentRevision||hash(body)!==contentRevision)throw Error('内容版本校验失败：'+ref.itemId);
   engine.validate(item.exercise);contract.validateLearning(item,engine);
   if(item.learning?.guidedExpression&&hash(item.learning.guidedExpression.steps)!==item.learning.guidedExpression.revision)throw Error('引导版本校验失败：'+ref.itemId);
   const wide=item.images?.wide,mobile=item.images?.mobile;
   if(!Array.isArray(wide)||!Array.isArray(mobile)||wide.length!==1||mobile.length!==1||wide[0]!==mobile[0]||typeof wide[0]!=='string'||!/^assets\/[A-Za-z0-9._-]+\.webp$/.test(wide[0]))throw Error('每个新教学项目需使用同一张宽屏 WebP（宽屏与窄屏共用）：'+ref.itemId);
   const url=wide[0];
   if(!imageFiles.has(url)){
    const stat=fs.statSync(path.join(assetsRoot,url));if(!stat.isFile()||stat.size<=0||stat.size>=20000)throw Error('教学图片必须小于 20000 bytes：'+url);
    imageFiles.add(url);
   }
   seen.set(ref.itemId,item);
  }
 }
 return {books:index.books.length,items:seen.size,images:imageFiles.size};
}
module.exports={validatePackage};
if(require.main===module){
 const directory=process.argv[2],assetsRoot=process.argv[3];
 if(!directory||!assetsRoot){console.error('用法：node scripts/validate-vocabulary-package.cjs <课程包目录> <资源根目录>（只读）');process.exitCode=1;}
 else try{console.log('课程包只读校验通过',validatePackage(path.resolve(directory),path.resolve(assetsRoot)));}catch(error){console.error(error.message);process.exitCode=1;}
}
