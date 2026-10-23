'use strict';

const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const model=require('./lib/vocabulary-illustrations.cjs');
const {createVocabularyImageDelivery}=require('../server/middleware/vocabulary-image-delivery');
const root=path.resolve(__dirname,'..'),file=path.resolve(process.argv[2]),output=path.resolve(process.argv[3]);
async function run(){
 const bytes=fs.readFileSync(file),catalog=model.validateCatalog(JSON.parse(bytes));
 assert.ok(catalog.reuseResolution,'Expected a reviewed shared catalog');
 for(const asset of catalog.assets){const actual=model.inspect(root,asset.path);assert.equal(actual.assetId,asset.assetId);assert.equal(actual.bytes,asset.bytes);}
 const groups=catalog.reuseResolution.appliedGroups;
 for(const group of groups){const bindings=catalog.bindings.filter(b=>b.reuseDecision?.groupId===group.groupId);assert.equal(bindings.length,group.entryCount);for(const binding of bindings)assert.equal(catalog.aliases[binding.path],group.assetId);}
 const publishedRoot=path.join(root,'server/data/wordbook-publications');
 const realDelivery=createVocabularyImageDelivery({root,catalog,publishedRoot});
 const sample=catalog.bindings.find(b=>b.reuseDecision);assert.ok(realDelivery.resolveImage(sample.path).endsWith(sample.assetId.slice(7)+'.webp'));
 const middleware=createVocabularyImageDelivery({root,catalog});
 const server=http.createServer((req,res)=>middleware(req,res,()=>{res.writeHead(404);res.end();}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const bindings=catalog.bindings.filter(b=>b.reuseDecision?.groupId===sample.reuseDecision.groupId);
  for(const binding of bindings){const response=await fetch(base+'/'+binding.path,{redirect:'manual'});assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/_vocab-images/'+sample.assetId.slice(7)+'.webp');await response.arrayBuffer();}
  const url=base+'/_vocab-images/'+sample.assetId.slice(7)+'.webp',response=await fetch(url);assert.equal(response.status,200);const body=Buffer.from(await response.arrayBuffer());assert.equal(model.hash(body),sample.assetId.slice(7));assert.match(response.headers.get('cache-control'),/immutable/);
  const cached=await fetch(url,{headers:{'If-None-Match':response.headers.get('etag')}});assert.equal(cached.status,304);
  const head=await fetch(url,{method:'HEAD'});assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);
 }finally{await new Promise(resolve=>server.close(resolve));}
 const result={verifiedAt:new Date().toISOString(),catalog:file,catalogSha256:model.hash(bytes),assetsChecked:catalog.assets.length,approvedGroups:groups.length,reusedBindings:groups.reduce((n,g)=>n+g.entryCount,0),checks:['all image bytes, hashes, 16:9 dimensions and <20000-byte budget','all reviewed group aliases','existing publication receipt compatibility','HTTP redirects, content hash, immutable caching, HEAD and 304'],liveChanged:false};
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
