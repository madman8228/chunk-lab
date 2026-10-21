'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const illustrations=require('./lib/vocabulary-illustrations.cjs');
const {configuredVocabularyImageDelivery}=require('../server/middleware/vocabulary-image-delivery');
const root=path.resolve(__dirname,'..'),source=path.join(root,'output/textbook-extractions');
const trackers=['primary-3-6-pep-jingtong-image-progress-20261016.md','people-grade7-8-image-progress-20261017.md'];
const ids=[...new Set(trackers.flatMap(name=>[...fs.readFileSync(path.join(source,name),'utf8').matchAll(/^\|[^\r\n]*?`((?:primary-|people-grade)[^`]+)`/gm)].map(m=>m[1])))];
const allowed=new Set(),books=[];
for(const id of ids){
 const dir=path.join(source,id);if(!fs.existsSync(dir))continue;
 const units=[];
 for(const unit of fs.readdirSync(dir).filter(n=>/^unit\d+(?:-starter)?-images$/.test(n)).sort((a,b)=>Number(b.includes('starter'))-Number(a.includes('starter'))||a.localeCompare(b,undefined,{numeric:true}))){
  const folder=path.join(dir,unit),items=new Map();
  for(const report of fs.readdirSync(folder).filter(n=>/^batch-.*\.report\.json$/.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))){
   const data=JSON.parse(fs.readFileSync(path.join(folder,report),'utf8'));
   for(const cell of data.cells||[]){
    const file=(cell.files||[]).find(f=>f.path.endsWith('.webp'));if(!file)continue;
    const absolute=path.resolve(root,file.path);if(!absolute.startsWith(root+path.sep)||!fs.existsSync(absolute))continue;
    allowed.add('/'+file.path.replaceAll('\\','/'));
    const next={id:cell.itemId,word:cell.word,meaning:cell.meaning,image:'/'+file.path.replaceAll('\\','/'),sha256:illustrations.hash(fs.readFileSync(absolute)),bytes:fs.statSync(absolute).size,report:path.relative(root,path.join(folder,report)).replaceAll('\\','/')};
    const old=items.get(cell.itemId);if(!old||/-v\d+\.report\.json$/.test(report))items.set(cell.itemId,next);
   }
  }
  units.push({id:unit,title:(unit.includes('starter')?'Starter Unit ':'Unit ')+unit.match(/\d+/)[0],items:[...items.values()].sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}))});
 }
 const grade=id.match(/grade(\d+)/)?.[1],volume=id.includes('-upper-')?'上册':'下册';
 const series=id.startsWith('primary-pep')?'人教 PEP':id.startsWith('primary-jingtong')?'人教精通':'人教版';
 const year=id.match(/-(2013|2024)-/)?.[1];
 books.push({id,title:series+' · '+grade+'年级'+volume+(year?'（'+year+'）':''),units});
}
const data=JSON.stringify({books});
const imageDelivery=configuredVocabularyImageDelivery(root);
const reviewItems=new Map(books.flatMap(b=>b.units.flatMap(u=>u.items.map(i=>[illustrations.sourceKey(b.id,u.id,i.id),{b,u,i}]))));
const server=http.createServer((req,res)=>{
 if(req.method==='POST'&&req.url==='/review-snapshot'){
  if(req.headers.origin!=='http://127.0.0.1:'+server.address().port||req.headers['content-type']!=='application/json'){res.writeHead(403);return res.end();}
  let size=0,chunks=[];req.on('data',chunk=>{size+=chunk.length;if(size>4000000){res.writeHead(413);res.end();req.destroy();}else chunks.push(chunk);});
  req.on('end',()=>{try{
   const body=JSON.parse(Buffer.concat(chunks));if(!Array.isArray(body.entries)||body.entries.length>10000)throw Error('Invalid snapshot');
   const seen=new Set(),entries=body.entries.map(r=>{
    const key=illustrations.sourceKey(r.bookId,r.unitId,r.itemId),source=reviewItems.get(key);
    if(!source||seen.has(key)||!['pass','issue','pending'].includes(r.status)||typeof r.note!=='string'||r.note.length>4000||r.image!==source.i.image||r.sha256!==source.i.sha256)throw Error('Review identity/hash mismatch');seen.add(key);
    return {bookId:r.bookId,unitId:r.unitId,itemId:r.itemId,word:source.i.word,meaning:source.i.meaning,image:source.i.image,sha256:source.i.sha256,status:r.status,note:r.note,updatedAt:r.updatedAt};
   });
   const snapshot={format:'vocabulary-illustration-review',schemaVersion:1,savedAt:new Date().toISOString(),entries},dir=path.join(root,'output/vocabulary-illustrations/reviews');fs.mkdirSync(dir,{recursive:true});
   const name='review-'+Date.now()+'-'+cryptoRandom()+'.json',file=path.join(dir,name);fs.writeFileSync(file,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});
   res.writeHead(201,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({path:path.relative(root,file).replaceAll('\\','/'),entries:entries.length}));
  }catch(error){res.writeHead(422,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}});return;
 }
 imageDelivery(req,res,()=>serve(req,res));
});
function cryptoRandom(){return require('node:crypto').randomBytes(4).toString('hex');}
function serve(req,res){
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 let url;try{url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end();}
 let body,type;
 if(url==='/'||url==='/textbook-image-review.html'){body=fs.readFileSync(path.join(__dirname,'textbook-image-review.html'));type='text/html; charset=utf-8';}
 else if(url==='/review-data.json'){body=data;type='application/json; charset=utf-8';}
 else if(allowed.has(url)){body=fs.readFileSync(path.join(root,url.slice(1)));type='image/webp';}
 else{res.writeHead(404);return res.end('Not found');}
 res.writeHead(200,{'Content-Type':type,'Cache-Control':type==='image/webp'?'private, max-age=3600':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);
}
server.listen(Number(process.env.IMAGE_REVIEW_PORT||4188),'127.0.0.1',()=>console.log(JSON.stringify({url:'http://127.0.0.1:'+server.address().port,books:books.length,items:books.reduce((n,b)=>n+b.units.reduce((m,u)=>m+u.items.length,0),0)})));
