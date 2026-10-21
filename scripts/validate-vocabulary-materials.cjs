'use strict';
const fs=require('node:fs'),model=require('./lib/vocabulary-materials.cjs');
(async()=>{
 const file=process.argv[2];if(!file)throw Error('用法：node scripts/validate-vocabulary-materials.cjs <材料草稿.json>');
 if(fs.statSync(file).size>10_000_000)throw Error('材料草稿过大，请分批审阅');
 const library=JSON.parse(fs.readFileSync(file,'utf8')),indexes=model.validate(library),courses=[];
 for(const course of indexes.courses.values()){
  const result=await model.previewCourse(library,course.courseId);courses.push({courseId:course.courseId,items:result.bindings.length,materialCount:result.applications.reduce((count,unit)=>count+unit.materials.length,0)});
 }
 console.log(JSON.stringify({stage:'draft',publishable:false,sources:indexes.sources.size,senses:indexes.senses.size,activities:indexes.activities.size,applications:indexes.applications.size,courses},null,2));
 console.log('来源、词义和任务固定版本引用及原引擎适配通过；只读检查，不代表内容审核或生产发布通过。');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
