'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../main.html'),'utf8');
const server=fs.readFileSync(require.resolve('../server/feedback.js'),'utf8');
const constants=html.slice(html.indexOf('var FEEDBACK_MAX_IMAGES ='),html.indexOf('/* 版本号：优先取 SW'));
const feedback=html.slice(html.indexOf("$('feedbackFile').onchange ="),html.indexOf("$('btnFeedbackSubmit').onclick ="));
const close=html.slice(html.indexOf('function closeMasks(){'),html.indexOf("document.addEventListener('click'",html.indexOf('function closeMasks(){')));
const restore=html.slice(html.indexOf("$('fileBackup').onchange ="),html.indexOf('/* AI 联网解读已停用',html.indexOf("$('fileBackup').onchange =")));
function fixture(){
 const nodes=new Map(),calls=[];
 const ctx={console,Promise,Map,_feedbackImages:[],_curPage:'pageHome',window:{},
  $:id=>{if(!nodes.has(id))nodes.set(id,{hidden:id!=='settingsMask',textContent:'',value:'selected',files:[]});return nodes.get(id);},
  FileReader:class{readAsDataURL(f){this.result='data:image/png;base64,eA==';this.onload();}readAsText(){this.result='synthetic backup';this.onload();}},
  renderFeedbackImages(){},goPractice:()=>calls.push('navigate'),location:{reload:()=>calls.push('reload')},
  importAllData:(text,cb)=>cb(ctx.restoreOk,'synthetic result'),alert:()=>{},restoreOk:false};
 vm.createContext(ctx);vm.runInContext(constants+feedback+close+restore,ctx);return {ctx,calls};
}
(async()=>{
 const {ctx,calls}=fixture(),MB=1024*1024;
 assert.equal(ctx.FEEDBACK_MAX_SINGLE,Number(server.match(/const MAX_IMAGE_BYTES = (\d+)/)[1])*MB);
 assert.equal(ctx.FEEDBACK_MAX_TOTAL,Number(server.match(/const MAX_IMAGES_TOTAL_BYTES = (\d+)/)[1])*MB);
 async function pick(sizes){const input=ctx.$('feedbackFile');input.files=sizes.map((size,i)=>({size,name:'image-'+i+'.png',type:'image/png'}));input.onchange();await new Promise(setImmediate);}
 await pick([5*MB+1]);assert.equal(ctx._feedbackImages.length,0);assert.match(ctx.$('feedbackMsg').textContent,/超过 5MB/);
 await pick([5*MB,5*MB,2*MB]);assert.equal(ctx._feedbackImages.length,3);assert.equal(ctx._feedbackImages.reduce((n,x)=>n+x.bytes,0),12*MB);
 ctx._feedbackImages=[];await pick([5*MB,5*MB,3*MB]);assert.equal(ctx._feedbackImages.length,2);assert.match(ctx.$('feedbackMsg').textContent,/12MB/);
 ctx._feedbackImages=[];await pick([1,1,1,1]);assert.equal(ctx._feedbackImages.length,3);
 for(const page of ['pageHome','pageMyLearning','pageDiscover','pageStats','pagePractice']){
  ctx._curPage=page;vm.runInContext('closeMasks()',ctx);assert.equal(ctx._curPage,page);assert.equal(calls.length,0);
 }
 const input=ctx.$('fileBackup');input.files=[{name:'synthetic.json'}];input.onchange();assert.equal(calls.length,0,'failed or cancelled recovery never reloads');
 ctx.restoreOk=true;input.onchange();assert.deepEqual(calls,['reload'],'successful recovery reloads, never starts a stale deck');
 assert.ok(!html.includes('setFxStack'),'removed UI has no remaining bindings');
 console.log('PASS: personal-center navigation, screenshot boundaries/count/total and confirmed-only recovery reload; synthetic DOM and backup only, no real data writes.');
})().catch(error=>{console.error(error);process.exitCode=1;});
