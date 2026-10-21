'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
async function main(){
 let durableResolve,receiptResolve;
 const durable=new Promise(resolve=>{durableResolve=resolve;});
 const committed=new Promise(resolve=>{receiptResolve=resolve;});committed.durable=durable;
 const context={Set,Promise,LearningSessionBootstrap:{identity:()=> 'owner'},AccountStorage:{assertCurrent(){}},ServerStore:{submitCommitted:()=>committed}};context.window=context;
 vm.runInNewContext(fs.readFileSync('js/vocabulary-study-store.js','utf8'),context);
 let confirmed=false,exitReady=false;
 const submitted=context.VocabularyStudyStore.submit('vocabulary.complete',{bookId:'b'},'test').then(()=>{confirmed=true;});
 const leaving=context.VocabularyStudyStore.waitForLocalWrites().then(()=>{exitReady=true;});
 await Promise.resolve();assert.equal(exitReady,false,'cannot leave before the local transaction');
 durableResolve({durable:true});await leaving;
 assert.equal(exitReady,true);assert.equal(confirmed,false,'leaving does not require a network receipt');
 receiptResolve({ok:true});await submitted;
 console.log('Course exit waits for local durability without blocking on network confirmation');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
