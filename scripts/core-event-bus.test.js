'use strict';

const assert = require('node:assert/strict');

(async function () {
  const { createEventBus } = await import('../src/core/event-bus.mjs');
  const bus = createEventBus();
  const seen = [];
  const off = bus.on('change', (value) => seen.push(value));
  bus.on('change', () => { throw new Error('isolated listener failure'); });
  bus.emit('change', 1);
  off();
  bus.emit('change', 2);
  assert.deepEqual(seen, [1]);
  const other = createEventBus();
  let otherSeen = 0;
  other.on('change', () => { otherSeen += 1; });
  bus.emit('change', 3);
  assert.equal(otherSeen, 0);
  console.log('core-event-bus.test.js passed');
})().catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
