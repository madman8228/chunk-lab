'use strict';
const http=require('http');
const assert=require('node:assert/strict');
const os=require('os');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
const {randomBytes}=require('crypto');
const {chromium}=require('playwright-core');
const ROOT=path.resolve(__dirname,'..');
const PORT=require('./lib/free-port').freePort(9730,100);
const BASE='http://127.0.0.1:'+PORT;
const TMP_DB=fs.mkdtempSync(path.join(os.tmpdir(),'cl-learning-loop-'));
const USERNAME='learning-loop-'+randomBytes(5).toString('hex');
const PASSWORD='learning-loop-isolated-test-password';
let server=null,browser=null;
function startServer(){return new Promise(function(resolve,reject){
  server=spawn(process.execPath,['index.js'],{cwd:path.join(ROOT,'server'),env:Object.assign({},process.env,{CHUNKLAB_DATA_DIR:TMP_DB,PORT:String(PORT),NODE_ENV:'test',REQUIRE_AUTH:'true',PHONE_AUTH_ENABLED:'false',JWT_SECRET:randomBytes(32).toString('hex'),CHUNKLAB_WRITE_PROTOCOL:'3'}),stdio:'ignore'});
  let tries=0;const iv=setInterval(function(){if(server.exitCode!==null){clearInterval(iv);reject(new Error('server exit '+server.exitCode));return;}
    const req=http.get({host:'127.0.0.1',port:PORT,path:'/api/health'},function(res){res.resume();if(res.statusCode===200){clearInterval(iv);resolve();}});req.on('error',function(){});req.setTimeout(600,function(){req.destroy();});if(++tries>300){clearInterval(iv);reject(new Error('server startup timeout'));}},100);
});}
async function operation(token,requestId,type,payload,expectedRev){
  const response=await fetch(BASE+'/api/operations',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({protocol:3,requestId,type,payload,...(expectedRev!==undefined?{expectedRev}:{})})});
  assert.equal(response.status,200,type+' fixture operation accepted: '+await response.text());
}
function stop(){if(server){try{server.kill('SIGKILL');}catch(_){}server=null;}try{fs.rmSync(TMP_DB,{recursive:true,force:true});}catch(_){}}
(async function(){try{
  await startServer();
  const registration=await fetch(BASE+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:USERNAME,password:PASSWORD})});
  assert.equal(registration.status,200,'isolated test account registered');const account=await registration.json();
  const deckId='test-learning',cid='bb07ad1a',sentence='I enjoy a quiet morning.',key=deckId+'#'+cid;
  await operation(account.token,'learning-loop-deck','deck.put',{deck:{id:deckId,name:'测评测试课程',items:[{cid,sentence,translation:'我喜欢安静的早晨。',chunks:['I enjoy','a quiet morning.']}] }},null);
  await operation(account.token,'learning-loop-enrollment','course.enrollment',{courseId:'user-deck:'+deckId,joined:true});
  await operation(account.token,'learning-loop-exposure','learning.exposure',{eventId:'learning-loop-exposure-event',key,deckId,occurredAt:Date.now()-8*86400000,sessionId:'learning-loop-exposure-session'});
  await operation(account.token,'learning-loop-answer','learning.answer',{eventId:'learning-loop-answer-event',key,deckId,ok:true,mode:'chunkSelection',sessionId:'learning-loop-answer-session',occurredAt:Date.now()-8*86400000,firstAttempt:true,assisted:false});
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.addInitScript(function(){
    localStorage.setItem('chunklab_token',arguments[0].token);
    localStorage.setItem('chunklab_manual','1');
    localStorage.setItem('chunklab.storage-owner.v1',JSON.stringify([location.origin,String(arguments[0].userId)]));
  },{token:account.token,userId:account.user.id});
  const page=await context.newPage();
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto(BASE+'/main.html?view=stats&tab=sent&domain=sentence&regression=learning-loop',{waitUntil:'domcontentloaded'});
  const archive=page.locator('#statsPageHost');
  try{await page.waitForFunction(()=>{const host=document.querySelector('#statsPageHost');return !!(host&&host.shadowRoot&&host.shadowRoot.querySelector('[data-tab="sent"]'));},null,{timeout:15000});}
  catch(error){console.error('[learning mastery loop e2e] archive mount diagnostics:',await page.evaluate(()=>({url:location.href,title:document.title,body:document.body.innerText.slice(0,1200),host:document.querySelector('#statsPageHost')?.outerHTML.slice(0,1000),curPage:window._curPage,statsPage:!!window.StatsPage})),pageErrors);throw error;}
  await archive.locator('#statsSentenceSearch').fill('I enjoy a quiet morning');
  try{await archive.locator('.assessment-launch').waitFor({timeout:10000});}
  catch(error){console.error('[learning mastery loop e2e] assessment diagnostics:',await page.evaluate(()=>({text:document.querySelector('#statsPageHost')?.shadowRoot?.textContent.slice(-2200),row:document.querySelector('#statsPageHost')?.shadowRoot?.querySelector('.stats-detail-row')?.outerHTML,mem:window.CL&&CL.loadMem().stats?.bySentence,owner:window.AccountStorage?.owner})));throw error;}
  await archive.locator('.assessment-launch').click();
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
  await page.goto(BASE+'/main.html?view=stats&tab=sent&domain=sentence&regression=learning-loop-result',{waitUntil:'domcontentloaded'});
  const resultArchive=page.locator('#statsPageHost');
  await page.waitForFunction(()=>{const host=document.querySelector('#statsPageHost');return !!(host&&host.shadowRoot&&host.shadowRoot.querySelector('[data-tab="sent"]'));},null,{timeout:15000});
  await resultArchive.locator('#statsSentenceSearch').fill('I enjoy a quiet morning');
  await page.waitForFunction(()=>{const host=document.querySelector('#statsPageHost');return !!(host&&host.shadowRoot&&host.shadowRoot.querySelector('[data-f="initialPassed"]'));});
  const labels=await resultArchive.locator('.stats-detail-row').first().innerText();
  if(!labels.includes('初测通过'))throw new Error('initial test should not immediately grant verified mastery: '+labels);
  await browser.close();browser=null;stop();console.log('[learning mastery loop e2e] passed');
}catch(error){if(browser){try{await browser.close();}catch(_){}}stop();console.error('[learning mastery loop e2e] failed:',error&&error.stack||error);process.exitCode=1;}})();
