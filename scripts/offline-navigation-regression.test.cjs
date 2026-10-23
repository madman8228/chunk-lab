'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const handlers={},rows=new Map(),origin='https://offline.test';
 const key=r=>typeof r==='string'?r:r.url;
 const cache={match:async r=>rows.get(key(r)),put:async(r,v)=>rows.set(key(r),v)};
 vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{URL,Response,self:{location:{origin},addEventListener:(n,f)=>handlers[n]=f},caches:{open:async()=>cache,match:cache.match},fetch:async()=>{throw Error('offline');}});
 rows.set(origin+'/decks.html',new Response('course manager'));
 rows.set('/main.html',new Response('wrong homepage'));
 let result;handlers.fetch({request:{method:'GET',mode:'navigate',url:origin+'/decks.html?view=home'},respondWith:p=>result=p});
 assert.equal(await (await result).text(),'course manager','offline query navigation must use the cached course page');
 rows.delete(origin+'/decks.html');
 handlers.fetch({request:{method:'GET',mode:'navigate',url:origin+'/decks.html?view=home'},respondWith:p=>result=p});
 assert.equal((await result).type,'error','missing course page must not masquerade as homepage');
 console.log('Offline navigation regression passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
