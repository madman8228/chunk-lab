'use strict';
const assert = require('node:assert/strict');
const Database = require('./node_modules/better-sqlite3');
const { createWorkspaceOperations } = require('./services/workspace-operations');
// In-memory fixture cannot touch any live data directory.
const db = new Database(':memory:');
try {
  db.exec(`CREATE TABLE user_entity_rows(user_id INTEGER,kind TEXT,item_key TEXT,data_json TEXT,deleted_at TEXT,PRIMARY KEY(user_id,kind,item_key));
    CREATE TABLE user_decks(user_id INTEGER,id TEXT,name TEXT,authoring_json TEXT,deleted_at TEXT);
    CREATE TABLE user_courses(user_id INTEGER,data_json TEXT,deleted_at TEXT);`);
  const resources = Array.from({ length: 5 }, (_, i) => ({ resourceId: 'public:' + i, available: true }));
  const operations = createWorkspaceOperations({ db, library: { resources: () => resources },
    operationError: (message, code, status) => Object.assign(new Error(message), { code, status }),
    upsertEntityRow: (user, kind, id, value) => db.prepare('INSERT INTO user_entity_rows(user_id,kind,item_key,data_json) VALUES(?,?,?,?) ON CONFLICT(user_id,kind,item_key) DO UPDATE SET data_json=excluded.data_json').run(user, kind, id, JSON.stringify(value)) });
  const select = (user, targetId, selected = true, itemType = 'resource', position) => operations.apply(user, { type: 'workspace.select', payload: { itemType, targetId, selected, ...(position === undefined ? {} : { position }) } }, 7);
  for (const resource of resources) assert.equal(select(1, resource.resourceId).entity, 'learningWorkspace');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_entity_rows WHERE user_id=1').get().n, 5);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_entity_rows WHERE user_id=2').get().n, 0);
  assert.throws(() => select(2, 'private:other'), /无权访问/);
  assert.throws(() => select(1, 'grammar', true, 'tool'), /工具/);
  assert.throws(() => select(1, 'chunks', true, 'tool', 3), /顺序/);
  select(1, 'chunks', true, 'tool', 0);
  select(1, 'vocabulary', true, 'tool', 1);
  resources.splice(0, 1);
  select(1, 'public:0', false);
  assert.equal(JSON.parse(db.prepare("SELECT data_json FROM user_entity_rows WHERE user_id=1 AND item_key='resource:public:0'").get().data_json).selected, false);
  assert.throws(() => select(2, 'public:0', false), /无权访问/);
  assert.throws(() => operations.apply(1, { type: 'workspace.select' }, 8), /格式/);
  console.log('workspace operations: five collections, validation, unavailable deselection and owner isolation passed');
} finally { db.close(); }
