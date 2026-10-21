import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { MembershipClient } from '../src/membership/client.mjs';
const storage = new Map(), pending = [];
const win = { location: { origin: 'https://synthetic.invalid', href: 'https://synthetic.invalid/main.html' },
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  BUILTIN: [] };
win.window = win;
win.fetch = (url, options) => {
  if (url === '/api/course-content/catalog') return new Promise((resolve, reject) => pending.push({ resolve, reject, options }));
  if (url === '/api/content/shards') return Promise.resolve({ ok: true, json: async () => ({ decks: [] }) });
  assert.equal(url, 'content/manifest.json');
  return Promise.resolve({ ok: true, json: async () => ({ schemaVersion: 1, decks: [] }) });
};
const context = vm.createContext({ ...win, window: win, URL, console });
vm.runInContext(fs.readFileSync(new URL('../api.js', import.meta.url), 'utf8'), context);
win.ChunkAPI.setSession('', 'synthetic-token');
vm.runInContext(fs.readFileSync(new URL('./content-repository.js', import.meta.url), 'utf8'), context);
const client = new MembershipClient({ request: () => { throw Error('catalog must use shared adapter'); }, readCatalog: () => win.ChunkAPI.getCourseCatalog() });
const readers = [win.ContentRepo.ready, win.ContentRepo.loadProtectedCatalog(), win.ContentRepo.loadProtectedCatalog(), client.catalog()];
assert.equal(pending.length, 1, 'startup, two repository readers and learning entry share one HTTP request');
pending[0].resolve({ ok: true, status: 200, text: async () => JSON.stringify({ courses: [{ courseId: 'synthetic', title: 'original', units: [] }] }) });
const results = await Promise.all(readers);
results[3].courses[0].title = 'changed by client';
assert.equal(win.ContentRepo.getProtectedCatalog()[0].title, 'original', 'native client cannot mutate repository view');
const fresh = win.ContentRepo.loadProtectedCatalog();assert.equal(pending.length, 2, 'later refresh still sends a fresh request');
pending[1].reject(Error('synthetic offline'));assert.equal((await fresh)[0].title, 'original', 'repository preserves existing fallback metadata');
const retry = client.catalog();assert.equal(pending.length, 3);
pending[2].resolve({ ok: true, status: 200, text: async () => JSON.stringify({ courses: [] }) });await retry;
console.log('catalog readers: startup/repository/native entry 4 -> 1 in-flight request, independent consumers, fresh reads and retry passed');
