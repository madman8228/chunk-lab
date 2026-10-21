'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

(async function () {
  const handlers = {}, downloads = [], cached = new Map();
  const source = fs.readFileSync(require.resolve('../sw.js'), 'utf8');
  const hard = Array.from(source.match(/const PRECACHE = \[([\s\S]*?)\n\];/)[1].matchAll(/'([^']+)'/g), m => m[1]);
  const soft = Array.from(source.match(/const PRECACHE_SOFT = \[([\s\S]*?)\n\];/)[1].matchAll(/'([^']+)'/g), m => m[1]);
  for (const url of ['/assets/content-studio.css', '/js/library-metadata-editor.js', '/js/illustration-review.js',
    '/assets/textbook-drafts.css', '/js/textbook-drafts.js']) {
    assert.ok(!hard.includes(url) && soft.includes(url), 'author-only assets stay out of the learning installation: ' + url);
  }
  for (const url of ['/icon-192.png', '/icon-512.png', '/icon-180.png', '/icon-32.png', '/favicon.ico']) {
    assert.ok(!hard.includes(url) && soft.includes(url), 'legacy icons remain available without eager installation: ' + url);
  }
  for (const url of ['/assets/brand/icon-180-v1.png', '/assets/brand/icon-192-v1.png', '/assets/brand/icon-512-v1.png',
    '/vocabulary.html', '/vocabulary-practice.html', '/wordbook.html', '/landing/action-game-view.js', '/landing/wordbook-study.js']) {
    assert.ok(!hard.includes(url) && soft.includes(url), 'independent vocabulary pages and large install icons load on demand: ' + url);
  }
  const homepage = require('./lib-deps').runtimeAssets(['main.html']).files.map(file => '/' + file.replace(/\\/g, '/'));
  for (const url of ['/library.js', '/js/stats-page.js', '/js/stats-growth.js', '/js/stats-insights.js',
    '/js/vocabulary-word-dictation.js', '/landing/word-dictation-view.js', '/js/vocabulary-sentence-audio.js',
    '/landing/vocabulary-course-audio.js', '/js/vocabulary-word-choice.js', '/landing/word-choice-view.js',
    '/js/vocabulary-chunk-order.js', '/landing/chunk-order-view.js', '/js/vocabulary-read-aloud.js',
    '/landing/read-aloud-recorder.js', '/landing/read-aloud-view.js']) {
    assert.ok(!homepage.includes(url), 'optional helper must not become a homepage dependency unnoticed: ' + url);
    assert.ok(!hard.includes(url) && soft.includes(url), 'optional pages own their helper scripts: ' + url);
  }
  const optionalHomeRefs = new Set(['/assets/brand/icon-180-v1.png', '/assets/brand/icon-192-v1.png', '/assets/brand/icon-512-v1.png',
    '/assets/membership-study.css', '/builtins.js', '/decks.html', '/index.html', '/js/membership.js', '/js/mistake-review.js', '/stats.html']);
  for (const url of homepage.filter(url => !optionalHomeRefs.has(url))) {
    assert.ok(hard.includes(url), 'homepage required assets stay atomic: ' + url);
  }
  assert.ok(hard.includes('/assets/brand/jqka-logo-v1.webp'),
    'visible homepage logo remains available offline');
  const bytes = hard.reduce((total, url) => total + fs.statSync(require('node:path').join(__dirname, '..', url.slice(1))).size, 0);
  assert.ok(bytes < 1.5 * 1024 * 1024, 'atomic installation remains below the existing 1.5 MiB budget: ' + bytes);
  const cache = {
    addAll: async urls => { downloads.push(...urls); },
    match: async key => cached.get(typeof key === 'string' ? key : key.url),
    put: async (key, response) => { cached.set(typeof key === 'string' ? key : key.url, response); }
  };
  let activated = false;
  vm.runInNewContext(source, {
    self: { location: { origin: 'https://example.test' },
      addEventListener: (name, handler) => { handlers[name] = handler; },
      skipWaiting: async () => { activated = true; } },
    caches: { open: async () => cache, keys: async () => [] },
    fetch: async request => {
      downloads.push(typeof request === 'string' ? request : request.url);
      return { status: 200, ok: true, clone() { return this; } };
    }, URL, Response, console
  });
  let installation;
  handlers.install({ waitUntil: task => { installation = task; } });
  await installation;
  assert.deepEqual(downloads, hard, 'installation downloads only the atomic learning bundle, not optional pages or pictures');
  assert.ok(activated);
  assert.ok(soft.includes('/admin.html') && soft.includes('/assets/jqka-learning-garden-v1.webp'));
  downloads.length = 0;
  const request = { method: 'GET', mode: 'cors', url: 'https://example.test/assets/jqka-learning-garden-v1.webp' };
  async function load() {
    let response;
    handlers.fetch({ request, respondWith: task => { response = task; } });
    await response;
    await new Promise(resolve => setImmediate(resolve));
  }
  await load(); await load();
  assert.deepEqual(downloads, [request.url], 'optional asset loads on demand and is reused on a second visit');
  activated = false;
  cache.addAll = async () => { throw new Error('synthetic required file unavailable'); };
  handlers.install({ waitUntil: task => { installation = task; } });
  await assert.rejects(installation, /required file unavailable/);
  assert.equal(activated, false, 'a partial required bundle must not activate');
  console.log('SW install budget: atomic-only installation and optional on-demand reuse passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
