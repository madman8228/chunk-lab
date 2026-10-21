'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const model=require('./lib/vocabulary-illustrations.cjs');
const {createVocabularyImageDelivery,configuredVocabularyImageDelivery}=require('../server/middleware/vocabulary-image-delivery');
test('service worker leaves vocabulary HTTP cache sharing alone, without precaching the library',()=>{
 const vm=require('node:vm'),handlers={};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),{URL,self:{location:{origin:'https://example.com'},addEventListener(name,fn){handlers[name]=fn;}},console});
 for(const image of ['/assets/vocab-u1-apple-wide-v1.webp','/_vocab-images/'+'a'.repeat(64)+'.webp','https://images.example.com/vocabulary/'+'a'.repeat(64)+'.webp']){
  let intercepted=false;handlers.fetch({request:{url:new URL(image,'https://example.com').href,method:'GET'},respondWith(){intercepted=true;}});assert.equal(intercepted,false);
 }
});
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'vocabulary-illustrations-test-'));
 t.after(()=>{if(path.dirname(root)!==fs.realpathSync(os.tmpdir()))throw Error('Unsafe test cleanup');fs.rmSync(root,{recursive:true,force:true});});
 fs.mkdirSync(path.join(root,'assets'));const image=fs.readFileSync(path.join(__dirname,'../assets/vocab-u1-name-wide-v1.webp'));
 for(const name of ['one','two'])fs.writeFileSync(path.join(root,'assets',name+'.webp'),image);
 const courses=['primary-one','primary-two'];
 for(const course of courses){const folder=path.join(root,'output/textbook-extractions',course,'unit1-images');fs.mkdirSync(folder,{recursive:true});const name=course==='primary-one'?'one':'two';fs.writeFileSync(path.join(folder,'batch-01-atlas.report.json'),JSON.stringify({styleReference:'campus-original',cells:[{itemId:'word1',word:'apple',meaning:'苹果',files:[{path:'assets/'+name+'.webp',bytes:image.length,sha256:model.hash(image)}]}]}));}
 return {root,courses,image};
}
test('content hashes deduplicate bytes without losing course bindings or trusting stale review',t=>{
 const f=fixture(t),review={entries:[{bookId:f.courses[0],unitId:'unit1-images',itemId:'word1',image:'/assets/one.webp',sha256:model.hash(f.image),status:'pass'}]};
 const catalog=model.buildCatalog(f.root,{courses:f.courses,reviews:[review]});
 assert.equal(catalog.assets.length,1);assert.equal(catalog.bindings.length,2);assert.equal(Object.keys(catalog.aliases).length,2);assert.equal(catalog.bindings[0].review,'pass');assert.equal(catalog.bindings[1].review,'pending');
 review.entries[0].sha256='0'.repeat(64);assert.equal(model.buildCatalog(f.root,{courses:f.courses,reviews:[review]}).bindings[0].review,'pending');
 fs.writeFileSync(path.join(f.root,'assets/one.webp'),Buffer.alloc(20000));assert.throws(()=>model.inspect(f.root,'assets/one.webp'),/20000/);
});
test('reuse requires sense, audience, style and reviewed target scene; produces a new draft',t=>{
 const f=fixture(t),catalog=model.buildCatalog(f.root,{courses:f.courses,reviews:[{entries:[{bookId:f.courses[0],unitId:'unit1-images',itemId:'word1',image:'/assets/one.webp',sha256:model.hash(f.image),status:'pass'}]}]});
 const manifest={batchId:'test',styleReference:'campus-original',cells:[{itemId:'new1',word:'apple',meaning:'苹果'}]};
 assert.equal(model.plan(catalog,manifest,{stage:'primary'}).items[0].action,'select-approved-image');
 assert.equal(model.plan(catalog,manifest,{stage:'junior'}).items[0].candidates.length,0);
 assert.equal(model.plan(catalog,manifest,{stage:'adult'}).items[0].candidates.length,0,'child audience approval cannot authorize adult reuse');
 assert.throws(()=>model.plan(catalog,manifest,{stage:'unknown'}),/explicit/);
 assert.equal(model.plan(catalog,{...manifest,styleReference:'other'},{stage:'primary'}).items[0].candidates.length,0);
 assert.equal(model.plan(catalog,{...manifest,cells:[{itemId:'new1',word:'apple',meaning:'公司'}]},{stage:'primary'}).items[0].candidates.length,0);
 const draft={items:[{...manifest.cells[0],images:{wide:[],mobile:[]}}]},binding=catalog.bindings[0],selection={itemId:'new1',assetId:binding.assetId,sourceKey:binding.sourceKey,sceneReviewed:true};
 const input={catalog,manifest,draft,selections:[selection],stage:'primary'};
 const result=model.applyReuse(f.root,input);assert.deepEqual(result.items[0].images,{wide:['assets/one.webp'],mobile:['assets/one.webp']});assert.equal(draft.items[0].images.wide.length,0);
 assert.throws(()=>model.applyReuse(f.root,{...input,selections:[{...selection,sceneReviewed:false}]}),/scene review/);
 assert.throws(()=>model.applyReuse(f.root,{...input,draft:result}),/references already/);
});
async function serve(t,delivery){const server=http.createServer((req,res)=>delivery(req,res,()=>{res.writeHead(404);res.end();}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));return 'http://127.0.0.1:'+server.address().port;}
test('different course paths converge on one immutable cache URL; HEAD/ETag and corruption work',async t=>{
 const f=fixture(t),catalog=model.buildCatalog(f.root,{courses:f.courses}),delivery=createVocabularyImageDelivery({root:f.root,catalog}),before=JSON.stringify(catalog),base=await serve(t,delivery);
 assert.equal(delivery.resolveImage('assets/one.webp'),delivery.resolveImage('/assets/two.webp'));assert.match(delivery.resolveImage('assets/one.webp'),/^\/_vocab-images\/[a-f0-9]{64}\.webp$/);assert.equal(delivery.resolveImage('assets/unknown.webp'),'assets/unknown.webp');assert.equal(JSON.stringify(catalog),before);assert.equal(configuredVocabularyImageDelivery(f.root,{}).resolveImage,undefined);
 const a=await fetch(base+'/assets/one.webp',{redirect:'manual'}),b=await fetch(base+'/assets/two.webp',{redirect:'manual'});assert.equal(a.headers.get('location'),b.headers.get('location'));assert.equal(a.headers.get('cache-control'),'no-cache');
 const url=base+a.headers.get('location'),image=await fetch(url);assert.equal(image.status,200);assert.match(image.headers.get('cache-control'),/immutable/);assert.equal((await image.arrayBuffer()).byteLength,f.image.length);
 for(const unknown of ['/constructor','/__proto__','/assets/unknown.webp'])assert.equal((await fetch(base+unknown)).status,404);
 const head=await fetch(url,{method:'HEAD'});assert.equal(head.headers.get('content-length'),String(f.image.length));assert.equal((await head.text()).length,0);
 assert.equal((await fetch(url,{headers:{'If-None-Match':image.headers.get('etag')}})).status,304);
 assert.equal((await fetch(base+'/_vocab-images/'+'0'.repeat(64)+'.webp')).status,404);
 fs.writeFileSync(path.join(f.root,catalog.assets[0].path),Buffer.alloc(10));assert.equal((await fetch(url)).status,503);
});
test('OSS resolves verified hash keys without rewriting courses or accepting arbitrary endpoints',async t=>{
 const f=fixture(t),catalog=model.buildCatalog(f.root,{courses:f.courses}),delivery=createVocabularyImageDelivery({root:f.root,catalog,baseUrl:'https://images.example.com/static'}),base=await serve(t,delivery);
 assert.equal(delivery.resolveImage('assets/one.webp'),'https://images.example.com/static/'+catalog.assets[0].objectKey);
 const r=await fetch(base+'/_vocab-images/'+catalog.assets[0].sha256+'.webp',{redirect:'manual'});assert.equal(r.headers.get('location'),'https://images.example.com/static/'+catalog.assets[0].objectKey);
 for(const url of ['http://images.example.com','https://user:pass@images.example.com','https://images.example.com/?signature=one'])assert.throws(()=>createVocabularyImageDelivery({root:f.root,catalog,baseUrl:url}));
 assert.throws(()=>configuredVocabularyImageDelivery(f.root,{VOCAB_IMAGE_BASE_URL:'https://images.example.com'}),/requires/);
});
