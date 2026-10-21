'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function verifyHistory(page,archive){
 await page.reload();const history=page.locator('.intro-history');await history.locator('summary').waitFor();
 assert.equal(await history.evaluate(el=>el.open),false);
 await page.evaluate(async archive=>{
  window.historyListCalls=0;window.historyReadCalls=0;window.historyWrites=0;window.failHistoryList=false;window.failHistoryDownload=false;
  const submit=ChunkAPI.submitOperation;ChunkAPI.submitOperation=function(operation,...args){if(operation.type==='vocabulary.browse')historyWrites++;return submit.call(this,operation,...args);};
  const list=ServerStore.listVocabularyBrowseConflictArchives,read=ServerStore.readVocabularyBrowseConflictArchive;
  ServerStore.listVocabularyBrowseConflictArchives=function(...args){historyListCalls++;if(failHistoryList)return Promise.reject(Error('injected history read failure'));return list.apply(this,args);};
  ServerStore.readVocabularyBrowseConflictArchive=function(...args){historyReadCalls++;if(failHistoryDownload)return Promise.reject(Error('injected download failure'));return read.apply(this,args);};
  for(let i=0;i<12;i++){const key=archive.key+'-history-test-'+String(i).padStart(2,'0');await IDBStore.updateSyncMeta(key,old=>{if(old.format)throw Error('must not replace existing archive');return {...archive,key,createdAt:archive.createdAt+i*60000};});}
  window.retainedHistoryTeaching=document.querySelector('.intro-target');
 },archive);
 assert.equal(await page.evaluate(()=>historyListCalls),0);assert.equal(await page.evaluate(()=>historyReadCalls),0);
 await history.locator('summary').focus();await page.keyboard.press('Enter');await history.getByRole('button',{name:'下一页归档',exact:true}).waitFor();
 assert.equal(await history.getByRole('button',{name:'下载归档',exact:true}).count(),10);assert.equal(await page.evaluate(()=>historyReadCalls),0);
 if(process.env.BROWSE_HISTORY_CAPTURE){const directory=path.resolve(__dirname,'../../.impeccable/review/wordbook-intro-history');fs.mkdirSync(directory,{recursive:true});for(const width of [1440,925,390,320]){await page.setViewportSize({width,height:932});await page.evaluate(()=>scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(directory,'history-'+width+'.png'),fullPage:true});}}
 const firstPage=await history.locator('li span').allTextContents();await history.getByRole('button',{name:'下一页归档',exact:true}).click();await history.getByRole('button',{name:'上一页归档',exact:true}).waitFor();assert.equal(await history.getByRole('button',{name:'下载归档',exact:true}).count(),3);
 await history.getByRole('button',{name:'上一页归档',exact:true}).click();await history.getByRole('button',{name:'下一页归档',exact:true}).waitFor();assert.deepEqual(await history.locator('li span').allTextContents(),firstPage);
 await page.evaluate(()=>window.failHistoryList=true);await history.getByRole('button',{name:'刷新归档列表',exact:true}).click();await history.getByRole('button',{name:'重试读取归档',exact:true}).waitFor();assert.match(await history.getByRole('alert').innerText(),/原归档保留/);
 await page.evaluate(()=>window.failHistoryList=false);await history.getByRole('button',{name:'重试读取归档',exact:true}).click();await history.getByRole('button',{name:'下一页归档',exact:true}).waitFor();
 await page.evaluate(()=>window.failHistoryDownload=true);await history.getByRole('button',{name:'下载归档',exact:true}).first().click();await history.getByRole('alert').getByText(/原归档保留/).waitFor();await page.evaluate(()=>window.failHistoryDownload=false);
 const ready=page.waitForEvent('download');await history.getByRole('button',{name:'下载归档',exact:true}).first().click();const download=await ready,stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const actual=JSON.parse(Buffer.concat(chunks).toString('utf8'));assert.deepEqual(actual,archive);
 assert.ok(await page.evaluate(()=>retainedHistoryTeaching.isConnected));
 assert.deepEqual(await page.evaluate(key=>ServerStore.readVocabularyBrowseConflictArchive(key),archive.key),archive);
 assert.equal(await page.evaluate(()=>historyWrites),0);assert.deepEqual(await page.evaluate(()=>ServerStore.pending()),[]);
 await history.locator('summary').click();
 await page.evaluate(()=>{window.historyListOriginal=ServerStore.listVocabularyBrowseConflictArchives;ServerStore.listVocabularyBrowseConflictArchives=()=>new Promise(resolve=>{window.finishLateHistoryRead=resolve;});});
 await history.locator('summary').click();await history.getByRole('status').getByText('正在读取本机归档…',{exact:true}).waitFor();await history.locator('summary').click();
 await page.evaluate(async()=>{finishLateHistoryRead({entries:[{key:'should-not-render',createdAt:1,choice:'cloud',rowCount:1}],nextAfter:null});await Promise.resolve();await Promise.resolve();ServerStore.listVocabularyBrowseConflictArchives=historyListOriginal;});
 assert.equal(await history.evaluate(el=>el.open),false);assert.equal(await history.locator('li').count(),0);
 await history.locator('summary').click();await history.getByRole('button',{name:'下一页归档',exact:true}).waitFor();
 return {afterReload:true,collapsedLazyRead:true,keyboardExpand:true,pagination:true,errorRetry:true,exactDownload:true,noLearningWrites:true,teachingDomPreserved:true,lateReadIgnored:true};
};
