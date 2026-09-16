/* ============================================================
   core.js · Chunk Lab 共享核心（ADR-002：全局仅暴露 CL 单例）
   ------------------------------------------------------------
   承载三个页面共享的基础设施：
   - 存储：浏览器本地存储（同源，统一键 'chunklab.v1'，带版本迁移）
   - 工具：$ / esc / norm / normSent / timeAgo / copyText
   - 领域：masteredKey / findDeck / allDecks / 标熟·掌握判定
   - 通信：事件总线 + postMessage（iframe 与主页跨页通知）
   ============================================================ */
(function(global){
  'use strict';
  var businessStorage=global.AccountStorage ? global.AccountStorage.storage : global.localStorage;

  /* ★ 统一键：与主页面 main.html 一致
     （此前 stats/decks 用 chunklab_mem_v1 → 数据不同步，已修根因） */
  var STORE_KEY = 'chunklab.v1';
  var REVS_KEY = 'chunklab_revs_v1'; /* ADR-005：per-entity 版本号，独立于 mem 存储 */
  var CONFLICT_KEY = 'chunklab.sync-conflict.v1';
  var LISTENERS = {};

  /* ADR-005 rev 基础设施：本地为每个可同步实体维护 rev（版本号），离线改动时升 rev；
     同步时随 payload 上送，服务端按 rev 冲突检测取新版本。多设备互不覆盖无关改动；
     删除走软删除标记跨设备传播。调用方（页面/业务模块）零改动。 */
  /* 仍以「整块 kv blob」形态同步的键（LWW 整块替换语义）。
     ★ mastered / reinforceBook / deletedItems 已从这里移出（2026-09-10 第二轮）：
       它们是「随练习量无限增长」的对象，塞在单个 blob 里会让**每答一题**全量搬运
       （mastered 8000 条约 227KB、错题本上限 200 条约 176KB；再加上 maintainRevs 的
       JSON.stringify 与本地整块落盘，单次答题约 400KB 的无谓开销）。
       现在改走服务端 user_entity_rows 行表 + entityDelta 增量，合并语义与 stats 一致
       （并集 + 墓碑，幂等）——留在 SYNC_KV_KEYS 里会退回 LWW 整块替换，
       那正是「本机未上行的改动被他机覆盖」的根因。 */
  var SYNC_KV_KEYS = ['best', 'stats', 'settings'];
  /* 已行级化的 kv 键 → 客户端键名（与 server/index.js 的 ROW_KV_KINDS 对应） */
  var ROW_ENTITY_KEYS = ['mastered', 'reinforceBook', 'deletedItems'];
  var _prevSnap = null; /* 上次保存的内存快照，用于 diff 检测变更/删除 */
  var _lastSyncMeta = { revs: { decks: {}, kv: {} }, deleted: { decks: [], kv: [] } };

  function loadRevs() {
    try { return JSON.parse(businessStorage.getItem(REVS_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveRevs(r) {
    try {
      /* ★ 多标签页防护：rev 是单调版本号（越大越新）。
         其他标签页刚升过某实体的 rev 时，本页若用自身旧计算值整份覆盖 → rev 回退 →
         本机改动在云端被判为「旧版本」而被丢弃（静默丢数据）。
         这里逐键取 max：rev 永不回退；单标签页下 r 恒 ⊇ 磁盘（maintainRevs 从磁盘读后再升），
         故本合并对既有行为是恒等变换（不改变任何单页语义）。 */
      var disk = null;
      try{ disk = JSON.parse(businessStorage.getItem(REVS_KEY) || 'null'); }catch(e2){ disk = null; }
      if(disk && typeof disk === 'object' && r && typeof r === 'object'){
        var out = {};
        Object.keys(disk).forEach(function(k){ out[k] = disk[k]; });
        Object.keys(r).forEach(function(k){
          var a = out[k], b = r[k];
          if(a && typeof a === 'object' && b && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)){
            var sub = {};
            Object.keys(a).forEach(function(kk){ sub[kk] = a[kk]; });
            Object.keys(b).forEach(function(kk){
              if((Number(b[kk]) || 0) > (Number(sub[kk]) || 0)) sub[kk] = b[kk];
            });
            out[k] = sub;
          }else{
            out[k] = b;
          }
        });
        r = out;
      }
      businessStorage.setItem(REVS_KEY, JSON.stringify(r));
      notifyTabs('revs');
    } catch (e) {}
  }
  function sigDeck(d) { return JSON.stringify([d.name || '', d.items || [], d.builtin ? 1 : 0]); }
  function sigKv(v) { return JSON.stringify(v); }
  /* kv 变更签名的分发点：只有 stats 需要走廉价路径（见 sigStats），其余照旧 JSON.stringify。 */
  function kvSig(k, v) { return k === 'stats' ? sigStats(v) : sigKv(v); }
  /* ★ stats 的变更签名必须廉价（2026-09-10 扩容 8000 句）。
     maintainRevs 在每次 saveMem 里都要比对 kv 签名，原先直接用 JSON.stringify(stats) ——
     8000 句时那是 7.5MB 的序列化，每次答题多花 ~130ms（实测：改造后答题写入 123ms 里几乎全是它）。
     这里换成「条数 + 各条数字签名的异或累积 + 事件尾 id」：
       - 任一句的任何计数字段变化 → statSig 变 → 异或结果变；
       - 档案增删 → n 变；
       - 每次答题都会 push 事件 → 事件尾 id 变；
       - 键名改写（cid 迁移）不依赖本签名：migrateCidKeys 分支显式 bump rev。
     成本 O(条数) 纯算术，8000 条约 0.5ms。 */
  function sigStats(st){
    if(!st || typeof st !== 'object') return '';
    var by = st.bySentence || {};
    var n = 0, x = 0;
    for(var k in by){ if(by.hasOwnProperty(k)){ n++; x = (x ^ statSig(by[k])) >>> 0; } }
    var ev = Array.isArray(st.events) ? st.events : [];
    var last = ev.length ? (ev[ev.length-1] && ev[ev.length-1].id) : '';
    return (st.totalRounds||0) + ':' + (st.totalAnswered||0) + ':' + n + ':' + x + ':' + ev.length + ':' + last +
      ':' + (st.daysLog ? Object.keys(st.daysLog).length : 0);
  }

  /* 在 saveMem 中调用：与上次快照 diff，自动升 rev 并登记软删除。 */
  function maintainRevs(m) {
    var revs = loadRevs();
    if (!revs.decks) revs.decks = {};
    if (!revs.kv) revs.kv = {};
    var deletes = { decks: [], kv: [] };
    var curDecks = {};
    (m.decks || []).forEach(function (d) { curDecks[d.id] = true; });
    if (_prevSnap) {
      (m.decks || []).forEach(function (d) {
        var prev = _prevSnap.decks[d.id];
        if (prev === undefined || sigDeck(d) !== prev) {
          revs.decks[d.id] = (revs.decks[d.id] || 0) + 1;
          markPending(_pendingDecks, d.id); /* 只上行变更过的 deck（不再整份 mem.decks 重传） */
        }
      });
      Object.keys(_prevSnap.decks).forEach(function (id) {
        if (!curDecks[id]) {
          revs.decks[id] = (revs.decks[id] || 0) + 1;
          deletes.decks.push({ id: id, rev: revs.decks[id] });
          markGone(_pendingDecks, id, revs.decks[id]); /* 累积到待发集合，PUT 成功才摘除 */
        }
      });
      SYNC_KV_KEYS.forEach(function (k) {
        var cur = (k in m) ? m[k] : undefined;
        var prev = _prevSnap.kv[k];
        if (prev === undefined) { if (cur !== undefined) revs.kv[k] = (revs.kv[k] || 0) + 1; }
        else if (cur === undefined) { /* 字段消失，罕见，忽略 */ }
        else if (kvSig(k, cur) !== prev) revs.kv[k] = (revs.kv[k] || 0) + 1;
      });
    } else {
      /* 首次 saveMem（无上一帧快照）→ 只做 rev 初始化。
         ★ 无 rev 的实体必须同时标为待发：「服务端还没确认过它」。
           否则 syncFromCloud 之后（会把快照置回 null 走本分支）新建的 deck 永远不上行。 */
      (m.decks || []).forEach(function (d) {
        if (!(d.id in revs.decks)) { revs.decks[d.id] = 1; markPending(_pendingDecks, d.id); }
      });
      SYNC_KV_KEYS.forEach(function (k) { if ((k in m) && !(k in revs.kv)) revs.kv[k] = 1; });
    }
    _prevSnap = { decks: {}, kv: {} };
    (m.decks || []).forEach(function (d) { _prevSnap.decks[d.id] = sigDeck(d); });
    SYNC_KV_KEYS.forEach(function (k) { if (k in m) _prevSnap.kv[k] = kvSig(k, m[k]); });
    saveRevs(revs);
    _lastSyncMeta = { revs: revs, deleted: deletes };
  }

  /* ADR-005 step 2：courses / courseProgress 的 rev 维护。
     它们不经 saveMem（由 library.js / course-package.js 直接写 localStorage），
     故在 cloudSyncNow 上行前做「惰性 diff」：与上次上行快照比较，变更升 rev、消失登记软删。
     首次上行（无快照）→ 新实体初始化 rev=1。 */
  var _coursesSnap = null;   /* {courseId: sig} */
  var _progressSnap = null;  /* {courseId: sig} */

  /* ---------- 上行待发集合（2026-09-10 第二轮） ----------
     只发送「自上次成功上行以来有变更的实体」，确认送达后才摘除。
     ★ 必须累积，不能沿用「上一次 saveMem 的 diff」（_lastSyncMeta.deleted）：
       删除实体后若在 400ms 防抖窗口内又发生一次 saveMem，那个 diff 会被新的空 diff
       覆盖 → 服务端永远收不到删除，而本机已无该实体 → 下次 syncFromCloud 又把它
       从云端拉回来（**实体复活**）。这是本次一并修掉的既有 bug。
     ★ 确认送达时只摘掉「本次真正发出去的」id：在途期间新增/变更的实体必须留在待发集合里，
       否则它们永远不会被上行（例如首次上行还在传输时新建的 deck）。
     all = true 表示「尚无确认基准」→ 首次上行全量发送。 */
  function makePending() { return { all: true, dirty: {}, gone: {} }; }
  function markPending(p, id) { p.dirty[id] = 1; }
  function markGone(p, id, rev) { p.gone[id] = rev; }
  function pendingList(p, list, keyOf) {
    if (p.all) return list;
    return list.filter(function (x) { return !!p.dirty[keyOf(x)]; });
  }
  function pendingMap(p, map) {
    if (p.all) return map;
    var out = {};
    Object.keys(map).forEach(function (k) { if (p.dirty[k]) out[k] = map[k]; });
    return out;
  }
  /* 待发删除 = 累积集合 ∪ 本次 diff（两者都不完整：累积集合覆盖跨多次 saveMem 的删除，
     diff 覆盖首次上行那一次 —— 此时累积集合还是空的）。返回下发列表 + 本次发出的 id 集合。 */
  function pendingGone(p, diffList) {
    var sent = {}, res = [];
    Object.keys(p.gone).forEach(function (id) { sent[id] = 1; res.push({ id: id, rev: p.gone[id] }); });
    (diffList || []).forEach(function (d) { if (!sent[d.id]) { sent[d.id] = 1; res.push(d); } });
    return { list: res, sent: sent };
  }
  function ackPending(p, sentUp, sentGone) {
    Object.keys(sentUp || {}).forEach(function (id) { delete p.dirty[id]; });
    Object.keys(sentGone || {}).forEach(function (id) { delete p.gone[id]; });
    p.all = false;
  }
  function discardSupersededDeletes(p, batch, sentUp, revs){
    batch.list = batch.list.filter(function(d){
      if(sentUp[d.id] && (revs[d.id] || 0) > d.rev){
        delete p.gone[d.id]; delete batch.sent[d.id];
        return false; // 删除尚未确认时又重建：只发送较新的重建意图。
      }
      return true;
    });
  }
  function idsOf(list, keyOf) {
    var out = {};
    (list || []).forEach(function (x) { out[keyOf(x)] = 1; });
    return out;
  }
  /* 算出「服务端还不知道 / 版本更旧」的实体 id 集合 —— 合并前的本地 rev 与远端 rev 比较。
     ★ 必须用**合并前**的本地 rev：合并会把 localRevs 抬到 max(本地, 远端)，
       之后就分辨不出「本地更新」，刷新页面后会把全部 deck / 课程重传一遍。 */
  function entitiesNeedingPush(list, keyOf, localMap, remoteMap) {
    var out = {};
    (list || []).forEach(function (x) {
      var id = keyOf(x);
      if (!(id in (remoteMap || {}))) { out[id] = 1; return; } /* 服务端没有 → 必须上行 */
      if ((localMap[id] || 0) > (remoteMap[id] || 0)) out[id] = 1; /* 本地更新 → 必须上行 */
    });
    return out;
  }

  var _pendingDecks = makePending();     /* 用户 deck（导入题库可达数百 KB，不该每答一题重传） */
  var _pendingCourses = makePending();   /* 课程（含 base64 图片，最大） */
  var _pendingProgress = makePending();  /* 课程进度 */
  function sigCourse(c) { return JSON.stringify(c); }

  function maintainCoursesRevs() {
    var revs = loadRevs();
    if (!revs.courses) revs.courses = {};
    if (!revs.courseProgress) revs.courseProgress = {};
    var deleted = { courses: [], courseProgress: [] };

    var cur = readCoursesRaw();
    var curIds = {};
    cur.forEach(function (c) { curIds[c.courseId] = true; });
    if (_coursesSnap) {
      cur.forEach(function (c) {
        var prev = _coursesSnap[c.courseId];
        if (prev === undefined || sigCourse(c) !== prev) {
          revs.courses[c.courseId] = (revs.courses[c.courseId] || 0) + 1;
          markPending(_pendingCourses, c.courseId); /* 只上行变更课程（课程可含 base64 图片） */
        }
      });
      Object.keys(_coursesSnap).forEach(function (cid) {
        if (!curIds[cid]) {
          revs.courses[cid] = (revs.courses[cid] || 0) + 1;
          deleted.courses.push({ id: cid, rev: revs.courses[cid] });
          markGone(_pendingCourses, cid, revs.courses[cid]);
        }
      });
    } else {
      /* 同理：快照被 syncFromCloud 置回 null 时，无 rev 的课程就是「服务端还不知道」的。
         不标记的话，syncFromCloud 之后新建的课程（`_pendingCourses.all` 已为 false）
         会被 pendingList 过滤掉，永远不上行。 */
      cur.forEach(function (c) {
        if (!(c.courseId in revs.courses)) { revs.courses[c.courseId] = 1; markPending(_pendingCourses, c.courseId); }
      });
    }
    _coursesSnap = {};
    cur.forEach(function (c) { _coursesSnap[c.courseId] = sigCourse(c); });

    var pcur = readProgressRaw();
    if (_progressSnap) {
      Object.keys(pcur).forEach(function (cid) {
        var prev = _progressSnap[cid];
        if (prev === undefined || sigKv(pcur[cid]) !== prev) {
          revs.courseProgress[cid] = (revs.courseProgress[cid] || 0) + 1;
          markPending(_pendingProgress, cid);
        }
      });
      Object.keys(_progressSnap).forEach(function (cid) {
        if (!(cid in pcur)) {
          revs.courseProgress[cid] = (revs.courseProgress[cid] || 0) + 1;
          deleted.courseProgress.push({ id: cid, rev: revs.courseProgress[cid] });
          markGone(_pendingProgress, cid, revs.courseProgress[cid]);
        }
      });
    } else {
      Object.keys(pcur).forEach(function (cid) {
        if (!(cid in revs.courseProgress)) { revs.courseProgress[cid] = 1; markPending(_pendingProgress, cid); }
      });
    }
    _progressSnap = {};
    Object.keys(pcur).forEach(function (cid) { _progressSnap[cid] = sigKv(pcur[cid]); });

    saveRevs(revs);
    return { revs: revs, deleted: deleted };
  }

  /* ---------- 存储版本化（版本迁移链） ----------
     version 语义：缺省 = 1（legacy）。写入时强制打当前版本。
     MIGRATIONS[n] = v(n) → v(n+1) 的迁移函数。 */
  var CURRENT_VERSION = 2;
  var MIGRATIONS = {
    1: function(raw){ /* v1→v2：无结构变化，仅建立版本化基础 */ return raw; }
  };

  function migrate(raw){
    if(!raw || typeof raw !== 'object') raw = {};
    var v = (typeof raw.version === 'number' && raw.version >= 1) ? raw.version : 1;
    if(v >= CURRENT_VERSION) return raw;
    for(var cur = v; cur < CURRENT_VERSION; cur++){
      var fn = MIGRATIONS[cur];
      if(fn){ try{ raw = fn(raw) || raw; }catch(e){ console.error('[core.migrate] v'+cur+'→v'+(cur+1), e); } }
      raw.version = cur + 1;
    }
    return raw;
  }

  /* 默认结构（缺省合并用） */
  function defaultMem(){
    return {
      decks: [], best: {}, mastered: {}, deletedItems: {},
      stats: { totalRounds:0, totalAnswered:0, bySentence:{}, events:[] },
      settings: {
        sound:true, shuffle:false, fxStack:true, celebrate:'confetti', mode:'choose',
        skipMastered:true, batchSize:10, autoSpeak:false, darkMode:false,
        provider:'deepseek', model:'deepseek-v4-flash', apiKey:''
      }
    };
  }

  /* ---------- 多标签页旧快照覆盖防护（P0 数据可靠性加固，2026-09-11） ----------
     根因：mem 在页面加载时 loadMem() 读入内存后本进程内不再自动刷新；
     写路径 saveAndNotify → saveMem → writeLocalMem 把**整份** mem 直接写回 localStorage，
     写前没有任何版本检查。两个标签页同时打开时：
       标签页 A 持旧 mem ─ 标签页 B 答题写回 ─ 标签页 A 再答题 saveMem
     → A 用旧整份快照覆盖掉 B 的全部改动（**单机双标签页即触发**，用户无感 = 静默丢数据）。

     方案（保守优先，绝不静默覆盖）：
       1. 每个标签页分配唯一 tabId；
       2. 写 localStorage 前比对「本页基线 base」与磁盘原文 —— 被其他标签页改过则做
          **三路合并**（base = 本页上次同步的磁盘态、ours = 本页内存、theirs = 当前磁盘），
          把本页改动 + 对方改动都保留（并集语义），绝不整份覆盖；
       3. 写后经 BroadcastChannel('chunklab-sync') 广播写事件（含 tabId），其他标签页据此
          刷新展示；BroadcastChannel 不可用 → 退回 storage 事件（写一个 beacon 键，
          其他标签页的 storage 事件即触发同一逻辑）。

     为什么是「三路合并」而不是「重新加载」：重新加载会丢掉本页刚刚答题产生的改动
     （那部分只在内存里，尚未落盘）。合并是唯一同时保住「本页新改动」与「对方新改动」的做法。

     不变式：任何写路径都不得让磁盘上「别的标签页刚写的」数据凭空消失；
     无法判定的冲突以「不丢用户数据」为先（同 key 双方都改 → 后写者胜，与云端 LWW 一致）。

     ★ 不改动既有机制语义：chunklab_revs_v1（单调 rev）/ 云端水位 _cloudBsSig·_cloudEvIds /
       IDB 内存桥 _coursesCache·_statsStore / _prevSnap 全部保持原语义，只是在其外面加一层
       「写前检查 + 合并」。 */
  var TAB_SYNC_KEY = 'chunklab_tabsync_v1';   /* 降级通道：写此键触发其他标签页的 storage 事件 */
  var TAB_CHANNEL = 'chunklab-sync' + (global.AccountStorage ? ':' + global.AccountStorage.owner : '');
  var TAB_ID = (function(){
    try{ if(global.crypto && typeof global.crypto.randomUUID === 'function') return global.crypto.randomUUID(); }
    catch(e){}
    return 'tab-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  })();
  var _tabChannel = null;
  var _tabSeq = 0;          /* 本页广播序号 */
  var _externalSeq = 0;     /* 收到的跨标签页写入次数（供页面/测试观察） */
  var _crossTabMerges = 0;  /* 触发的三路合并次数（供页面/测试观察） */
  /* 本页基线：磁盘上「与本页内存相对应」的那份 chunklab.v1 原文 + 其可见字段视图。
     base 是三路合并的共同祖先：本页改动 = 内存 vs base；磁盘改动 = 当前磁盘 vs base。
     只在「本页提交」与「主动采纳磁盘 / 迁移回写」时推进 —— 绝不在任意 loadMem 里推进，
     否则会把页面上仍持有的旧内存态误判为「最新磁盘态」→ 漏判真实的外部改动。 */
  var _memBaseRaw = null;
  var _memBaseMem = null;
  var _memBaseReady = false;
  /* courses / progress 的跨标签页信号与基线（大对象在 IDB，不能靠 chunklab.v1 原文判变） */
  var _coursesDiskBase = null;
  var _progressDiskBase = null;
  var _coursesExternal = false;
  var _progressExternal = false;

  function _readRaw(key){
    try{ return businessStorage.getItem(key); }catch(e){ return null; }
  }
  /* localStorage 里「可见」的 mem 视图（IDB 托管时 bySentence/events 不在其中）。
     只用于三路合并的 base / theirs 两侧；缺省字段补空，避免 undefined 参与比较。 */
  function parseLocalMem(raw){
    var o = {};
    try{ o = raw ? (JSON.parse(raw) || {}) : {}; }catch(e){ o = {}; }
    if(!o || typeof o !== 'object') o = {};
    var os = (o.stats && typeof o.stats === 'object') ? o.stats : {};
    return {
      decks: Array.isArray(o.decks) ? o.decks : [],
      best: (o.best && typeof o.best === 'object') ? o.best : {},
      mastered: (o.mastered && typeof o.mastered === 'object') ? o.mastered : {},
      deletedItems: (o.deletedItems && typeof o.deletedItems === 'object') ? o.deletedItems : {},
      reinforceBook: Array.isArray(o.reinforceBook) ? o.reinforceBook : [],
      progress: (o.progress && typeof o.progress === 'object') ? o.progress : {},
      settings: (o.settings && typeof o.settings === 'object') ? o.settings : {},
      stats: {
        totalRounds: Number(os.totalRounds) || 0,
        totalAnswered: Number(os.totalAnswered) || 0,
        bySentence: (os.bySentence && typeof os.bySentence === 'object') ? os.bySentence : {},
        events: Array.isArray(os.events) ? os.events : [],
        daysLog: (os.daysLog && typeof os.daysLog === 'object') ? os.daysLog : {}
      }
    };
  }
  function _has(o, k){ return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function _eqJson(a, b){
    if(a === b) return true;
    try{ return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b); }
    catch(e){ return false; }
  }
  function _toMap(list, keyOf){
    var m = {};
    (Array.isArray(list) ? list : []).forEach(function(x){
      var k = keyOf(x);
      if(k != null && k !== '') m[k] = x;
    });
    return m;
  }
  function _listFromKeyed(primaryList, res, keyOf){
    var out = [], seen = {};
    (Array.isArray(primaryList) ? primaryList : []).forEach(function(x){
      var k = keyOf(x);
      if(k != null && k !== '' && _has(res, k) && !seen[k]){ seen[k] = 1; out.push(res[k]); }
    });
    Object.keys(res).forEach(function(k){ if(!seen[k]){ seen[k] = 1; out.push(res[k]); } });
    return out;
  }
  /* 以 key 对齐的集合三路合并（maps 与 arrays 归一后共用）。
     规则（并集语义，绝不丢任一侧的改动）：
       - 起点 = ours（本页内存）：本页正在提交的改动必须落盘，否则本页丢数据；
       - theirs 相对 base 的「新增/修改」→ 本页未动则采纳；双方都改 → 保留本页（后写者胜）；
       - theirs 相对 base 的「删除」→ 本页未动则采纳删除；本页改过则保留本页改动。 */
  function mergeKeyedMap(base, ours, theirs){
    base = base || {}; ours = ours || {}; theirs = theirs || {};
    var res = {}, k;
    for(k in ours){ if(_has(ours, k)) res[k] = ours[k]; }
    for(k in theirs){
      if(!_has(theirs, k)) continue;
      var baseHas = _has(base, k);
      if(baseHas && _eqJson(theirs[k], base[k])) continue;   /* 对方没动 → 忽略 */
      var oursHas = _has(ours, k);
      var oursChanged = baseHas ? (!oursHas || !_eqJson(ours[k], base[k])) : oursHas;
      if(!oursChanged) res[k] = theirs[k];                   /* 对方新增/改动且本页未动 → 采纳 */
      else if(!oursHas) res[k] = theirs[k];                  /* 本页删了、对方改了 → 保留对方（不丢对方改动） */
      /* 双方都改 → 保留本页 */
    }
    for(k in base){
      if(!_has(base, k)) continue;
      if(_has(theirs, k)) continue;                          /* 对方仍保留该实体 */
      if(!_has(ours, k)){ delete res[k]; continue; }         /* 双方都删 */
      if(_eqJson(ours[k], base[k])) delete res[k];           /* 本页没动 → 采纳对方删除 */
      /* 本页改过 → 保留本页（不因对方删除而丢本页新改动） */
    }
    return res;
  }
  /* daysLog 是「按天的打卡汇总」（单调），取逐天 max，绝不回退。 */
  function mergeDaysLogTabs(base, ours, theirs){
    var res = {}, k;
    [theirs, ours].forEach(function(o){
      if(!o) return;
      for(k in o){
        if(!_has(o, k)) continue;
        var r = (o[k] && Number(o[k].rounds)) || 0;
        if(r <= 0) continue;
        res[k] = { rounds: Math.max((res[k] && res[k].rounds) || 0, r) };
      }
    });
    return res;
  }
  /* bySentence：句子级档案。磁盘侧在 IDB 模式下不含大对象（theirs 为空）→ 直接保持本页引用
     （IDB 内存桥身份不能断），否则按 key 并集。 */
  function mergeBySentenceTabs(base, ours, theirs){
    if(!theirs || !Object.keys(theirs).length) return ours || {};
    return mergeKeyedMap(base, ours, theirs);
  }
  /* events：按 id 并集（本页在前，补对方独有），绝不因合并丢事件。 */
  function mergeEventsTabs(base, ours, theirs){
    var oa = Array.isArray(ours) ? ours : [];
    var ta = Array.isArray(theirs) ? theirs : [];
    var ba = Array.isArray(base) ? base : [];
    if(!ta.length && !ba.length) return oa;
    var seen = {}, out = [];
    function push(list){
      (list || []).forEach(function(e){
        if(!e) return;
        if(e.id){ if(!seen[e.id]){ seen[e.id] = 1; out.push(e); } }
        else out.push(e);
      });
    }
    push(oa); push(ta);
    return out;
  }
  /* stats 小字段三路合并：计数器取 max（单调，绝不回退）；daysLog 逐天 max；
     其余标量「本页改过则本页，否则磁盘」；大对象走上面的并集。 */
  function mergeStatsForTabs(base, ours, theirs){
    base = base || {}; ours = ours || {}; theirs = theirs || {};
    var res = {}, k, keys = {};
    [ours, theirs, base].forEach(function(o){ for(var kk in o){ if(_has(o, kk)) keys[kk] = 1; } });
    for(k in keys){
      if(k === 'bySentence' || k === 'events') continue;
      if(k === 'totalRounds' || k === 'totalAnswered'){
        res[k] = Math.max(Number(ours[k]) || 0, Number(theirs[k]) || 0, Number(base[k]) || 0);
        continue;
      }
      if(k === 'daysLog'){ res[k] = mergeDaysLogTabs(base[k], ours[k], theirs[k]); continue; }
      if(_has(ours, k) && !_eqJson(ours[k], base[k])) res[k] = ours[k];
      else if(_has(theirs, k)) res[k] = theirs[k];
      else if(_has(ours, k)) res[k] = ours[k];
    }
    res.bySentence = mergeBySentenceTabs(base.bySentence, ours.bySentence, theirs.bySentence);
    res.events = mergeEventsTabs(base.events, ours.events, theirs.events);
    return res;
  }
  /* mem 的三路合并：把「本页改动」与「对方改动」都保留下来（就地改写 target）。 */
  function mergeMemInto(target, disk, base){
    if(!target || typeof target !== 'object') return target;
    disk = disk || {}; base = base || {};
    var deckKey = function(d){ return d && d.id; };
    var bookKey = function(it){ return it && (it._key || it.id || it.sentence); };
    target.decks = _listFromKeyed(target.decks,
      mergeKeyedMap(_toMap(base.decks, deckKey), _toMap(target.decks, deckKey), _toMap(disk.decks, deckKey)), deckKey);
    target.reinforceBook = _listFromKeyed(target.reinforceBook,
      mergeKeyedMap(_toMap(base.reinforceBook, bookKey), _toMap(target.reinforceBook, bookKey), _toMap(disk.reinforceBook, bookKey)), bookKey);
    target.mastered = mergeKeyedMap(base.mastered, target.mastered, disk.mastered);
    target.deletedItems = mergeKeyedMap(base.deletedItems, target.deletedItems, disk.deletedItems);
    target.best = mergeKeyedMap(base.best, target.best, disk.best);
    target.progress = mergeKeyedMap(base.progress, target.progress, disk.progress);
    target.settings = mergeKeyedMap(base.settings, target.settings, disk.settings);
    target.stats = mergeStatsForTabs(base.stats, target.stats, disk.stats);
    return target;
  }
  /* 提交后推进基线：此后「本页内存」与磁盘即视为一致。 */
  function adoptMemBase(raw){
    _memBaseRaw = raw;
    _memBaseMem = parseLocalMem(raw);
    _memBaseReady = true;
  }
  /* 广播一次写事件（含 tabId）；BroadcastChannel 主通道 + beacon 键降级通道并用。 */
  function notifyTabs(area){
    _tabSeq++;
    var msg = { v: 1, type: 'chunklab-write', tabId: TAB_ID, area: area || 'mem', seq: _tabSeq, at: Date.now() };
    if(_tabChannel){ try{ _tabChannel.postMessage(msg); }catch(e){} }
    try{ businessStorage.setItem(TAB_SYNC_KEY, JSON.stringify(msg)); }catch(e){}
  }
  function onTabMessage(msg){
    if(!msg || msg.type !== 'chunklab-write' || msg.tabId === TAB_ID) return;
    _externalSeq++;
    if(msg.area === 'courses') _coursesExternal = true;
    else if(msg.area === 'progress') _progressExternal = true;
    emit('memExternal', { seq: _externalSeq, area: msg.area || 'mem', fromTab: msg.tabId });
  }
  function onCrossTabStorage(e){
    if(!e || !e.key) return;
    if(global.AccountStorage) e = { key: global.AccountStorage.decodeKey(e.key), newValue: e.newValue };
    if(e.key === TAB_SYNC_KEY){
      if(!e.newValue) return;
      var msg = null;
      try{ msg = JSON.parse(e.newValue); }catch(err){ msg = null; }
      if(msg) onTabMessage(msg);
      return;
    }
    /* 兼容：别的标签页（或外部代码 / 旧版本）直接改了 chunklab.v1 */
    if(e.key === STORE_KEY){
      _externalSeq++;
      emit('memExternal', { seq: _externalSeq, area: 'mem', fromTab: '' });
    }
  }
  /* 主动采纳磁盘最新态（页面在「安全时机」调用，如收到 memExternal 且不在答题中）：
     重新从 IDB 载入大对象内存桥 + 重读磁盘小字段，并把基线推进到磁盘态。 */
  function refreshExternal(){
    _bySentenceCache = null; _eventsCache = null;
    _coursesCache = null; _progressCache = null;
    _preloadTask = null;
    if(_statsStore === 'idb'){ _statsFullRewrite = true; _evSnap = null; }
    return preload().then(function(){
      var m = loadMem();
      _coursesSnap = null; _progressSnap = null;   /* 让 maintainCoursesRevs 重新对齐，避免误 bump */
      adoptMemBase(_readRaw(STORE_KEY));
      _coursesExternal = false; _progressExternal = false;
      emit('memRefreshed', m);
      return m;
    }).catch(function(e){
      console.warn('[core.refreshExternal] 采纳磁盘态失败，退回内存现值：', e && e.message);
      return loadMem();
    });
  }
  (function initCrossTab(){
    if(global.__CL_DISABLE_CROSSTAB__ === true) return; /* 仅供对照实验/排障使用，正常为 false */
    try{
      if(typeof global.BroadcastChannel === 'function'){
        _tabChannel = new global.BroadcastChannel(TAB_CHANNEL);
        _tabChannel.onmessage = function(ev){ onTabMessage(ev && ev.data); };
        /* Node 环境（单测）里 BroadcastChannel 会挂住事件循环 → 显式 unref（浏览器无此方法，跳过） */
        if(typeof _tabChannel.unref === 'function'){ try{ _tabChannel.unref(); }catch(e){} }
      }
    }catch(e){ _tabChannel = null; }
    try{ if(typeof global.addEventListener === 'function') global.addEventListener('storage', onCrossTabStorage); }catch(e){}
    adoptMemBase(_readRaw(STORE_KEY));
  })();

  /* ---------- 存储 ---------- */
  function loadMem(){
    var d = defaultMem();
    try{
      var _diskRaw = businessStorage.getItem(STORE_KEY);
      var o = migrate(JSON.parse(_diskRaw || '{}'));
      var os = (o.stats && typeof o.stats === 'object') ? o.stats : {};
      var out = {
        decks: Array.isArray(o.decks) ? o.decks : d.decks,
        best: o.best || d.best,
        mastered: o.mastered || d.mastered,
        deletedItems: o.deletedItems || {},
        stats: {
          totalRounds: os.totalRounds || 0,
          totalAnswered: os.totalAnswered || 0,
          /* 大对象优先取内存桥（preload 从 IDB 载入）；未预载时读 localStorage 旧值 */
          bySentence: _bySentenceCache || ((os.bySentence && typeof os.bySentence === 'object') ? os.bySentence : {}),
          events: _eventsCache || (Array.isArray(os.events) ? os.events : []),
          daysLog: (os.daysLog && typeof os.daysLog === 'object') ? os.daysLog : {}
        },
        settings: Object.assign({}, d.settings, o.settings || {}),
        reinforceBook: o.reinforceBook || [],
        progress: o.progress || {},
        version: CURRENT_VERSION
      };
      /* ADR：句子档案 key 迁移（幂等），两步顺序不可颠倒：
         ① 原文 → cid（migrateCidKeys）；② 老口语 deck → 新 oral-* deck（migrateToBookDecks）。
         对「组装后的完整 stats」执行，同时覆盖 IDB 内存桥与 localStorage 旧值两条来源。 */
      try{
        var _cidMoved = migrateCidKeys(out);
        var _sceneMoved = migrateToBookDecks(out);
        if(_cidMoved || _sceneMoved){
          /* 仅当大对象已托管给 IDB 时才回填内存桥；否则保持 null，让后续 loadMem 始终
             读 localStorage 真值（IDB 不可用时缓存会变「粘住」的陈旧副本 → 数据看起来丢失） */
          if(_statsStore === 'idb'){
            _bySentenceCache = out.stats.bySentence;
            _eventsCache = out.stats.events;
            _statsFullRewrite = true; /* 键被改写 → IDB 必须整块覆盖，不能按签名增量 */
          }
          /* ★ 迁移是「读磁盘 → 原地改写 → 回写」的同一事务：写前把基线推进到刚读到的磁盘态。
             否则三路合并会把迁移前的旧键（如 d1#原文）当成「对方新增」复活，把幂等迁移做坏。 */
          adoptMemBase(_diskRaw);
          saveMem(out);
          var _r = loadRevs();
          if(!_r.kv) _r.kv = {};
          ['stats'].forEach(function(k){ if(k in out) _r.kv[k] = (_r.kv[k] || 0) + 1; });
          saveRevs(_r);
          /* 句子 key 被改写 → mastered / deletedItems / 错题本的行主键也变了。
             旧水位里的 key 已不复存在，必须整批重推（置 null = 水位未知 → 下次全量上行）。
             这与 stats 走 rev+1 是同一个目的，只是这三个走水位机制而非 rev。 */
          _cloudMasteredSig = null;
          _cloudReinforceSig = null;
          _cloudDeletedSig = null;
          _prevSnap = null; /* 让下一次 saveMem 的 maintainRevs 走初始化分支，避免误 bump 合并结果 */
        }
      }catch(e){ console.error('[core.migrateKeys]', e); }
      return out;
    }catch(e){
      console.error('[core.loadMem]', e);
      return d;
    }
  }
  function saveMem(m, recordLearning, commitGeneration){
    try{
      /* ★ 三路合并失败时 writeLocalMem 返回 false → 本次不落盘（宁可本次丢失、也绝不覆盖
         其他标签页的新数据）。调用方（saveStore / saveAndNotify）会拿到 false 并可提示用户。 */
      if(writeLocalMem(m) === false) return false;
      maintainRevs(m);
      /* 大对象增量落盘（异步，不阻塞答题）。
         若落盘失败，persistStats 会把托管模式降级为 'local' ——
         此时必须立刻用「未剥离」的完整 stats 重写 localStorage，否则本次 save 已经写下的
         是剥离版副本，大对象就真的没有落点了（实测过的丢数据路径）。 */
      var commit = Promise.resolve(true);
      if(_statsStore === 'idb' && m.stats){
        commit = persistStats(m.stats,recordLearning,commitGeneration,m).then(function(ok){
          if(ok === false && _statsStore === 'local'){
            /* 保留完整 localStorage 兜底，但本次提交仍报告失败：不能在
               IDB 事务失败后把未确认的状态继续上传云端。下次保存再重试。 */
            try{ writeLocalMem(m); return false; }
            catch(e2){ console.error('[core.saveMem] 降级回写 localStorage 也失败（配额不足）', e2); emit('persistError', { error: e2 }); return false; }
          }
          return ok !== false;
        }).catch(function(error){
          console.error('[core.saveMem] 异步统计落盘失败', error);
          emit('persistError', { area: 'stats', error: error });
          return false;
        });
      }
      /* saveMem 保持历史同步返回值；统一入口通过这个 Promise 等待真正的
         IndexedDB/降级落盘结果，避免在事务尚未完成时广播“已保存”或发起同步。 */
      _lastSavePromise = commit;
      return true;
    }
    catch(e){
      /* ★ 不再静默：配额/序列化失败必须让调用方与用户可感知（此前只 console.error + return false，
         8000 句超配额时表现为「练习记录凭空消失」）。 */
      console.error('[core.saveMem] 落盘失败（可能超出 localStorage 配额）', e);
      emit('persistError', { error: e });
      return false;
    }
  }
  var _lastSavePromise = Promise.resolve(true);
  /* 单一落点：把 mem 写进 localStorage。大对象已托管给 IDB 时只写小字段
     （这是解除 5MB 配额与 188ms/次写入延迟的关键，见 _statsStore 注释）。

     ★ 多标签页旧快照防护（P0）：写前比对磁盘基线与当前磁盘原文。
       被其他标签页改过（diskRaw !== base）→ 先做三路合并，把本页改动与对方改动都保留，
       再整份落盘；绝不拿旧内存态覆盖别人刚写的。返回 false 表示「为避免覆盖而放弃本次落盘」。 */
  function writeLocalMem(m){
    var diskRaw = _readRaw(STORE_KEY);
    if(_memBaseReady && diskRaw !== null && diskRaw !== _memBaseRaw){
      var okMerge = true;
      try{
        mergeMemInto(m, parseLocalMem(diskRaw), _memBaseMem || parseLocalMem(null));
        /* 合并后 stats 可能是新对象：重挂大对象内存桥，避免后续 loadMem 又取回合并前的旧 bySentence/events。
           'local' 模式且内存桥为 null 时保持 null（让 loadMem 始终读 localStorage 真值，不制造「粘住」的副本）。 */
        if(m.stats){
          if(_statsStore === 'idb' || _bySentenceCache !== null) _bySentenceCache = m.stats.bySentence || {};
          if(_statsStore === 'idb' || _eventsCache !== null) _eventsCache = m.stats.events || [];
        }
        _crossTabMerges++;
        emit('memMerged', { count: _crossTabMerges, tabId: TAB_ID });
      }catch(e){
        okMerge = false;
        console.error('[core.writeLocalMem] 跨标签页三路合并失败 —— 为避免覆盖其他标签页的新数据，已跳过本次落盘', e);
        emit('persistError', { area: 'crossTabMerge', error: e });
      }
      if(!okMerge) return false;
    }
    var out = Object.assign({}, m);
    out.version = CURRENT_VERSION; /* 写入时强制版本 */
    if(_statsStore === 'idb' && m.stats && typeof m.stats === 'object'){
      var light = {}, s = m.stats;
      for(var k in s){ if(s.hasOwnProperty(k) && k !== 'bySentence' && k !== 'events') light[k] = s[k]; }
      out.stats = light;
    }
    var str = JSON.stringify(out);
    businessStorage.setItem(STORE_KEY, str);
    adoptMemBase(str);   /* 提交成功：本页内存与磁盘就此一致 */
    notifyTabs('mem');
    return true;
  }
  /* 数据变更统一入口：保存 + 本地事件 + 通知父窗口 + 后台同步云端 */
  function saveAndNotify(memObj, syncMode){
    /* 代次候选值随本地提交一起进入 IDB；只有提交成功后才正式调度云同步。 */
    var shouldSync = syncMode !== 'local' && _cloudOn && global.ChunkAPI;
    /* Reserve the generation before the asynchronous persistence lane.  Two
       saves can be queued before either IDB transaction completes; deriving
       both from the old value would give them the same generation and could
       leave the second save without a successor sync attempt. */
    var commitGeneration = shouldSync ? ++_syncGeneration : null;
    var ok = saveMem(memObj, undefined, commitGeneration);
    if(ok === false) return false;
    return _lastSavePromise.then(function(committed){
      if(!committed) return false;
      /* IDB 托管路径已把代次写进同一事务；localStorage 兜底或测试降级
         路径没有这个能力，必须让 scheduleCloudSync 走独立的安全补写。 */
      var generationAtomic = shouldSync && _statsStore === 'idb' && global.IDBStore &&
        typeof global.IDBStore.writeStatsBatch === 'function';
      if(shouldSync) scheduleCloudSync(memObj, generationAtomic ? commitGeneration : null);
      emit('memUpdated', memObj);
      if(global.parent && global.parent !== global){
        try{ global.parent.postMessage({ type:'memUpdated' }, '*'); }catch(e){}
      }
      return true;
    });
  }

  /* ---------- 云端同步层（前后端分离） ----------
     设计：localStorage 仍是同步写入（保证 UI 即时、离线可用），
     云端在后台异步同步。已登录时：
       - 保存 → debounce 后 PUT 全量（mem + courses + courseProgress）
       - 启动 → ensureCloud() 拉取云端覆盖本地
     courses / courseProgress 的 localStorage 键与 library.js / course-package.js 完全一致，
     故此处直接读写这两个键，避免与业务模块耦合。 */
  var COURSES_KEY = 'chunklab.courses.v1';
  var PROGRESS_KEY = 'chunklab.course-progress.v1';

  /* 大对象（courses / courseProgress）内存桥 + IndexedDB 主存储（解除 localStorage 5MB 配额）：
     启动时 CL.preload() 从 IDB 载入内存（首次从 localStorage 迁移后删除大键）；
     读走内存（同步 API 形态，调用方零改动），写走内存 + 异步 IDB，不再写 localStorage。 */
  var _coursesCache = null;   /* null = 未预载（兜底读 localStorage 旧值） */
  var _progressCache = null;
  /* stats 大对象（bySentence / events）的内存桥与增量落盘状态 —— 详见「持久化分层」注释块 */
  var _statsStore = 'local';     /* 'idb' = 大对象已托管给 IDB；'local' = 保留旧行为（全部进 localStorage） */
  var _bySentenceCache = null;   /* null = 未预载 → 兜底读 localStorage 旧值 */
  var _eventsCache = null;
  var _bsSig = {};               /* key → 上次落盘时的数字签名（判定该行是否需要重写） */
  var _evSnap = null;            /* { count, lastId }：上次落盘后事件数组的尾部标记（判定能增量追加还是需整体替换） */
  var _statsFullRewrite = false; /* 置位后下次落盘强制全量覆盖 IDB（cid 迁移 / 云合并后） */

  function readCoursesRaw(){
    if(_coursesCache !== null) return _coursesCache;
    try{ return JSON.parse(businessStorage.getItem(COURSES_KEY) || '[]'); }catch(e){ return []; }
  }
  function readProgressRaw(){
    if(_progressCache !== null) return _progressCache;
    try{ return JSON.parse(businessStorage.getItem(PROGRESS_KEY) || '{}'); }catch(e){ return {}; }
  }

  /* 启动预载：IDB → 内存；IDB 空则从 localStorage 迁移，随后删除大键释放配额。
     幂等：多个页面（main + iframe 子页）同时调用安全（同源共享 IDB，迁移结果一致）。 */
  var _preloadTask = null;
  function preload(){
    if(_preloadTask) return _preloadTask;
    _preloadTask = preloadStores().then(function(ok){ _preloadTask = null; return ok; });
    return _preloadTask;
  }
  async function preloadStores(){
    if(!global.IDBStore) return Promise.resolve(false);
    return Promise.resolve().then(function(){
      return Promise.all([
        global.IDBStore.loadAll(),
        global.IDBStore.readBusinessMem ? global.IDBStore.readBusinessMem().catch(function(){return null;}) : Promise.resolve(null),
        /* The durable batch generation must be restored before the first
         * post-refresh save reserves a successor generation.  Otherwise a
         * page that previously committed generation N starts at zero and
         * stages its next payload with an older generation than syncMeta. */
        global.IDBStore.readSyncMeta ? global.IDBStore.readSyncMeta('conditional-batch-v1').catch(function(){return null;}) : Promise.resolve(null)
      ]);
    }).then(async function(parts){
      var data=parts[0], businessMeta=parts[1], syncMeta=parts[2];
      if(syncMeta && global.AccountStorage && syncMeta.owner===global.AccountStorage.owner &&
         Number.isSafeInteger(syncMeta.localGeneration) && syncMeta.localGeneration>=0){
        _syncGeneration=Math.max(_syncGeneration || 0,syncMeta.localGeneration);
      }
      /* localStorage 只是小字段投影：仅在缺失/损坏且投影明确属于当前 owner 时
         用已提交 IDB 数据重建，绝不覆盖仍可解析的本地版本。题库等未进入投影的
         内容保持默认空值，避免猜测归属或把半份数据当完整恢复。 */
      if(businessMeta && businessMeta.owner && global.AccountStorage &&
         businessMeta.owner===global.AccountStorage.owner && businessMeta.data){
        var rawSmall=null, validSmall=false;
        try{
          rawSmall=businessStorage.getItem(STORE_KEY);
          var parsedSmall=rawSmall ? JSON.parse(rawSmall) : null;
          validSmall=!!(parsedSmall && typeof parsedSmall==='object' && Array.isArray(parsedSmall.decks) &&
            parsedSmall.stats && typeof parsedSmall.stats==='object');
        }catch(error){ validSmall=false; }
        if(!validSmall){
          try{
            var recovered=defaultMem(), projected=businessMeta.data;
            Object.keys(projected).forEach(function(key){ if(key!=='stats') recovered[key]=projected[key]; });
            recovered.stats=Object.assign({},recovered.stats,projected.stats||{},
              {bySentence:data.sentenceStats||{},events:data.events||{}});
            businessStorage.setItem(STORE_KEY,JSON.stringify(recovered));
            adoptMemBase(businessStorage.getItem(STORE_KEY));
          }catch(error2){ emit('persistError',{area:'businessProjectionRecovery',error:error2}); }
        }
      }
      /*
       * 迁移期间可能同时存在两份数据：
       * - IDB 是之前已经迁移成功的课程子集；
       * - localStorage 里还保留着迁移前的完整列表，或包含刚导入的一课。
       *
       * 旧逻辑只要发现 IDB 有任意课程就直接覆盖 localStorage，
       * 结果会把另一课从课程树中“吃掉”。启动时按 courseId 做并集，
       * 同 ID 以 IDB 版本为准，新增课程则完整保留，并回写统一结果。
       */
      var localCourses = readCoursesRaw();
      var idbCourses = Array.isArray(data.courses) ? data.courses : [];
      var courseMap = {};
      localCourses.concat(idbCourses).forEach(function(c){
        if(!c || !c.courseId) return;
        courseMap[c.courseId] = c;
      });
      _coursesCache = Object.keys(courseMap).map(function(id){ return courseMap[id]; });

      var localProgress = readProgressRaw();
      var idbProgress = (data.courseProgress && typeof data.courseProgress === 'object') ? data.courseProgress : {};
      /* 同一课程以 IDB 版本为准，localStorage 仅补齐尚未迁移的课程进度。 */
      _progressCache = Object.assign({}, localProgress, idbProgress);
      // 事务完成之前保留旧键；任一写入失败，冷启动仍可重新迁移。
      if(global.IDBStore.updateCourses && global.IDBStore.updateProgress){
        _coursesCache = await global.IDBStore.updateCourses(function(current){
          var merged = {};
          localCourses.concat(current).forEach(function(c){ if(c && c.courseId) merged[c.courseId]=c; });
          return Object.keys(merged).map(function(id){return merged[id];});
        });
        _progressCache = await global.IDBStore.updateProgress(function(current){
          return Object.assign({}, localProgress, current);
        });
      }else{
        await global.IDBStore.putCourses(_coursesCache);
        await global.IDBStore.putProgress(_progressCache);
      }
      /* 迁移完成后删除 localStorage 大键（仅当 IDB 可用且迁移成功） */
      try{ businessStorage.removeItem(COURSES_KEY); businessStorage.removeItem(PROGRESS_KEY); }catch(e){}
      /* 三路合并基线：此刻内存桥内容 == IDB 内容，即本页课程/进度视图的起点 */
      _coursesDiskBase = _coursesCache;
      _progressDiskBase = _progressCache;

      /* --- ★ stats 大对象：IDB 与 localStorage 旧值按 key 并集（同 IDB 优先），
             整体写回 IDB 成功后才剥离 localStorage 副本（避免「先删后写失败」造成丢数据）。 --- */
      var legacy = readLegacyStatsRaw();
      var idbBS = (data.sentenceStats && typeof data.sentenceStats === 'object') ? data.sentenceStats : {};
      var bsMap = {};
      Object.keys(legacy.bySentence).forEach(function(k){ bsMap[k] = legacy.bySentence[k]; });
      Object.keys(idbBS).forEach(function(k){ bsMap[k] = idbBS[k]; });   /* IDB 优先 */
      _bySentenceCache = bsMap;
      var evMap = {};
      (Array.isArray(data.events) ? data.events : []).forEach(function(e){ if(e && e.id) evMap[e.id] = e; });
      legacy.events.forEach(function(e){ if(e && e.id && !evMap[e.id]) evMap[e.id] = e; });
      _eventsCache = Object.keys(evMap).map(function(id){ return evMap[id]; });

      var hasBig = Object.keys(_bySentenceCache).length || _eventsCache.length;
      var needPersist = hasBig && (_statsStore !== 'idb' ||
        Object.keys(_bySentenceCache).length !== Object.keys(idbBS).length ||
        _eventsCache.length !== (Array.isArray(data.events) ? data.events.length : 0));
      if(!hasBig){
        /* 无任何存量（全新用户）：直接托管，后续走增量写 */
        _statsStore = 'idb';
        return { migrated: false };
      }
      if(!needPersist){
        _statsStore = 'idb';
        return { migrated: true };
      }
      return global.IDBStore.replaceSentenceStats(_bySentenceCache).then(function(){
        return global.IDBStore.replaceEvents(_eventsCache);
      }).then(function(){
        _statsStore = 'idb';
        _statsFullRewrite = false;
        /* 建立签名基线，避免下一次 saveMem 把全部行判为「脏」再白写一遍 */
        _bsSig = {};
        Object.keys(_bySentenceCache).forEach(function(k){ _bsSig[k] = statSig(_bySentenceCache[k]); });
        _evSnap = evSnapOf(_eventsCache);
        return { migrated: true };
      });
    }).then(function(res){
      /* 落盘确认后，才把大对象从 localStorage 副本里剥离（解除 5MB 配额） */
      if(res && res.migrated && _statsStore === 'idb') stripBigStatsFromLocal();
      return true;
    }).catch(function(e){
      console.warn('[idb preload] 失败，大对象继续由 localStorage 托管：', e && e.message);
      emit('persistError', { area: 'migration', error: e });
      _statsStore = 'local';
      /* 失败前若已污染内存桥，清空以便 loadMem 回退读 localStorage 真值 */
      if(_bySentenceCache && !Object.keys(_bySentenceCache).length) _bySentenceCache = null;
      return false;
    });
  }

  /* 把 bySentence / events 从 localStorage 的 mem 副本里删掉（IDB 已是权威副本）。
     只改这两个字段，其余原样保留；同时归档旧值为迁移保险（键名带 _migrated 后缀）。 */
  function stripBigStatsFromLocal(){
    try{
      var raw = businessStorage.getItem(STORE_KEY);
      if(!raw) return;
      var o = JSON.parse(raw);
      if(!o || !o.stats || typeof o.stats !== 'object') return;
      if(!('bySentence' in o.stats) && !('events' in o.stats)) return;
      delete o.stats.bySentence;
      delete o.stats.events;
      var str = JSON.stringify(o);
      businessStorage.setItem(STORE_KEY, str);
      adoptMemBase(str);   /* 直接改写 chunklab.v1：同步推进基线，避免下次写入误判为外部改动 */
      notifyTabs('mem');
    }catch(e){ console.warn('[idb] 剥离 localStorage 大对象失败：', e && e.message); }
  }

  /* 按存储串行提交，Promise resolve 才代表落盘成功。
     失败不发布新内存值、不触发上行；旧值仍可读取，调用者负责呈现错误。

     ★ 多标签页旧快照防护（P0）：courses / progress 的大对象在 IDB，不能靠 chunklab.v1 原文
       判变，故用「跨标签页写信号 _coursesExternal/_progressExternal + 读当前 IDB 实况比对基线」
       来触发三路合并。只有确实收到过其他标签页的课程写入时才多读一次 IDB（快路径零额外开销）。
       写前合并、写后推进基线；对方课程 / 进度条目一律不被本页整份覆盖丢掉。 */
  var _courseWriteTail = Promise.resolve(), _progressWriteTail = Promise.resolve();
  function cloneJSON(value){ return JSON.parse(JSON.stringify(value)); }
  function _keyedCourses(list){ return _toMap(list, function(c){ return c && c.courseId; }); }
  function _mergeCoursesList(baseList, oursList, theirsList){
    return _listFromKeyed(oursList, mergeKeyedMap(_keyedCourses(baseList), _keyedCourses(oursList), _keyedCourses(theirsList)),
      function(c){ return c && c.courseId; });
  }
  function courseIntentScope(){
    /* AccountStorage 已经完成服务地址规范化和 uid 解析；复用它可避免
       旧页面只写兼容 token 镜像时出现“origin”和空 base 两个作用域。 */
    if(global.AccountStorage && global.AccountStorage.owner) return global.AccountStorage.owner;
    var api=global.ChunkAPI, account='local';
    var base=api && api.getBase ? api.getBase() : '';
    var token=api && api.getToken ? api.getToken() : null;
    if(token){
      var claims=JSON.parse(global.atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      if(claims.uid == null) throw new Error('登录状态无法识别，请重新登录后保存');
      account=String(claims.uid);
    }
    return JSON.stringify([base.replace(/\/+$/,''),account]);
  }
  function persistCourseValue(kind, value, sync, allowOperations){
    var snapshot = cloneJSON(value);
    var intentScope = sync ? courseIntentScope() : null;
    /* Reserve a monotonic local generation before entering the per-entity
       write tail. The IDB transaction stores the maximum, so concurrent
       courses/progress writes cannot move the durable generation backwards. */
    var commitGeneration = sync && _cloudOn && global.ChunkAPI ? ++_syncGeneration : null;
    var syncState = Number.isSafeInteger(commitGeneration) ? {
      key:'conditional-batch-v1', owner:intentScope, schemaVersion:1,
      localGeneration:commitGeneration
    } : null;
    var tail = kind === 'courses' ? _courseWriteTail : _progressWriteTail;
    var task = tail.then(async function(){
      if(_preloadTask) await _preloadTask;
      if(sync && courseIntentScope() !== intentScope) throw new Error('账号已切换，本次课程改动未保存，请在原账号下重试');
      var isCourses = kind === 'courses';
      if(global.IDBStore){
        if(_coursesCache === null || _progressCache === null) throw new Error('无法读取已有课程，已停止保存以防覆盖，请刷新后重试');
        var update = global.IDBStore[isCourses ? 'updateCourses' : 'updateProgress'];
        var merged = false;
        if(update){
          var diskBase = isCourses ? _coursesDiskBase : _progressDiskBase;
          snapshot = await update(function(current){
            if(diskBase !== null && !_eqJson(current, diskBase)){
              merged = true;
              return isCourses ? _mergeCoursesList(diskBase, snapshot, current)
                : mergeKeyedMap(diskBase || {}, snapshot || {}, current || {});
            }
            return snapshot;
          }, intentScope, sync ? null : {scope:courseIntentScope(),allowOperations:allowOperations || []}, syncState);
          if(merged) emit('courseMerged', { kind: kind });
        }else{
        var needMerge = isCourses ? _coursesExternal : _progressExternal;
        if(needMerge){
          var base = isCourses ? _coursesDiskBase : _progressDiskBase;
          var cur = isCourses ? await global.IDBStore.getCourses() : await global.IDBStore.getProgress();
          if(base !== null && !_eqJson(cur, base)){
            snapshot = isCourses
              ? _mergeCoursesList(base, snapshot, cur)
              : mergeKeyedMap(base || {}, (snapshot && typeof snapshot === 'object') ? snapshot : {}, cur || {});
            emit('courseMerged', { kind: kind });
          }
        }
        await global.IDBStore[isCourses ? 'putCourses' : 'putProgress'](snapshot);
        }
        businessStorage.removeItem(isCourses ? COURSES_KEY : PROGRESS_KEY);
        /* ★ P0：IDB 分支同样要广播写入信号，否则其他标签页永不置 _coursesExternal/_progressExternal
           → needMerge 恒为 false → 三路合并成死代码，后写者整份覆盖前者丢数据。与 local 分支保持一致。 */
        notifyTabs(kind);
      }else{
        var key = isCourses ? COURSES_KEY : PROGRESS_KEY;
        var baseLs = isCourses ? _coursesDiskBase : _progressDiskBase;
        var curLs = null;
        try{ curLs = JSON.parse(businessStorage.getItem(key) || (isCourses ? '[]' : '{}')); }
        catch(e2){ curLs = isCourses ? [] : {}; }
        if(baseLs !== null && !_eqJson(curLs, baseLs)){
          snapshot = isCourses
            ? _mergeCoursesList(baseLs, snapshot, curLs)
            : mergeKeyedMap(baseLs || {}, (snapshot && typeof snapshot === 'object') ? snapshot : {}, curLs || {});
          emit('courseMerged', { kind: kind });
        }
        businessStorage.setItem(key, JSON.stringify(snapshot));
        notifyTabs(kind);
      }
      if(isCourses){ _coursesCache = snapshot; _coursesDiskBase = snapshot; _coursesExternal = false; }
      else { _progressCache = snapshot; _progressDiskBase = snapshot; _progressExternal = false; }
      if(sync) scheduleCloudSync(loadMem(),commitGeneration);
      return true;
    });
    var settled = task.catch(function(e){ emit('persistError', { area: kind, error: e }); });
    if(kind === 'courses') _courseWriteTail = settled; else _progressWriteTail = settled;
    return task;
  }
  function writeCourses(list){ return persistCourseValue('courses', Array.isArray(list) ? list : [], true); }
  function writeProgress(obj){ return persistCourseValue('progress', (obj && typeof obj === 'object') ? obj : {}, true); }

  /* ---------- 句子档案 / 事件日志的持久化分层（2026-09-10 扩容 8000 句） ----------
     根因：stats.bySentence 与 stats.events 是「随练习量无限增长」的数据，而 localStorage
     没有增量写语义 —— 每答一题都要把整份 mem 重新 JSON.stringify 并整键覆写。
     8000 句实测：saveMem 188ms/次（每题肉眼可感卡顿），落盘 7.39MB 已超常见 5MB 配额
     → setItem 抛 QuotaExceeded，而旧 saveMem 只 console.error 后 return false，用户数据静默丢失。

     方案：沿用 courses 已验证的「内存桥 + IndexedDB 主存储」模式。
       - 内存里 mem 结构完全不变（所有调用方零改动，mergeStats 语义不变）；
       - 持久化分层：小字段（decks/best/mastered/settings/daysLog/totalRounded…）进 localStorage，
         bySentence / events 按「变更行」增量写 IDB。
       - 变更检测用廉价数字签名（statSig）：8000 条 ~2ms，远低于全量 stringify 的 ~180ms。
         之所以不靠调用方「手动标脏」，是因为 bySentence 在多处被直接改写，漏一处就是静默丢数据；
         签名比对是自愈的，没有「忘记标记」这个失败模式。
     _statsStore 语义：'idb' = 大对象已托管（localStorage 不再留副本）；'local' = 保留旧行为。 */
  /* 句子档案的廉价签名：建档后只有计数字段会变（sentence/translation/deckName 是常量），
     故只需混算数字字段即可判定「这一行是否需要重写」。
     浮点（ease）放大 1000 倍后取整；时间戳（lastAt/dueAt）经 int32 回绕 ——
     需恰好相差 2^32 才碰撞，实用上不可能。 */
  function _mix(h, n){ return Math.imul(h ^ (n | 0), 0x01000193) >>> 0; }
  function statSig(v){
    if(!v) return 0;
    var h = 0x811c9dc5;
    h = _mix(h, v.times || 0);
    h = _mix(h, v.okTimes || 0);
    h = _mix(h, v.wrongTimes || 0);
    h = _mix(h, v.streak || 0);
    h = _mix(h, v.maxStreak || 0);
    h = _mix(h, v.interval || 0);
    h = _mix(h, v.repetition || 0);
    h = _mix(h, (v.ease || 0) * 1000);
    h = _mix(h, v.dueAt || 0);
    h = _mix(h, v.lastAt || 0);
    return h >>> 0;
  }

  /* 事件数组的落盘标记：首/尾 id + 长度三锚点。
     之所以要三个锚点：只比长度和尾 id 时，「整体替换成另一个首尾恰好相同的数组」会误判为
     可增量追加 → IDB 内容静默错位。三锚点让纯追加（首不变、尾=上一个尾、长度增长）
     与任何替换都能区分开；而唯一会整体替换 events 的地方（syncFromCloud 的合并）已显式
     置 _evSnap = null 强制全量覆盖，不依赖锚点猜测。 */
  function evSnapOf(ev){
    ev = Array.isArray(ev) ? ev : [];
    return {
      count: ev.length,
      firstId: ev.length ? (ev[0] && ev[0].id) : null,
      lastId: ev.length ? (ev[ev.length-1] && ev[ev.length-1].id) : null
    };
  }

  /* 把 stats 大对象异步落到 IDB：只写变更行。返回 Promise（无 IDB 时 resolve(false)）。
     这里故意不在排队入口 clone 整份 stats：8000 句时 bySentence/events 可能已经是
     数 MB，而 persistStatsSnapshot 本身只会把真正变更的行交给 IDB。IDB 的 put()
     会在事务建立时完成结构化克隆；全量 clone 既没有增加提交安全性，反而让每次答题
     都承担 O(全部句子 + 全部事件) 的内存和 CPU 成本。全量替换仅在迁移/云合并时由
     _statsFullRewrite 明确触发，属于低频安全路径。 */
  var _statsWriteTail=Promise.resolve();
  var _statsActive=null, _statsPending=null;
  function trackStatsWrite(promise){
    /* waitForSync 只需要一个不拒绝的“所有当前写入都结束”尾标记；
       单次保存的成功/失败仍由调用方拿到的原始 Promise 决定。 */
    _statsWriteTail=Promise.all([_statsWriteTail,promise]).then(function(){return true;},function(){return false;});
  }
  function sameStatsLane(a,b){
    return a.scope===b.scope && a.recordLearning===b.recordLearning;
  }
  function finishStatsEntry(entry,ok,error){
    if(error) entry.reject(error); else entry.resolve(ok);
    if(_statsActive===entry) _statsActive=null;
    if(!_statsActive && _statsPending){
      var next=_statsPending; _statsPending=null; startStatsEntry(next);
    }
  }
  function startStatsEntry(entry){
    _statsActive=entry;
    Promise.resolve().then(function(){
      if(courseIntentScope()!==entry.scope){
        emit('persistError',{area:'stats',error:new Error('账号已切换，学习记录未写入新账号')});
        return false;
      }
      return persistStatsSnapshot(entry.stats,entry.recordLearning ? entry.scope : null,
        entry.commitGeneration,entry.businessMem);
    }).then(function(ok){finishStatsEntry(entry,ok);},function(error){finishStatsEntry(entry,null,error);});
  }
  function persistStats(stats,recordLearning,commitGeneration,businessMem){
    /* 慢 IDB 下只保留一个正在提交的快照和一个最新尾快照。
       练习热路径通常复用同一个 mem.stats 引用，后续答题会合并进尾提交；
       若调用方传入不同对象且已有尾提交，则拒绝本次排队，保留 localStorage
       中的安全副本，避免用无限 Promise 链换取“看似成功”。 */
    var entry={stats:stats || {},scope:courseIntentScope(),recordLearning:recordLearning!==false,
      commitGeneration:commitGeneration,businessMem:businessMem,resolve:null,reject:null};
    entry.promise=new Promise(function(resolve,reject){entry.resolve=resolve;entry.reject=reject;});
    trackStatsWrite(entry.promise);
    if(!_statsActive){ startStatsEntry(entry); return entry.promise; }
    if(_statsPending && sameStatsLane(_statsPending,entry) && _statsPending.stats===entry.stats){
      _statsPending.commitGeneration = Number.isSafeInteger(entry.commitGeneration)
        ? Math.max(Number.isSafeInteger(_statsPending.commitGeneration) ? _statsPending.commitGeneration : 0,entry.commitGeneration)
        : _statsPending.commitGeneration;
      _statsPending.businessMem=entry.businessMem || _statsPending.businessMem;
      return _statsPending.promise;
    }
    if(!_statsPending){ _statsPending=entry; return entry.promise; }
    var error=new Error('统计写入队列已满，请稍后重试'); error.code='STATS_QUEUE_FULL';
    entry.reject(error);
    emit('persistError',{area:'stats',error:error});
    return entry.promise;
  }
  function persistStatsSnapshot(stats,scope,commitGeneration,businessMem){
    if(_statsStore !== 'idb' || !global.IDBStore) return Promise.resolve(false);
    stats = stats || {};
    var by = stats.bySentence || {};
    var ev = Array.isArray(stats.events) ? stats.events : [];
    var dirty = [], gone = [], k;
    var businessMeta = businessMem ? (function(){
      var light = {}, source = businessMem.stats || {};
      Object.keys(source).forEach(function(key){ if(key !== 'bySentence' && key !== 'events') light[key] = source[key]; });
      return {
        owner: global.AccountStorage ? global.AccountStorage.owner : null,
        localGeneration: Number.isSafeInteger(commitGeneration) && commitGeneration >= 0 ? commitGeneration : 0,
        data: { best: businessMem.best || {}, settings: businessMem.settings || {}, stats: light }
      };
    })() : null;
    if(_statsFullRewrite){
      for(k in by) _bsSig[k] = statSig(by[k]);
      var syncState=commitGeneration===null || commitGeneration===undefined ? null : {
        key:'conditional-batch-v1', owner:courseIntentScope(), schemaVersion:1,
        localGeneration:commitGeneration
      };
      var fullWrite=global.IDBStore.writeStatsBatch
        ? global.IDBStore.writeStatsBatch({stats:by,events:ev,replaceStats:true,replaceEvents:true,businessMem:businessMeta},scope,syncState)
        : global.IDBStore.replaceSentenceStats(by).then(function(){
        return global.IDBStore.replaceEvents(ev);
      });
      return fullWrite.then(function(){
        _statsFullRewrite = false;
        _evSnap = evSnapOf(ev);
        return true;
      }).catch(function(e){
        console.warn('[stats→idb] 全量落盘失败，退回 localStorage 托管：', e && e.message);
        _statsStore = 'local'; _statsFullRewrite = false;
        return false;
      });
    }
    for(k in by){
      var s = statSig(by[k]);
      if(_bsSig[k] !== s){ _bsSig[k] = s; dirty.push(k); }
    }
    for(k in _bsSig){ if(!(k in by)) gone.push(k); }
    gone.forEach(function(g){ delete _bsSig[g]; });
    /* 事件：三锚点全对得上 → 只追加新增的；否则（被合并/重排/截断）整体替换 */
    var canAppend = false, evRows = [];
    if(_evSnap && ev.length >= _evSnap.count){
      if(_evSnap.count === 0) canAppend = true;
      else canAppend = (ev[0] && ev[0].id) === _evSnap.firstId &&
                       (ev[_evSnap.count-1] && ev[_evSnap.count-1].id) === _evSnap.lastId;
    }
    if(canAppend) evRows = ev.slice(_evSnap.count);
    var evFull = !canAppend;
    if(global.IDBStore.writeStatsBatch){
      var changed={}; dirty.forEach(function(id){changed[id]=by[id];});
      var syncState=commitGeneration===null || commitGeneration===undefined ? null : {
        key:'conditional-batch-v1', owner:courseIntentScope(), schemaVersion:1,
        localGeneration:commitGeneration
      };
      return global.IDBStore.writeStatsBatch({stats:changed,gone:gone,events:evFull ? ev : evRows,replaceEvents:evFull,businessMem:businessMeta},scope,syncState).then(function(){
        _evSnap=evSnapOf(ev); return true;
      }).catch(function(error){
        console.warn('[stats→idb] 事务保存失败:',error.message);
        _statsStore='local'; _bsSig={}; return false;
      });
    }
    var tasks = [];
    if(dirty.length){
      var patch = {};
      dirty.forEach(function(d){ patch[d] = by[d]; });
      tasks.push(global.IDBStore.putSentenceStats(patch));
    }
    if(gone.length) tasks.push(global.IDBStore.deleteSentenceStats(gone));
    if(evFull) tasks.push(global.IDBStore.replaceEvents(ev));
    else if(evRows.length) tasks.push(global.IDBStore.appendEvents(evRows));
    return Promise.all(tasks).then(function(){
      _evSnap = evSnapOf(ev);
      return true;
    }).catch(function(e){
      /* 落盘失败 → 降级回 localStorage 托管（宁可占配额也不静默丢数据），并显式告警 */
      console.warn('[stats→idb] 增量落盘失败，退回 localStorage 托管：', e && e.message);
      _statsStore = 'local';
      _bsSig = {};
      return false;
    });
  }

  /* 从 localStorage 的 mem 里读出大对象（迁移用；_statsStore='idb' 后这里恒为空） */
  function readLegacyStatsRaw(){
    try{
      var o = JSON.parse(businessStorage.getItem(STORE_KEY) || '{}');
      var s = (o && o.stats && typeof o.stats === 'object') ? o.stats : {};
      return {
        bySentence: (s.bySentence && typeof s.bySentence === 'object') ? s.bySentence : {},
        events: Array.isArray(s.events) ? s.events : []
      };
    }catch(e){ return { bySentence: {}, events: [] }; }
  }

  var _cloudTimer = null;
  var _cloudOn = false; /* 云端是否启用：服务器可达（开放模式）或已登录（鉴权模式）时为 true */
  var _cloudConfig = null; /* 最近一次 /api/config 结果（含 aiEnabled），供页面做 AI 数据面收敛 */
  var _dirty = false;   /* 待同步标志（离线 change-log 轻量版）：有本地变更未上云时为 true */
  var _syncGeneration = 0;
  var _syncConflict = null;
  var _rejectedDeletes = {};
  try{
    var storedConflict = JSON.parse(businessStorage.getItem(CONFLICT_KEY) || 'null');
    if(storedConflict && Array.isArray(storedConflict.conflicts)){
      _syncConflict = storedConflict.conflicts; _dirty = true;
      _rejectedDeletes = storedConflict.deleted || {};
      (_rejectedDeletes.decks || []).forEach(function(d){ markGone(_pendingDecks, d.id, d.rev); });
      (_rejectedDeletes.courses || []).forEach(function(d){ markGone(_pendingCourses, d.id, d.rev); });
      (_rejectedDeletes.courseProgress || []).forEach(function(d){ markGone(_pendingProgress, d.id, d.rev); });
    }
  }catch(e){}
  function rememberSyncConflict(conflicts, deleted){
    _syncConflict = conflicts;
    _rejectedDeletes = deleted || {};
    try{
      if(conflicts) businessStorage.setItem(CONFLICT_KEY, JSON.stringify({ conflicts: conflicts, deleted: _rejectedDeletes }));
      else businessStorage.removeItem(CONFLICT_KEY);
    }catch(e){ emit('persistError', { area: 'syncConflict', error: e }); }
  }

  /* 有变更待同步时通知 UI（main.html 顶栏"未同步"徽标） */
  function notifySync(){ emit('syncStatus', { dirty: _dirty, conflict: _syncConflict }); }

  /* ---------- 云端增量水位（2026-09-10，8000 句扩容） ----------
     bySentence / events 已从「stats 整块」拆到服务端行表，客户端改为只上行变更行。
     为什么要独立一套水位、不复用 _bsSig / _evSnap：那是 **IndexedDB 已落盘**的水位。
     IDB 写成功 ≠ 云端收到了（可能未登录、离线、PUT 失败）—— 把两者混用，
     会出现「IDB 已推进、云端没收到」→ 该批变更永不再发（静默丢数据）。
     null 语义 = 水位未知 → 下一次全量上行（安全兜底方向）。 */
  var _cloudBsSig = null;   /* {key: statSig}，已确认被云端接收的句子档案 */
  var _cloudEvIds = null;   /* {eventId: 1}，已确认被云端接收的事件 id */
  /* 行级实体（mastered / reinforceBook / deletedItems）的云端水位，语义与上面两个完全一致：
     {key: 行签名}，null = 水位未知 → 下次全量上行。 */
  var _cloudMasteredSig = null;
  var _cloudReinforceSig = null;
  var _cloudDeletedSig = null;

  /* 32 位 FNV-1a；行级实体用它做「键 + 值」的廉价指纹。
     ★ 绝不能退回 JSON.stringify：maintainRevs/buildEntityDelta 在每次 saveMem 都要比对，
       mastered 8000 条时那是 227KB 的序列化（与 sigStats 修掉的是同一个坑）。 */
  function strHash(s){
    var h = 0x811c9dc5;
    s = String(s == null ? '' : s);
    for(var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
    return h;
  }
  /* 行签名：只要「可能变的那部分」变了，签名就变。
     mastered 的值只在（重新）标熟时写入 → markedAt 是唯一变量，配上 deckId 足够；
     错题本条目一经加入就不再改写（saveReinforceList 只在 !exists 时 push）→ addedAt + 原文指纹。 */
  function sigMasteredRow(v){
    return (v && v.markedAt ? v.markedAt : 0) + ':' + strHash(v && v.deckId || '');
  }
  function sigReinforceRow(it){
    return (it && it.addedAt || '') + ':' + strHash(it && it.sentence || '');
  }
  /* deletedItems 是集合（值恒为 true）→ 签名与值无关，水位实际退化为「云端已有的键集合」 */
  function sigDeletedRow(){ return '1'; }

  /* 通用行级增量：与 buildStatsDelta 同构（签名水位 + gone 集合）。
     返回 { up, gone, next }；next = 本次**成功后**应推进到的水位。
     ★ 失败时绝不推进水位，否则这批变更永远不会重发。 */
  function rowDelta(map, mark, rowSig){
    var up = {}, gone = [], k;
    if(mark === null){
      for(k in map){ if(map.hasOwnProperty(k)) up[k] = map[k]; }
    } else {
      for(k in map){ if(map.hasOwnProperty(k) && mark[k] !== rowSig(map[k])) up[k] = map[k]; }
      for(k in mark){ if(mark.hasOwnProperty(k) && !(k in map)) gone.push(k); }
    }
    var next = {};
    if(mark){ for(k in mark){ if(mark.hasOwnProperty(k)) next[k] = mark[k]; } }
    for(k in up){ if(up.hasOwnProperty(k)) next[k] = rowSig(map[k]); }
    gone.forEach(function(g){ delete next[g]; });
    return { up: up, gone: gone, next: next };
  }
  function deltaHasRows(d){ return Object.keys(d.up).length > 0 || d.gone.length > 0; }

  /* 上行增量：mastered / reinforceBook / deletedItems。错题本是数组，先按 _key 归一成映射，
     与服务端的行主键（user_entity_rows.item_key）对齐。 */
  function buildEntityDelta(memObj){
    var mastered = (memObj && memObj.mastered && typeof memObj.mastered === 'object') ? memObj.mastered : {};
    var deleted = (memObj && memObj.deletedItems && typeof memObj.deletedItems === 'object') ? memObj.deletedItems : {};
    var book = Array.isArray(memObj && memObj.reinforceBook) ? memObj.reinforceBook : [];
    var rMap = {};
    for(var i = 0; i < book.length; i++){ if(book[i] && book[i]._key) rMap[book[i]._key] = book[i]; }
    return {
      mastered: rowDelta(mastered, _cloudMasteredSig, sigMasteredRow),
      reinforceBook: rowDelta(rMap, _cloudReinforceSig, sigReinforceRow),
      deletedItems: rowDelta(deleted, _cloudDeletedSig, sigDeletedRow)
    };
  }
  /* 把水位对齐到「云端实际内容」（远端已有的不再回传，本地独有的下次上行）。
     syncFromCloud 用：不回传 ≠ 不需要，若不用远端实况对齐，每次启动都会全量重推这三块。 */
  function alignEntityMarks(remoteMem){
    var rMastered = (remoteMem && remoteMem.mastered && typeof remoteMem.mastered === 'object') ? remoteMem.mastered : {};
    var rDeleted = (remoteMem && remoteMem.deletedItems && typeof remoteMem.deletedItems === 'object') ? remoteMem.deletedItems : {};
    var rBook = (remoteMem && Array.isArray(remoteMem.reinforceBook)) ? remoteMem.reinforceBook : [];
    var wM = {}, wD = {}, wR = {};
    Object.keys(rMastered).forEach(function(k){ wM[k] = sigMasteredRow(rMastered[k]); });
    Object.keys(rDeleted).forEach(function(k){ wD[k] = sigDeletedRow(rDeleted[k]); });
    rBook.forEach(function(it){ if(it && it._key) wR[it._key] = sigReinforceRow(it); });
    /* 墓碑不进水位：它们只用于「把本机残留的条目删掉」，服务端已经记着了，
       再当成待推变更会让每次上行都白跑一批已删除的键。 */
    _cloudMasteredSig = wM;
    _cloudReinforceSig = wR;
    _cloudDeletedSig = wD;
  }

  /* 把「走增量通道」的大对象从上行 payload 里剥离：
       stats.bySentence / stats.events            → statsDelta
       mastered / reinforceBook / deletedItems    → entityDelta
     必须浅拷贝：memObj 是与调用方共享的活对象，直接 delete 会破坏内存里的 mem。
     ⚠️ 不能因为「某个字段不存在」就提前 return 原对象 —— 那样其余大对象会被原样带上去
        （原实现只判 stats，正是 mastered / 错题本每答一题全量重传的原因）。 */
  function memForCloud(memObj){
    if(!memObj) return memObj;
    var out = {}, k;
    for(k in memObj){ if(memObj.hasOwnProperty(k)) out[k] = memObj[k]; }
    var st = memObj.stats;
    if(st && typeof st === 'object' && (st.bySentence || st.events)){
      var light = {};
      for(k in st){ if(st.hasOwnProperty(k) && k !== 'bySentence' && k !== 'events') light[k] = st[k]; }
      out.stats = light;
    }
    ROW_ENTITY_KEYS.forEach(function(rk){ delete out[rk]; });
    return out;
  }

  /* 生成上行增量：只带「云端还没确认收到的部分」。
     返回 { sbs, sbsGone, evs, mark }；mark = 本次**成功后**应推进到的水位。
     ★ 失败时绝不推进水位，否则这批变更永远不会重发。 */
  function buildStatsDelta(memObj){
    var stats = (memObj && memObj.stats) || {};
    var by = (stats.bySentence && typeof stats.bySentence === 'object') ? stats.bySentence : {};
    var ev = Array.isArray(stats.events) ? stats.events : [];
    var sbs = {}, sbsGone = [], k, i;

    if(_cloudBsSig === null){
      for(k in by){ if(by.hasOwnProperty(k)) sbs[k] = by[k]; }
    } else {
      for(k in by){ if(by.hasOwnProperty(k) && _cloudBsSig[k] !== statSig(by[k])) sbs[k] = by[k]; }
      for(k in _cloudBsSig){ if(_cloudBsSig.hasOwnProperty(k) && !(k in by)) sbsGone.push(k); }
    }

    var evs = [];
    if(_cloudEvIds === null){
      evs = ev;
    } else {
      for(i = 0; i < ev.length; i++){ if(ev[i] && ev[i].id && !_cloudEvIds[ev[i].id]) evs.push(ev[i]); }
    }

    /* 新水位 = 云端的「已有 ∪ 本次发送」；本地删除的 key 要去掉（sbsGone 已通知服务端）。 */
    var nextBs = {};
    if(_cloudBsSig){ for(k in _cloudBsSig){ if(_cloudBsSig.hasOwnProperty(k)) nextBs[k] = _cloudBsSig[k]; } }
    for(k in by){ if(by.hasOwnProperty(k)) nextBs[k] = statSig(by[k]); }
    sbsGone.forEach(function(g){ delete nextBs[g]; });
    var nextEvIds = {};
    if(_cloudEvIds){ for(k in _cloudEvIds){ if(_cloudEvIds.hasOwnProperty(k)) nextEvIds[k] = 1; } }
    for(i = 0; i < ev.length; i++){ if(ev[i] && ev[i].id) nextEvIds[ev[i].id] = 1; }

    return { sbs: sbs, sbsGone: sbsGone, evs: evs, mark: { bsSig: nextBs, evIds: nextEvIds } };
  }

  function scheduleCloudSync(memObj,committedGeneration){
    if(!_cloudOn || !global.ChunkAPI) return;
    var generationWasCommitted=Number.isSafeInteger(committedGeneration) && committedGeneration>=0;
    if(generationWasCommitted) _syncGeneration=Math.max(_syncGeneration,committedGeneration);
    else _syncGeneration++;
    if(!generationWasCommitted && global.BatchSync && global.BatchSync.noteLocalGeneration){
      global.BatchSync.noteLocalGeneration(_syncGeneration).catch(function(error){
        _dirty=true; notifySync(); console.warn('[cloud sync] 保存本地同步代次失败:',error.message);
      });
    }
    _dirty = true;
    notifySync();
    if(_cloudTimer) clearTimeout(_cloudTimer);
    _cloudTimer = setTimeout(function(){ cloudSyncNow(memObj); }, 400);
  }
  var _cloudInFlight = null;
  var _courseDrain = null;
  var _protectedCourses = Object.create(null), _protectedProgress = Object.create(null);
  function canReplayCourses(){
    /* The account-wide conditional writer owns the request/receipt boundary.
       Keeping the older per-course HTTP drain active would create a second
       sender that can advance revisions outside that boundary. Its durable
       intents remain in the normal batch until the batch is acknowledged. */
    if(global.BatchSync) return false;
    return global.IDBStore && global.IDBStore.freezeSyncIntent && global.ChunkAPI && global.ChunkAPI.getSyncEntity;
  }
  function sameSyncValue(a,b){
    function stable(value){
      if(Array.isArray(value)) return value.map(stable);
      if(value && typeof value==='object'){
        var obj=Object.create(null); Object.keys(value).sort().forEach(function(k){obj[k]=stable(value[k]);}); return obj;
      }
      return value;
    }
    return JSON.stringify(stable(a))===JSON.stringify(stable(b));
  }
  function replayCourseIntents(){
    if(!canReplayCourses()) return Promise.resolve(true);
    if(_courseDrain) return _courseDrain;
    _courseDrain=drainCourseIntents().finally(function(){_courseDrain=null;});
    return _courseDrain;
  }
  async function drainCourseIntents(){
    var scope=courseIntentScope(), store=global.IDBStore, api=global.ChunkAPI;
    function checkScope(){if(courseIntentScope()!==scope) throw new Error('账号已切换，停止恢复同步');}
    try{
      await Promise.all([_courseWriteTail,_progressWriteTail]);
      for(var round=0;round<64;round++){
        checkScope();
        if(_resolutionPaused) return false;
        var records=await store.readSyncIntents(scope);
        checkScope();
        if(!records.length) return true;
        var record=records[0], group=record.entity;
        (group==='courses' ? _protectedCourses : _protectedProgress)[record.id]=true;
        var frozen=record.frozen;
        if(!frozen){
          var remote=await api.getSyncEntity(group,record.id);
          checkScope();
          if(!remote || typeof remote.exists!=='boolean' || !Number.isSafeInteger(remote.rev) || remote.rev<0 || typeof remote.deleted!=='boolean') throw new Error('服务端需升级后才能安全恢复课程同步');
          var remoteValue=remote.deleted ? null : remote.value;
          if(record.deleted===remote.deleted && sameSyncValue(record.value,remoteValue)){
            // Already delivered (including a previously lost response): no write needed.
            await store.acknowledgeSyncIntents(scope,[{key:record.key,operationId:record.operationId}]);
            rememberCourseRevision(group,record.id,remote.rev);
            continue;
          }
          if(!sameSyncValue(record.original,remoteValue)){
            var conflict=new Error('云端课程已有修改，请先比较双方版本');
            conflict.code='SYNC_CONFLICT';
            conflict.conflicts=[{entity:group,id:record.id,currentRev:remote.rev,reason:'BASE_CONTENT_CHANGED'}];
            throw conflict;
          }
          var rev=Math.max(remote.rev,(loadRevs()[group] || {})[record.id] || 0)+1;
          if(!Number.isSafeInteger(rev)) throw new Error('课程版本号超出范围');
          var payload={mem:{},revs:{},baseRevs:{},deleted:{}};
          payload.revs[group]={[record.id]:rev};
          payload.baseRevs[group]={[record.id]:remote.exists ? remote.rev : null};
          if(record.deleted) payload.deleted[group]=[{id:record.id,rev:rev}];
          else if(group==='courses') payload.courses=[record.value];
          else payload.courseProgress={[record.id]:record.value};
          frozen=await store.freezeSyncIntent(scope,record.key,record.operationId,payload);
          checkScope();
          if(!frozen) continue; // Another tab changed the draft before it was frozen.
        }
        checkScope();
        var receipt=await api.putData(frozen.payload);
        checkScope();
        if(!receipt || receipt.ok!==true) throw new Error('服务器未确认课程保存成功');
        await store.confirmSyncIntent(scope,record.key,frozen.operationId);
        rememberCourseRevision(group,record.id,frozen.payload.revs[group][record.id]);
      }
      // Bound a run when another tab is continuously editing; leave the rest durable.
      _dirty=true; notifySync();
      if(_cloudTimer) clearTimeout(_cloudTimer);
      _cloudTimer=setTimeout(function(){
        if(courseIntentScope()===scope && !_resolutionPaused) syncFromCloud();
      },400);
      return false;
    }catch(error){
      _dirty=true;
      if(error.code==='SYNC_CONFLICT') rememberSyncConflict(error.conflicts || []);
      notifySync(); console.warn('[course replay] 恢复暂停:',error.message); return false;
    }
  }
  function rememberCourseRevision(group,id,rev){
    var revs=loadRevs(); if(!revs[group]) revs[group]={};
    revs[group][id]=Math.max(revs[group][id] || 0,rev); saveRevs(revs);
  }
  var _resolutionPaused = false;
  function setResolutionPaused(paused){
    _resolutionPaused = !!paused;
    if(paused){ _dirty = true; if(_cloudTimer) clearTimeout(_cloudTimer); }
    notifySync();
  }
  function cloudSyncNow(memObj){
    if(_resolutionPaused) return Promise.resolve(false);
    /* 保存后的显式同步可能撞上上一批请求：直接返回旧 promise 会让调用方
       误以为本次改动已经确认，而新改动则留在 BatchSync.pending 里，下一次拉取
       还会被旧基线挡住。等待在途批次结束后，若本地代次已变化，立即用最新快照
       发送后继批次；这样 saveAndNotify + cloudSyncNow 的调用也有确定语义。 */
    if(_cloudInFlight){
      var requestedGeneration = _syncGeneration;
      var active = _cloudInFlight;
      return active.then(function(ok){
        if(!_resolutionPaused && _syncGeneration > requestedGeneration) return cloudSyncNow(loadMem());
        return ok;
      });
    }
    var sentGeneration = _syncGeneration;
    _cloudInFlight = sendCloudData(memObj).then(function(ok){
      _cloudInFlight = null;
      if(ok && _syncGeneration !== sentGeneration) scheduleCloudSync(loadMem());
      return ok;
    }).catch(function(error){
      _cloudInFlight=null; _dirty=true; notifySync();
      console.warn('[cloud sync] 准备同步失败:', error.message);
      /* A local edit may land while the payload is waiting for IDB writes.
         Do not send that stale payload; schedule a successor built from the
         current local view instead. */
      if(_syncGeneration !== sentGeneration && !_resolutionPaused){
        setTimeout(function(){ scheduleCloudSync(loadMem()); },0);
      }
      return false;
    });
    return _cloudInFlight;
  }
  async function putConditionalCloud(payload,expectedGeneration,operationReceipts){
    if(!global.BatchSync) return global.ChunkAPI.putData(payload);
    var state=await global.BatchSync.state();
    if(!Number.isSafeInteger(state.baseline) || state.baseline<0){
      var baseError=new Error('尚未确认云端基线，暂不上传本地数据');
      baseError.code='SYNC_BASELINE_REQUIRED';
      throw baseError;
    }
    await global.BatchSync.stage(payload,state.baseline,expectedGeneration,operationReceipts);
    var outcome=await global.BatchSync.retry();
    if(!outcome || !outcome.receipt) throw new Error('服务器未确认条件同步');
    return outcome.receipt;
  }
  async function sendCloudData(memObj){
    if(!_cloudOn || !global.ChunkAPI) return Promise.resolve(false);
    if(global.IDBStore) await Promise.all([_courseWriteTail,_progressWriteTail,_statsWriteTail]);
    /* A lost response leaves the exact request durable. Confirm it before
       constructing a successor payload, otherwise a stale in-memory payload
       could be staged after the old request has already committed. */
    if(global.BatchSync){
      var queued=await global.BatchSync.state();
      if(queued.pending){ await global.BatchSync.retry(); memObj=loadMem(); }
    }
    if(canReplayCourses() && !await replayCourseIntents()) return false;
    var intentScope=courseIntentScope();
    var intents=global.IDBStore && global.IDBStore.readSyncIntents
      ? await global.IDBStore.readSyncIntents(intentScope) : [];
    var learningIntents=global.IDBStore && global.IDBStore.readLearningIntents
      ? await global.IDBStore.readLearningIntents(intentScope) : [];
    if(courseIntentScope()!==intentScope) throw new Error('账号已切换，停止同步');
    var sentGeneration = _syncGeneration;
    var meta = _lastSyncMeta || { revs: { decks: {}, kv: {} }, deleted: { decks: [], kv: [] } };
    var cmeta = maintainCoursesRevs();
    var delta = buildStatsDelta(memObj);
    // Persistent tombstones survive loss of the in-memory cloud signature map.
    learningIntents.forEach(function(record){
      if(record.entity==='sentenceStats' && record.deleted &&
         !Object.prototype.hasOwnProperty.call((memObj.stats || {}).bySentence || {},record.id)){
        if(delta.sbsGone.indexOf(record.id)<0) delta.sbsGone.push(record.id);
        delete delta.sbs[record.id]; delete delta.mark.bsSig[record.id];
      }
    });
    var ent = buildEntityDelta(memObj);

    /* 只上行「自上次成功上行以来变更过的实体」。
       decks 走得最明显：用户导入的大题库每答一题都要重传整份（可达数百 KB），
       courses 更甚（含 base64 图片）。未变更的实体不进 payload，也就不会触发服务端 upsert。 */
    var deckPayload = pendingList(_pendingDecks, memObj.decks || [], function (d) { return d.id; });
    var coursePayload = pendingList(_pendingCourses, readCoursesRaw(), function (c) { return c.courseId; });
    var progPayload = pendingMap(_pendingProgress, readProgressRaw());
    if(canReplayCourses()){
      intents.forEach(function(record){(record.entity==='courses' ? _protectedCourses : _protectedProgress)[record.id]=true;});
      coursePayload=coursePayload.filter(function(c){return !_protectedCourses[c.courseId];});
      Object.keys(progPayload).forEach(function(id){if(_protectedProgress[id]) delete progPayload[id];});
    }
    var sentDecks = idsOf(deckPayload, function (d) { return d.id; });
    var sentCourses = idsOf(coursePayload, function (c) { return c.courseId; });
    var sentProgress = {};
    Object.keys(progPayload).forEach(function (cid) { sentProgress[cid] = 1; });
    var deckGone = pendingGone(_pendingDecks, meta.deleted.decks);
    var courseGone = pendingGone(_pendingCourses, cmeta.deleted.courses);
    var progGone = pendingGone(_pendingProgress, cmeta.deleted.courseProgress);
    if(canReplayCourses()){
      courseGone.list=courseGone.list.filter(function(d){return !_protectedCourses[d.id];});
      progGone.list=progGone.list.filter(function(d){return !_protectedProgress[d.id];});
    }
    discardSupersededDeletes(_pendingDecks, deckGone, sentDecks, meta.revs.decks || {});
    discardSupersededDeletes(_pendingCourses, courseGone, sentCourses, cmeta.revs.courses || {});
    discardSupersededDeletes(_pendingProgress, progGone, sentProgress, cmeta.revs.courseProgress || {});

    /* mem 里只带小字段 + 变更过的 deck（bySentence/events/mastered/错题本 都走各自 delta） */
    var memToSend = memForCloud(memObj) || {};
    memToSend.decks = deckPayload;

    var payload = {
      mem: memToSend,
      courses: coursePayload,
      courseProgress: progPayload,
      revs: {
        decks: meta.revs.decks, kv: meta.revs.kv,
        courses: cmeta.revs.courses, courseProgress: cmeta.revs.courseProgress
      },
      deleted: {
        decks: deckGone.list, kv: (meta.deleted.kv || []).concat((_rejectedDeletes.kv || []).filter(function(d){
          return !(meta.deleted.kv || []).some(function(current){ return current.k === d.k; });
        })),
        courses: courseGone.list, courseProgress: progGone.list
      }
    };
    /* 无变更时不带 statsDelta —— 省掉服务端一轮空 UPSERT */
    if(Object.keys(delta.sbs).length || delta.sbsGone.length || delta.evs.length){
      payload.statsDelta = { sbs: delta.sbs, sbsGone: delta.sbsGone, evs: delta.evs };
    }
    if(deltaHasRows(ent.mastered) || deltaHasRows(ent.reinforceBook) || deltaHasRows(ent.deletedItems)){
      payload.entityDelta = {};
      if(deltaHasRows(ent.mastered)) payload.entityDelta.mastered = { up: ent.mastered.up, gone: ent.mastered.gone };
      if(deltaHasRows(ent.reinforceBook)) payload.entityDelta.reinforceBook = { up: ent.reinforceBook.up, gone: ent.reinforceBook.gone };
      if(deltaHasRows(ent.deletedItems)) payload.entityDelta.deletedItems = { up: ent.deletedItems.up, gone: ent.deletedItems.gone };
    }
    var intentReceipts=intents.filter(function(record){
      if(record.deleted) return (payload.deleted[record.entity] || []).some(function(d){return d.id===record.id;});
      var value=record.entity==='courses' ? coursePayload.find(function(c){return c.courseId===record.id;}) : progPayload[record.id];
      return value!==undefined && _eqJson(value,record.value);
    }).map(function(record){return {key:record.key,operationId:record.operationId};});
    var sentEvents=Object.create(null);
    (delta.evs || []).forEach(function(event){sentEvents[event.id]=event;});
    var sentGone=new Set(delta.sbsGone || []);
    learningIntents.forEach(function(record){
      var matches=record.entity==='events'
        /* id is the event's immutable identity. Its key may be normalized by
           the cid migration between IDB intent creation and cloud assembly;
           comparing the whole object would strand the intent forever. */
        ? !record.deleted && !!sentEvents[record.id]
        : record.deleted ? sentGone.has(record.id) : sameSyncValue(delta.sbs[record.id],record.value);
      if(matches) intentReceipts.push({key:record.key,operationId:record.operationId});
    });
    return putConditionalCloud(payload,sentGeneration,intentReceipts).then(async function(result){
      if(!result || result.ok !== true){
        var error = new Error('服务器未确认保存成功');
        error.code = result && result.code;
        error.conflicts = result && result.conflicts;
        throw error;
      }
      if(courseIntentScope()!==intentScope) throw new Error('账号已切换，原账号的待同步记录已保留');
      if(!global.BatchSync && intentReceipts.length && global.IDBStore.acknowledgeSyncIntents){
        await global.IDBStore.acknowledgeSyncIntents(intentScope,intentReceipts);
      }
      /* ★ 只有确认送达才推进水位（失败保持 → 下次自动重发这批变更） */
      _cloudBsSig = delta.mark.bsSig;
      _cloudEvIds = delta.mark.evIds;
      _cloudMasteredSig = ent.mastered.next;
      _cloudReinforceSig = ent.reinforceBook.next;
      _cloudDeletedSig = ent.deletedItems.next;
      /* 待发集合只摘掉「本次真正发出去的」id（在途新增/变更的留待下次），见 makePending 注释 */
      if(_syncGeneration === sentGeneration){
        ackPending(_pendingDecks, sentDecks, deckGone.sent);
        ackPending(_pendingCourses, sentCourses, courseGone.sent);
        ackPending(_pendingProgress, sentProgress, progGone.sent);
      }
      _dirty = _syncGeneration !== sentGeneration;
      rememberSyncConflict(null);
      notifySync();
      return true;
    }).catch(function(e){
      console.warn('[cloud sync →] 失败:', e.message);
      _dirty = true;
      if(e.code === 'SYNC_CONFLICT') rememberSyncConflict(e.conflicts || [], payload.deleted);
      notifySync();
      return false;
    });
  }
  function syncFromCloud(pendingChecked, coursesChecked){
    if(!_cloudOn || !global.ChunkAPI) return Promise.resolve(false);
    if(!pendingChecked && global.SyncResolution) return global.SyncResolution.restorePause().then(function(){ return syncFromCloud(true); });
    if(_resolutionPaused) return Promise.resolve(false);
    if(!coursesChecked && canReplayCourses()) return replayCourseIntents().then(function(ok){return ok ? syncFromCloud(true,true) : false;});
    if(_syncConflict){
      // 未解决的本地版本不能被启动时的 LWW 拉取覆盖。先重试原版本，
      // 若云端仍不同则继续明确报冲突；不擅自抬高 rev 强制覆盖。
      var pending = loadMem();
      maintainRevs(pending);
      return cloudSyncNow(pending);
    }
    var pullScope=courseIntentScope(), pullGeneration=_syncGeneration;
    /* Retry the durable request before reading a new snapshot. A GET first
       could make the following write use a newer baseline than the request
       that was already committed but whose response was lost. */
    var retryBeforePull=global.BatchSync ? global.BatchSync.retry() : Promise.resolve();
    return retryBeforePull.then(function(){ return global.ChunkAPI.getData(); }).then(async function(data){
      if(!data) return false;
      // Pull must merge committed imports, not a snapshot taken before their writes finish.
      await Promise.all([_courseWriteTail, _progressWriteTail, _statsWriteTail]);
      var pendingLearning=global.IDBStore && global.IDBStore.readLearningIntents
        ? await global.IDBStore.readLearningIntents(pullScope) : [];
      if(courseIntentScope()!==pullScope) throw new Error('账号已切换，停止拉取合并');
      var remoteMem = data.mem || {};
      var remoteRevs = data.revs || { decks: {}, kv: {} };
      var localRevs = loadRevs();
      if(!localRevs.decks) localRevs.decks = {};
      if(!localRevs.kv) localRevs.kv = {};
      if(!localRevs.courses) localRevs.courses = {};
      if(!localRevs.courseProgress) localRevs.courseProgress = {};
      /* 合并前快照本地 rev（合并会把 localRevs 抬到 max(本地,远端)），供待发集合对齐使用 */
      var preLocalRevs = {
        decks: Object.assign({}, localRevs.decks),
        courses: Object.assign({}, localRevs.courses),
        courseProgress: Object.assign({}, localRevs.courseProgress)
      };
      var m = loadMem();
      /* 记录「云端当前已有什么」，作为增量上行的水位基准。
         合并后本地会包含远端全部内容，但那**不等于**「云端需要再收一次」——
         若不用远端实际内容对齐水位，每次启动都会把 8000 条档案全量回传（2674KB），
         拆表省下的流量会被这一步整个吃掉。 */
      var remoteBsSig = {}, remoteEvIds = {};
      var rstats = (remoteMem.stats && typeof remoteMem.stats === 'object') ? remoteMem.stats : {};
      var rby = (rstats.bySentence && typeof rstats.bySentence === 'object') ? rstats.bySentence : {};
      for(var rk in rby){ if(rby.hasOwnProperty(rk)) remoteBsSig[rk] = statSig(rby[rk]); }
      var revList = Array.isArray(rstats.events) ? rstats.events : [];
      for(var ri = 0; ri < revList.length; ri++){ if(revList[ri] && revList[ri].id) remoteEvIds[revList[ri].id] = 1; }
      // decks：per-entity LWW 合并（取 rev 大者）；采纳远程时同步写回 localRevs，
      //   否则新设备首拉后本地 rev=0/1，下一次本地修改会被服务端按旧 rev 拒绝
      var merged = {};
      (m.decks || []).forEach(function(d){ merged[d.id] = { data: d, rev: localRevs.decks[d.id] || 0 }; });
      (remoteMem.decks || []).forEach(function(d){
        var rr = remoteRevs.decks[d.id] || 0;
        var cur = merged[d.id];
        if(!cur || rr > cur.rev){ merged[d.id] = { data: d, rev: rr }; if(rr > (localRevs.decks[d.id] || 0)) localRevs.decks[d.id] = rr; }
      });
      // 软删除传播：远程 revs 有但 remoteMem.decks 无 → 已删，本地移除并采纳其 rev
      Object.keys(remoteRevs.decks || {}).forEach(function(id){
        if(!(remoteMem.decks || []).some(function(d){ return d.id === id; })){
          var ri = remoteRevs.decks[id];
          if(ri > (localRevs.decks[id] || 0)){ delete merged[id]; localRevs.decks[id] = ri; }
        }
      });
      m.decks = Object.keys(merged).map(function(id){ return merged[id].data; });
      // kv：per-key LWW 合并
      SYNC_KV_KEYS.forEach(function(k){
        var rRev = (remoteRevs.kv && remoteRevs.kv[k]) || 0;
        var lRev = localRevs.kv[k] || 0;
        if(k === 'stats' && remoteMem[k] !== undefined){
          var beforeStats = JSON.stringify(m.stats || {});
          var mergedStats = mergeStats(m.stats, remoteMem[k]);
          if(JSON.stringify(mergedStats) !== beforeStats){
            m.stats = mergedStats;
            /* 合并后的新结果需要一个更高 rev，确保能回写云端。 */
            localRevs.kv[k] = Math.max(lRev, rRev) + 1;
          } else if(rRev > lRev){
            localRevs.kv[k] = rRev;
          }
        } else if(rRev > lRev && remoteMem[k] !== undefined){ m[k] = remoteMem[k]; localRevs.kv[k] = rRev; }
        /* rRev <= lRev：本地更新优先，下次 PUT 覆盖 */
      });

      /* mastered / reinforceBook / deletedItems：**并集 + 墓碑**合并。
         服务端持有的是「全设备并集」，而本地可能还有尚未上行的自有条目 → 不能整块替换
         （整块替换 = LWW，正是「本机未上行的标熟被他机覆盖」的根因）。
         ⚠️ 墓碑（entityGone）不能省：设备 A 取消标熟某句后若 B 拿不到墓碑，
            B 的本地副本会把它重新写活 —— 取消标熟就永远不会生效。
         老客户端不认 entityGone（服务端只会对它下发块状形态），这里做存在性判断即兼容。 */
      var goneM = (data.entityGone && data.entityGone.mastered) || [];
      var goneR = (data.entityGone && data.entityGone.reinforce) || [];
      var goneD = (data.entityGone && data.entityGone.deletedItem) || [];
      var rMastered = (remoteMem.mastered && typeof remoteMem.mastered === 'object') ? remoteMem.mastered : {};
      var rDeleted = (remoteMem.deletedItems && typeof remoteMem.deletedItems === 'object') ? remoteMem.deletedItems : {};
      var rBook = Array.isArray(remoteMem.reinforceBook) ? remoteMem.reinforceBook : [];

      var mergedMastered = {};
      Object.keys(m.mastered || {}).forEach(function(k){ mergedMastered[k] = m.mastered[k]; });
      Object.keys(rMastered).forEach(function(k){ mergedMastered[k] = rMastered[k]; }); /* 远端为准（同 key 值等价） */
      goneM.forEach(function(k){ delete mergedMastered[k]; });
      m.mastered = mergedMastered;

      var mergedDeleted = {};
      Object.keys(m.deletedItems || {}).forEach(function(k){ if(m.deletedItems[k]) mergedDeleted[k] = true; });
      Object.keys(rDeleted).forEach(function(k){ mergedDeleted[k] = true; });
      goneD.forEach(function(k){ delete mergedDeleted[k]; });
      m.deletedItems = mergedDeleted;

      /* 错题本按 _key 去重；**先远端后本地** —— 服务端行表按 order by rowid 返回，
         保留服务端插入序才能让各设备的 slice(-200) 裁掉同一批最旧条目。 */
      var goneRSet = {};
      goneR.forEach(function(k){ goneRSet[k] = 1; });
      var mergedBook = [], seenBook = {};
      rBook.concat(Array.isArray(m.reinforceBook) ? m.reinforceBook : []).forEach(function(it){
        if(!it || !it._key || seenBook[it._key] || goneRSet[it._key]) return;
        seenBook[it._key] = 1; mergedBook.push(it);
      });
      m.reinforceBook = mergedBook;

      pendingLearning.forEach(function(record){
        if(record.entity==='sentenceStats' && record.deleted) delete m.stats.bySentence[record.id];
      });
      /* 事件在普通答题路径只追加；整账号显式选择可产生事件墓碑。
         先合并远端新增，再应用墓碑，避免已删除事件被本地旧副本复活。 */
      var goneEvents = data.deleted && Array.isArray(data.deleted.events) ? data.deleted.events : [];
      if(goneEvents.length){
        var goneEventSet = {};
        goneEvents.forEach(function(id){ goneEventSet[id]=1; });
        /* 事件 id 是不可变主键；若本机曾在旧 key 迁移前写入过 intent，
           仅靠整对象比较会让这条已经被云端明确删除的 intent 永久待发，
           下一次拉取又会把“空 payload”卡在旧基线。整账号选择的删除是
           明确的权威结果，因此同步摘除对应本机 intent。 */
        if(global.IDBStore && global.IDBStore.acknowledgeSyncIntents){
          var goneReceipts = pendingLearning.filter(function(record){
            return record.entity==='events' && !record.deleted && goneEventSet[record.id];
          }).map(function(record){ return {key:record.key,operationId:record.operationId}; });
          if(goneReceipts.length) await global.IDBStore.acknowledgeSyncIntents(pullScope,goneReceipts);
          pendingLearning = pendingLearning.filter(function(record){
            return !(record.entity==='events' && !record.deleted && goneEventSet[record.id]);
          });
        }
        m.stats.events = (Array.isArray(m.stats.events) ? m.stats.events : []).filter(function(ev){
          return !ev || !goneEventSet[ev.id];
        });
      }
      if(pendingLearning.length) _dirty=true;

      saveRevs(localRevs);
      _prevSnap = null; /* 让 saveMem 的 maintainRevs 走初始化分支，避免误 bump 合并结果 */
      /* ★ 合并结果必须同步回内存桥：否则下一次 loadMem() 仍会取到合并前的旧 bySentence/events，
         合并成果在内存里被丢弃（大对象已迁 IDB 后才有这个陷阱）。
         _evSnap 置 null：并集事件是整体替换（顺序/内容都变了），强制事件全量覆盖，
         不依赖三锚点去猜「能否增量追加」——只有本轮练习真正 append 时才走增量路径。 */
      if(_statsStore === 'idb'){
        _bySentenceCache = m.stats.bySentence;
        _eventsCache = m.stats.events;
        _evSnap = null;
      }
      saveMem(m,false);
      /* 增量水位对齐到云端实际内容：远端已有的不再回传，本地独有的下次上行。
         必须在合并结果写盘后立即就位 —— 之后任何一次 scheduleCloudSync 都要基于它。 */
      _cloudBsSig = remoteBsSig;
      _cloudEvIds = remoteEvIds;
      /* 行级实体同样要把水位对齐到云端实况 —— 否则每次启动都会把 mastered / 错题本
         / deletedItems 全量重推一遍，拆表省下的流量被这一步整个吃掉。 */
      alignEntityMarks(remoteMem);
      // courses：per-entity LWW 合并 + 软删传播（ADR-005 step 2）
      var mergedCourses = {};
      readCoursesRaw().forEach(function(c){ mergedCourses[c.courseId] = { data: c, rev: localRevs.courses[c.courseId] || 0 }; });
      (data.courses || []).forEach(function(c){
        var rr = (remoteRevs.courses && remoteRevs.courses[c.courseId]) || 0;
        var cur = mergedCourses[c.courseId];
        if(!cur || rr > cur.rev){ mergedCourses[c.courseId] = { data: c, rev: rr }; if(rr > (localRevs.courses[c.courseId] || 0)) localRevs.courses[c.courseId] = rr; }
      });
      Object.keys(remoteRevs.courses || {}).forEach(function(cid){
        if(!(data.courses || []).some(function(c){ return c.courseId === cid; })){
          var ri = remoteRevs.courses[cid];
          if(ri > (localRevs.courses[cid] || 0)){ delete mergedCourses[cid]; localRevs.courses[cid] = ri; }
        }
      });
      await persistCourseValue('courses', Object.keys(mergedCourses).map(function(cid){ return mergedCourses[cid].data; }), false);
      // courseProgress：per-key LWW 合并 + 软删传播
      var mergedProg = {};
      var pcur = readProgressRaw();
      Object.keys(pcur).forEach(function(cid){ mergedProg[cid] = { data: pcur[cid], rev: localRevs.courseProgress[cid] || 0 }; });
      Object.keys(data.courseProgress || {}).forEach(function(cid){
        var rr = (remoteRevs.courseProgress && remoteRevs.courseProgress[cid]) || 0;
        var cur = mergedProg[cid];
        if(!cur || rr > cur.rev){ mergedProg[cid] = { data: data.courseProgress[cid], rev: rr }; if(rr > (localRevs.courseProgress[cid] || 0)) localRevs.courseProgress[cid] = rr; }
      });
      Object.keys(remoteRevs.courseProgress || {}).forEach(function(cid){
        if(!data.courseProgress || !(cid in data.courseProgress)){
          var ri = remoteRevs.courseProgress[cid];
          if(ri > (localRevs.courseProgress[cid] || 0)){ delete mergedProg[cid]; localRevs.courseProgress[cid] = ri; }
        }
      });
      var newProg = {};
      Object.keys(mergedProg).forEach(function(cid){ newProg[cid] = mergedProg[cid].data; });
      await persistCourseValue('progress', newProg, false);
      saveRevs(localRevs);
      /* The read is now accepted and all merged local values are persisted.
         Only this point may advance the baseline; a concurrent local edit
         keeps the old relation so its next PUT can surface a real conflict. */
      if(global.BatchSync && Number.isSafeInteger(data.seq) && data.seq>=0 &&
         _syncGeneration===pullGeneration && !_dirty){
        var accepted=await global.BatchSync.state();
        if(accepted.baseline===null || accepted.baseline!==data.seq){
          await global.BatchSync.observe(data.seq,accepted.baseline);
        }
      }
      /* 重置 courses/progress 快照：合并结果已采纳（localRevs 已对齐），下次上行走初始化分支不误 bump */
      _coursesSnap = null;
      _progressSnap = null;
      /* ---------- 待发集合对齐到「服务端实况」 ----------
         合并后本地包含云端全部内容，但那**不等于**服务端需要再收一次。
         不对齐的话，刷新页面后第一次上行会把全部 deck / 课程 / 进度重传一遍
         （含 base64 图片的课程可达数 MB）—— 只上行变更实体省下的流量会被这一个场景吃掉。
         判定用**合并前**的本地 rev（见 preLocalRevs 注释）。
         gone 集合不动：那是「本机删了但还没上行的」实体，清掉就真的丢了。 */
      _pendingDecks.all = false;
      _pendingCourses.all = false;
      _pendingProgress.all = false;
      var pushDecks = entitiesNeedingPush(m.decks || [], function(d){ return d.id; }, preLocalRevs.decks, remoteRevs.decks);
      Object.keys(pushDecks).forEach(function(id){ _pendingDecks.dirty[id] = 1; });
      var pushCourses = entitiesNeedingPush(_coursesCache || [], function(c){ return c.courseId; }, preLocalRevs.courses, remoteRevs.courses);
      Object.keys(pushCourses).forEach(function(id){ _pendingCourses.dirty[id] = 1; });
      var pushProg = entitiesNeedingPush(Object.keys(_progressCache || {}), function(cid){ return cid; }, preLocalRevs.courseProgress, remoteRevs.courseProgress);
      Object.keys(pushProg).forEach(function(id){ _pendingProgress.dirty[id] = 1; });
      /* 离线 change-log（轻量版）：拉取合并成功后，若本地仍有未同步变更（离线期间产生），立即补传 push */
      if(_dirty){
        notifySync();
        cloudSyncNow(loadMem());
      }
      return true;
    }).catch(function(e){
      console.warn('[cloud sync ←] 失败:', e.message);
      return false;
    });
  }
  function readSyncLocal(entity, id){
    var value, m = loadMem();
    if(entity === 'courses' || entity === 'courseProgress') maintainCoursesRevs(); else maintainRevs(m);
    if(entity === 'decks') value = (m.decks || []).find(function(d){ return d.id === id; });
    else if(entity === 'courses') value = readCoursesRaw().find(function(c){ return c.courseId === id; });
    else if(entity === 'courseProgress') value = readProgressRaw()[id];
    else if(entity === 'kv' && SYNC_KV_KEYS.indexOf(id) >= 0) value = memForCloud(m)[id];
    else throw new Error('不支持的冲突项目');
    var revs = loadRevs();
    return cloneJSON({ rev: (revs[entity] && revs[entity][id]) || 0, deleted: value == null, value: value == null ? null : value });
  }
  /* Full local learning snapshot used only after an account-level conflict.
     It is intentionally on-demand: normal answering and sync continue to use
     row-level deltas, so an 8000-sentence account is not cloned per answer. */
  function readSyncSnapshot(){
    return cloneJSON({
      mem: loadMem(),
      courses: readCoursesRaw(),
      courseProgress: readProgressRaw(),
      revs: loadRevs(),
      generation: _syncGeneration
    });
  }
  /* 整账号冲突处理成功后，选中的快照就是新的已确认基线。
     不能把 _prevSnap / 云端增量水位留空：否则紧接着删除或修改一个题库时，
     maintainRevs 只能走“首次保存”分支，既检测不到删除，也可能用旧 rev 上行。
     这里一次性重建所有轻量水位；8000 句只在低频的冲突处理路径执行。 */
  function adoptConfirmedBatchSnapshot(snapshot){
    snapshot = snapshot || {};
    var cm = snapshot.mem || loadMem();
    var cs = cm.stats || {};
    _prevSnap = { decks: {}, kv: {} };
    (cm.decks || []).forEach(function(d){ _prevSnap.decks[d.id] = sigDeck(d); });
    SYNC_KV_KEYS.forEach(function(k){ if(k in cm) _prevSnap.kv[k] = kvSig(k, cm[k]); });
    _coursesSnap = {};
    (snapshot.courses || readCoursesRaw()).forEach(function(c){ _coursesSnap[c.courseId] = sigCourse(c); });
    _progressSnap = {};
    var cp = snapshot.courseProgress || readProgressRaw();
    Object.keys(cp).forEach(function(id){ _progressSnap[id] = sigKv(cp[id]); });
    var by = cs.bySentence && typeof cs.bySentence === 'object' ? cs.bySentence : {};
    _cloudBsSig = {};
    Object.keys(by).forEach(function(k){ _cloudBsSig[k] = statSig(by[k]); });
    _cloudEvIds = {};
    (Array.isArray(cs.events) ? cs.events : []).forEach(function(ev){ if(ev && ev.id) _cloudEvIds[ev.id] = 1; });
    alignEntityMarks(cm);
    if(snapshot.revs) saveRevs(snapshot.revs);
    [_pendingDecks, _pendingCourses, _pendingProgress].forEach(function(p){
      p.all = false; p.dirty = {}; p.gone = {};
    });
  }
  async function applySyncBatchResolution(receipt, original){
    if(!receipt || receipt.kind!=='batch' || !receipt.snapshot || !global.BatchSync || !global.BatchSync.finishResolution){
      throw new Error('整账号处理回执无效');
    }
    var current=readSyncSnapshot();
    if(!sameSyncValue(current, original)){
      var changed=new Error('处理期间本机已有新修改，请重新比较双方版本');
      changed.code='LOCAL_CHANGED'; throw changed;
    }
    if(receipt.choice==='remote'){
      var remote=receipt.snapshot;
      if(saveMem(remote.mem,false)===false) throw new Error('云端版本写入本机失败，原数据未切换');
      await persistCourseValue('courses', remote.courses || [], false);
      await persistCourseValue('progress', remote.courseProgress || {}, false);
    }
    adoptConfirmedBatchSnapshot(receipt.snapshot);
    await global.BatchSync.finishResolution(receipt.seq,receipt.requestId);
    /* A recovered namespace remains local-only until this exact comparison
       and resolution succeeds.  Remove the hold only after both local
       activation and the durable sync baseline have completed. */
    if(global.AccountStorage && global.AccountStorage.storage.getItem('chunklab.restore-cloud-hold')){
      global.AccountStorage.storage.removeItem('chunklab.restore-cloud-hold');
    }
    _lastSyncMeta=null; _dirty=false; rememberSyncConflict(null); notifySync();
    emit('syncResolved',{entity:'batch',id:receipt.requestId,choice:receipt.choice});
  }
  async function applySyncResolution(receipt, original){
    await Promise.all([_courseWriteTail, _progressWriteTail]);
    var entity = receipt.entity, id = receipt.id, state = receipt.state;
    var current = readSyncLocal(entity, id);
    var intentScope=courseIntentScope();
    var resolutionIntents=global.IDBStore && global.IDBStore.readSyncIntents
      ? (await global.IDBStore.readSyncIntents(intentScope)).filter(function(record){
        return record.entity===entity && record.id===id && record.deleted===original.deleted && sameSyncValue(record.value,original.value);
      }) : [];
    var sameData = function(a,b){ return a.deleted === b.deleted && JSON.stringify(a.value) === JSON.stringify(b.value); };
    if(!sameData(current, original) && !sameData(current, state)){
      var changed = new Error('本机在处理期间有新修改，已保留。请重新比较双方版本。');
      changed.code = 'LOCAL_CHANGED'; throw changed;
    }
    var m = loadMem();
    if(entity === 'courses'){
      var courses = readCoursesRaw().filter(function(c){ return c.courseId !== id; });
      if(!state.deleted) courses.push(state.value);
      await persistCourseValue('courses', courses, false,resolutionIntents.map(function(r){return r.operationId;}));
      if(_coursesSnap){ if(state.deleted) delete _coursesSnap[id]; else _coursesSnap[id] = sigCourse(state.value); }
    }else if(entity === 'courseProgress'){
      var progress = cloneJSON(readProgressRaw());
      if(state.deleted) delete progress[id]; else progress[id] = state.value;
      await persistCourseValue('progress', progress, false,resolutionIntents.map(function(r){return r.operationId;}));
      if(_progressSnap){ if(state.deleted) delete _progressSnap[id]; else _progressSnap[id] = sigKv(state.value); }
    }else{
      if(entity === 'decks'){
        m.decks = m.decks.filter(function(d){ return d.id !== id; });
        if(!state.deleted) m.decks.push(state.value);
      }else if(id === 'stats'){
        // Only the conflicting summary changes; sentence cards and events stay intact.
        m.stats = Object.assign({}, state.deleted ? {} : state.value, { bySentence: m.stats.bySentence, events: m.stats.events });
      }else m[id] = state.deleted ? {} : state.value;
      writeLocalMem(m);
      if(_prevSnap){
        if(entity === 'decks'){ if(state.deleted) delete _prevSnap.decks[id]; else _prevSnap.decks[id] = sigDeck(state.value); }
        else _prevSnap.kv[id] = kvSig(id, m[id]);
      }
    }
    if((entity==='courses' || entity==='courseProgress') && !sameData(readSyncLocal(entity,id),state)){
      var raced=new Error('处理期间出现新修改，已保留，请重新比较'); raced.code='LOCAL_CHANGED'; throw raced;
    }
    var revs = loadRevs();
    if(!revs[entity]) revs[entity] = {};
    revs[entity][id] = state.rev;
    /* 走 saveRevs（逐键 max 合并）而非直接 setItem：避免把其他标签页刚升的 rev 覆盖回退 */
    saveRevs(revs);
    if(resolutionIntents.length){
      if(courseIntentScope()!==intentScope) throw new Error('账号已切换，处理记录已保留');
      await global.IDBStore.acknowledgeSyncIntents(intentScope,resolutionIntents);
    }
    _lastSyncMeta.revs = revs;
    var pending = entity === 'decks' ? _pendingDecks : entity === 'courses' ? _pendingCourses : entity === 'courseProgress' ? _pendingProgress : null;
    if(pending){ delete pending.dirty[id]; delete pending.gone[id]; }
    _rejectedDeletes[entity] = (_rejectedDeletes[entity] || []).filter(function(d){ return (d.id || d.k) !== id; });
    if(_lastSyncMeta.deleted[entity]) _lastSyncMeta.deleted[entity] = _lastSyncMeta.deleted[entity].filter(function(d){ return (d.id || d.k) !== id; });
    var remaining = (_syncConflict || []).filter(function(c){ return c.entity !== entity || c.id !== id; });
    var hasDeletes = Object.keys(_rejectedDeletes).some(function(k){ return _rejectedDeletes[k].length; });
    rememberSyncConflict(remaining.length || hasDeletes ? remaining : null, _rejectedDeletes);
    emit('memUpdated', loadMem()); emit('syncResolved', { entity: entity, id: id }); notifySync();
  }

  /* ---------- 静默游客账号 ----------
     鉴权模式下让用户免登录直接用：首次访问自动注册 guest_xxx（凭据存本地供静默续期），
     token 过期后凭据可透明重登。手动登录的账号不存此凭据 → 到期仍走登录框，防止自动换成新游客导致数据错挂。 */
  var GUEST_KEY = 'chunklab_guest';
  function _randId(n){
    var chars = 'abcdefghjkmnpqrstuvwxyz23456789', s = '';
    for (var i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  function _loadGuest(){
    try {
      var saved = JSON.parse(localStorage.getItem(GUEST_KEY) || 'null');
      return saved && (saved.base || '') === global.ChunkAPI.getBase() ? saved : null;
    } catch (e) { return null; }
  }
  function _createGuest(tries){
    var api = global.ChunkAPI;
    tries = tries || 0;
    var u = 'guest_' + _randId(10), p = _randId(24);
    return api.register(u, p).then(function(r){
      if (r && r.token) {
        api.setToken(r.token);
        try { localStorage.setItem(GUEST_KEY, JSON.stringify({ u: u, p: p, base: api.getBase() })); } catch (e) {}
        return true;
      }
      return false;
    }).catch(function(){
      /* 用户名撞车（极小概率）→ 重试；网络/服务异常 → 放弃静默，走登录框 */
      if (tries < 2) return _createGuest(tries + 1);
      return false;
    });
  }
  function guestBootstrap(){
    var api = global.ChunkAPI;
    var saved = _loadGuest();
    if (saved && saved.u && saved.p) {
      /* 有游客凭据：静默重登（顺带解决 JWT 过期），账号被删则重建游客 */
      return api.login(saved.u, saved.p).then(function(r){
        if (r && r.token) { api.setToken(r.token); return true; }
        return _createGuest();
      }).catch(function(){ return _createGuest(); });
    }
    if (api.isLoggedIn()) return Promise.resolve(true); /* 手动登录会话：不自动换账号 */
    /* 无凭据无 token：真新访客 → 建游客；但带手动会话标记（登录过自己账号、token 已过期）→ 弹登录框，
       绝不静默换成新游客（用户会以为数据丢了） */
    try {
      if (localStorage.getItem('chunklab_manual')) return Promise.resolve(false);
    } catch (e) {}
    return _createGuest();
  }
  function ensureCloud(){
    return new Promise(function(resolve){
      if(!global.ChunkAPI){ resolve(); return; }
      preload().then(function(){
        global.ChunkAPI.getConfig().then(function(cfg){
          _cloudConfig = cfg || null;
          var needAuth = cfg && cfg.requireAuth;
          if(needAuth && (!global.ChunkAPI.isLoggedIn() || _loadGuest())){
            /* 鉴权模式：无 token 或有游客凭据（过期续期）→ 先试静默游客引导，失败再弹登录框 */
            guestBootstrap().then(function(ok){
              if(ok){ _cloudOn = true; syncFromCloud().then(resolve, resolve); }
              else if(global.ChunkAuthUI && global.ChunkAuthUI.showLogin){
                global.ChunkAuthUI.showLogin(function(){ _cloudOn = true; syncFromCloud().then(resolve, resolve); });
              } else { resolve(); }
            });
          } else {
            /* 开放模式，或鉴权模式下的手动登录会话：直接同步 */
            _cloudOn = true;
            syncFromCloud().then(resolve, resolve);
          }
        }).catch(function(){
          /* 服务器不可达 → 纯本地模式，不阻塞启动 */
          _cloudConfig = null;
          console.warn('[cloud] 服务器不可达，使用纯本地存储');
          resolve();
        });
      });
    });
  }

  /* ---------- 工具 ---------- */
  function $(id){ return global.document.getElementById(id); }
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  function norm(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, ''); }
  function normSent(s){ return norm(s); }
  function timeAgo(t){
    if(!t) return '—';
    var d = Date.now() - t;
    if(d < 60000) return '刚刚';
    if(d < 3600000) return Math.floor(d/60000)+' 分钟前';
    if(d < 86400000) return Math.floor(d/3600000)+' 小时前';
    return Math.floor(d/86400000)+' 天前';
  }

  /* 统计同步：stats 是一个逻辑对象，但练习记录本身是可合并事件。
     旧数据没有 events 时仍按旧聚合值兼容；新数据按事件 ID 去重，
     避免两个设备离线各练一次后，后写入的整块 stats 覆盖先写入的数据。

     ★ 性能（2026-09-10 扩容 8000 句）：原实现用 eventCount(list,...) 在每个
     bySentence key 上反复 filter 全量 events，复杂度 O(keys × events)；8000 句实测
     12.2s（每句答 3 次），足以卡死启动同步。现改为「单遍建索引 + 主循环查表」：
       pass1  遍历 a.events / b.events，同时累计计数并建 byKeyA / byKeyB
       pass2  遍历去重并集，建 byKeyU + union 计数
       主循环 每个 key 只做 O(1) 查表
     总复杂度 O(events + keys)。语义与原实现逐条对齐（见下方注释中的兼容点）。 */
  function mergeStats(a, b){
    a = (a && typeof a === 'object') ? a : {};
    b = (b && typeof b === 'object') ? b : {};
    var ae = Array.isArray(a.events) ? a.events : [];
    var be = Array.isArray(b.events) ? b.events : [];

    /* pass 1：并集去重表（只收带 id 的事件，与原实现一致）+ a/b 两侧计数索引。
       兼容点：answerA/roundA 等「侧计数」统计的是 list 中所有同类事件（含无 id 的），
       与并集 events 数组的「只收带 id」口径不同，这里必须分开累计。 */
    var eventMap = {};
    var answerA = 0, roundA = 0, answerB = 0, roundB = 0;
    var byKeyA = {}, byKeyB = {};
    var i, e;
    for(i = 0; i < ae.length; i++){
      e = ae[i];
      if(!e) continue;
      if(e.id) eventMap[e.id] = e;
      if(e.kind === 'answer'){ answerA++; if(e.key){ var ta = byKeyA[e.key]; if(!ta) ta = byKeyA[e.key] = { ok:0, wrong:0 }; if(e.ok) ta.ok++; else ta.wrong++; } }
      else if(e.kind === 'round'){ roundA++; }
    }
    for(i = 0; i < be.length; i++){
      e = be[i];
      if(!e) continue;
      if(e.id) eventMap[e.id] = e;
      if(e.kind === 'answer'){ answerB++; if(e.key){ var tb = byKeyB[e.key]; if(!tb) tb = byKeyB[e.key] = { ok:0, wrong:0 }; if(e.ok) tb.ok++; else tb.wrong++; } }
      else if(e.kind === 'round'){ roundB++; }
    }

    /* 并集事件：按 id 全序排序（用 < 比较而非 localeCompare —— 后者在数万条时开销显著，
       且 UTF-16 码元序同样是稳定全序，保证 mergeStats 幂等）。 */
    var ids = Object.keys(eventMap);
    var events = new Array(ids.length);
    for(i = 0; i < ids.length; i++) events[i] = eventMap[ids[i]];
    var keyOf = new Array(events.length);
    for(i = 0; i < events.length; i++) keyOf[i] = String(events[i].id);
    var order = new Array(events.length);
    for(i = 0; i < events.length; i++) order[i] = i;
    order.sort(function(x, y){ var p = keyOf[x], q = keyOf[y]; return p < q ? -1 : (p > q ? 1 : 0); });
    var sorted = new Array(events.length);
    for(i = 0; i < events.length; i++) sorted[i] = events[order[i]];
    events = sorted;

    /* pass 2：并集侧计数索引（setOnlyKeys 供 bySentence key 全集用） */
    var answerU = 0, roundU = 0;
    var byKeyU = {};
    var setOnlyKeys = {};
    for(i = 0; i < events.length; i++){
      e = events[i];
      if(e.kind === 'answer'){
        answerU++;
        if(e.key){
          var tu = byKeyU[e.key]; if(!tu) tu = byKeyU[e.key] = { ok:0, wrong:0, lastAt:0 };
          if(e.ok) tu.ok++; else tu.wrong++;
          if((e.at||0) > tu.lastAt) tu.lastAt = e.at || 0;
          setOnlyKeys[e.key] = true;
        }
      } else if(e.kind === 'round'){ roundU++; }
    }

    var baseAnswered = events.length
      ? Math.max(Math.max(0, (Number(a.totalAnswered)||0) - answerA), Math.max(0, (Number(b.totalAnswered)||0) - answerB))
      : Math.max(Number(a.totalAnswered)||0, Number(b.totalAnswered)||0);
    var baseRounds = events.length
      ? Math.max(Math.max(0, (Number(a.totalRounds)||0) - roundA), Math.max(0, (Number(b.totalRounds)||0) - roundB))
      : Math.max(Number(a.totalRounds)||0, Number(b.totalRounds)||0);
    var out = { totalRounds: baseRounds + roundU, totalAnswered: baseAnswered + answerU, bySentence:{}, events:events };
    /* ★ 修复（2026-09-09）：mergeStats 此前重建 out 时丢掉 daysLog —— 每次启动云同步合并
       后 saveMem 回写，连续打卡数据被清零。补：按天合并，rounds 取两侧较大值（daysLog 是
       events 的按日汇总，取 max 对齐 bySentence 的基线取大策略，单调不回退）。 */
    out.daysLog = {};
    [a.daysLog || {}, b.daysLog || {}].forEach(function(dl){
      Object.keys(dl).forEach(function(k){
        var r = (dl[k] && dl[k].rounds) || 0;
        if(r <= 0) return; /* 0 次的日期等价于不存在，不入表 */
        if(!out.daysLog[k]) out.daysLog[k] = { rounds: 0 };
        out.daysLog[k].rounds = Math.max(out.daysLog[k].rounds, r);
      });
    });
    var aBy = a.bySentence || {}, bBy = b.bySentence || {};
    var keys = {};
    Object.keys(aBy).forEach(function(k){ keys[k] = true; });
    Object.keys(bBy).forEach(function(k){ keys[k] = true; });
    Object.keys(setOnlyKeys).forEach(function(k){ keys[k] = true; });
    var EMPTY_C = { ok:0, wrong:0, lastAt:0 };
    Object.keys(keys).sort().forEach(function(key){
      var ra = aBy[key] || null;
      var rb = bBy[key] || null;
      if(!ra && !rb) return;
      var ca = byKeyA[key] || EMPTY_C, cb = byKeyB[key] || EMPTY_C, cu = byKeyU[key] || EMPTY_C;
      var ea = ca.ok + ca.wrong, eb = cb.ok + cb.wrong, eu = cu.ok + cu.wrong;
      var baseTimes = Math.max(ra ? Math.max(0, (ra.times||0) - ea) : 0, rb ? Math.max(0, (rb.times||0) - eb) : 0);
      /* ★ 修复（2026-09-10）：baseOk 必须减去「本侧 ok 事件数」而非「本侧全部 answer 事件数」。
         原实现用 ea（含 wrong 事件），导致每次合并 okTimes 都被多减 ca.wrong：
           merged.okTimes = okTimes - ea + ok_union = okTimes - ca.wrong
         而 syncFromCloud 每次启动都跑 mergeStats(x, x)，于是 okTimes 逐次下沉，
         直到塌回事件里 ok 事件的条数 —— 准确率虚低、isFluencyByDeck 的 okTimes>=3 判定失真。
         旧测试每侧只放 1 条事件（ca.wrong 恒为 0）恰好掩盖了它。修正后 mergeStats 幂等。 */
      var baseOk = Math.max(ra ? Math.max(0, (ra.okTimes||0) - ca.ok) : 0, rb ? Math.max(0, (rb.okTimes||0) - cb.ok) : 0);
      var baseWrong = Math.max(ra ? Math.max(0, (ra.wrongTimes||0) - ca.wrong) : 0, rb ? Math.max(0, (rb.wrongTimes||0) - cb.wrong) : 0);
      if(!events.length){
        var legacy = (ra && rb) ? ((ra.times||0) >= (rb.times||0) ? ra : rb) : (ra || rb);
        out.bySentence[key] = Object.assign({}, legacy);
        return;
      }
      var latest = (ra && rb) ? ((ra.lastAt||0) >= (rb.lastAt||0) ? ra : rb) : (ra || rb);
      var merged = Object.assign({}, latest);
      merged.times = baseTimes + eu;
      /* answer 事件带 ok 字段；正确/错误增量直接取并集索引计数。 */
      merged.okTimes = baseOk + cu.ok;
      merged.wrongTimes = baseWrong + cu.wrong;
      merged.lastAt = Math.max((ra&&ra.lastAt)||0, (rb&&rb.lastAt)||0, cu.lastAt);
      merged.maxStreak = Math.max((ra&&ra.maxStreak)||0, (rb&&rb.maxStreak)||0);
      out.bySentence[key] = merged;
    });
    return out;
  }
  function copyText(t, done){
    var ok = false;
    if(global.navigator.clipboard && global.navigator.clipboard.writeText){
      global.navigator.clipboard.writeText(t).then(function(){ done && done(true); }, function(){ done && done(fallback()); });
    } else { done && done(fallback()); }
    function fallback(){
      var ta = global.document.createElement('textarea');
      ta.value = t; global.document.body.appendChild(ta);
      ta.select();
      var r = false;
      try{ r = global.document.execCommand('copy'); }catch(e){}
      global.document.body.removeChild(ta);
      return r;
    }
  }

  /* ---------- 句子稳定身份（cid） ----------
     学习档案 key 与原文解耦：key = deckId#cid。
     - cid 优先取句子数据的显式 cid 字段（内容修订时保留 cid → 用户进度不丢，根因修复）；
     - 无 cid 字段（老数据/导入句）时退化为原文的稳定 FNV-1a 哈希（幂等，同文本同 cid）。
     老档案 key（deckId#原文）在 loadMem 时一次性迁移为 deckId#cid（见 migrateCidKeys）。 */
  function fnv8(str){
    var h = 0x811c9dc5;
    str = String(str == null ? '' : str);
    for(var i = 0; i < str.length; i++){
      /* 必须用 Math.imul：普通乘法 (h*0x01000193) 是双精度，乘积超 2^53 丢精度，
         与精确 32 位实现（python/标准 FNV-1a）结果不一致 → 会导致 key/迁移对不上数据 cid */
      h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
    }
    var hex = (h >>> 0).toString(16);
    while(hex.length < 8) hex = '0' + hex;
    return hex;
  }
  function cidOf(it){
    if(!it) return '';
    if(it.cid) return String(it.cid);
    return fnv8(it.sentence || it.en || '');
  }
  /* 全部句子级档案 key 的统一构造点（mastered / deletedItems / stats.bySentence / events） */
  function cidKey(deckId, it){ return deckId + '#' + cidOf(it); }
  /* 旧档案 key（deckId#原文）→ 新 key（deckId#cid(原文)）的单键迁移 */
  function moveKeyToCid(k){
    var m = /^([^#]+)#(.+)$/.exec(String(k == null ? '' : k));
    if(!m || /^[0-9a-f]{8}$/.test(m[2])) return k; /* 无 # 或已是 cid 格式：不动 */
    return m[1] + '#' + fnv8(m[2]);
  }
  /* 全量迁移 bySentence / mastered / deletedItems / events 里的句子 key。
     幂等：二次执行无变化。返回是否有变更。 */
  function migrateCidKeys(o){
    var changed = false;
    function moveMap(map){
      if(!map || typeof map !== 'object') return;
      Object.keys(map).forEach(function(k){
        var nk = moveKeyToCid(k);
        if(nk === k) return;
        if(!(nk in map)) map[nk] = map[k];
        delete map[k];
        changed = true;
      });
    }
    moveMap(o.mastered);
    moveMap(o.deletedItems);
    if(o.stats && typeof o.stats === 'object'){
      moveMap(o.stats.bySentence);
      if(Array.isArray(o.stats.events)){
        o.stats.events.forEach(function(e){ if(e && e.key){ e.key = moveKeyToCid(e.key); } });
      }
    }
    return changed;
  }

  /* ★ 口语 8000 合并为 oral-book.js 后的档案 key 迁移（2026-09-15，幂等）。
     映射表 window.BUILTIN_MIGRATION（随 builtins.js 加载）= { 新deckId: [cid, ...] }。
     必须同时兼容三代老 key：
       - `builtin-daily#cid` —— 初版单 deck；
       - `daily-home|social|chat|basic|emotion|work#cid` —— 上一版按 6 场景拆分的 deck。
     覆盖与 migrateCidKeys 相同的四处（mastered / deletedItems / bySentence / events）；
     另加错题本 —— 它的 key 是 `deckId::sentence`，历史 cid 迁移不覆盖，换 deck 后会指向不存在的库。 */
  function migrateToBookDecks(o){
    var map = global.BUILTIN_MIGRATION;
    if(!map) return false;                       /* 迁移表未加载（如旧页面）→ 不动任何数据 */
    var OLD_DECKS = {
      'builtin-daily': 1, 'daily-home': 1, 'daily-social': 1, 'daily-chat': 1,
      'daily-basic': 1, 'daily-emotion': 1, 'daily-work': 1
    };
    /* 惰性反向索引：cid → 新 deckId（只在首次命中时构建一次） */
    var cidToDeck = null;
    function deckOfCid(cid){
      if(!cidToDeck){
        cidToDeck = {};
        for(var id in map){
          if(!map.hasOwnProperty(id)) continue;
          var list = map[id] || [];
          for(var i = 0; i < list.length; i++) cidToDeck[list[i]] = id;
        }
      }
      return cidToDeck[cid] || null;
    }
    /* 只改写「已 cid 化」的老 key（<老deck>#8位hex）；找不到归属就原样保留（不删数据）。
       新 deck id（oral-*）不在 OLD_DECKS 里 → 二次执行无变化，天然幂等。 */
    function remapKey(k){
      if(typeof k !== 'string') return k;
      var sep = k.indexOf('#');
      if(sep <= 0) return k;
      var oldDeck = k.slice(0, sep), cid = k.slice(sep + 1);
      if(!OLD_DECKS[oldDeck]) return k;
      if(!/^[0-9a-f]{8}$/.test(cid)) return k;
      var deck = deckOfCid(cid);
      return deck ? deck + '#' + cid : k;
    }
    var changed = false;
    function moveMap(mapObj){
      if(!mapObj || typeof mapObj !== 'object') return;
      Object.keys(mapObj).forEach(function(k){
        var nk = remapKey(k);
        if(nk === k) return;
        if(!(nk in mapObj)) mapObj[nk] = mapObj[k];
        delete mapObj[k];
        changed = true;
      });
    }
    moveMap(o.mastered);
    moveMap(o.deletedItems);
    if(o.stats && typeof o.stats === 'object'){
      moveMap(o.stats.bySentence);
      if(Array.isArray(o.stats.events)){
        o.stats.events.forEach(function(e){ if(e && e.key){ e.key = remapKey(e.key); } });
      }
    }
    if(Array.isArray(o.reinforceBook)){
      o.reinforceBook.forEach(function(it){
        if(!it || !OLD_DECKS[it.deckId]) return;
        var deck = deckOfCid(fnv8(it.sentence || ''));
        if(!deck) return;
        it.deckId = deck;
        it._key = deck + '::' + (it.sentence || '');
        changed = true;
      });
    }
    return changed;
  }

  /* ---------- 领域：题库 ---------- */
  function masteredKey(deckId, it){ return cidKey(deckId, it); }
  function allDecks(m){ return (m.decks || []).slice(); }
  /* 内置题库只读视图：按 deletedItems 过滤，返回副本（不改写静态 BUILTIN） */
  function builtinDecks(m){
    return (global.BUILTIN || []).map(function(bd){
      var copy = {};
      for(var k in bd){ if(bd.hasOwnProperty(k)) copy[k] = bd[k]; }
      copy.items = (bd.items || []).filter(function(it){ return !isItemDeleted(m, bd.id, it); });
      return copy;
    });
  }
  /* 页面统一取数：内置（过滤后）+ 用户导入。原分散于 main/stats/decks 三处，收敛于此。 */
  function allDecksView(m){ return builtinDecks(m).concat(allDecks(m)); }
  function findDeck(m, deckId){
    for(var i=0; i<m.decks.length; i++) if(m.decks[i].id === deckId) return m.decks[i];
    return null;
  }
  function isMastered(m, deckId, it){
    return !!(m.mastered && m.mastered[masteredKey(deckId, it)]);
  }
  function isFluencyByDeck(m, deckId, it){
    if(!m.stats || !m.stats.bySentence) return false;
    var st = m.stats.bySentence[cidKey(deckId, it)];
    return !!(st && st.okTimes >= 3 && st.streak >= 3);
  }
  function isMarkedForDeck(m, deckId, it){
    return isMastered(m, deckId, it) || isFluencyByDeck(m, deckId, it);
  }
  function classifyStat(s){
    if(!s || !s.times) return 'unseen';
    var acc = s.times ? s.okTimes / s.times : 0;
    if(s.times >= 3 && acc >= 0.8) return 'master';
    if(acc < 0.6) return 'weak';
    return 'learn';
  }

  /* ---------- 打卡 streak（首页今日卡上方紧凑 chip 的数据源） ----------
     daysLog 格式：{ 'YYYY-MM-DD': { rounds: <Number> } }
     数据来源：finishSession 时维护，每完成一整轮练习 +1（用户感知粒度，
     不按提交答案算，避免自纠让"今日次数"看起来虚高）。
     云同步走 stats 整体 LWW（ADR-005），不需要额外 kv。
     demoStatsSample 不写 daysLog（走 stats 内存直接覆盖路径，不经 finishSession），
     故 demo 装入不会污染 streak chip。
     老用户上线首日：daysLog 为空，streak=0 / today=0 → chip 不渲染（不打击）。 */
  function ymd(d){
    var _d = (d instanceof Date) ? d : new Date();
    var pad = function(n){ return n < 10 ? '0'+n : ''+n; };
    return _d.getFullYear() + '-' + pad(_d.getMonth()+1) + '-' + pad(_d.getDate());
  }
  /* 统计审计：统一回答“累计答题”和“按日期活动”为什么可能不同。
     totalAnswered / bySentence.times 是历史累计口径；events 是逐次活动口径。
     events 上线以前的旧答题没有 at，不能安全地分配到某一天，所以这里只报告
     未归档日期的数量，不把它们伪造进日历。事件按 id 去重，与 dailyActivity 保持一致。 */
  function answerStatsAudit(mem){
    var stats = (mem && mem.stats) || {}, by = stats.bySentence || {},
      evs = Array.isArray(stats.events) ? stats.events : [], seen = new Set(),
      sentenceAnswered = 0, eventAnswered = 0, datedAnswered = 0;
    Object.keys(by).forEach(function(key){
      var n = Number(by[key] && by[key].times);
      if(isFinite(n) && n > 0) sentenceAnswered += n;
    });
    evs.forEach(function(ev){
      if(!ev || ev.kind !== 'answer') return;
      if(ev.id && seen.has(ev.id)) return;
      if(ev.id) seen.add(ev.id);
      eventAnswered++;
      if(ev.at && !isNaN(new Date(ev.at).getTime())) datedAnswered++;
    });
    var storedAnswered = Math.max(0, Number(stats.totalAnswered) || 0);
    /* 正常数据三者相等；若某个旧字段缺失，使用仍能证明答题发生过的较大值，
       同时把差异暴露给界面，而不是继续显示一个偏小的累计数。 */
    var totalAnswered = Math.max(storedAnswered, sentenceAnswered, eventAnswered);
    return {
      totalAnswered: totalAnswered,
      storedAnswered: storedAnswered,
      sentenceAnswered: sentenceAnswered,
      eventAnswered: eventAnswered,
      datedAnswered: datedAnswered,
      undatedAnswered: Math.max(0, totalAnswered - datedAnswered),
      legacyAnswered: Math.max(0, totalAnswered - eventAnswered),
      hasMismatch: storedAnswered !== sentenceAnswered || datedAnswered !== totalAnswered
    };
  }
  /* Daily activity derives from durable events; legacy rounds remain a fallback.
     Never infer dates from aggregate totals or a sentence's latest timestamp. */
  function dailyActivity(mem){
    var stats = (mem && mem.stats) || {}, days = {}, seen = new Set();
    Object.keys(stats.daysLog || {}).forEach(function(k){
      days[k] = { answered:0, rounds:Math.max(0, Number((stats.daysLog[k] || {}).rounds) || 0) };
    });
    var rounds = {};
    (Array.isArray(stats.events) ? stats.events : []).forEach(function(ev){
      if(!ev || !ev.at || (ev.kind !== 'answer' && ev.kind !== 'round')) return;
      if(ev.id && seen.has(ev.id)) return;
      var d = new Date(ev.at); if(isNaN(d.getTime())) return;
      if(ev.id) seen.add(ev.id);
      var key = ymd(d), day = days[key] || (days[key] = {answered:0, rounds:0});
      if(ev.kind === 'answer') day.answered++;
      else rounds[key] = (rounds[key] || 0) + 1;
    });
    Object.keys(rounds).forEach(function(k){ days[k].rounds = Math.max(days[k].rounds, rounds[k]); });
    return days;
  }
  function streakDays(mem, now){
    /* 答题事件或历史完成轮次均计为学习日；今天未学则从昨天开始。 */
    var log = dailyActivity(mem);
    var d = (now instanceof Date) ? new Date(now.getTime()) : new Date();
    var n = 0;
    var todayKey = ymd(d);
    var todayR = log[todayKey] && (log[todayKey].answered || log[todayKey].rounds) || 0;
    if(todayR > 0) n++;
    d.setDate(d.getDate() - 1);
    /* 防御：最多回看 3650 天（≈10 年），超出认作断 */
    for(var i = 0; i < 3650; i++){
      var key = ymd(d);
      var r = log[key] && (log[key].answered || log[key].rounds) || 0;
      if(r > 0) n++;
      else break;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }
  function todayRounds(mem, now){
    var log = (mem && mem.stats && mem.stats.daysLog) || {};
    var d = (now instanceof Date) ? now : new Date();
    return (log[ymd(d)] && log[ymd(d)].rounds) || 0;
  }
  /* 写入帮手（main.html 的 finishSession 调一次；不放在 core.js 内部是因为 scheduleCloudSync
     触发需与现有主流程一致——放 main 里能直接复用 saveStore）。 */
  function bumpDaysLog(mem, now){
    if(!mem.stats) mem.stats = { totalRounds:0, totalAnswered:0, bySentence:{}, events:[], daysLog:{} };
    if(!mem.stats.daysLog) mem.stats.daysLog = {};
    var d = (now instanceof Date) ? now : new Date();
    var key = ymd(d);
    var slot = mem.stats.daysLog[key] || { rounds: 0 };
    slot.rounds = (Number(slot.rounds) || 0) + 1;
    mem.stats.daysLog[key] = slot;
    return slot.rounds;
  }
  /* 一次性历史回填：daysLog 为空 + events 非空 → 按 events.at 分组回填 daysLog
     根因（2026-09-09）：用户 12:20 已练题但 daysLog 还是空 —— 那时 streak 功能还没上线，
     finishSession 没经过 bumpDaysLog；events 数组却忠实地记录了所有 round 时刻。回填是
     一次性数据收敛，不重复（daysLog 已有任何 key 即跳过）。 */
  function backfillDaysLog(mem){
    if(!mem || !mem.stats) return 0;
    var evs = Array.isArray(mem.stats.events) ? mem.stats.events : [];
    if(!evs.length) return 0;
    if(!mem.stats.daysLog || typeof mem.stats.daysLog !== 'object') mem.stats.daysLog = {};
    if(Object.keys(mem.stats.daysLog).length > 0) return 0;
    var counts = {};
    for(var i=0;i<evs.length;i++){
      var ev = evs[i];
      if(!ev || ev.kind !== 'round' || !ev.at) continue;
      var d = new Date(ev.at);
      if(isNaN(d.getTime())) continue;
      var key = ymd(d);
      counts[key] = (counts[key] || 0) + 1;
    }
    var n = 0;
    Object.keys(counts).forEach(function(k){
      mem.stats.daysLog[k] = { rounds: counts[k] };
      n++;
    });
    return n;
  }

  /* ---------- 示例统计（demo stats，2026-09-09 老板批准：stats 空态主动装入） ----------
     只生成 stats 纯计数（bySentence / totalAnswered / totalRounds），
     绝不写 mastered / reinforceBook —— 练习队列与错题复习流零影响。
     示例句全部取自真实题库（cid 对齐：句子恒为真，仅计数为演示值），
     删除/清空句子后对应统计自动随 deletedItems 过滤消失。
     本函数是纯函数（不读写存储），由调用方在「全空态」才暴露入口。 */
  var DEMO_STAT_TEMPLATES = [
    /* master 形态 ×3（times>=3 且 acc>=0.8） */
    { times:6, ok:5, w:1, streak:4, ms:6, day:0 },
    { times:5, ok:5, w:0, streak:5, ms:5, day:1 },
    { times:8, ok:7, w:1, streak:6, ms:8, day:2 },
    /* learn 形态 ×7 */
    { times:3, ok:2, w:1, streak:2, ms:3, day:0 },
    { times:4, ok:3, w:1, streak:2, ms:3, day:1 },
    { times:2, ok:2, w:0, streak:2, ms:2, day:1 },
    { times:5, ok:3, w:2, streak:2, ms:4, day:2 },
    { times:7, ok:5, w:2, streak:3, ms:5, day:3 },
    { times:2, ok:2, w:0, streak:1, ms:2, day:4 },
    { times:4, ok:3, w:1, streak:3, ms:4, day:5 },
    /* weak 形态 ×2（acc<0.6） */
    { times:6, ok:2, w:4, streak:1, ms:2, day:2 },
    { times:4, ok:1, w:3, streak:1, ms:1, day:6 }
  ];
  function demoStatsSample(decksList){
    var decks = Array.isArray(decksList) ? decksList : [];
    var flat = [];
    decks.forEach(function(d){
      if(!d || !d.id || !Array.isArray(d.items) || !d.items.length) return;
      var name = d.name || '';
      d.items.forEach(function(it){
        if(!it || !it.sentence) return;
        flat.push({ dId: d.id, name: name, it: it });
      });
    });
    var total = DEMO_STAT_TEMPLATES.length;
    var n = Math.min(flat.length, total);
    if(n < 3) return null; /* 题库可练句太少：示例意义不大，直接练真句 */
    var by = {}, answered = 0;
    /* 线性插值采样：从题库首尾均匀取 n 句（覆盖更广，演示形态更真实） */
    var span = Math.max(1, flat.length - 1);
    for(var i = 0; i < n; i++){
      var tpl = DEMO_STAT_TEMPLATES[i];
      var src = flat[Math.round(i * span / (n - 1))];
      var key = cidKey(src.dId, src.it);
      if(by[key]) continue; /* 防御：采样撞同一句时跳过 */
      var lastAt = Date.now() - tpl.day * 86400000 - (2 + ((i * 37) % 540)) * 60000;
      /* 去冗余（2026-09-10）：不写 deckName/translation（展示冗余，可重建）。 */
      by[key] = {
        deckId: src.dId,
        sentence: src.it.sentence || '',
        times: tpl.times, okTimes: tpl.ok, wrongTimes: tpl.w,
        streak: tpl.streak, maxStreak: tpl.ms,
        lastAt: lastAt, interval: Math.max(1, tpl.day + 1), ease: 2.5,
        dueAt: lastAt + (tpl.day + 1) * 86400000
      };
      answered += tpl.times;
    }
    if(!Object.keys(by).length) return null;
    return { rounds: 3, answered: answered, bySentence: by };
  }

  /* ---------- 内置题删除（override 机制） ----------
     内置题库来自静态 oral-book.js（构建期唯一内容源）与 freq-idioms.js；运行时经
     content/manifest.json + 分片读取，页面不直接加载这两个大文件。不可被改写。
     删除内置单句 = 在 deletedItems 里登记 key，列表/练习时过滤掉。
     key 与 masteredKey / stats.bySentence 同构：deckId#cid（与原文解耦）。 */
  function itemKey(deckId, it){ return cidKey(deckId, it); }
  function isItemDeleted(m, deckId, it){
    return !!(m && m.deletedItems && m.deletedItems[itemKey(deckId, it)]);
  }
  function deleteItem(m, deckId, it){
    m.deletedItems = m.deletedItems || {};
    m.deletedItems[itemKey(deckId, it)] = true;
  }
  /* 返回题库的「有效句子」：内置题库按 deletedItems 过滤；导入题库原样 */
  function deckItems(deck, m){
    if(!deck || !deck.builtin) return (deck && deck.items) || [];
    return (deck.items || []).filter(function(it){ return !isItemDeleted(m, deck.id, it); });
  }
  /* ★ 统计某 deck 在 deletedItems 里的隐藏条数（用于 decks.html 给用户可观察性）
     - 内置 deck：实际从 BUILTIN 取原句集，过滤后对比差值
     - 导入 deck：deletedItems 现存 key 数（仍以 cid 为键，与原句对照） */
  function hiddenCount(deck, m){
    if(!deck || !m || !m.deletedItems) return 0;
    var deckId = deck.id;
    var prefix = deckId + '#';
    var keys = Object.keys(m.deletedItems).filter(function(k){ return k.indexOf(prefix) === 0; });
    return keys.length;
  }
  /* ★ 恢复某 deck 全部已删除内置句（清空 m.deletedItems 里 deckId# 的所有 key）
     返回实际清除的条数。导入 deck 由于原句变更风险，默认 NOOP 并返回 0。 */
  function restoreAllDeleted(m, deck){
    if(!m || !m.deletedItems) return 0;
    if(!deck || !deck.builtin) return 0; /* 导入 deck 不支持全量恢复（cid 不在静态集中） */
    var deckId = deck.id;
    var prefix = deckId + '#';
    var n = 0;
    Object.keys(m.deletedItems).forEach(function(k){
      if(k.indexOf(prefix) === 0){ delete m.deletedItems[k]; n++; }
    });
    return n;
  }

  /* ---------- 事件总线 + 跨页通信 ---------- */
  function on(type, fn){
    (LISTENERS[type] = LISTENERS[type] || []).push(fn);
    return function off(){ LISTENERS[type] = LISTENERS[type].filter(function(f){ return f !== fn; }); };
  }
  function emit(type, payload){
    (LISTENERS[type] || []).slice().forEach(function(fn){ try{ fn(payload); }catch(e){} });
  }
  /* 通知父窗口启动练习 / 返回 */
  function startReviewDeck(deck){
    if(global.parent && global.parent !== global){
      try{ global.parent.postMessage({ type:'startDeck', deck:deck }, '*'); }catch(e){}
    }
  }
  function goBack(){
    if(global.parent && global.parent !== global){
      try{ global.parent.postMessage({ type:'goBack' }, '*'); }catch(e){}
    }
  }

  /* ---------- 导出 ---------- */
  global.CL = {
    STORE_KEY: STORE_KEY,
    store: { CURRENT_VERSION: CURRENT_VERSION, MIGRATIONS: MIGRATIONS, migrate: migrate, defaultMem: defaultMem },
    loadMem: loadMem,
    saveMem: saveMem,
    saveAndNotify: saveAndNotify,
    lastSave: function(){ return _lastSavePromise; },
    $: $, esc: esc, norm: norm, normSent: normSent, timeAgo: timeAgo, copyText: copyText,
    masteredKey: masteredKey, allDecks: allDecks, allDecksView: allDecksView, builtinDecks: builtinDecks, findDeck: findDeck,
    deckItems: deckItems, hiddenCount: hiddenCount, restoreAllDeleted: restoreAllDeleted,
    isMastered: isMastered, isFluencyByDeck: isFluencyByDeck, isMarkedForDeck: isMarkedForDeck,
    classifyStat: classifyStat,
    demoStatsSample: demoStatsSample,
    mergeStats: mergeStats,
    ymd: ymd, answerStatsAudit: answerStatsAudit, dailyActivity: dailyActivity, streakDays: streakDays, todayRounds: todayRounds, bumpDaysLog: bumpDaysLog,
    backfillDaysLog: backfillDaysLog,
    itemKey: itemKey, isItemDeleted: isItemDeleted, deleteItem: deleteItem, deckItems: deckItems,
    fnv8: fnv8, cidOf: cidOf, cidKey: cidKey, migrateCidKeys: migrateCidKeys, moveKeyToCid: moveKeyToCid,
    on: on, emit: emit,
    scheduleCloudSync: scheduleCloudSync, cloudSyncNow: cloudSyncNow,
    syncFromCloud: syncFromCloud, ensureCloud: ensureCloud,
    isDirty: function(){ return _dirty; },
    getSyncConflict: function(){ return _syncConflict; },
    readSyncLocal: readSyncLocal, readSyncSnapshot: readSyncSnapshot, applySyncResolution: applySyncResolution,
    applySyncBatchResolution: applySyncBatchResolution,
    setResolutionPaused: setResolutionPaused,
    waitForSync: function(){ return Promise.all([_cloudInFlight, _courseDrain, _courseWriteTail, _progressWriteTail, _statsWriteTail]); },
    /* stats 大对象的持久化托管模式：'idb' = 已分层（localStorage 只留小字段）；'local' = 旧行为 */
    statsStoreMode: function(){ return _statsStore; },
    getCloudConfig: function(){ return _cloudConfig; },
    preload: preload,
    readCourses: function(){ return cloneJSON(readCoursesRaw()); },
    readProgress: function(){ return cloneJSON(readProgressRaw()); },
    writeCourses: writeCourses, writeProgress: writeProgress,
    COURSES_KEY: COURSES_KEY, PROGRESS_KEY: PROGRESS_KEY,
    startReviewDeck: startReviewDeck, goBack: goBack,
    /* 多标签页旧快照防护（P0）：tabId / 采纳磁盘最新态 / 诊断计数。
       页面用 CL.on('memExternal') 感知「其他标签页有新写入」，
       用 CL.on('memMerged') 感知「本次写入触发了三路合并」。 */
    tabId: TAB_ID,
    TAB_SYNC_KEY: TAB_SYNC_KEY,
    refreshExternal: refreshExternal,
    crossTabState: function(){
      return { tabId: TAB_ID, merges: _crossTabMerges, external: _externalSeq };
    }
  };
  /* 内部实现暴露给单测（不作为稳定 API）：三路合并语义的纯函数部分 */
  global.CL.__crossTab = {
    mergeKeyedMap: mergeKeyedMap,
    mergeMemInto: mergeMemInto,
    mergeStatsForTabs: mergeStatsForTabs,
    mergeDaysLogTabs: mergeDaysLogTabs,
    parseLocalMem: parseLocalMem
  };
})(window);
