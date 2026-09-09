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
 * 版本号约定：CACHE 版本由 scripts/gen-sw.js 按预缓存资源的内容 hash 自动生成——
 *   改了任何静态资源后跑一次 `node scripts/gen-sw.js` 即可（版本自动变，activate 清旧缓存）。
 *   不要手改 CACHE 行（脚本每次会覆盖）。上面 v45/v44… 为历史人工台账，仅存档。
 */
/* eslint-disable */
/* 每次前端资源变更都递增版本，避免旧版 HTML/CSS 被长期命中。
   v47(2026-09-07)：P1a 资产归位 + P1b 扩容到 200 句。
     - P1a：394 idiom 源从 D:/tmp 拷到 extra/idioms-394.json；inject-freq-idioms.js / pick-batch2.js / apply-translation-review.js / freq-idioms.js 头部 默认源路径改项目内相对路径；deck desc 去掉内部文件名话术（用户面向文案）。
     - P1b：freq-idioms 103→200（+97，3 批 extra/batch3-batch5.json 注入；每条带 sentence/translation/chunks/hints/grammar(逐词音标)/explanations 两段 全字段）。
     - scripts/e2e-freq-idioms.js 修复过时断言（去冗余后 deck 数变，写死 >=5 永远超时；改为查 builtin-freq-idioms 注册 + .deck-item 数量）。
     - gen-sw 重算 cache hash（v46 hash acd1d0e4 → v47 hash ee67c6d3）。
   v46(2026-09-07)：deck 三去冗余（方案 A 续）—— builtin-freq-spoken(口语·口头禅30句) 并入 builtin-daily。
     - builtins.js：freq-spoken 是文件最后一个 deck，文本级行区间拼接删除整块（比 shopping 简单，无后方偏移），30 句 concat 进 daily items → daily 静态 88 句
     - daily desc 更新为「生活口语综合 138 句：寒暄+购物+口头禅+进阶表达」；头部/尾部注释同步
     - validate_builtins.js：期望 1 个 deck（daily 静态 88）
     - 30 句逐句复查均可独立使用（应答语/祈使句本就完整），无需补主语改写
     - 运行态 deck 现为 2 个：builtin-daily(138 = 58日常+28购物+30口头禅+50 oral 并入) + builtin-freq-idioms(103) = 241 句
   v45(2026-09-07)：deck 二次去冗余（方案 A）—— builtin-oral-8000(日常进阶50句) 不再独立注册，运行时 concat 进 builtin-daily → daily 108 句。
     - oral8000.js：尾部从 BUILTIN.push 独立 deck 改为 find builtin-daily 后 items.concat(DATA_ORAL8000)；数据资产 DATA_ORAL8000 保留可续扩
     - builtins.js：仅更新头部注释与 daily desc（数据零行改动，彻底绕开上次文本拼接写坏文件的坑）；daily desc 更新为 108 句口径
     - validate_oral8000.js：注册检查 → 并入检查（dailyStub.items 尾部 === DATA_ORAL8000 引用）
     - validate_builtins.js：注释口径更新（静态 58 句，运行态 108）
     - 数据零迁移：oral-8000 云端 stats=0 / best=空壳(acc0) / mastered/deletedItems 空 → concat 后同句同 cid 天然对齐 builtin-daily 历史 key
     - 内置 deck 运行态现为 3 个：builtin-daily(108) + builtin-freq-spoken(30) + builtin-freq-idioms(103) = 241 句
   v44(2026-09-06)：合并 deck 去冗余 —— builtin-shopping(购物英语28句) 并入 builtin-daily(日常对话)，58 句单 deck「日常对话 · Daily Talk」。
     - builtins.js：文本级行区间拼接，删除 builtin-shopping 块；desc 更新为「生活口语综合58句：寒暄+购物场景」；头部注释说明合并
     - validate_builtins.js：期望 3→2 个 deck
     - 数据零迁移：云端实测 shopping 无 stats/mastered/deletedItems/best 残留（唯一数据 builtin-daily 30条 + freq-idioms 19条），cid 与 deck 无关所以购物句在 daily 内 cid 不变
     - 内置 deck 现为 4 个：builtin-daily(58) + builtin-freq-spoken(30) + builtin-oral-8000(50) + builtin-freq-idioms(103) = 241 句
   v43(2026-09-06)：去题库名称冗余（老板反馈「这些题库不冗余么」）。三个口语类 deck 重命名+定位分工：
     - builtin-daily         「日常对话 · Daily Talk」       — 完整生活场景句（≥3 词完整句）
     - builtin-freq-spoken   「口语·口头禅 · Casual Phrases」 — 短小功能性口头禅（≤3 词片段）
     - builtin-oral-8000     「日常进阶 · Beyond Basics」     — 更长更地道的完整日常句（5+ 词）
     此前3个 deck 都以"高频口语"开头，截图里视觉重叠、用户选择困难。改后每个 deck 有清晰分工（短片段口头禅 / 完整生活句 / 进阶日常句）。
     数据/进度不动（mastered/stat/masteredKey 全部按 deckId 维度，无数据迁移）。
   v42(2026-09-06)：核心修复「103 题只练 10 题就满分通关」根因 —— 用户的 mem.deletedItems 里有 93 条 freq-idioms 标记未被察觉。
   v41(2026-09-06)：main.html 修「长期 deck 被 batchSize 截断」bug（如 103 题 English Idioms 被截到 10 题就通关，剩 93 题永久跳过）。batchSize 仅作用于临时题库（#/book-/weak-/srs-/rev-）。
   v40(2026-09-06)：main.html 修「本句讲解」与「满分通关」两卡之间 0 gap（.result 加 margin-top:14px）。
   v39(2026-09-06)：freq-idioms.js 修 2 条翻译（#29「吃什么像什么」、#88「两个工作机会之间举棋不定」）。
   v38(2026-09-06)：freq-idioms.js 重建至 103 条（修复 3 段声明叠加损坏 + 9 条句末标点数据）。 */
const CACHE = 'chunklab-de34bc86'; // 由 scripts/gen-sw.js 按资源内容 hash 自动生成，勿手改
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
  '/freq-idioms.js',
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
  '/js/bridge.mjs',
  '/icon-180.png',
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

  /* 导航请求：在线优先，网络不可用时再回退缓存，避免更新后的页面被旧缓存冻结。 */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('/main.html');
        });
      })
    );
    return;
  }

  /* 静态资源：cache-first —— **只搜当前 CACHE**。
     根因（2026-09-09 生产事故）：caches.match(req) 跨所有 cache name 搜索，老 chunklab 缓存（activate
     清理前仍在）里的旧 core.js 会被命中，导致已升级版本被旧版覆盖。新版必须限定到当前 CACHE，
     由 activate 负责清理老 cache（不可把"老 cache 清理"当兜底）。 */
  e.respondWith(
    caches.open(CACHE).then(function (c) { return c.match(req); }).then(function (hit) {
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
