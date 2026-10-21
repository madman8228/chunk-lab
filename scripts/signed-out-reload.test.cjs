'use strict';
// Real API + account-storage code; synthetic credentials and in-memory data only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const token = uid => 'test.' + Buffer.from(JSON.stringify({uid})).toString('base64url') + '.test';

function boot(values) {
  const timers = [], events = [];
  let reloads = 0;
  const context = {
    URL, atob: value => Buffer.from(value, 'base64').toString('binary'),
    localStorage: {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key)
    },
    location: {origin:'http://isolated.invalid', reload() { reloads++; }},
    document: {documentElement:{style:{}}},
    setTimeout: fn => timers.push(fn), addEventListener() {},
    CustomEvent: function(type) { this.type = type; },
    dispatchEvent: event => events.push(event.type),
    fetch: async () => ({status:401, ok:false, text:async () => ''})
  };
  context.window = context;
  vm.createContext(context);
  for (const file of ['js/account-storage.js', 'api.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  }
  return {
    context, events,
    flush() { while (timers.length) timers.shift()(); },
    reloadCount() { return reloads; }
  };
}

async function unauthorized(page) {
  await assert.rejects(page.context.ChunkAPI.getData(), e => e.code === 'NOT_AUTH' && e.status === 401);
  page.flush();
}

async function main() {
  const values = new Map([['irreplaceable-course', 'original']]);
  // Multiple requests and repeated page boots must keep the login page stable.
  for (let i = 0; i < 3; i++) {
    const page = boot(values);
    const before = values.get('chunklab.session.v1');
    await unauthorized(page);
    assert.equal(page.reloadCount(), 0, 'Signed-out 401 must not reload the login page');
    await unauthorized(page);
    assert.equal(page.context.document.documentElement.style.visibility, undefined);
    assert.equal(values.get('chunklab.session.v1'), before, 'Signed-out 401 must not rotate the session epoch');
    assert.deepEqual(page.events, [], 'No login has expired when there was no token');
    assert.equal(values.get('irreplaceable-course'), 'original');
  }

  values.set('chunklab_token', token(7));
  const expired = boot(values);
  await unauthorized(expired);
  assert.equal(expired.context.ChunkAPI.getToken(), null);
  assert.equal(expired.reloadCount(), 1, 'An expired authenticated session still switches safely to signed-out storage');
  assert.deepEqual(expired.events, ['chunklab-auth-expired']);
  const reopened = boot(values);
  const signedOutSession = values.get('chunklab.session.v1');
  await unauthorized(reopened);
  assert.equal(reopened.reloadCount(), 0, 'Expiry must not start a reload loop after reopening');
  assert.equal(values.get('chunklab.session.v1'), signedOutSession);

  // A delayed response from the old account must not clear a new login.
  const switching = boot(values);
  let release;
  switching.context.fetch = () => new Promise(resolve => { release = resolve; });
  const pending = switching.context.ChunkAPI.getData();
  switching.context.ChunkAPI.setSession('', token(8));
  release({status:401, ok:false, text:async () => ''});
  await assert.rejects(pending, e => e.code === 'SESSION_CHANGED');
  assert.equal(switching.context.ChunkAPI.getToken(), token(8));
  assert.deepEqual(switching.events, []);
  assert.equal(values.get('irreplaceable-course'), 'original');
  console.log('signed-out reload: stable login page, genuine expiry and account-switch protections retained');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
