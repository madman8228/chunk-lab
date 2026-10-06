'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'chunklab-module-boundary-'));
const code=`
  const assert=require('node:assert/strict');
  require('./index');
  for(const file of [
    './services/data-save','./services/batch-replacement','./sync-resolution',
    './routes/sync','./routes/courses','./routes/legacy-snapshot-writes','./routes/legacy-deck-publication'
  ]) assert.equal(require.cache[require.resolve(file)],undefined,'new startup loaded '+file);
  for(const file of ['./routes/operations','./routes/content-import','./routes/recovery','./services/recovery-baseline'])
    assert.ok(require.cache[require.resolve(file)],'required current module missing '+file);
  const db=require('./db');
  assert.equal(db.prepare('SELECT count(*) n FROM user_courses').get().n,0);
  assert.equal(db.prepare('SELECT count(*) n FROM user_decks').get().n,0);
  console.log('PROTOCOL3_MODULE_BOUNDARY_OK');
  process.exit(0);
`;
try {
  const result=spawnSync(process.execPath,['-e',code],{
    cwd:__dirname,env:{...process.env,CHUNKLAB_DATA_DIR:temp,PORT:'0',NODE_ENV:'test',
      REQUIRE_AUTH:'false',CHUNKLAB_WRITE_PROTOCOL:'3'},encoding:'utf8',timeout:30000
  });
  assert.equal(result.status,0,result.stderr||result.error?.message||result.stdout);
  assert.ok(result.stdout.includes('PROTOCOL3_MODULE_BOUNDARY_OK'),result.stdout);
  console.log('[protocol3-module-boundary] actual startup loads current services, not retired writers or conflict engines');
} finally {
  // Remove only this test's newly allocated directory, never an application DB.
  const resolved=path.resolve(temp),tempRoot=path.resolve(os.tmpdir());
  assert.equal(path.dirname(resolved),tempRoot);
  assert.ok(path.basename(resolved).startsWith('chunklab-module-boundary-'));
  fs.rmSync(resolved,{recursive:true,force:true});
}
