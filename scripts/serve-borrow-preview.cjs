'use strict';
// Read-only course review in a newly owned temporary app root; no database.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),express=require('../server/node_modules/express');
async function createPreview(port=0,{pilot=false}={}){
 const folder=path.join(root,'drafts/scene-wordbooks/borrow-things-v1/audio-a-v3'),read=file=>JSON.parse(fs.readFileSync(path.join(folder,file),'utf8'));
 let library=read('integrated-v4/library.json');const assets=read('assembled/asset-manifest.json');
 if(pilot){const artifact=JSON.parse(fs.readFileSync(path.join(root,'drafts/scene-wordbooks/borrow-things-v1/pilot-review-v5/review-package.json'),'utf8'));assert.deepEqual(artifact,await require('./prepare-borrow-pilot.cjs').prepare(),'审阅包与来源或实际素材不一致，请先生成新版本');library=artifact.library;}
 const model=require('./lib/vocabulary-materials.cjs'),crypto=require('node:crypto'),hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
 const course=library.courses.find(c=>c.audience==='adult'),previews=[];
 for(const arrangement of pilot?library.courses:[course]){const prepared=(await model.previewCourse(library,arrangement.courseId)).wordbookPackage;
  for(const item of prepared.items){const image=assets.records.find(r=>r.itemId===item.itemId).image;item.images={wide:[image.path],mobile:[image.path]};const {contentRevision,...body}=item;item.contentRevision=hash(body);}
  const book=prepared.index.books[0];book.items=prepared.items.map(({itemId,contentRevision})=>({itemId,contentRevision}));book.revision=hash(book.items);previews.push({course:arrangement,prepared,book});
 }
 const {prepared,book}=previews.find(row=>row.course.courseId===course.courseId);
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'borrow-readonly-preview-')),appRoot=path.join(temp,'app');let server;
 const cleanup=()=>{assert.equal(path.dirname(fs.realpathSync(temp)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(temp).startsWith('borrow-readonly-preview-'));fs.rmSync(temp,{recursive:true,force:true});};
 try{
  require('../e2e/lib/prepare-ui-root')(appRoot);fs.mkdirSync(path.join(appRoot,'content/vocabulary/items'),{recursive:true});
  fs.writeFileSync(path.join(appRoot,'content/vocabulary/index.json'),JSON.stringify({...prepared.index,books:previews.map(row=>row.book)}),{flag:'wx'});
  const sharedItems=new Map();for(const row of previews)for(const item of row.prepared.items){if(sharedItems.has(item.itemId))assert.deepEqual(item,sharedItems.get(item.itemId),'共享任务不能随课程悄悄变化');else sharedItems.set(item.itemId,item);}
  for(const item of sharedItems.values())fs.writeFileSync(path.join(appRoot,'content/vocabulary/items',item.itemId.replace(/:/g,'_')+'.json'),JSON.stringify(item),{flag:'wx'});
  const paths=new Set(assets.records.flatMap(r=>[r.image.path,...r.tracks.map(t=>t.url)]));
  for(const relative of paths)fs.copyFileSync(path.join(root,relative),path.join(appRoot,relative),fs.constants.COPYFILE_EXCL);
  const content=require('../server/services/vocabulary-content').createVocabularyContent({appRoot}),requests=[];
  const arrangement=id=>{const row=previews.find(row=>row.book.bookId===id);assert.ok(row,'未知预览课程');return row;};
  const materials=id=>{const {book,course}=arrangement(id);return {bookId:id,revision:book.revision,level:course.levelProposal,levelStatus:'pending',units:course.units.map(unit=>({unitId:unit.unitId,materials:unit.materialRefs.map(ref=>{const material=library.applications.find(m=>m.materialId===ref.materialId&&m.revision===ref.revision);assert.ok(material);return {...material,lines:material.lines.map(line=>({...line,targets:line.senseRefs.map(ref=>{const sense=library.senses.find(s=>s.senseId===ref.senseId&&s.revision===ref.revision);assert.ok(sense);return {senseId:sense.senseId,word:sense.word,meaning:sense.meaning};})}))};})}))};};
  const app=express();app.use((req,res,next)=>{requests.push({method:req.method,path:req.path});res.set('Cache-Control','no-store');if(!['GET','HEAD'].includes(req.method))return res.status(405).json({error:'草稿预览只读，不保存账号或学习记录'});next();});
  app.get('/api/preview',(req,res)=>res.json({readOnly:true,publishable:false,bookId:book.bookId,courses:previews.map(({course,book})=>({bookId:book.bookId,title:book.title,audience:course.audience,levelReview:'pending',url:'/wordbook-details.html?book='+encodeURIComponent(book.bookId)}))}));
  require('../server/routes/wordbooks').registerWordbookRoutes({app,auth:{authenticate:(req,res)=>res.status(401).json({error:'只读体验，不连接账号'})},study:{capabilities:()=>({wordDictation:true,wordChoice:pilot,chunkOrder:pilot,readAloud:false})},content:{...content,materials,details:id=>{const {course}=arrangement(id);return {...content.details(id),level:{value:course.levelProposal,status:'pending'},materialKinds:[...new Set(course.units.flatMap(unit=>unit.materialRefs.map(ref=>library.applications.find(row=>row.materialId===ref.materialId).kind)))]};}}});
  app.get('/',(req,res)=>res.redirect('/wordbook-details.html?book='+encodeURIComponent(book.bookId)));
  for(const name of ['wordbook.html','wordbook-details.html'])app.get('/'+name,(req,res)=>res.type('html').send(fs.readFileSync(path.join(appRoot,name),'utf8').replace(/(<body\b[^>]*>)/i,'$1<p role="status">只读草稿预览 · A 声音 · 建议等级待审核 · 不保存学习记录／不发布</p>')));
  app.use('/api',(req,res)=>res.status(404).json({error:'预览不提供此接口'}));app.use(require('../server/middleware/static-guard').createStaticGuard());app.use(express.static(appRoot));
  server=await new Promise((resolve,reject)=>{const instance=app.listen(port,'127.0.0.1',()=>resolve(instance));instance.once('error',reject);});
  let closed=false;return {server,appRoot,book,prepared,previews,requests,base:'http://127.0.0.1:'+server.address().port,close:async()=>{if(closed)return;closed=true;await new Promise(resolve=>server.close(resolve));cleanup();}};
 }catch(error){if(server)await new Promise(resolve=>server.close(resolve));cleanup();throw error;}
}
if(require.main===module)createPreview(Number(process.argv[2]||12861),{pilot:process.argv.includes('--pilot')}).then(preview=>{console.log('只读试点预览：'+preview.base+'/ （不连接真实服务／账号）');for(const row of preview.previews)console.log(row.book.title+'：'+preview.base+'/wordbook-details.html?book='+encodeURIComponent(row.book.bookId));for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>preview.close().then(()=>process.exit(0)));}).catch(error=>{console.error(error);process.exitCode=1;});
module.exports={createPreview};
