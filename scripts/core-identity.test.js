'use strict';

const assert = require('node:assert/strict');

(async function () {
  const identity = await import('../src/core/identity.mjs');
  assert.equal(identity.fnv8('hello'), '4f9f2cab');
  assert.equal(identity.cidOf({ sentence: 'hello' }), '4f9f2cab');
  assert.equal(identity.cidOf({ cid: 'fixed', sentence: 'hello' }), 'fixed');
  assert.equal(identity.cidKey('oral-1', { sentence: 'hello' }), 'oral-1#4f9f2cab');
  assert.equal(identity.moveKeyToCid('daily-home#hello'), 'daily-home#4f9f2cab');
  assert.equal(identity.moveKeyToCid('daily-home#4f9f2cab'), 'daily-home#4f9f2cab');
  console.log('core-identity.test.js passed');
})().catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
