'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const retired=['core-sync-delta','core-sync-intents','core-sync-payload','core-sync-transport',
  'core-sync-replay','core-sync-batch-merge','core-sync-learning-marks','core-sync-entity-merge',
  'core-sync-kv','sync-resolution','sync-resolution-ui','batch-sync','recovery-center'];
for(const file of ['main.html','courses.html','decks.html','stats.html','course-create.html']){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  for(const module of retired) assert.ok(!source.includes('src="js/'+module+'.js"'),file+' loads '+module);
}
const core=fs.readFileSync(path.join(root,'core.js'),'utf8');
assert.ok(!/\.putData\(|getSyncBatch\(|applySyncBatchResolution|loadLegacyBatchSync/.test(core),
  'shared runtime contains no legacy snapshot writer or conflict resolver');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const deploy=fs.readFileSync(path.join(root,'scripts/deploy-prod.sh'),'utf8');
for(const module of retired) assert.ok(!deploy.includes('js/'+module+'.js'), 'deployment includes retired module '+module);
const api=fs.readFileSync(path.join(root,'api.js'),'utf8');
assert.ok(!/putData:|importData:|getSyncBatch:|resolveSyncBatch:|getSyncEntity:|resolveSync:|postCourse:|deleteCourse:|publishDeck:|global\.BatchSync/.test(api),
  'normal API exposes no retired conflict, course or publication writer');
for(const module of retired)assert.ok(!sw.includes("'/js/"+module+".js'"),'cache includes '+module);
for(const file of ['server/routes/data.js','server/routes/backup.js','server/routes/decks.js']) {
  const source=fs.readFileSync(path.join(root,file),'utf8');
  assert.ok(!/saveData|validatePutPayload|app\.(put|post)\(/.test(source),file+' must remain read-only');
}
console.log('[server-runtime-boundary] normal pages, shared core and precache exclude retired sync engines');
const server=fs.readFileSync(path.join(root,'server/index.js'),'utf8');
assert.ok(!/const saveData = createDataSave/.test(server),'normal startup must not eagerly construct legacy writer');
assert.ok(server.includes('getWriter: getLegacyDataWriter'),'explicit restoration obtains a lazy writer');
