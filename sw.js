/**
 * sw.js · Chunk Lab service worker（PWA 离线）
 *
 * 策略：
 *   - 静态资源（HTML/JS/manifest/icons）：cache-first；命中即用，未命中走网络并回填缓存。
 *   - API 请求（/api/*）：network-only，不缓存（含用户数据，避免脏读）。
 *   - 非 GET（PUT/POST/DELETE）：直接放行，交给业务自身的 debounce/重试。
 *   - 导航请求（HTML）缓存 miss 时回退 /main.html（离线可用）。
 *   - 版本更新时 activate 删除旧版本缓存。
 *
 * 注意：开发期 SW 缓存会"冻结"旧文件——改代码后需要：
 *   1) 刷新页面自动触发 SW 更新检查（导航时），新版 install 后 skipWaiting+clients.claim
 *      立即激活，activate 清理旧版本缓存 → 资源从网络重拉，一次刷新即生效
 *   2) 或 DevTools → Application → Service Workers → Update / Unregister
 *   3) 或临时改 CACHE 版本号强制刷新（见下）
 * 版本号约定：业务代码变更时必须 bump CACHE（如 v2 → v3），否则浏览器可能继续
 * serve 旧版本缓存的 JS（cache-first），导致修复不生效。
 */
/* eslint-disable */
const CACHE = 'chunklab-v14';
const PRECACHE = [
  '/main.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/core.js',
  '/api.js',
  '/auth-ui.js',
  '/srs.js',
  '/builtins.js',
  '/oral8000.js',
  '/library.js',
  '/course-package.js',
  '/courses.html',
  '/decks.html',
  '/stats.html',
  '/js/idb.js',
  '/js/icons.js',
  '/js/chunk-engine.mjs',
  '/js/format.mjs',
  '/js/ai-prompts.mjs',
  '/js/backup.mjs',
  '/js/bridge.mjs'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(PRECACHE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;                 /* 写请求直接放行 */
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;    /* 跨域（如 DeepSeek）放行 */
  if (url.pathname.indexOf('/api/') === 0) return;   /* API 不缓存 */

  /* 导航请求：cache-first，未命中回退 main.html */
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return res;
        }).catch(function () { return caches.match('/main.html'); });
      })
    );
    return;
  }

  /* 静态资源：cache-first */
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return caches.match('/main.html'); });
    })
  );
});
