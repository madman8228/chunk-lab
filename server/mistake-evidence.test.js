'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { createDataRows } = require('./services/data-rows');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-mistake-evidence-'));
const db = new Database(path.join(temp, 'test.db'));
db.exec(`CREATE TABLE user_entity_rows (
  user_id TEXT NOT NULL, kind TEXT NOT NULL, item_key TEXT NOT NULL, data_json TEXT NOT NULL,
  deleted_at TEXT, updated_at TEXT, seq INTEGER,
  PRIMARY KEY(user_id,kind,item_key)
)`);
const rows = createDataRows({ stmt: (sql) => db.prepare(sql) });
const event = (eventId, at, answer) => ({ eventId, at, mode: 'typing', hinted: false, revealed: false, needsReview: true, mistakes: [{ chunkIdx: 0, chunk: 'Where', wrongAnswers: [answer], wrongAttemptCount: 1, hintUsed: false }] });
const record = (entry) => ({ _key: 'deck::Where is it?', deckId: 'deck', sentence: 'Where is it?', addedAt: '2026-01-01 00:00:00', history: [event(entry.id, entry.at, entry.answer)], evidenceVersion: 1 });

try {
  const baseline = Date.now() - 120000;
  rows.upsertEntityRow('user-a', 'reinforce', 'deck::Where is it?', record({ id: 'a1', at: baseline, answer: 'When' }), 1);
  rows.upsertEntityRow('user-a', 'reinforce', 'deck::Where is it?', record({ id: 'a2', at: baseline + 1000, answer: 'What' }), 2);
  const merged = JSON.parse(db.prepare("SELECT data_json FROM user_entity_rows WHERE user_id='user-a' AND kind='reinforce'").get().data_json);
  assert.deepEqual(merged.history.map((item) => item.eventId).sort(), ['a1', 'a2']);

  rows.upsertEntityRow('user-b', 'reinforce', 'deck::Where is it?', record({ id: 'b1', at: baseline + 2000, answer: 'Why' }), 1);
  const isolated = JSON.parse(db.prepare("SELECT data_json FROM user_entity_rows WHERE user_id='user-b' AND kind='reinforce'").get().data_json);
  assert.deepEqual(isolated.history.map((item) => item.eventId), ['b1']);

  rows.deleteEntityRow('user-a', 'reinforce', 'deck::Where is it?', 3);
  rows.upsertEntityRow('user-a', 'reinforce', 'deck::Where is it?', record({ id: 'stale', at: baseline + 3000, answer: 'When' }), 4);
  const tombstone = db.prepare("SELECT deleted_at,data_json FROM user_entity_rows WHERE user_id='user-a' AND kind='reinforce'").get();
  assert.ok(tombstone.deleted_at, 'stale snapshot must not revive a deleted row');
  assert.deepEqual(JSON.parse(tombstone.data_json).history.map((item) => item.eventId).sort(), ['a1', 'a2']);

  rows.upsertEntityRow('user-a', 'reinforce', 'deck::Where is it?', record({ id: 'a3', at: Date.now() + 10000, answer: 'Where' }), 5);
  const recreated = db.prepare("SELECT deleted_at,data_json FROM user_entity_rows WHERE user_id='user-a' AND kind='reinforce'").get();
  assert.equal(recreated.deleted_at, null);
  assert.deepEqual(JSON.parse(recreated.data_json).history.map((item) => item.eventId), ['a3']);
  console.log('server/mistake-evidence.test.js passed');
} finally {
  db.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
