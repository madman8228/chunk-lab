'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'learning-session-bootstrap.js'),'utf8');
function fixture(){
 let token='token',cache={appliedSeq:9,snapshot:{seq:9,mem:{}}},online=false,ready=false,mode='offline';
 const config={persistenceMode:'server-authoritative',writeProtocol:3,requireAuth:true,responseIdentityVersion:1};
 const window={AccountStorage:{owner:'owner',sessionEpoch:'one',assertCurrent(){}},navigator:{get onLine(){return online;}},ChunkAPI:{getBase:()=>'/api',getToken:()=>token},CL:{preload:async()=>{},ensureCloud:async()=>{},serverPersistenceReady:()=>ready,getCloudConfig:()=>config,getPersistenceState:()=>mode},ServerCache:{read:async()=>cache}};
 vm.runInNewContext(source,{window,...window});
 return {api:window.LearningSessionBootstrap,config,window,setCache(value){cache=value;},setOnline(value){online=value;},setMode(value){mode=value;},setReady(value){ready=value;},changeToken(){token='other';}};
}
(async()=>{
 let f=fixture();await assert.rejects(f.api.ready(),/尚未确认/);
 f.window.ChunkAPI.getToken=()=>null;await assert.rejects(f.api.ready(),error=>error.code==='AUTH_REQUIRED','signed-out sessions cannot read account learning data');
 f=fixture();
 const result=await f.api.ready({allowConfirmedOffline:true});assert.equal(result.source,'confirmed-cache');assert.equal(f.window.CL.serverPersistenceReady(),false,'cached reading must not open the network write gate');
 f=fixture();f.setCache(null);await assert.rejects(f.api.ready({allowConfirmedOffline:true}),/尚未确认/);
 f=fixture();f.setCache({appliedSeq:9,snapshot:{seq:8,mem:{}}});await assert.rejects(f.api.ready({allowConfirmedOffline:true}),/尚未确认/);
 f=fixture();f.config.writeProtocol=2;await assert.rejects(f.api.ready({allowConfirmedOffline:true}),/尚未确认/);
 f=fixture();f.setOnline(true);assert.equal((await f.api.ready({allowConfirmedOffline:true})).source,'confirmed-cache','network failure evidence is stronger than navigator.onLine');
 f=fixture();f.setMode('config-invalid');await assert.rejects(f.api.ready({allowConfirmedOffline:true}),/尚未确认/);
 f=fixture();f.setMode('signed-out');await assert.rejects(f.api.ready({allowConfirmedOffline:true}),/尚未确认/);
 f=fixture();f.window.ServerCache.read=async()=>{f.changeToken();return {appliedSeq:9,snapshot:{seq:9,mem:{}}};};await assert.rejects(f.api.ready({allowConfirmedOffline:true}),/账号已变化/);
 f=fixture();f.setReady(true);assert.equal((await f.api.ready()).source,'server');
 f=fixture();f.window.CL.getCloudStartupError=()=>({code:'SERVER_SEQ_ROLLBACK',message:'确认缓存序号不一致'});await assert.rejects(f.api.ready(),error=>error.code==='SERVER_SEQ_ROLLBACK','startup preserves the specific conflict instead of suggesting a network retry');
 console.log('Learning bootstrap offline confirmed-read isolation passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
