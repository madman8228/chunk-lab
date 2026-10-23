'use strict';
// Local acceptance only: new temporary application, database and synthetic accounts.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto'),http=require('node:http'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),express=require('../server/node_modules/express'),Database=require('../server/node_modules/better-sqlite3');
async function createAcceptance(port=14600){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'wordbook-acceptance-')),appRoot=path.join(temp,'app'),dataDir=path.join(temp,'data');
 require('../e2e/lib/prepare-ui-root')(appRoot);fs.mkdirSync(path.join(appRoot,'content/vocabulary'),{recursive:true});fs.writeFileSync(path.join(appRoot,'content/vocabulary/index.json'),JSON.stringify({schemaVersion:1,books:[]}));fs.copyFileSync(path.join(root,'content/manifest.json'),path.join(appRoot,'content/manifest.json'));
 // Main loads the embedded record page dynamically, outside static HTML references.
 fs.copyFileSync(path.join(root,'js/stats-page.js'),path.join(appRoot,'js/stats-page.js'),fs.constants.COPYFILE_EXCL);
 const artifact=await require('./prepare-borrow-pilot.cjs').prepare(),library=artifact.library,course=library.courses.find(row=>row.audience==='adult');
 const draft=JSON.parse(fs.readFileSync(path.join(root,'drafts/scene-wordbooks/borrow-things-v1/audio-a-v3/integrated-v4/wordbook.json'),'utf8'));
 for(const item of draft.items){const activity=library.activities.find(row=>row.itemId===item.itemId);item.wordChoice=activity.wordChoice;item.chunkOrder=activity.chunkOrder;}
 // Give the editable demonstration its own source identity; the reviewed source is untouched.
 draft.book.bookId='acceptance-adult-six';draft.book.title='借东西 · 成人六词（我的课程验收）';
 for(const file of artifact.assets){const destination=path.resolve(appRoot,file.path);assert.ok(destination.startsWith(appRoot+path.sep));fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(root,file.path),destination,fs.constants.COPYFILE_EXCL);}
 for(const file of ['assets/jqka-learning-garden-body-v1.webp','assets/jqka-learning-garden-hero-v1.webp'])if(fs.existsSync(path.join(root,file))&&!fs.existsSync(path.join(appRoot,file)))fs.copyFileSync(path.join(root,file),path.join(appRoot,file));
 const backendPort=require('../e2e/lib/free-port').freePort(15600,200),backend='http://127.0.0.1:'+backendPort,secret=crypto.randomBytes(32).toString('hex'),password=crypto.randomBytes(20).toString('hex');let logs='',server,db,child;
 const childEnv={...process.env,HOST:'127.0.0.1',PORT:String(backendPort),CHUNKLAB_DATA_DIR:dataDir,CHUNKLAB_APP_ROOT:appRoot,NODE_ENV:'test',CHUNKLAB_WRITE_PROTOCOL:'3',REQUIRE_AUTH:'true',PHONE_AUTH_ENABLED:'false',JWT_SECRET:secret,ADMIN_JWT_SECRET:secret,ADMIN_PASSWORD:password,CHUNKLAB_WORD_DICTATION:'true',CHUNKLAB_WORD_CHOICE:'true',CHUNKLAB_CHUNK_ORDER:'true',CHUNKLAB_READ_ALOUD:'false',CHUNKLAB_VOCABULARY_BROWSE:'false'};
 function startBackend(){child=spawn(process.execPath,['index.js'],{cwd:path.join(root,'server'),env:childEnv,stdio:['ignore','pipe','pipe']});child.stdout.on('data',data=>{logs=(logs+data).slice(-12000);});child.stderr.on('data',data=>{logs=(logs+data).slice(-12000);});}
 function stopBackend(){if(!child||child.exitCode!==null)return Promise.resolve();return new Promise(resolve=>{child.once('close',resolve);child.kill();});}
 startBackend();
 async function request(route,token,body){const response=await fetch(backend+route,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Error(route+': '+JSON.stringify(data));return data;}
 try{
  let ready=false;for(let n=0;n<100;n++){if(child.exitCode!==null)throw Error(logs);try{if((await fetch(backend+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}assert.ok(ready,'isolated service failed to start');
  const learner=await request('/api/auth/register',null,{username:'wordbook-reviewer',password}),other=await request('/api/auth/register',null,{username:'wordbook-other',password}),admin=await request('/api/admin/login',null,{password});
  db=new Database(path.join(dataDir,'chunklab.db'));db.exec('CREATE TABLE IF NOT EXISTS user_phone_identities(phone TEXT PRIMARY KEY,user_id INTEGER UNIQUE,verified_at INTEGER)');for(const [i,account] of [learner,other].entries())db.prepare('INSERT INTO user_phone_identities VALUES(?,?,?)').run('acceptance-only-'+i,account.user.id,Date.now());
  const route='/api/admin/vocabulary-material-libraries/acceptance-adult-six',saved=await request(route,admin.token,{library,baseRevision:null});
  const preparation={revision:saved.revision,courseId:course.courseId,images:course.units.flatMap(unit=>unit.activityRefs.map(ref=>({itemId:ref.itemId,url:draft.items.find(item=>item.itemId===ref.itemId).images.wide[0]}))),review:{revision:saved.revision,content:'approved',level:'approved',assets:'approved',rights:'approved',reviewer:'ISOLATED ACCEPTANCE FIXTURE ONLY',note:'Synthetic approvals apply only to the temporary test copy. Original review remains pending.'}};
  const checked=await request(route+'/release/validate',admin.token,preparation);await request(route+'/release/publish',admin.token,{preparation,fingerprint:checked.fingerprint,confirmed:true});
  const app=express();app.use('/review-api',(req,res,next)=>{res.set('Cache-Control','no-store');if(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)return res.status(403).json({error:'仅允许本机验收页面'});next();});
  app.get('/',(req,res)=>res.redirect('/acceptance'));
  app.get('/acceptance',(req,res)=>res.sendFile(path.join(root,'scripts/preview/wordbook-acceptance.html')));
  app.get('/review-assets/:file',(req,res)=>{if(!['wordbook-acceptance.js','wordbook-acceptance.css'].includes(req.params.file))return res.sendStatus(404);res.sendFile(path.join(root,'scripts/preview',req.params.file));});
  app.get('/review-api/sample',(req,res)=>{res.attachment('adult-six-review.json').json(draft);});
  const materialModel=require('./lib/vocabulary-materials.cjs'),materialSample={format:'vocabulary-material-course-draft',schemaVersion:1,libraryRef:{libraryId:'review:borrow-adult',revision:materialModel.revisionOf(library)},courseRef:{courseId:course.courseId,revision:course.revision},library,deliveries:preparation.images.map(image=>{const asset=artifact.assets.find(value=>value.path===image.url);return {itemId:image.itemId,url:image.url,bytes:asset.bytes,sha256:asset.sha256};})};materialModel.prepareDraft(materialSample);
  app.get('/review-api/material-sample',(req,res)=>res.attachment('adult-six-with-materials.json').json(materialSample));
  app.get('/review-api/info',(req,res)=>res.json({isolated:true,materialDraftSupported:true,courseId:course.courseId,words:draft.items.map(item=>({word:item.word,meaning:item.meaning})),review:'pending',microphone:'deferred'}));
  app.post('/review-api/login',express.json(),(req,res)=>{const account=req.body?.account==='other'?other:learner;res.json({token:account.token,account:req.body?.account==='other'?'other':'reviewer'});});
  app.get('/review-api/records',(req,res)=>{
   const account=[learner,other].find(row=>req.headers.authorization==='Bearer '+row.token);if(!account)return res.status(401).json({error:'请先进入测试账号'});const id=account.user.id;
   const words=new Map(draft.items.map(item=>[item.itemId,item.word]));for(const row of db.prepare('SELECT package_json FROM personal_wordbook_versions WHERE user_id=? ORDER BY version DESC LIMIT 200').all(id))for(const item of JSON.parse(row.package_json).items)words.set(item.itemId,item.word);
   const decode=row=>{const {data_json,...rest}=row,data=JSON.parse(data_json);return {...rest,data,word:words.get(row.item_id||data.itemId)||null};};
   res.json({account:account===learner?'reviewer':'other',eventCount:db.prepare('SELECT COUNT(*) n FROM vocabulary_study_events WHERE user_id=?').get(id).n,
    attemptCount:db.prepare('SELECT COUNT(*) n FROM vocabulary_attempt_events WHERE user_id=?').get(id).n,attemptIncorrectCount:db.prepare("SELECT COUNT(*) n FROM vocabulary_attempt_events WHERE user_id=? AND json_extract(data_json,'$.correct')=0").get(id).n,attempts:db.prepare('SELECT * FROM vocabulary_attempt_events WHERE user_id=? ORDER BY seq DESC LIMIT 200').all(id).map(decode),
    events:db.prepare('SELECT * FROM vocabulary_study_events WHERE user_id=? ORDER BY seq DESC LIMIT 200').all(id).map(decode),
    reports:db.prepare('SELECT * FROM vocabulary_practice_reports WHERE user_id=? ORDER BY seq DESC LIMIT 200').all(id).map(decode),
    progress:db.prepare('SELECT * FROM vocabulary_item_progress WHERE user_id=? ORDER BY seq DESC LIMIT 200').all(id).map(decode),
    positions:db.prepare("SELECT kind,item_key,data_json,seq FROM user_entity_rows WHERE user_id=? AND deleted_at IS NULL AND kind IN ('vocabularyResume','vocabularyStudySummary','vocabularyBrowseResume') ORDER BY seq DESC LIMIT 200").all(id).map(decode),
    personalBooks:db.prepare('SELECT book_id,version,revision,created_at FROM personal_wordbook_versions WHERE user_id=? ORDER BY created_at DESC LIMIT 200').all(id),
    independentBooks:db.prepare(`SELECT c.course_id,c.title,m.source_id AS legacy_source_id,json_extract(r.content_json,'$.contentFamily') AS content_family
     FROM course_content_legacy_mappings m JOIN course_contents c ON c.course_id=m.course_id
     JOIN course_content_access a ON a.course_id=c.course_id AND a.subject_user_id=?
     JOIN course_content_releases r ON r.course_id=c.course_id AND r.release_id=c.active_release
     WHERE m.source_kind='course' AND m.source_id LIKE 'wordbook:%' ORDER BY c.created_at DESC LIMIT 200`).all(id)});
  });
  // Transparent same-origin forwarding: product pages and save requests use the real server.
  app.use((req,res)=>{const outgoing=http.request(backend+req.originalUrl,{method:req.method,headers:{...req.headers,host:'127.0.0.1:'+backendPort}},incoming=>{res.writeHead(incoming.statusCode,incoming.headers);incoming.pipe(res);});outgoing.on('error',()=>{if(!res.headersSent)res.status(502).json({error:'隔离服务连接失败'});else res.destroy();});req.pipe(outgoing);});
  server=await new Promise((resolve,reject)=>{const instance=app.listen(port,'127.0.0.1',()=>resolve(instance));instance.once('error',reject);});
  const base='http://127.0.0.1:'+server.address().port;fs.writeFileSync(path.join(temp,'acceptance.json'),JSON.stringify({base,dataDir,appRoot,courseId:course.courseId,createdAt:new Date().toISOString()},null,2),{flag:'wx'});
  let closed=false;return {base,temp,dataDir,appRoot,courseId:course.courseId,draft,request,adminToken:admin.token,learnerToken:learner.token,learnerUsername:'wordbook-reviewer',testPassword:password,otherToken:other.token,restartBackend:async()=>{await stopBackend();logs='';startBackend();for(let n=0;n<100;n++){if(child.exitCode!==null)throw Error('isolated service failed to restart: '+logs);try{if((await fetch(backend+'/api/health')).ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}throw Error('isolated service restart timed out: '+logs);},close:async()=>{if(closed)return;closed=true;await new Promise(resolve=>server.close(resolve));db.close();await stopBackend();}};
 }catch(error){if(server)await new Promise(resolve=>server.close(resolve));db?.close();if(child.exitCode===null)await new Promise(resolve=>{child.once('close',resolve);child.kill();});throw error;}
}
if(require.main===module)createAcceptance(Number(process.argv[2]||14600)).then(instance=>{console.log('单词课程完整验收：'+instance.base+'/acceptance');console.log('独立测试数据（保留）：'+instance.temp);for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>instance.close().then(()=>process.exit(0)));}).catch(error=>{console.error(error);process.exitCode=1;});
module.exports={createAcceptance};
