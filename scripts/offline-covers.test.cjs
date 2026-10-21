'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const handlers={},stores=new Map(),origin='https://offline.test';let online=true,downloads=0;
 const key=r=>typeof r==='string'?r:r.url;
 const caches={open:async name=>{if(!stores.has(name))stores.set(name,new Map());const rows=stores.get(name);return {match:async r=>rows.get(key(r))?.clone(),put:async(r,v)=>rows.set(key(r),v.clone()),keys:async()=>[...rows.keys()].map(url=>({url})),addAll:async urls=>urls.forEach(url=>rows.set(origin+url,new Response('bundle')))};},keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name)};
 vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{self:{location:{origin},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(name,fn)=>handlers[name]=fn},caches,URL,Response,fetch:async()=>{downloads++;if(!online)throw Error('offline');return new Response('cover',{headers:{'Content-Type':'image/webp'}});}});
 async function load(path){let result;const tasks=[];handlers.fetch({request:{method:'GET',mode:'no-cors',url:origin+path},respondWith:p=>result=p,waitUntil:p=>tasks.push(p)});const response=await result;await Promise.all(tasks);return response;}
 const url='/assets/covers/oral-3000.webp';
 await load(url);online=false;
 let activation;handlers.activate({waitUntil:p=>activation=p});await activation;
 assert.equal((await load(url)).status,200,'previously viewed cover survives activation offline');
 const imageCache='course-images-v1-'+'a'.repeat(64);await caches.open(imageCache);await caches.open('unrelated-cache');
 const old=await caches.open('chunklab-old');await old.put(origin+'/assets/catalog/oral-3000/1_1.webp',new Response('legacy cover',{headers:{'Content-Type':'image/webp'}}));
 await old.put(origin+'/core.js',new Response('old script'));
 handlers.activate({waitUntil:p=>activation=p});await activation;
 assert.equal((await load('/assets/catalog/oral-3000/1_1.webp')).status,200,'legacy cover is preserved before old bundle retirement');
 assert.equal(downloads,1,'cached cover does not require the server');
 assert.ok(stores.has(imageCache)&&stores.has('unrelated-cache'),'activation preserves account image and unrelated caches');
 assert.ok(!stores.get('course-covers-v1').has(origin+'/core.js'),'old scripts never enter the cover cache');
 console.log('Offline covers: on-demand reuse and upgrade preservation passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
