'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function fixture() {
  const storage = new Map(), calls = [];
  const context = { localStorage: { getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    fetch: (url, options) => new Promise((resolve, reject) => { calls.push({ url, options, resolve, reject }); }) };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(require.resolve('./api'), 'utf8'), context);
  context.ChunkAPI.setSession('', 'synthetic-a');
  const respond = (index, body, status = 200) => calls[index].resolve({ status, ok: status === 200,
    text: async () => JSON.stringify(body) });
  return { api: context.ChunkAPI, context, calls, respond };
}
(async () => {
  for (const method of ['me', 'getConfig', 'getCourseCatalog']) {
    const f = fixture();
    const pending = Array.from({ length: 8 }, () => f.api[method]());
    assert.equal(f.calls.length, 1, method + ': eight concurrent reads use one request');
    f.respond(0, { user: { id: 1 }, revision: 1 });
    const values = await Promise.all(pending);
    values[0].user.id = 999;
    assert.equal(values[1].user.id, 1, 'callers receive independent response objects');
    const fresh = f.api[method](); assert.equal(f.calls.length, 2, 'completed response is not cached');
    f.respond(1, { revision: 2 }); assert.equal((await fresh).revision, 2);
    const failed = [f.api[method](), f.api[method]()];
    assert.equal(f.calls.length, 3);
    f.calls[2].reject(Error('synthetic offline'));
    assert.ok((await Promise.allSettled(failed)).every(result => result.status === 'rejected'));
    const retry = f.api[method](); assert.equal(f.calls.length, 4);
    f.respond(3, { revision: 3 }); await retry;
    const old = f.api[method](); const oldCheck = assert.rejects(old, error => error.code === 'SESSION_CHANGED');
    f.api.setSession('', 'synthetic-b');
    const next = f.api[method](); assert.equal(f.calls.length, 6, 'new account does not join previous account request');
    f.respond(4, {}, 401); await oldCheck;
    assert.equal(f.api.getToken(), 'synthetic-b', 'late old-account 401 cannot log out new account');
    const joinedNext = f.api[method]();
    assert.equal(f.calls.length, 6, 'old request cleanup cannot remove a new account in-flight read');
    f.respond(5, { user: { id: 2 } }); assert.equal((await next).user.id, 2); await joinedNext;
    const oldBase = f.api[method](); const baseCheck = assert.rejects(oldBase, error => error.code === 'SESSION_CHANGED');
    f.api.setBase('https://synthetic.invalid'); const nextBase = f.api[method]();
    assert.equal(f.calls.length, 8); f.respond(6, {}); await baseCheck;
    f.respond(7, { revision: 4 }); await nextBase;
  }
  const f = fixture();
  const first = f.api.me(), config = f.api.getConfig(); assert.equal(f.calls.length, 2, 'different endpoints are not merged');
  f.respond(0, {}); f.respond(1, {}); await Promise.all([first, config]);
  const writes = [f.api.heartbeat(), f.api.heartbeat()];
  assert.equal(f.calls.length, 4, 'writes are never merged');
  f.respond(2, {}); f.respond(3, {}); await Promise.all(writes);
  console.log('API read coalescing: scope isolation, no result cache, independent responses, failures, writes and stale 401 passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
