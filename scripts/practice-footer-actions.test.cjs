'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright-core');
const html=fs.readFileSync('main.html','utf8'),styles=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(row=>row[1]).join('\n');
const markup=html.slice(html.indexOf('<div class="wrap">'),html.indexOf('<!-- 详解弹窗'));
const playback=html.slice(html.indexOf('var _sentencePlaybackId=0;'),html.indexOf('/* 纯工具函数单源化'));
const reset=html.slice(html.indexOf('function resetPracticeSelection(){'),html.indexOf("$('btnResetSelection').onclick=resetPracticeSelection;"));
const click=html.slice(html.indexOf("$('btnSpeak').onclick = function(){"),html.indexOf('function resetPracticeSelection(){'));
const exposure=html.slice(html.indexOf('function recordSentenceExposure(){'),html.indexOf('/* Ctrl+P：'));
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage();
 await page.setContent('<html class="practice-reference-layout"><style>'+styles+'</style><body><div id="answerHint"></div>'+markup+'</body></html>');
 await page.addStyleTag({path:'assets/practice-reference-layout.css'});await page.addScriptTag({path:'js/main-lifecycle.js'});
 await page.addScriptTag({path:'js/icons.js'});await page.evaluate(()=>Icons.install());
 await page.evaluate(()=>{
  window.$=id=>document.getElementById(id);$('pagePractice').classList.remove('hidden');$('btnSpeak').classList.remove('hidden');$('btnResetSelection').hidden=false;
  window.item={sentence:'Give me a thumbs up.',chunks:['Give me','a thumbs up.']};window.cur=()=>item;
  window.S={deck:{id:'fixture'},idx:0,status:['ok','pending'],answers:['Give me',''],chunkIdx:1,wrongAttempts:[1,0],wrongAnswers:[['wrong'],[]],chunkTotal:2,chunkRight:1,attemptId:'original-attempt',sessionId:'original-session',hinted:false,perfectThis:false,hintedChunks:{},spellingDraft:['draft']};
  window.mem={stats:{bySentence:{}}};window.projectionWrites=0;window.saveStore=()=>projectionWrites++;window.statKey=()=> 'fixture-sentence';window.statDeckId=()=> 'fixture';window.serverPersistenceEnabled=()=>false;window.serverWriteProtocol3Enabled=()=>false;
  window.showSysToast=text=>{window.message=text;};window.renderQ=preserve=>{if(!preserve)throw Error('reset allocated new attempt');window.rendered=true;};
  window.speechMock={cancel(){},speak(utterance){window.lastUtterance=utterance;}};
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:speechMock});
  window.SpeechSynthesisUtterance=class{constructor(sentence){this.text=sentence;}};
  window._feedbackEffects=MainLifecycle.createFeedbackEffects({window,document,getCurrentItem:()=>item});
  window.Audio=class{constructor(url){this.url=url;window.lastAudio=this;}play(){return Promise.resolve();}pause(){this.onpause?.();}};
 });
 await page.addScriptTag({content:playback+'\n'+exposure+'\n'+reset+'\n'+click+"\n$('btnResetSelection').onclick=resetPracticeSelection;"});
 await page.getByRole('button',{name:'听全句朗读',exact:true}).click();
 assert.equal(await page.locator('#btnSpeak').getAttribute('aria-pressed'),'false','no fake animation before speech starts');
 assert.equal(await page.evaluate(()=>S.hinted),true,'full answer audio is assisted practice');
 await page.evaluate(()=>lastUtterance.onstart());assert.equal(await page.locator('#btnSpeak').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('.sentence-waves i').count(),3);
 assert.equal(await page.locator('.sentence-waves i').first().evaluate(node=>getComputedStyle(node).animationName),'sentence-wave');
 await page.evaluate(()=>lastUtterance.onend());assert.equal(await page.locator('#btnSpeak').getAttribute('aria-pressed'),'false');
 await page.evaluate(()=>{item._courseAudioUrl='fixture.ogg';speakSentence();lastAudio.onplaying();});assert.equal(await page.locator('#btnSpeak').getAttribute('aria-pressed'),'true');
 await page.evaluate(()=>lastAudio.onpause());assert.equal(await page.locator('#btnSpeak').getAttribute('aria-pressed'),'false');
 await page.evaluate(()=>{lastAudio.onplaying();window.oldAudio=lastAudio;stopSentencePlayback();oldAudio.onplaying();});assert.equal(await page.locator('#btnSpeak').getAttribute('aria-pressed'),'false','stale callbacks cannot restart animation');
 const before=await page.evaluate(()=>structuredClone(S));
 await page.getByRole('button',{name:'重置选择',exact:true}).click();
 const after=await page.evaluate(()=>structuredClone(S));
 for(const key of ['attemptId','sessionId','wrongAttempts','wrongAnswers','chunkTotal','chunkRight'])assert.deepEqual(after[key],before[key],'reset preserves '+key);
 assert.deepEqual(after.status,['pending','pending']);assert.deepEqual(after.answers,['','']);assert.equal(after.hinted,true);assert.equal(after.perfectThis,false);assert.equal(after.chunkIdx,0);
 for(const guard of ['_finishing','_answerQueued','_pendingAnswerOperation','_saveRetry','assessment','finished']){
  assert.equal(await page.evaluate(guard=>{S[guard]=true;const before=JSON.stringify(S);resetPracticeSelection();const unchanged=before===JSON.stringify(S);delete S[guard];return unchanged;},guard),true,'reset blocked by '+guard);
 }
 await page.evaluate(()=>{
  $('zh').textContent='给我竖个大拇指（点个赞）吧。';$('track').innerHTML='<div class="chunk ok" style="--chunk-color:#e74c7a"><div class="chunk-role-wrap"><span class="chunk-role">谓语 + 宾语</span></div><div class="chunk-hint">给我</div><div class="chunk-answer">Give me</div></div>';
  $('track').classList.add('compact-chunks');
 });
 const colors=await page.evaluate(()=>({role:getComputedStyle(document.querySelector('.chunk-role')).color,answer:getComputedStyle(document.querySelector('.chunk-answer')).color}));assert.equal(colors.role,colors.answer,'selected answer matches role color');
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>setSentencePlayback(true));
 assert.equal(await page.locator('.sentence-waves i').first().evaluate(node=>getComputedStyle(node).animationName),'none');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>setSentencePlayback(false));
 fs.mkdirSync('output/playwright/practice-footer',{recursive:true});
 for(const width of [1043,390]){await page.setViewportSize({width,height:932});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.resolve('output/playwright/practice-footer/'+width+'.png'),fullPage:true});}
 console.log('Practice footer: actual speech/audio event-driven waves, stop/stale callback handling, assisted exposure, safe reset guards/evidence retention, matched colors, reduced motion and two widths passed. Isolated page only.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
