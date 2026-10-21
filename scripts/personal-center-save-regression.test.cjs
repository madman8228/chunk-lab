'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../main.html'),'utf8');
const source=html.slice(html.indexOf("$('btnSaveSettings').onclick ="),html.indexOf('/* API Key 显示/隐藏切换 */'));
(async()=>{
 const nodes=new Map(),calls=[];
 const original={sound:true,shuffle:false,mode:'choose',batchSize:15,dailyGoal:0,celebrate:'confetti',autoSpeak:false,darkMode:false,provider:'deepseek',model:'deepseek-v4-flash',apiKey:''};
 const context={console:{warn(){}},Promise,mem:{settings:{...original}},
  $:id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,disabled:false});return nodes.get(id);},
  normDailyGoal:value=>Number(value)||0,serverPersistenceEnabled:()=>true,newPracticeSessionId:()=> 'synthetic-save',
  ServerStore:{submit:async(type,payload)=>{calls.push({type,payload});if(context.fail)throw Error('synthetic offline');}},
  saveStore:async mode=>{calls.push({localSave:mode});return true;},setSoundIcon(){},renderHome(){},
  document:{documentElement:{classList:{add(){},remove(){}}}},
  showSysToast:message=>{context.message=message;},closeMasks:()=>{context.closed=true;},fail:true};
 vm.createContext(context);vm.runInContext(source,context);
 for(const [id,value] of [['setCelebrate','confetti'],['setProvider','deepseek'],['setModel','deepseek-v4-flash']])context.$(id).value=value;
 const button=context.$('btnSaveSettings');button.onclick();
 await new Promise(setImmediate);
 assert.equal(context.closed,undefined);assert.equal(button.disabled,false);assert.deepEqual(context.mem.settings,original);
 assert.match(context.message,/设置暂未保存/);assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{type:'settings.patch',payload:{patch:{sound:false}}}]);
 context.fail=false;button.onclick();await new Promise(setImmediate);
 assert.equal(context.closed,true);assert.equal(context.mem.settings.sound,false);assert.equal(context.mem.settings.batchSize,15);
 assert.equal(context.mem.settings.mode,'choose');assert.equal(context.mem.settings.shuffle,false);
 assert.deepEqual(calls[calls.length-1],{localSave:'local'});
 const submitted=calls.filter(row=>row.type).length;
 context.closed=false;button.onclick();await new Promise(setImmediate);
 assert.equal(context.closed,true);assert.equal(calls.filter(row=>row.type).length,submitted,'unchanged settings do not generate extra server operations');
 console.log('PASS: failed settings save retains draft/state, retry commits a narrow patch, unrelated practice preferences remain intact, unchanged save sends no operation (isolated VM).');
})().catch(error=>{console.error(error);process.exitCode=1;});
