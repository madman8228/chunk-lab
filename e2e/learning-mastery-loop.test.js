'use strict';
const http=require('http');
const os=require('os');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
const {chromium}=require('playwright-core');
const ROOT=path.resolve(__dirname,'..');
const PORT=require('./lib/free-port').freePort(9730,100);
const BASE='http://127.0.0.1:'+PORT;
const TMP_DB=fs.mkdtempSync(path.join(os.tmpdir(),'cl-learning-loop-'));
let server=null,browser=null;
function startServer(){return new Promise(function(resolve,reject){
  server=spawn(process.execPath,['index.js'],{cwd:path.join(ROOT,'server'),env:Object.assign({},process.env,{CHUNKLAB_DATA_DIR:TMP_DB,PORT:String(PORT),NODE_ENV:'test'}),stdio:'ignore'});
  let tries=0;const iv=setInterval(function(){if(server.exitCode!==null){clearInterval(iv);reject(new Error('server exit '+server.exitCode));return;}
    const req=http.get({host:'127.0.0.1',port:PORT,path:'/api/health'},function(res){res.resume();if(res.statusCode===200){clearInterval(iv);resolve();}});req.on('error',function(){});req.setTimeout(600,function(){req.destroy();});if(++tries>300){clearInterval(iv);reject(new Error('server startup timeout'));}},100);
});}
function stop(){if(server){try{server.kill('SIGKILL');}catch(_){}server=null;}try{fs.rmSync(TMP_DB,{recursive:true,force:true});}catch(_){}}
(async function(){try{
  await startServer();
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});
  const context=await browser.newContext();
  await context.route('**/api/**',route=>route.abort('failed'));
  await context.addInitScript(function(){
    if(sessionStorage.getItem('__learning_loop_seeded'))return;
    const now=Date.now(),key='test-learning#bb07ad1a';localStorage.clear();
    localStorage.setItem('chunklab.storage-owner.v1',JSON.stringify([location.origin,'local']));
    localStorage.setItem('chunklab.v1',JSON.stringify({version:2,decks:[{id:'test-learning',name:'测评测试课程',items:[{cid:'bb07ad1a',sentence:'I enjoy a quiet morning.',translation:'我喜欢安静的早晨。',chunks:['I enjoy','a quiet morning.']}]}],best:{},mastered:{},deletedItems:{},stats:{totalRounds:0,totalAnswered:0,events:[],bySentence:{[key]:{deckId:'test-learning',sentence:'I enjoy a quiet morning.',times:1,okTimes:1,wrongTimes:0,streak:1,maxStreak:1,lastAt:now-2*86400000,interval:1,ease:2.5,dueAt:now-86400000}}},settings:{}}));
    sessionStorage.setItem('__learning_loop_seeded','1');
  });
  const page=await context.newPage();
  await page.goto(BASE+'/stats.html?regression=learning-loop',{waitUntil:'domcontentloaded'});
  await page.locator('[data-tab="sent"]').click();
  await page.locator('#statsSentenceSearch').fill('I enjoy a quiet morning');
  await page.waitForSelector('.assessment-launch');
  await page.locator('.assessment-launch').click();
  await page.waitForURL(/assessmentKey=test-learning%23bb07ad1a/);
  await page.waitForSelector('[data-assessment-answer="0"]');
  await page.locator('[data-assessment-answer="0"]').fill('I enjoy');
  await page.locator('[data-assessment-answer="1"]').fill('a quiet morning');
  await page.locator('#btnAssessmentSubmit').click();
  await page.waitForSelector('#btnAssessmentFinalize');
  if(await page.locator('.assessment-results').count())throw new Error('assessment leaked result before final submit');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('#btnAssessmentFinalize');
  await page.locator('#btnAssessmentFinalize').click();
  await page.waitForSelector('#btnAssessmentHome');
  if(!(await page.locator('.result').innerText()).includes('测评通过'))throw new Error('assessment did not pass after refresh resume');
  await page.locator('#btnAssessmentHome').click();
  await page.goto(BASE+'/stats.html?regression=learning-loop-result',{waitUntil:'domcontentloaded'});
  await page.locator('[data-tab="sent"]').click();
  await page.locator('#statsSentenceSearch').fill('I enjoy a quiet morning');
  await page.waitForFunction(()=>document.querySelector('[data-f="initialPassed"]'));
  const labels=await page.locator('.stats-detail-row').first().innerText();
  if(!labels.includes('初测通过'))throw new Error('initial test should not immediately grant verified mastery: '+labels);
  await browser.close();browser=null;stop();console.log('[learning mastery loop e2e] passed');
}catch(error){if(browser){try{await browser.close();}catch(_){}}stop();console.error('[learning mastery loop e2e] failed:',error&&error.stack||error);process.exitCode=1;}})();
