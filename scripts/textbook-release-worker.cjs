'use strict';
require('../server/loadenv');
const fs=require('node:fs'),path=require('node:path');
const {loadProduction,publicStatus}=require('./lib/textbook-production.cjs');
function save(file,value){const temporary=file+'.'+process.pid+'.tmp';fs.writeFileSync(temporary,JSON.stringify(value,null,2)+'\n',{flag:'wx'});fs.renameSync(temporary,file);}
function finish(message){if(process.connected)process.send(message,()=>{if(process.connected)process.disconnect();});}
process.once('message',async message=>{
 try{
  if(message.mode==='status'){const snapshot=loadProduction(message.config);finish({status:publicStatus(snapshot),items:snapshot.books.map(book=>({id:book.id,title:book.label,items:book.items})),audioFiles:[...snapshot.audioFiles]});return;}
  const file=message.file,job=JSON.parse(fs.readFileSync(file,'utf8'));job.status='running';job.pid=process.pid;save(file,job);
  const snapshot=loadProduction(job.config);
  job.results=await require('./lib/textbook-release-pipeline.cjs').runRelease({config:job.config,snapshot,bookIds:job.bookIds,action:job.action,onProgress:(results,current)=>{job.results=results;job.current=current||null;job.updatedAt=new Date().toISOString();save(file,job);}});
  job.status=job.results.some(r=>['blocked','failed'].includes(r.status))?'needs-attention':'completed';job.current=null;job.updatedAt=new Date().toISOString();save(file,job);finish({done:true});
 }catch(error){if(message.file){const job=JSON.parse(fs.readFileSync(message.file,'utf8'));job.status='failed';job.error=error.message;save(message.file,job);}finish({error:error.message});process.exitCode=1;}
});
