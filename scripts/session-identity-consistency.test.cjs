'use strict';
// Isolated diagnostic: synthetic credentials, in-memory storage, mocked network.
// Never opens a browser database or the live application's SQLite database.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const token = uid => 'test.' + Buffer.from(JSON.stringify({uid})).toString('base64url') + '.test';
async function main() {
  const values = new Map([
    ['chunklab.session.v1', JSON.stringify({version:1,epoch:'synthetic-epoch',base:'',token:token(27)})],
    ['chunklab_api_base',''], ['chunklab_token',token(1)],
    ['chunklab.storage-owner.v1','legacy-unassigned']
  ]);
  let sent = false;
  const context = {
    URL, atob:s=>Buffer.from(s,'base64').toString('binary'),
    localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)},
    location:{origin:'http://isolated.invalid',reload(){}},
    document:{documentElement:{style:{}}},setTimeout(){},addEventListener(){},
    fetch:async(_url,options)=>{
      sent = options.headers.Authorization === 'Bearer '+token(1);
      return {status:200,ok:true,text:async()=>JSON.stringify({seq:239,delta:false,mem:{decks:[{id:'account1-course'}]}})};
    }
  };
  context.window=context;
  vm.createContext(context);
  for(const file of ['js/account-storage.js','api.js']) vm.runInContext(fs.readFileSync(file,'utf8'),context);
  assert.throws(()=>context.AccountStorage.assertCurrent(),error=>error.code==='ACCOUNT_STORAGE_UNAVAILABLE');
  let rejected = false;
  try { await context.ChunkAPI.getData(); } catch(error) { rejected = true; }
  console.log(JSON.stringify({storageUnavailable:!context.AccountStorage.owner,requestCredentialOwner:sent?'1':null,rejected}));
  assert.ok(rejected && !sent,'inconsistent session/mirror credentials must not send account1 data requests under account27 storage ownership');
  // Network layer must also fail closed when loaded without AccountStorage.
  vm.runInContext('delete window.AccountStorage',context);
  await assert.rejects(context.ChunkAPI.getData(),error=>['SESSION_INCONSISTENT','ACCOUNT_STORAGE_UNAVAILABLE'].includes(error.code));
  assert.equal(sent,false);
  // A consistent session can reopen storage without removing business data.
  values.set('irreplaceable-course-marker','original');
  values.set('chunklab.session.v1',JSON.stringify({version:1,epoch:'consistent-epoch',base:'',token:token(27)}));
  values.set('chunklab_token',token(27));
  vm.runInContext(fs.readFileSync('js/account-storage.js','utf8'),context);
  assert.equal(JSON.parse(context.AccountStorage.owner)[1],'27');
  context.fetch=async()=>({status:200,ok:true,text:async()=>'{"seq":30}',headers:{get:name=>name==='X-ChunkLab-Account-Id'?'27':null}});
  assert.equal((await context.ChunkAPI.getData()).seq,30);
  assert.equal(values.get('irreplaceable-course-marker'),'original');
  // A base mirror conflict is rejected just like a token conflict.
  values.set('chunklab_api_base','https://other.invalid');
  await assert.rejects(context.ChunkAPI.getData());
  assert.throws(()=>context.AccountStorage.storage.setItem('course','wrong-account'));
  // No complete record: old mirror-only clients remain supported.
  values.delete('chunklab.session.v1'); values.set('chunklab_api_base','');
  vm.runInContext(fs.readFileSync('js/account-storage.js','utf8'),context);
  assert.equal((await context.ChunkAPI.getData()).seq,30);
  assert.equal(values.get('irreplaceable-course-marker'),'original');
  console.log('session consistency: token/base conflicts blocked; consistent and legacy sessions accepted; business data preserved');
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
