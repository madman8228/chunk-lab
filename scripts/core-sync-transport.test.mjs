import assert from 'node:assert/strict';
import { CoreSyncTransport } from '../src/core/sync-transport.mjs';

const payload = { mem: { best: { streak: 1 } } };
let directCalls = 0;
const directReceipt = await CoreSyncTransport.putConditional({
  api: { putData: async (value) => { directCalls += 1; return { ok: true, value }; } },
  payload,
});
assert.equal(directCalls, 1);
assert.deepEqual(directReceipt, { ok: true, value: payload });

const calls = [];
const receipt = { ok: true, seq: 4 };
const conditionalReceipt = await CoreSyncTransport.putConditional({
  api: { putData: async () => { throw new Error('should use batch sync'); } },
  batchSync: {
    state: async () => ({ baseline: 3 }),
    stage: async (...args) => calls.push(['stage', ...args]),
    retry: async () => { calls.push(['retry']); return { receipt }; },
  },
  payload,
  expectedGeneration: 7,
  operationReceipts: [{ key: 'k', operationId: 'op' }],
});
assert.deepEqual(conditionalReceipt, receipt);
assert.deepEqual(calls, [
  ['stage', payload, 3, 7, [{ key: 'k', operationId: 'op' }]],
  ['retry'],
]);

await assert.rejects(
  CoreSyncTransport.putConditional({
    api: { putData: async () => ({ ok: true }) },
    batchSync: { state: async () => ({ baseline: -1 }) },
    payload,
  }),
  (error) => error.code === 'SYNC_BASELINE_REQUIRED',
);

await assert.rejects(
  CoreSyncTransport.putConditional({
    api: { putData: async () => ({ ok: true }) },
    batchSync: {
      state: async () => ({ baseline: 1 }),
      stage: async () => {},
      retry: async () => ({}),
    },
    payload,
  }),
  /服务器未确认条件同步/,
);

console.log('core-sync-transport.test.mjs passed');
