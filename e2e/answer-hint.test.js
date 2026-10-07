/* answer-hint.test.js · Ctrl+F and its button show the whole sentence without answering */
'use strict';
const http=require('http');
const os=require('os');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
const {chromium}=require('playwright-core');

const ROOT=path.resolve(__dirname,'..');
const PORT=require('./lib/free-port').freePort(9760,100);
const TMP_DB=fs.mkdtempSync(path.join(os.tmpdir(),'cl-answer-hint-'));
const BASE='http://127.0.0.1:'+PORT;
let server=null,browser=null;

function startServer(){return new Promise(function(resolve,reject){
  server=spawn(process.execPath,['index.js'],{cwd:path.join(ROOT,'server'),env:Object.assign({},process.env,{CHUNKLAB_DATA_DIR:TMP_DB,PORT:String(PORT),NODE_ENV:'test'}),stdio:'ignore'});
  let tries=0;const timer=setInterval(function(){
    if(server.exitCode!==null){clearInterval(timer);reject(new Error('server exit '+server.exitCode));return;}
    const req=http.get({host:'127.0.0.1',port:PORT,path:'/api/health'},function(res){res.resume();if(res.statusCode===200){clearInterval(timer);resolve();}});
    req.on('error',function(){});req.setTimeout(600,function(){req.destroy();});
    if(++tries>300){clearInterval(timer);reject(new Error('server startup timeout'));}
  },100);
});}

function stop(){if(server){try{server.kill('SIGKILL');}catch(_){}server=null;}try{fs.rmSync(TMP_DB,{recursive:true,force:true});}catch(_){}}

(async function(){try{
  await startServer();
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});
  const context=await browser.newContext();
  await context.route('**/api/**',route=>route.abort('failed'));
  const page=await context.newPage();
  await page.addInitScript(function(){
    const now=Date.now(),item={cid:'answer-hint-1',sentence:'Slow startup keeps this lesson open.',translation:'慢启动时仍保持课程打开。',chunks:['Slow startup','keeps','this lesson','open.'],hints:['','','','']};
    localStorage.clear();localStorage.setItem('chunklab.storage-owner.v1',JSON.stringify([location.origin,'local']));
    localStorage.setItem('chunklab.v1',JSON.stringify({version:2,decks:[{id:'answer-hint',name:'答案提示测试',items:[item]}],best:{},mastered:{},deletedItems:{},reinforceBook:[],stats:{totalRounds:0,totalAnswered:0,events:[],bySentence:{}},settings:{mode:'choose',sound:false,batchSize:10}}));
  });
  await page.goto(BASE+'/main.html?answer-hint-test=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window._mainBooted&&window.mem&&typeof window.startDeck==='function');
  await page.evaluate(()=>startDeck(window.mem.decks[0],0));
  await page.waitForSelector('#stageChoices .choice');
  const initial=await page.evaluate(()=>({status:S.status.slice(),answers:S.answers.slice(),idx:S.idx,chunkIdx:S.chunkIdx,chunkTotal:S.chunkTotal}));
  await page.keyboard.press('Control+f');
  await page.waitForFunction(()=>{const hint=document.getElementById('answerHint');return hint&&hint.classList.contains('show');});
  const shortcut=await page.evaluate(()=>({text:document.getElementById('answerHint').textContent,status:S.status.slice(),answers:S.answers.slice(),idx:S.idx,chunkIdx:S.chunkIdx,chunkTotal:S.chunkTotal}));
  if(shortcut.text!==itemSentence()||JSON.stringify({status:shortcut.status,answers:shortcut.answers,idx:shortcut.idx,chunkIdx:shortcut.chunkIdx,chunkTotal:shortcut.chunkTotal})!==JSON.stringify(initial))throw new Error('Ctrl+F must only show the full sentence: '+JSON.stringify(shortcut));
  const exposure=await page.evaluate(()=>mem.stats.bySentence[CL.cidKey('answer-hint',cur())]?.learningV1?.lastExposureAt||0);
  if(!exposure||exposure<Date.now()-5000)throw new Error('Showing the answer must persist its exposure time');
  await page.locator('[data-action="reveal"]').click();
  const assistance=await page.evaluate(()=>({hinted:S.hinted,perfect:S.perfectThis}));
  if(!assistance.hinted||assistance.perfect)throw new Error('Viewing the answer must count as assisted practice');
  const button=await page.evaluate(()=>({text:document.getElementById('answerHint').textContent,status:S.status.slice(),answers:S.answers.slice(),idx:S.idx,chunkIdx:S.chunkIdx,chunkTotal:S.chunkTotal}));
  if(button.text!==itemSentence()||JSON.stringify({status:button.status,answers:button.answers,idx:button.idx,chunkIdx:button.chunkIdx,chunkTotal:button.chunkTotal})!==JSON.stringify(initial))throw new Error('Hint button must not fill or advance the answer: '+JSON.stringify(button));
  await page.evaluate(()=>CL.lastSave());
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window._mainBooted&&window.mem);
  const persistedExposure=await page.evaluate(()=>Math.max(0,...Object.values(mem.stats.bySentence||{}).map(row=>Number(row.learningV1?.lastExposureAt)||0)));
  if(persistedExposure<exposure)throw new Error('Answer exposure time must survive a reload');
  await page.evaluate(()=>{S.items=[];S.idx=0;renderQ();});
  if(await page.locator('#answerHint').textContent())throw new Error('Previous answer leaked into empty queue');
  if(await page.locator('#btnMaster').isVisible())throw new Error('Empty queue exposes familiarity action');
  const emptyState=await page.evaluate(()=>{
    const note=document.getElementById('zh'),first=note.firstChild,followup=note.querySelector('.empty-queue-followup');
    return {message:note.textContent,first:first&&first.textContent,followup:followup&&followup.textContent,
      followupDisplay:followup&&getComputedStyle(followup).display,shortcutHidden:document.getElementById('stageTipBar').classList.contains('hidden')};
  });
  if(!emptyState.shortcutHidden||!emptyState.message.includes('没有待学或到期')||
    emptyState.followup!=='到复习时间后会再次推荐。'||emptyState.followupDisplay!=='block')
    throw new Error('Empty due queue must hide shortcuts and put its follow-up on a separate line: '+JSON.stringify(emptyState));
  await page.setViewportSize({width:375,height:812});
  const mobileFollowup=await page.locator('#zh .empty-queue-followup').evaluate(el=>getComputedStyle(el).display);
  if(mobileFollowup!=='block')throw new Error('Empty-state follow-up must remain on its own line on mobile: '+mobileFollowup);
  await browser.close();browser=null;stop();console.log('[answer-hint] shortcut and button show the complete sentence without changing practice state');
}catch(error){if(browser){try{await browser.close();}catch(_){}}stop();console.error('[answer-hint] failed:',error&&error.stack||error);process.exitCode=1;}})();

function itemSentence(){return 'Slow startup keeps this lesson open.';}
