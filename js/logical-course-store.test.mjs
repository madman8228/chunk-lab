import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const values = new Map();
const window = { localStorage: {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); }
}, CL: { getCloudConfig: () => ({ persistenceMode: 'legacy', writeProtocol: 2 }) } };
const module = { exports: {} };
vm.runInNewContext(readFileSync(fileURLToPath(new URL('./logical-course-store.js', import.meta.url)), 'utf8'),
  { window, module, Date, JSON, String, Array, Object });
const store = module.exports;

const legacy = [{ id: 'logical-course:legacy', title: 'Legacy directory', coverImage: '', catalogKey: 'logical:logical-course:legacy', origin: 'user', contentType: 'story', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' }];
store.write(legacy);
const savedLocal = window.localStorage.getItem(store.STORAGE_KEY);
store.setConfirmed([{ id: 'logical-course:remote', title: 'Remote directory' }]);
assert.deepEqual(JSON.parse(JSON.stringify(store.read())), [{ id: 'logical-course:remote', title: 'Remote directory' }],
  'server-confirmed directories become the app read view');
assert.equal(window.localStorage.getItem(store.STORAGE_KEY), savedLocal,
  'applying a server snapshot must not overwrite the original local directory source');
const built = store.build({ title: 'New directory', coverImage: '' });
assert.ok(built.id.startsWith('logical-course:new-directory-'));
store.write([{ id: 'logical-course:legacy', title: 'Legacy directory' }]);
assert.deepEqual(JSON.parse(JSON.stringify(store.read())), [{ id: 'logical-course:legacy', title: 'Legacy directory' }],
  'the compatibility writer returns to local mode explicitly');

window.CL.getCloudConfig = () => ({ persistenceMode: 'server-authoritative', writeProtocol: 3 });
store.setConfirmed([{ id: 'logical-course:remote', title: 'Remote directory' }]);
const beforeProtocol3Write = window.localStorage.getItem(store.STORAGE_KEY);
for (const mutation of [
  () => store.write([{ id: 'logical-course:unsafe', title: 'Unsafe' }]),
  () => store.create({ title: 'Unsafe create' }),
  () => store.remove('logical-course:legacy'),
]) {
  assert.throws(mutation, error => error && error.code === 'PROTOCOL3_NARROW_WRITE_REQUIRED',
    'protocol 3 directory changes require a narrow server operation');
}
assert.equal(window.localStorage.getItem(store.STORAGE_KEY), beforeProtocol3Write,
  'protocol 3 directory mutations never change the legacy localStorage source');
assert.deepEqual(JSON.parse(JSON.stringify(store.read())), [{ id: 'logical-course:remote', title: 'Remote directory' }],
  'rejected local mutations preserve the server-confirmed directory view');

console.log('logical course store confirmed-view tests passed');
