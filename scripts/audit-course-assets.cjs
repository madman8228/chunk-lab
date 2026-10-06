'use strict';
// Read-only comparison. Never regenerate, stage, restore or delete course files.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const git=args=>execFileSync('git',['-c','core.safecrlf=false',...args],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
const reference=process.argv[2]||'HEAD';
const original=JSON.parse(git(['show',reference+':content/manifest.json']));
const current=JSON.parse(fs.readFileSync(path.join(root,'content/manifest.json'),'utf8'));
const problems=[],changes=[];
const decks=new Map(current.decks.map(deck=>[deck.id,deck]));
let oldItems=0,newItems=0,checkedFiles=0;
function items(deck,baseline){
  return (deck.shards||[]).flatMap(shard=>{
    const raw=baseline?git(['show',reference+':'+shard.url]):fs.readFileSync(path.join(root,shard.url),'utf8');
    const data=JSON.parse(raw);return data.items||[];
  });
}
for(const deck of current.decks){
  for(const shard of [...deck.shards||[],...deck.indexShards||[]]){
    const file=path.resolve(root,shard.url);
    if(!file.startsWith(root+path.sep)){problems.push('unsafe path '+shard.url);continue;}
    if(!fs.existsSync(file)){problems.push('missing '+shard.url);continue;}
    const raw=fs.readFileSync(file);
    if(shard.sha256&&crypto.createHash('sha256').update(raw).digest('hex')!==shard.sha256)problems.push('hash mismatch '+shard.url);
    checkedFiles++;
  }
}
for(const before of original.decks){
  const after=decks.get(before.id);
  if(!after){problems.push('missing deck '+before.id);continue;}
  const old=items(before,true),now=items(after,false);oldItems+=old.length;newItems+=now.length;
  const counts=new Map();
  const key=item=>JSON.stringify([item.cid||'',item.sentence||item.en||'']);
  for(const item of now)counts.set(key(item),(counts.get(key(item))||0)+1);
  for(const item of old){const k=key(item),count=counts.get(k)||0;if(!count)problems.push('missing identity '+before.id+' '+k);else counts.set(k,count-1);}
  const changed=old.filter(item=>{const next=now.find(candidate=>key(candidate)===key(item));return next&&JSON.stringify(next)!==JSON.stringify(item);}).length;
  if(changed||old.length!==now.length)changes.push({deck:before.id,before:old.length,after:now.length,modified:changed});
}
const deleted=git(['diff','--name-only','--diff-filter=D','--','content']).trim().split(/\r?\n/).filter(Boolean);
const oldPaths=new Set(original.decks.flatMap(deck=>[...deck.shards||[],...deck.indexShards||[]].map(shard=>shard.url)));
const newPaths=new Set(current.decks.flatMap(deck=>[...deck.shards||[],...deck.indexShards||[]].map(shard=>shard.url)));
const unexplained=deleted.filter(file=>!oldPaths.has(file)||newPaths.has(file));
problems.push(...unexplained.map(file=>'unexplained deletion '+file));
console.log(JSON.stringify({reference,oldDecks:original.decks.length,currentDecks:current.decks.length,
  oldItems,newItems,checkedFiles,deletedManifestFiles:deleted.length,unexplainedDeletions:unexplained,
  changedDecks:changes,problems},null,2));
if(problems.length)process.exitCode=1;
