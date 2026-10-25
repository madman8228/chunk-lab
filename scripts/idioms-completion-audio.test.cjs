'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('main.html','utf8');
const playback=html.slice(html.indexOf('var _sentencePlaybackId=0;'),html.indexOf('/* 纯工具函数单源化'));
const finish=html.slice(html.indexOf('function finishSentence(){'),html.indexOf('function nextQuestion(){'));
function fixture(deckId,audio,autoSpeak=false){
  const calls=[],node={disabled:false,innerHTML:'',setAttribute(){},classList:{toggle(){},remove(){},add(){}}};
  const item={cid:'same-cid',sentence:'Give me a thumbs up.',...(audio?{sentenceAudio:{audio:{url:'assets/idiom-fixture.ogg'}}}:{})};
  const context={window:{},S:{deck:{id:deckId},perfectThis:true,status:['ok'],combo:0,perfectCount:0},mem:{settings:{autoSpeak,celebrate:'off'}},cur:()=>item,$:()=>node,
    speechSynthesis:{cancel(){}},_feedbackEffects:{speakSentence(){calls.push('synthesis');}},
    Audio:class{constructor(url){this.url=url;}play(){calls.push(this.url);return Promise.resolve();}pause(){}},
    statDeckId:()=>deckId,serverPersistenceEnabled:()=>false,destroyMainChunkSelection(){},recordSentenceResult(){return {};},renderSchedLine(){},refreshMasterBtn(){},updateCombo(){},SFX:{perfect(){}},showToast(){},clearTimeout(){},setTimeout(){return 1;},_anaTimer:null,updateRing(){},saveStore(){calls.push('save');}};
  vm.createContext(context);vm.runInContext(playback+'\n'+finish,context);return {context,calls};
}
const idioms=fixture('builtin-freq-idioms',true);idioms.context.finishSentence();idioms.context.finishSentence();
assert.deepEqual(idioms.calls,['assets/idiom-fixture.ogg','save'],'one completed assembly plays its packaged audio once even with autoSpeak off');
const other=fixture('other-course',true);other.context.finishSentence();assert.deepEqual(other.calls,['save'],'other courses retain personal audio preference');
const enabled=fixture('other-course',true,true);enabled.context.finishSentence();assert.deepEqual(enabled.calls,['assets/idiom-fixture.ogg','save']);
const preview=fixture('builtin-freq-idioms',true);preview.context.S.readOnlyPreview=true;preview.context.finishSentence();assert.deepEqual(preview.calls,[]);
const review=fixture('builtin-freq-idioms',true);review.context.S.deck.id='srs-fixture';review.context.finishSentence();assert.deepEqual(review.calls,['assets/idiom-fixture.ogg','save'],'review keeps the original course audio policy');
for(const deckId of ['oral-basic','oral-1-1-1','oral-8-39']){const oral=fixture(deckId,true);oral.context.finishSentence();oral.context.finishSentence();assert.deepEqual(oral.calls,['assets/idiom-fixture.ogg','save'],'oral course completion plays once: '+deckId);const oralReview=fixture(deckId,true);oralReview.context.S.deck.id='srs-fixture';oralReview.context.finishSentence();assert.deepEqual(oralReview.calls,['assets/idiom-fixture.ogg','save'],'oral review uses original course identity');}
console.log('Completion audio: packaged idiom audio once, preferences for other courses, read-only preview and saving passed. No database or browser storage.');
