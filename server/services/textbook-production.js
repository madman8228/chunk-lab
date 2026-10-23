'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{fork}=require('node:child_process');
function createTextbookProduction({config}){
 const directory=path.join(config.dataRoot,'textbook-production-jobs'),worker=path.resolve(__dirname,'../../scripts/textbook-release-worker.cjs');let snapshot,loading,items=new Map(),audioFiles=new Map();
 const fail=(text,status=409)=>Object.assign(Error(text),{status});
 const fileFor=id=>{if(!/^[a-f0-9-]{36}$/.test(id))throw fail('任务编号无效',404);return path.join(directory,id+'.json');};
 function child(){const child=fork(worker,[],{cwd:config.appRoot,env:process.env,windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});child.stderr.resume();return child;}
 function publicJob(job){const {config:privateConfig,...result}=job;return result;}
 function job(id){const file=fileFor(id);if(!fs.existsSync(file))throw fail('制作任务不存在',404);const saved=JSON.parse(fs.readFileSync(file,'utf8'));if(['queued','running'].includes(saved.status)&&saved.pid){try{process.kill(saved.pid,0);}catch{saved.status='failed';saved.error='制作进程已停止，已完成的课程和素材保留，可以重试';const tmp=file+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(saved,null,2)+'\n',{flag:'wx'});fs.renameSync(tmp,file);}}return publicJob(saved);}
 function jobs(){if(!fs.existsSync(directory))return [];return fs.readdirSync(directory).filter(name=>/^[a-f0-9-]{36}\.json$/.test(name)).map(name=>job(name.slice(0,-5))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
 function status(refresh=false){
  if(loading)return loading;
  if(snapshot&&!refresh)return Promise.resolve({...snapshot,jobs:jobs().slice(0,10)});
  loading=new Promise((resolve,reject)=>{const process=child();let received=false;process.on('message',message=>{if(message.error){received=true;reject(Error(message.error));}else if(message.status){received=true;snapshot=message.status;items=new Map(message.items.map(book=>[book.id,book]));audioFiles=new Map(message.audioFiles);resolve({...snapshot,jobs:jobs().slice(0,10)});}});process.once('error',reject);process.once('exit',()=>{if(!received)reject(Error('生产核验进程未完成，请重试'));});process.send({mode:'status',config});}).finally(()=>{loading=null;});return loading;
 }
 async function start(body,admin){
  if(!admin?.id)throw fail('管理员身份无效',401);
  if(!['prepare','stage'].includes(body?.action)||!Array.isArray(body.bookIds)||!body.bookIds.length||body.bookIds.length>30||new Set(body.bookIds).size!==body.bookIds.length)throw fail('请选择要制作的教材及操作',400);
  const current=await status();if(body.bookIds.some(id=>!current.books.some(book=>book.id===id)))throw fail('教材不在生产清单中',400);
  const running=jobs().find(j=>['queued','running'].includes(j.status)&&j.pid&&(()=>{try{process.kill(j.pid,0);return true;}catch{return false;}})());if(running)throw fail('已有制作任务运行，请等待完成');
  fs.mkdirSync(directory,{recursive:true});const id=crypto.randomUUID(),file=fileFor(id),record={id,action:body.action,bookIds:body.bookIds,status:'queued',createdAt:new Date().toISOString(),adminId:String(admin.id),results:[],config};
  const processChild=child();record.pid=processChild.pid;fs.writeFileSync(file,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  const failed=error=>{const saved=JSON.parse(fs.readFileSync(file,'utf8'));if(['queued','running'].includes(saved.status)){saved.status='failed';saved.error=error.message;fs.writeFileSync(file,JSON.stringify(saved,null,2)+'\n');}};
  processChild.once('error',failed);processChild.on('message',()=>{snapshot=null;});processChild.once('exit',code=>{snapshot=null;if(code)failed(Error('制作任务异常退出，可检查结果后重试'));});processChild.send({mode:'job',file});return publicJob(record);
 }
 async function itemPage(bookId){await status();if(!items.has(bookId))throw fail('教材不存在',404);const book=items.get(bookId);return {title:book.title,items:book.items};}
 async function audio(sha){await status();if(!/^[a-f0-9]{64}$/.test(sha)||!audioFiles.has(sha))throw fail('音频不存在',404);const asset=audioFiles.get(sha),bytes=fs.readFileSync(asset.file);if(bytes.length!==asset.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==sha)throw fail('音频核验失败');return bytes;}
 return {status,start,job,jobs,itemPage,audio};
}
module.exports={createTextbookProduction};
