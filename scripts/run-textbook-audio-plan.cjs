'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
async function runPlan({planFile,python='python',concurrency=2,run=runProcess}){
 if(!Number.isSafeInteger(concurrency)||concurrency<1||concurrency>4)throw Error('并发数须为1至4');
 const plan=JSON.parse(fs.readFileSync(planFile,'utf8'));
 if(plan.format!=='textbook-audio-production-plan'||plan.schemaVersion!==1||plan.publishable!==false||!Array.isArray(plan.batches))throw Error('生产任务清单无效');
 const root=fs.realpathSync(path.dirname(planFile)),batches=plan.batches;
 const seen=new Set();
 for(const batch of batches){
  const folder=fs.realpathSync(batch.path),relative=path.relative(root,folder);
  if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative)||seen.has(folder)||!['word','sentence'].includes(batch.kind))throw Error('生产批次越界、重复或类型无效');
  seen.add(folder);
  const queue=JSON.parse(fs.readFileSync(path.join(folder,'audio-task-queue.json'),'utf8'));
  if(queue.book.bookId!==batch.bookId||queue.tasks.length!==batch.count||queue.tasks.some(task=>task.kind!==batch.kind))throw Error('生产批次身份或条数变化');
 }
 let position=0;const results=[];
 await Promise.all(Array.from({length:Math.min(concurrency,batches.length)},async()=>{
  while(position<batches.length){const batch=batches[position++];try{
   const queue=path.join(batch.path,'audio-task-queue.json');
   await run(python,[path.join(__dirname,'generate-textbook-audio-masters.py'),'--queue',queue,'--out',batch.path,'--kind',batch.kind]);
   if(!fs.existsSync(path.join(batch.path,'delivery-manifest.json')))await run(process.execPath,[path.join(__dirname,'package-textbook-audio-delivery.cjs'),'--batch',batch.path,'--kind',batch.kind]);
   results.push({...batch,status:'completed'});
  }catch(error){results.push({...batch,status:'failed',error:error.message});}}
 }));
 return {batches:results.length,completed:results.filter(r=>r.status==='completed').length,failed:results.filter(r=>r.status==='failed').length,results};
}
function runProcess(command,args){return new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:'inherit',windowsHide:true});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('音频制作退出，状态码 '+code)));});}
if(require.main===module){const args=process.argv.slice(2),get=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};const plan=get('--plan');if(!plan)throw Error('需要 --plan');runPlan({planFile:path.resolve(plan),python:get('--python','python'),concurrency:Number(get('--concurrency',2))}).then(result=>{console.log(JSON.stringify(result,null,2));if(result.failed)process.exitCode=1;}).catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={runPlan};
