'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),batch=path.join(root,'output/audio-production/freq-idioms-sentences-v1');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function immutable(file,bytes){fs.mkdirSync(path.dirname(file),{recursive:true});if(fs.existsSync(file))assert.equal(hash(fs.readFileSync(file)),hash(bytes),'Existing file differs: '+file);else fs.writeFileSync(file,bytes,{flag:'wx'});}
function main(){
  const source=JSON.parse(fs.readFileSync(path.join(batch,'source.json'))),audio=JSON.parse(fs.readFileSync(path.join(batch,'audio-manifest.json')));
  assert.equal(source.items.length,418);assert.equal(audio.records.length,418);
  const byId=new Map(audio.records.map(row=>[row.cid,row]));assert.equal(byId.size,418);
  const updated=structuredClone(source);
  for(const item of updated.items){const row=byId.get(item.cid);assert.equal(row.text,item.sentence.trim());const bytes=fs.readFileSync(path.join(batch,'delivery',row.file));assert.equal(hash(bytes),row.sha256);assert.equal(bytes.length,row.bytes);assert.ok(row.durationSeconds>.25);immutable(path.join(root,'assets',row.file),bytes);item.sentenceAudio={text:row.text,audio:{url:'assets/'+row.file,mimeType:'audio/ogg',sha256:row.sha256,bytes:row.bytes}};}
  const override={schemaVersion:1,profile:'sentence-deck/1',course:updated};
  const overrideDir=path.join(batch,'overrides');fs.mkdirSync(overrideDir,{recursive:true});
  for(const name of fs.readdirSync(path.join(root,'extra/content-overrides')))immutable(path.join(overrideDir,name),fs.readFileSync(path.join(root,'extra/content-overrides',name)));
  immutable(path.join(overrideDir,source.id+'.json'),Buffer.from(JSON.stringify(override,null,2)+'\n'));
  const stage=path.join(batch,'release');const built=spawnSync(process.execPath,['scripts/build-content.mjs'],{cwd:root,env:{...process.env,CONTENT_OUTPUT_ROOT:stage,CONTENT_OVERRIDE_ROOT:overrideDir},encoding:'utf8'});if(built.status!==0)throw Error(built.stderr||built.stdout);
  const previous=JSON.parse(fs.readFileSync(path.join(root,'server/content/shards.json'))),next=JSON.parse(fs.readFileSync(path.join(stage,'server/content/shards.json')));
  for(const deck of previous.decks)if(deck.id!==source.id)assert.deepEqual(next.decks.find(row=>row.id===deck.id),deck,'Unrelated course changed: '+deck.id);
  const target=next.decks.find(row=>row.id===source.id),items=target.shards.flatMap(shard=>JSON.parse(fs.readFileSync(path.join(stage,shard.url))).items);
  assert.deepEqual(items.map(({sentenceAudio,...item})=>item),source.items,'Teaching content and identities must remain identical');
  if(!process.argv.includes('--publish')){console.log(JSON.stringify({verified:true,sentences:items.length,stage,bytes:audio.records.reduce((sum,row)=>sum+row.bytes,0)}));return;}
  const backup=path.join(batch,'backup-'+Date.now());fs.mkdirSync(backup);
  for(const name of ['content/manifest.json','server/content/shards.json'])immutable(path.join(backup,name),fs.readFileSync(path.join(root,name)));
  immutable(path.join(root,'extra/content-overrides',source.id+'.json'),Buffer.from(JSON.stringify(override,null,2)+'\n'));
  for(const shard of [...target.shards,...target.indexShards])immutable(path.join(root,shard.url),fs.readFileSync(path.join(stage,shard.url)));
  for(const name of ['server/content/shards.json','content/manifest.json']){const file=path.join(root,name),temp=file+'.idiom-audio.tmp';fs.writeFileSync(temp,fs.readFileSync(path.join(stage,name)),{flag:'wx'});fs.renameSync(temp,file);}
  immutable(path.join(batch,'publication-receipt.json'),Buffer.from(JSON.stringify({courseId:source.id,sentences:418,contentVersion:next.contentVersion,backup,publishedAt:new Date().toISOString(),scope:'system built-in catalog; account data unchanged'},null,2)));
  console.log(JSON.stringify({published:true,courseId:source.id,sentences:418,backup,contentVersion:next.contentVersion}));
}
main();
