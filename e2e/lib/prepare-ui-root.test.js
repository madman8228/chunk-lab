'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),prepare=require('./prepare-ui-root');
const root=path.resolve(__dirname,'../..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'chunklab-ui-root-'));
const app=path.join(temp,'app'),port=require('./free-port').freePort(15400,100),base='http://127.0.0.1:'+port;
let child;
(async()=>{try{
  fs.mkdirSync(path.join(app,'content'),{recursive:true});
  fs.copyFileSync(path.join(root,'content/manifest.json'),path.join(app,'content/manifest.json'));
  const original=fs.readFileSync(path.join(app,'content/manifest.json'));
  assert.throws(()=>prepare(root),/temporary/);
  assert.throws(()=>prepare(os.tmpdir()),/temporary/);
  child=spawn(process.execPath,['server/index.js'],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,
    NODE_ENV:'test',HOST:'127.0.0.1',PORT:String(port),CHUNKLAB_DATA_DIR:path.join(temp,'data'),CHUNKLAB_APP_ROOT:app,
    REQUIRE_AUTH:'true',PHONE_AUTH_ENABLED:'false',JWT_SECRET:crypto.randomBytes(32).toString('hex')}});
  let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch(_){}if(ready)break;await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready);
  assert.equal((await fetch(base+'/main.html')).status,404,'incomplete original fixture reproduces the missing-page failure');
  const files=prepare(app);
  for(const url of ['/main.html','/wordbook-create.html','/wordbook.html','/js/learning-navigation.js','/js/wordbook-authoring.js',
    '/assets/catalog/default-cloud-v1.svg','/assets/covers/oral-3000.webp']){
    const response=await fetch(base+url);assert.equal(response.status,200,'real UI fixture serves '+url);await response.arrayBuffer();
  }
  assert.ok(files.length>50);
  assert.deepEqual(fs.readFileSync(path.join(app,'content/manifest.json')),original,'UI preparation preserves fixture content');
  assert.ok(!fs.existsSync(path.join(app,'content/vocabulary')),'no course library is silently copied into the fixture');
  assert.throws(()=>prepare(app),/EEXIST/,'existing fixture UI cannot be silently overwritten');
  console.log('UI fixture: original 404 reproduced, real pages/scripts served, content preserved, temporary-only and no overwrite passed');
}finally{
  if(child&&child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}
  assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(temp,{recursive:true,force:true});
}})().catch(error=>{console.error(error);process.exitCode=1;});
