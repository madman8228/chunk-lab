'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const Catalog=require('../js/course-catalog');
const root=path.resolve(__dirname,'..'),batch=path.join(root,'output/audio-production/oral-3000-sentences-v1');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file));
function immutable(file,bytes){fs.mkdirSync(path.dirname(file),{recursive:true});if(fs.existsSync(file))assert.equal(hash(fs.readFileSync(file)),hash(bytes),'Existing file differs: '+file);else fs.writeFileSync(file,bytes,{flag:'wx'});assert.equal(hash(fs.readFileSync(file)),hash(bytes),'Written file verification failed: '+file);}
function atomic(file,bytes){const temp=file+'.oral-audio.tmp';fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(temp,bytes,{flag:'wx'});fs.renameSync(temp,file);}
function prepare(){
  const manifest=read(path.join(root,'content/manifest.json')),shards=read(path.join(root,'server/content/shards.json'));
  assert.equal(manifest.contentVersion,shards.contentVersion);
  const course=manifest.catalog.courses.find(row=>row.id==='builtin:oral');assert.ok(course);
  const ids=new Set(Catalog.listLessons(course).map(lesson=>lesson.contentRef.id));assert.equal(ids.size,65);
  const decks=manifest.decks.filter(deck=>ids.has(deck.id)).map(deck=>({...deck,items:shards.decks.find(row=>row.id===deck.id).shards.flatMap(shard=>read(path.join(root,shard.url)).items)}));
  const previous=read(path.join(root,'output/audio-production/freq-idioms-sentences-v1/audio-manifest.json'));assert.equal(previous.voice,'af_heart');
  const reuse=new Map(previous.records.map(row=>[row.text,row]));
  const items=decks.flatMap(deck=>deck.items.map(item=>{const row=reuse.get(item.sentence.trim());return {deckId:deck.id,cid:item.cid,sentence:item.sentence,...(row?{reuse:{delivery:path.join(root,'output/audio-production/freq-idioms-sentences-v1/delivery',row.file),sha256:row.sha256,durationSeconds:row.durationSeconds}}:{})};}));
  assert.equal(items.length,3259);
  immutable(path.join(batch,'source.json'),Buffer.from(JSON.stringify({courseId:course.id,decks,items},null,2)+'\n'));
  console.log(JSON.stringify({prepared:true,course:course.id,decks:decks.length,sentences:items.length,reuse:items.filter(row=>row.reuse).length,batch}));
}
function release(){
  const source=read(path.join(batch,'source.json')),audio=read(path.join(batch,'audio-manifest.json'));assert.equal(audio.voice,'af_heart');assert.equal(audio.codec,'opus');assert.equal(audio.speed,1);assert.equal(audio.sourceSha256,hash(fs.readFileSync(path.join(batch,'source.json'))));assert.equal(audio.records.length,source.items.length);
  const byId=new Map(audio.records.map(row=>[row.deckId+':'+row.cid,row]));assert.equal(byId.size,source.items.length);
  const selected=new Set(source.decks.map(deck=>deck.id)),overrides=new Map();
  for(const original of source.decks){const deck=structuredClone(original);for(const item of deck.items){const row=byId.get(deck.id+':'+item.cid);assert.equal(row.text,item.sentence.trim());const bytes=fs.readFileSync(path.join(batch,'delivery',row.file));assert.equal(hash(bytes),row.sha256);assert.equal(bytes.length,row.bytes);assert.ok(row.durationSeconds>.25);immutable(path.join(root,'assets',row.file),bytes);item.sentenceAudio={text:row.text,audio:{url:'assets/'+row.file,mimeType:'audio/ogg',sha256:row.sha256,bytes:row.bytes}};}overrides.set(deck.id+'.json',Buffer.from(JSON.stringify({schemaVersion:1,profile:'sentence-deck/1',course:deck},null,2)+'\n'));}
  const overrideDir=path.join(batch,'overrides');fs.mkdirSync(overrideDir,{recursive:true});for(const name of fs.readdirSync(path.join(root,'extra/content-overrides')))if(!overrides.has(name))immutable(path.join(overrideDir,name),fs.readFileSync(path.join(root,'extra/content-overrides',name)));for(const [name,bytes]of overrides)immutable(path.join(overrideDir,name),bytes);
  const stage=path.join(batch,'release'),result=spawnSync(process.execPath,['scripts/build-content.mjs'],{cwd:root,env:{...process.env,CONTENT_OUTPUT_ROOT:stage,CONTENT_OVERRIDE_ROOT:overrideDir},encoding:'utf8'});if(result.status!==0)throw Error(result.stderr||result.stdout);
  const before=read(path.join(root,'server/content/shards.json')),next=read(path.join(stage,'server/content/shards.json'));
  for(const deck of before.decks)if(!selected.has(deck.id))assert.deepEqual(next.decks.find(row=>row.id===deck.id),deck,'Unrelated deck changed: '+deck.id);
  for(const deck of source.decks){const entry=next.decks.find(row=>row.id===deck.id),items=entry.shards.flatMap(shard=>read(path.join(stage,shard.url)).items);assert.deepEqual(items.map(({sentenceAudio,...item})=>item),deck.items.map(({sentenceAudio,...item})=>item),'Teaching data changed: '+deck.id);const current=before.decks.find(row=>row.id===deck.id).shards.flatMap(shard=>read(path.join(root,shard.url)).items);assert.deepEqual(current.map(({sentenceAudio,...item})=>item),deck.items.map(({sentenceAudio,...item})=>item),'Live course changed during generation: '+deck.id);}
  if(!process.argv.includes('--publish')){console.log(JSON.stringify({verified:true,decks:source.decks.length,sentences:audio.records.length,bytes:audio.records.reduce((n,row)=>n+row.bytes,0),stage}));return;}
  const backup=path.join(batch,'backup-'+Date.now());fs.mkdirSync(backup);
  for(const name of ['content/manifest.json','server/content/shards.json',...Array.from(overrides.keys(),name=>'extra/content-overrides/'+name)])if(fs.existsSync(path.join(root,name)))immutable(path.join(backup,name),fs.readFileSync(path.join(root,name)));
  for(const deck of next.decks.filter(deck=>selected.has(deck.id)))for(const shard of [...deck.shards,...deck.indexShards])immutable(path.join(root,shard.url),fs.readFileSync(path.join(stage,shard.url)));
  for(const [name,bytes]of overrides)atomic(path.join(root,'extra/content-overrides',name),bytes);
  for(const name of ['server/content/shards.json','content/manifest.json'])atomic(path.join(root,name),fs.readFileSync(path.join(stage,name)));
  const receipt={courseId:source.courseId,decks:source.decks.length,sentences:audio.records.length,bytes:audio.records.reduce((n,row)=>n+row.bytes,0),contentVersion:next.contentVersion,backup,publishedAt:new Date().toISOString(),scope:'system built-in course; account records unchanged'};immutable(path.join(batch,'publication-receipt.json'),Buffer.from(JSON.stringify(receipt,null,2)));console.log(JSON.stringify({published:true,...receipt}));
}
if(process.argv.includes('--prepare'))prepare();else release();
