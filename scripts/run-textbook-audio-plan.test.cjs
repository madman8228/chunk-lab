'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {runPlan}=require('./run-textbook-audio-plan.cjs');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'audio-plan-'));
(async()=>{try{
 const batches=['word','sentence','word'].map((kind,i)=>{const dir=path.join(temp,String(i));fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'audio-task-queue.json'),JSON.stringify({book:{bookId:'fixture-'+i},tasks:[{kind}]}));return {bookId:'fixture-'+i,kind,count:1,path:dir};});
 const file=path.join(temp,'production-plan.json');fs.writeFileSync(file,JSON.stringify({format:'textbook-audio-production-plan',schemaVersion:1,publishable:false,batches}));
 let active=0,max=0,calls=0;
 const result=await runPlan({planFile:file,concurrency:2,run:async(command,args)=>{calls++;active++;max=Math.max(max,active);try{await new Promise(resolve=>setTimeout(resolve,5));if(args.includes(batches[1].path))throw Error('isolated generation failure');}finally{active--;}}});
 assert.equal(result.completed,2);assert.equal(result.failed,1);assert.equal(max,2);assert.equal(calls,5,'failure in one batch does not cancel the other word/sentence batches');
 await assert.rejects(()=>runPlan({planFile:file,concurrency:5}),/并发数/);
 batches[0].path=path.dirname(temp);fs.writeFileSync(file,JSON.stringify({format:'textbook-audio-production-plan',schemaVersion:1,publishable:false,batches}));
 await assert.rejects(()=>runPlan({planFile:file,run:()=>{throw Error('must not execute');}}),/越界/);
 console.log('Audio production plan: bounded concurrent word/sentence batches, independent failure reporting and path validation passed.');
}finally{assert.equal(path.dirname(temp),os.tmpdir());assert.ok(path.basename(temp).startsWith('audio-plan-'));fs.rmSync(temp,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
