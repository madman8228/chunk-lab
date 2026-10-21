'use strict';
const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage();await page.setContent('<button id="btnRestorePersonalBooks">恢复个人单词本</button><input type="file" id="filePersonalBooks"><p id="personalBooksRestoreStatus" hidden></p>');
 await page.evaluate(()=>{
  window.calls=[];window.mode='cancel';window.AccountStorage={owner:'fixture',databaseName:'isolated',sessionEpoch:'1',assertCurrent(){}};
  window.confirm=()=>mode==='success';window.ChunkAPI={getBase:()=>'',getToken:()=> 'fixture-token',request:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});if(mode==='switch'){AccountStorage.owner='other';}if(url.endsWith('preview'))return {eligible:true,bookCount:1,versionCount:2,fingerprint:'a'.repeat(64)};return {confirmed:true,bookCount:1};}};
 });
 await page.addScriptTag({path:path.resolve('js/personal-wordbook-recovery.js')});
 const choose=()=>page.locator('#filePersonalBooks').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'personal-wordbooks-archive',version:1,owner:1,rows:[]}))});
 await choose();await page.getByText('已取消恢复，当前内容未改变。',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>calls.length),1,'cancel sends preview only');
 await page.evaluate(()=>{mode='switch';calls=[];});await choose();await page.getByText(/账号或服务已切换/).waitFor();assert.equal(await page.evaluate(()=>calls.length),1,'account switch never applies recovery');
 await page.evaluate(()=>{mode='success';AccountStorage.owner='fixture';calls=[];});await choose();await page.getByText(/已恢复 1 本个人单词本/).waitFor();
 const requests=await page.evaluate(()=>calls);assert.equal(requests.length,2);assert.equal(requests[1].body.confirmed,true);assert.equal(requests[1].body.fingerprint,'a'.repeat(64));assert.equal(await page.locator('#btnRestorePersonalBooks').isEnabled(),true);
 console.log('Recovery UI: preview-only cancellation, account-switch stop, explicit confirmation and safe completion passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
