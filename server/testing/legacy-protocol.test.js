'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { assertHistoricalEnvironment } = require('./legacy-protocol');
const env = { NODE_ENV: 'test', CHUNKLAB_DATA_DIR: path.join(os.tmpdir(), 'historical-guard-only') };
assert.doesNotThrow(() => assertHistoricalEnvironment(env, 2));
assert.throws(() => assertHistoricalEnvironment({ ...env, NODE_ENV: 'production' }, 2), /test-only/);
assert.throws(() => assertHistoricalEnvironment(env, 3), /test-only/);
assert.throws(() => assertHistoricalEnvironment({ NODE_ENV: 'test' }, 2), /explicit absolute/);
assert.throws(() => assertHistoricalEnvironment({ ...env, CHUNKLAB_DATA_DIR: 'relative-test' }, 2), /explicit absolute/);
for (const target of [path.resolve(__dirname, '..', 'data'), path.resolve(__dirname, '..', 'data', 'child')]) {
  assert.throws(() => assertHistoricalEnvironment({ ...env, CHUNKLAB_DATA_DIR: target }, 2), /application data/);
}
console.log('[historical-protocol] environment guards passed without opening a database');
