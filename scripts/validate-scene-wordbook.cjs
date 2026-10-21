'use strict';
const fs=require('node:fs'),reviewModel=require('./lib/scene-wordbook-review.cjs');
(async()=>{
 const file=process.argv[2];if(!file)throw Error('用法：node scripts/validate-scene-wordbook.cjs <审阅包 JSON>');
 if(fs.statSync(file).size>10_000_000)throw Error('审阅包过大，请分批审阅');
 const review=JSON.parse(fs.readFileSync(file,'utf8')),{summary}=await reviewModel.prepare(review);
 console.log(JSON.stringify(summary,null,2));
 console.log('结构与现有练习适配检查通过；只读操作，未导入、未保存账号、未发布。');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
