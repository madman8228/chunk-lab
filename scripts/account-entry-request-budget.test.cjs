'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('main.html','utf8');
const source=html.slice(html.indexOf('var _accountEntryRevision = 0;'),html.indexOf('/* 账号区块：仅多用户模式显示；'));
assert.ok(source.includes('function updateAccountEntry'));
function fixture(){
 let token='a',base='',config={authMode:'password',requireAuth:true},fail=false,gate=null,configs=0,users=0;
 const entry={textContent:'登录',setAttribute(){}},events={};
 const sandbox={JSON,Promise,setTimeout,CL:{getCloudConfig:()=>config},$ :()=>entry,
  ChunkAPI:{getToken:()=>token,getBase:()=>base,getConfig:async()=>{configs++;if(gate)await gate;if(fail)throw Error('offline');return {...config};},me:async()=>{users++;return {user:{username:'user-'+token}};}},
  addEventListener(name,fn){events[name]=fn;}};
 sandbox.window=sandbox;vm.runInNewContext(source,sandbox);
 return {sandbox,entry,events,counts:()=>[configs,users],setToken:value=>{token=value;},setBase:value=>{base=value;},setConfig:value=>{config=value;},fail:value=>{fail=value;},gate:value=>{gate=value;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const f=fixture();await settle();assert.deepEqual(f.counts(),[1,1]);
 for(let i=0;i<5;i++){await f.events['cloud-config-changed']();}
 assert.deepEqual(f.counts(),[1,1],'readiness notifications reuse the confirmed label, not another HTTP read');
 await f.sandbox.refreshAccountEntry();assert.deepEqual(f.counts(),[2,2],'explicit opening always reconfirms');
 f.setToken('b');await f.sandbox.updateAccountEntry();assert.deepEqual(f.counts(),[3,3]);
 f.setBase('https://other.invalid');await f.sandbox.updateAccountEntry();assert.deepEqual(f.counts(),[4,4]);
 f.setConfig({authMode:'phone',requireAuth:true});await f.sandbox.updateAccountEntry();assert.deepEqual(f.counts(),[5,5]);assert.equal(f.entry.textContent,'登录');
 f.setToken(null);await f.sandbox.updateAccountEntry();assert.deepEqual(f.counts(),[6,5]);
 const failure=fixture();await settle();failure.setToken('new');failure.fail(true);
 let release;failure.gate(new Promise(resolve=>{release=resolve;}));
 const first=failure.sandbox.updateAccountEntry(),second=failure.sandbox.updateAccountEntry();release();
 await Promise.all([first,second]);assert.equal(failure.entry.textContent,'登录');
 failure.fail(false);failure.gate(null);await failure.sandbox.updateAccountEntry();assert.equal(failure.entry.textContent,'个人中心','failed confirmation can recover');
 const race=fixture();await settle();let finish;race.gate(new Promise(resolve=>{finish=resolve;}));
 race.setToken('old');const old=race.sandbox.updateAccountEntry();race.setToken('new');race.gate(null);await race.sandbox.updateAccountEntry();finish();await old;
 assert.equal(race.entry.textContent,'个人中心');assert.ok(race.sandbox._accountEntryConfirmedKey.includes('new'),'late old-account response cannot replace current confirmation');
 console.log('Account entry request budget: readiness, explicit refresh, base/account/auth mode changes, shared failures, recovery and late responses passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
