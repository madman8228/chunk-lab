'use strict';

const assert = require('node:assert/strict');
const { createChangeSequence } = require('./change-seq');

const rows = new Map();
const statements = new Map();
function stmt(sql) {
  if (!statements.has(sql)) {
    statements.set(sql, {
      get(userId) {
        if (sql.startsWith('SELECT')) {
          const seq = rows.get(userId);
          return seq == null ? undefined : { seq };
        }
        const seq = (rows.get(userId) || 0) + 1;
        rows.set(userId, seq);
        return { seq };
      }
    });
  }
  return statements.get(sql);
}

const sequence = createChangeSequence({ stmt });
assert.equal(sequence.currentSeq('u1'), 0);
assert.equal(sequence.allocSeq('u1'), 1);
assert.equal(sequence.currentSeq('u1'), 1);
assert.equal(sequence.allocSeq('u1'), 2);
assert.equal(sequence.currentSeq('u1'), 2);
assert.equal(sequence.currentSeq('u2'), 0);
console.log('change-seq.test.js passed');
