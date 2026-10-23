'use strict';
const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage();
 await page.setContent('<main id="statsContent"><div id="statsSentenceHeading"></div><div id="statsSentenceHeader"></div><div id="statsCards"></div><div id="statsBody"></div><div id="statsRecordToolbar"></div><div id="statsVocabulary"></div></main><nav id="statsDomains"><button data-domain="all">全部</button><button data-domain="vocabulary">单词</button></nav>');
 await page.evaluate(()=>{
  window.AccountStorage={owner:'fixture'};window.fail=false;window.hold=false;
  window.tab='sent';window.renderStats=()=>window.StatsVocabulary?.render(tab);
  window.ChunkAPI={isLoggedIn:()=>true,request:async url=>{if(hold)await(window.archiveGate||(window.archiveGate=new Promise(resolve=>window.releaseArchive=resolve)));if(fail)throw Error('offline');return url.includes('summary')?{confirmed:true,domains:[]}:{confirmed:true,items:[{id:'one',title:'borrow',at:1791849600000}],nextOffset:null};}};
 });
 await page.addScriptTag({path:path.resolve('js/stats-vocabulary.js')});await page.locator('#statsDomains [data-domain="vocabulary"]').click();await page.getByText('borrow',{exact:true}).waitFor();
 await page.evaluate(()=>{hold=true;StatsVocabulary.load();});
 assert.equal(await page.locator('.archive-word-event').count(),1,'background refresh keeps confirmed records on screen');
 await page.evaluate(()=>{fail=true;hold=false;releaseArchive();});
 await page.getByRole('button',{name:'重试',exact:true}).waitFor();
 assert.equal(await page.locator('.archive-word-event').count(),1,'failed refresh must retain confirmed records');
 await page.evaluate(()=>{AccountStorage.owner='different';renderStats();});
 assert.equal(await page.locator('.archive-word-event').count(),0,'account changes never reuse previous owner content');
 console.log('Vocabulary archive refresh: confirmed records survive failure and account changes cannot reuse prior-owner content.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
