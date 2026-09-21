'use strict';

const assert = require('node:assert/strict');

async function main() {
  const { CoreRuntime } = await import('../src/core/runtime.mjs');

  const flight = CoreRuntime.createSingleFlight();
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const first = flight.run(async () => {
    calls += 1;
    await gate;
    return 'ready';
  });
  const second = flight.run(() => {
    calls += 1;
    return 'duplicate';
  });

  assert.strictEqual(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);
  release();
  assert.equal(await first, 'ready');

  const afterSettle = flight.run(() => {
    calls += 1;
    return 'next';
  });
  assert.equal(await afterSettle, 'next');
  assert.equal(calls, 2);

  const clearable = CoreRuntime.createSingleFlight();
  let clearCalls = 0;
  let clearRelease;
  const clearGate = new Promise((resolve) => { clearRelease = resolve; });
  clearable.run(async () => {
    clearCalls += 1;
    await clearGate;
    return 'old';
  });
  clearable.clear();
  const replacement = clearable.run(() => {
    clearCalls += 1;
    return 'replacement';
  });
  assert.equal(await replacement, 'replacement');
  clearRelease();
  assert.equal(clearCalls, 2);

  assert.throws(() => flight.run(null), /factory must be a function/);

  const queue = CoreRuntime.createTaskQueue();
  const order = [];
  const queuedOne = queue.enqueue(async () => {
    order.push('one:start');
    await Promise.resolve();
    order.push('one:end');
    return 1;
  });
  const queuedTwo = queue.enqueue(() => {
    order.push('two');
    return 2;
  });
  assert.deepEqual([await queuedOne, await queuedTwo], [1, 2]);
  assert.deepEqual(order, ['one:start', 'one:end', 'two']);
  await queue.wait();

  const recoveringQueue = CoreRuntime.createTaskQueue();
  const failed = recoveringQueue.enqueue(() => Promise.reject(new Error('expected')));
  const recovered = recoveringQueue.enqueue(() => 'recovered');
  await assert.rejects(failed, /expected/);
  assert.equal(await recovered, 'recovered');

  const writeErrors = [];
  const coordinator = CoreRuntime.createWriteCoordinator({ onError: (error) => writeErrors.push(error.message) });
  const writeFailed = coordinator.enqueue(() => Promise.reject(new Error('write failed')));
  const writeRecovered = coordinator.enqueue(() => 'write recovered');
  await assert.rejects(writeFailed, /write failed/);
  assert.equal(await writeRecovered, 'write recovered');
  await coordinator.wait();
  assert.deepEqual(writeErrors, ['write failed']);

  const lane = CoreRuntime.createLatestWriteLane({
    sameLane: (left, right) => left.scope === right.scope,
    mergePending: (left, right) => { left.value = right.value; },
    start: async (entry) => {
      order.push(`lane:${entry.value}`);
      return entry.value;
    },
  });
  const laneOne = lane.enqueue({ scope: 'stats', value: 'one' });
  const laneTwo = lane.enqueue({ scope: 'stats', value: 'two' });
  assert.strictEqual(laneOne, laneOne);
  assert.strictEqual(laneTwo, laneTwo);
  assert.equal(await laneOne, 'one');
  assert.equal(await laneTwo, 'two');
  await lane.wait();
  assert.deepEqual(order.slice(-2), ['lane:one', 'lane:two']);

  const beacon = {};
  const notifier = CoreRuntime.createTabNotifier({
    tabId: 'tab-a', syncKey: 'sync-key', storeKey: 'store-key',
    storage: { setItem: (key, value) => { beacon[key] = value; } }, now: () => 123,
  });
  const published = notifier.publish('courses');
  assert.deepEqual(published, { v: 1, type: 'chunklab-write', tabId: 'tab-a', area: 'courses', seq: 1, at: 123 });
  assert.equal(JSON.parse(beacon['sync-key']).area, 'courses');
  assert.equal(notifier.receive(published), null);
  assert.deepEqual(notifier.receive({ v: 1, type: 'chunklab-write', tabId: 'tab-b', area: 'progress' }), {
    seq: 1, area: 'progress', fromTab: 'tab-b',
  });
  assert.deepEqual(notifier.receiveStorageEvent({ key: 'sync-key', newValue: JSON.stringify({ type: 'chunklab-write', tabId: 'tab-c' }) }), {
    seq: 2, area: 'mem', fromTab: 'tab-c',
  });
  assert.deepEqual(notifier.receiveStorageEvent({ key: 'store-key', newValue: '{}' }), {
    seq: 3, area: 'mem', fromTab: '',
  });
  assert.equal(notifier.receiveStorageEvent({ key: 'sync-key', newValue: '{bad' }), null);
  assert.deepEqual(notifier.state(), { sequence: 1, external: 3 });

  console.log('[core-runtime] single-flight contract passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
