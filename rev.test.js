/**
 * rev.test.js · 前端 rev 维护单测（ADR-005 本地侧 + step 2 courses/progress）
 *
 * 验证 core.js：
 *   - maintainRevs（saveMem 内触发）：新增/修改/删除实体自动升 rev，kv 变更升 rev、未变不 bump
 *   - maintainCoursesRevs（cloudSyncNow 内触发）：courses / courseProgress 惰性 diff 维护 rev
 *   - syncFromCloud：per-entity LWW 合并采纳远程 rev（含修复：合并后本地 revs 同步对齐，不误 bump）
 * 用最小 localStorage mock + mock ChunkAPI 在 Node 直跑，不依赖浏览器。
 *
 * 运行：node rev.test.js
 */
'use strict';

var store = {};
global.window = global;
global.localStorage = {
  getItem: function (k) { return (k in store) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; }
};

var remoteData = {};
var lastPayloads = [];
global.ChunkAPI = {
  getConfig: function () { return Promise.resolve({ requireAuth: false }); },
  getData: function () { return Promise.resolve(remoteData); },
  putData: function (p) { lastPayloads.push(JSON.parse(JSON.stringify(p))); return Promise.resolve({ ok: true }); },
  isLoggedIn: function () { return false; }
};

require('./core.js');
var CL = global.CL;

var passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}
function getRevs() { try { return JSON.parse(store['chunklab_revs_v1'] || '{}'); } catch (e) { return {}; } }

async function main() {
  var m = CL.loadMem();

  /* 0. 统计事件合并：两台设备从同一基线各完成一次练习，合并后不能丢一条。 */
  var mergedStats = CL.mergeStats(
    { totalRounds: 2, totalAnswered: 6, bySentence: { 'd1#S': { deckId: 'd1', sentence: 'S', times: 6, okTimes: 5, wrongTimes: 1, lastAt: 100 } },
      events: [{ id: 'a', kind: 'answer', key: 'd1#S', deckId: 'd1', sentence: 'S', ok: true, at: 100 }, { id: 'ra', kind: 'round', at: 110 }] },
    { totalRounds: 2, totalAnswered: 6, bySentence: { 'd1#S': { deckId: 'd1', sentence: 'S', times: 6, okTimes: 4, wrongTimes: 2, lastAt: 200 } },
      events: [{ id: 'b', kind: 'answer', key: 'd1#S', deckId: 'd1', sentence: 'S', ok: false, at: 200 }, { id: 'rb', kind: 'round', at: 210 }] }
  );
  check('stats: 双设备各练一次后累计次数为 7', mergedStats.totalAnswered === 7, JSON.stringify(mergedStats));
  check('stats: 双设备合并保留正确/错误次数', mergedStats.bySentence['d1#S'].times === 7 && mergedStats.bySentence['d1#S'].okTimes === 5 && mergedStats.bySentence['d1#S'].wrongTimes === 2, JSON.stringify(mergedStats.bySentence['d1#S']));
  check('stats: 双设备合并轮次为 3', mergedStats.totalRounds === 3, JSON.stringify(mergedStats));
  var oldAndNew = CL.mergeStats(
    { totalRounds: 5, totalAnswered: 20, bySentence: { 'd1#S': { deckId: 'd1', sentence: 'S', times: 20, okTimes: 18, wrongTimes: 2, lastAt: 100 } }, events: [] },
    { totalRounds: 1, totalAnswered: 1, bySentence: { 'd1#S': { deckId: 'd1', sentence: 'S', times: 1, okTimes: 1, wrongTimes: 0, lastAt: 200 } }, events: [{ id: 'new-device', kind: 'answer', key: 'd1#S', deckId: 'd1', sentence: 'S', ok: true, at: 200 }] }
  );
  check('stats: 老设备历史 + 新设备一次练习不丢旧次数', oldAndNew.totalAnswered === 21 && oldAndNew.bySentence['d1#S'].times === 21, JSON.stringify(oldAndNew));

  /* ★ 回归（2026-09-09）：mergeStats 曾丢 daysLog —— 云同步合并回写后连续打卡清零。
     修复后：按天合并，rounds 取两侧较大值。 */
  var daysMerged = CL.mergeStats(
    { totalRounds: 1, totalAnswered: 3, bySentence: {}, events: [], daysLog: { '2026-09-08': { rounds: 2 }, '2026-09-09': { rounds: 5 } } },
    { totalRounds: 1, totalAnswered: 2, bySentence: {}, events: [], daysLog: { '2026-09-09': { rounds: 3 }, '2026-09-07': { rounds: 1 } } }
  );
  check('stats: daysLog 合并不丢任一天', daysMerged.daysLog && daysMerged.daysLog['2026-09-08'] && daysMerged.daysLog['2026-09-07'], JSON.stringify(daysMerged.daysLog));
  check('stats: daysLog 同日取较大 rounds（9-09 = 5）', daysMerged.daysLog['2026-09-09'].rounds === 5, JSON.stringify(daysMerged.daysLog));
  check('stats: daysLog 单侧保留（9-08 = 2 / 9-07 = 1）', daysMerged.daysLog['2026-09-08'].rounds === 2 && daysMerged.daysLog['2026-09-07'].rounds === 1, JSON.stringify(daysMerged.daysLog));
  var noDays = CL.mergeStats({ totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] }, { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] });
  check('stats: 双侧无 daysLog → 合并结果 daysLog 为空对象', noDays.daysLog && Object.keys(noDays.daysLog).length === 0, JSON.stringify(noDays.daysLog));

  /* ★ 回归（2026-09-10）：mergeStats 重写为 O(n+m) 单遍索引，以下四条锁住原实现的边界语义。
     重写动机：原实现每个 bySentence key 都 filter 一遍全量 events，8000 句实测 12.2s。 */
  /* 1) 幂等：合并结果再与自己合并必须逐字节稳定 —— 否则每次启动同步都会造出新 rev / 反复上行。 */
  var idem = CL.mergeStats(mergedStats, mergedStats);
  check('stats: mergeStats 幂等（m,m 结果不变）',
    JSON.stringify(idem) === JSON.stringify(mergedStats),
    'totals=' + idem.totalAnswered + '/' + mergedStats.totalAnswered);
  /* 2) 无 id 的事件无法去重 → 并集为空 → 走「旧聚合取较大值」分支。
     这里锁的是「宁可少算也不重复计数」的保守口径（应用自身始终写 id，此分支只服务老数据）。 */
  var noId = CL.mergeStats(
    { totalRounds: 0, totalAnswered: 5, bySentence: {}, events: [{ kind: 'answer', key: 'd#1', ok: true }, { kind: 'answer', key: 'd#1', ok: true }] },
    { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] }
  );
  check('stats: 无 id 事件 → 并集为空走旧聚合分支（max(5,0)=5）', noId.totalAnswered === 5, 'got=' + noId.totalAnswered);
  /* 2b) ★ 回归（2026-09-10）：okTimes 合并必须只减「本侧 ok 事件数」。
     本用例两侧各有 1 ok + 1 wrong 事件，旧实现会每次合并多减 1 → okTimes 从 5 掉到 4。 */
  var okDrift = CL.mergeStats(
    { totalRounds: 1, totalAnswered: 5, bySentence: { 'd#k': { times: 5, okTimes: 3, wrongTimes: 2, lastAt: 100 } },
      events: [{ id: 'o1', kind: 'answer', key: 'd#k', ok: true, at: 90 }, { id: 'w1', kind: 'answer', key: 'd#k', ok: false, at: 100 }] },
    { totalRounds: 1, totalAnswered: 5, bySentence: {}, events: [] }
  );
  check('stats: okTimes 不因合并被多减（3 保持 3，times/wrong 同步守恒）',
    okDrift.bySentence['d#k'].okTimes === 3 && okDrift.bySentence['d#k'].wrongTimes === 2 && okDrift.bySentence['d#k'].times === 5,
    JSON.stringify(okDrift.bySentence['d#k']));
  /* 3) 只出现在 events、不在任何一侧 bySentence 里的 key → 不凭空造出 bySentence 记录。 */
  var ghost = CL.mergeStats(
    { totalRounds: 0, totalAnswered: 1, bySentence: {}, events: [{ id: 'g1', kind: 'answer', key: 'd#ghost', ok: true, at: 1 }] },
    { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] }
  );
  check('stats: events-only key 不进入 bySentence', Object.keys(ghost.bySentence).length === 0, JSON.stringify(ghost.bySentence));
  /* 4) 并集事件按 id 全序去重排序（乱序输入 → 稳定输出），同 id 出现两次只留一条。 */
  var sorted = CL.mergeStats(
    { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [{ id: 'zz', kind: 'round', at: 3 }, { id: 'aa', kind: 'round', at: 1 }] },
    { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [{ id: 'mm', kind: 'round', at: 2 }, { id: 'aa', kind: 'round', at: 1 }] }
  );
  check('stats: 并集事件去重后按 id 升序',
    sorted.events.map(function (e) { return e.id; }).join(',') === 'aa,mm,zz' && sorted.totalRounds === 3,
    'ids=' + sorted.events.map(function (e) { return e.id; }).join(',') + ' rounds=' + sorted.totalRounds);

  // 1. 新增 deck → rev=1
  m.decks = [{ id: 'd1', name: 'A', items: [{ sent: 'a' }], builtin: false }];
  CL.saveMem(m);
  var revs = getRevs();
  check('rev: 新增 deck d1 → rev=1', revs.decks && revs.decks.d1 === 1, 'revs=' + JSON.stringify(revs));

  // 2. 改 deck → rev 递增到 2
  m.decks[0].name = 'A2';
  CL.saveMem(m);
  revs = getRevs();
  check('rev: 修改 deck d1 → rev=2', revs.decks.d1 === 2, 'rev=' + revs.decks.d1);

  // 3. 删除 deck → rev 递增（软删标记），本地不再含 d1
  m.decks = [];
  CL.saveMem(m);
  revs = getRevs();
  check('rev: 删除 deck d1 → rev 递增且本地移除',
    revs.decks.d1 === 3 && CL.loadMem().decks.length === 0,
    'rev=' + revs.decks.d1 + ' decks=' + CL.loadMem().decks.length);

  // 4. kv 变更 → rev 递增
  var b4 = getRevs().kv.best;
  m.best = { s1: 5 };
  CL.saveMem(m);
  var a4 = getRevs().kv.best;
  check('rev: kv.best 变更 → rev 递增', a4 === b4 + 1, 'before=' + b4 + ' after=' + a4);

  // 5. kv 未变 → rev 不递增（避免误 bump）
  var b5 = getRevs().kv.best;
  m.best = { s1: 5 };
  CL.saveMem(m);
  var a5 = getRevs().kv.best;
  check('rev: kv.best 未变 → rev 不递增', a5 === b5, 'before=' + b5 + ' after=' + a5);

  /* ===== ADR-005 step 2：courses / courseProgress（cloudSyncNow 惰性 diff） =====
     大对象已迁 IndexedDB 内存桥：写入走 CL.writeCourses/writeProgress（真实调用路径）。 */
  await CL.ensureCloud();

  // 6. 新增 course → rev=1 且上行 payload 携带
  CL.writeCourses([{ courseId: 'cA', title: 'A' }]);
  await CL.cloudSyncNow(CL.loadMem());
  revs = getRevs();
  check('s2: 新增 course cA → rev=1', revs.courses && revs.courses.cA === 1, 'revs=' + JSON.stringify(revs.courses));
  var pl = lastPayloads[lastPayloads.length - 1];
  check('s2: 上行 payload 含 revs.courses.cA=1', pl.revs.courses.cA === 1, 'revs=' + JSON.stringify(pl.revs));

  // 7. 修改 course → rev=2
  CL.writeCourses([{ courseId: 'cA', title: 'A2' }]);
  await CL.cloudSyncNow(CL.loadMem());
  revs = getRevs();
  check('s2: 修改 course cA → rev=2', revs.courses.cA === 2, 'rev=' + revs.courses.cA);

  // 8. 删除 course → rev 递增 + deleted 登记
  CL.writeCourses([]);
  await CL.cloudSyncNow(CL.loadMem());
  revs = getRevs();
  pl = lastPayloads[lastPayloads.length - 1];
  check('s2: 删除 course cA → rev=3 且 deleted 登记',
    revs.courses.cA === 3 && pl.deleted.courses.some(function (d) { return d.id === 'cA' && d.rev === 3; }),
    'rev=' + revs.courses.cA + ' del=' + JSON.stringify(pl.deleted.courses));

  // 9. courseProgress 新增/修改
  CL.writeProgress({ pA: { done: 1 } });
  await CL.cloudSyncNow(CL.loadMem());
  revs = getRevs();
  check('s2: 新增 progress pA → rev=1', revs.courseProgress && revs.courseProgress.pA === 1, 'revs=' + JSON.stringify(revs.courseProgress));
  CL.writeProgress({ pA: { done: 2 } });
  await CL.cloudSyncNow(CL.loadMem());
  revs = getRevs();
  check('s2: 修改 progress pA → rev=2', revs.courseProgress.pA === 2, 'rev=' + revs.courseProgress.pA);

  // 10. courseProgress 未变 → 不 bump
  var b10 = getRevs().courseProgress.pA;
  CL.writeProgress({ pA: { done: 2 } });
  await CL.cloudSyncNow(CL.loadMem());
  check('s2: progress 未变 → rev 不递增', getRevs().courseProgress.pA === b10, 'before=' + b10 + ' after=' + getRevs().courseProgress.pA);

  // 10b. preload 防丢课：IDB 与旧 localStorage 同时有数据时按 courseId 合并
  var unionCourseWrites = null;
  global.IDBStore = {
    loadAll: function () { return Promise.resolve({
      courses: [{ courseId: 'cSame', title: 'IDB 版本' }],
      courseProgress: { cSame: { seen: ['n1'] } }
    }); },
    putCourses: function (l) { unionCourseWrites = l.slice(); return Promise.resolve(); },
    putProgress: function () { return Promise.resolve(); }
  };
  store['chunklab.courses.v1'] = JSON.stringify([
    { courseId: 'cSame', title: '旧版本' },
    { courseId: 'cLocal', title: '迁移前课程' }
  ]);
  store['chunklab.course-progress.v1'] = JSON.stringify({ cLocal: { seen: ['n0'] } });
  delete require.cache[require.resolve('./core.js')];
  require('./core.js');
  CL = global.CL;
  await CL.preload();
  check('s2: IDB 与旧缓存并存时不丢课程',
    CL.readCourses().length === 2 && CL.readCourses().some(function (c) { return c.courseId === 'cLocal'; }),
    'courses=' + JSON.stringify(CL.readCourses()));
  check('s2: 同 courseId 以 IDB 版本为准',
    CL.readCourses().some(function (c) { return c.courseId === 'cSame' && c.title === 'IDB 版本'; }),
    'courses=' + JSON.stringify(CL.readCourses()));
  check('s2: 课程合并结果回写 IDB',
    unionCourseWrites && unionCourseWrites.length === 2,
    'writes=' + JSON.stringify(unionCourseWrites));
  check('s2: 课程进度并集不丢记录',
    CL.readProgress().cSame && CL.readProgress().cLocal,
    'progress=' + JSON.stringify(CL.readProgress()));

  // 10c. preload 迁移：localStorage 大键 → IDB → 删键（mock IDBStore；重载 core.js 模拟冷启动，内存未预载）
  var migrated = false;
  global.IDBStore = {
    loadAll: function () { return Promise.resolve({ courses: [], courseProgress: {} }); },
    putCourses: function (l) { migrated = true; return Promise.resolve(); },
    putProgress: function () { return Promise.resolve(); }
  };
  delete require.cache[require.resolve('./core.js')];
  require('./core.js');
  CL = global.CL;
  store['chunklab.courses.v1'] = JSON.stringify([{ courseId: 'legacy', title: 'L' }]);
  await CL.preload();
  check('s2: preload 迁移 localStorage → IDB 并删大键',
    migrated === true && !('chunklab.courses.v1' in store) && !('chunklab.course-progress.v1' in store),
    'migrated=' + migrated + ' hasKey=' + ('chunklab.courses.v1' in store));
  delete global.IDBStore;
  await CL.ensureCloud(); /* 重载后的新实例：重新启用云同步（remoteData 暂为空，无副作用） */

  /* ===== syncFromCloud 合并：采纳远程 rev（含修复：合并后本地 revs 对齐） ===== */
  // 11. 远程 rev 更高 → 本地采纳，且本地 revs 同步对齐（修 bug：此前不写回 localRevs，首拉后本地修改被服务端拒绝）
  remoteData = {
    mem: {
      decks: [{ id: 'r1', name: 'R', items: [], builtin: false }], best: {}, mastered: {},
      stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} }, settings: {}, reinforceBook: [], deletedItems: []
    },
    courses: [{ courseId: 'rc', title: 'Remote' }],
    courseProgress: { rp: { done: 9 } },
    revs: { decks: { r1: 5 }, kv: {}, courses: { rc: 7 }, courseProgress: { rp: 8 } }
  };
  await CL.syncFromCloud();
  revs = getRevs();
  check('s2: 合并后本地 revs 采纳远程 decks rev', revs.decks.r1 === 5, 'rev=' + revs.decks.r1);
  check('s2: 合并后本地 revs 采纳远程 courses rev', revs.courses.rc === 7, 'rev=' + revs.courses.rc);
  check('s2: 合并后本地 revs 采纳远程 progress rev', revs.courseProgress.rp === 8, 'rev=' + revs.courseProgress.rp);
  check('s2: 合并后本地 courses 含远程课程',
    CL.readCourses().some(function (c) { return c.courseId === 'rc'; }), '');
  check('s2: 合并后本地 progress 含远程进度',
    CL.readProgress().rp && CL.readProgress().rp.done === 9, '');

  // 12. 合并后立即上行 → 不误 bump（已采纳 rev 应保持原值）
  await CL.cloudSyncNow(CL.loadMem());
  pl = lastPayloads[lastPayloads.length - 1];
  check('s2: 合并后上行不误 bump courses rev（仍 7）', pl.revs.courses.rc === 7, 'rev=' + pl.revs.courses.rc);
  check('s2: 合并后上行不误 bump decks rev（仍 5）', pl.revs.decks.r1 === 5, 'rev=' + pl.revs.decks.r1);

  /* ===== 离线 change-log（轻量版）：dirty 标志 + 重连补传 ===== */
  // 13. scheduleCloudSync 置 dirty；同步成功清位；syncStatus 事件发出
  var syncEvents = [];
  var offSync = CL.on('syncStatus', function (st) { syncEvents.push(!!st.dirty); });
  CL.scheduleCloudSync(CL.loadMem());
  check('offline: scheduleCloudSync 置 dirty', CL.isDirty() === true, 'dirty=' + CL.isDirty());
  await CL.cloudSyncNow(CL.loadMem());
  check('offline: 同步成功清除 dirty', CL.isDirty() === false, 'dirty=' + CL.isDirty());
  check('offline: syncStatus 事件（置位→清位）', syncEvents.length >= 2 && syncEvents[0] === true && syncEvents[syncEvents.length - 1] === false, JSON.stringify(syncEvents));
  offSync();

  // 14. 同步失败 → dirty 保持；重连拉取（syncFromCloud）成功后自动补传 push
  var origPut = global.ChunkAPI.putData;
  var failOnce = true;
  global.ChunkAPI.putData = function (p) {
    lastPayloads.push(JSON.parse(JSON.stringify(p)));
    if (failOnce) { failOnce = false; return Promise.reject(new Error('offline')); }
    return Promise.resolve({ ok: true });
  };
  CL.scheduleCloudSync(CL.loadMem());
  check('offline: 离线保存置 dirty', CL.isDirty() === true, 'dirty=' + CL.isDirty());
  await CL.cloudSyncNow(CL.loadMem());
  check('offline: 同步失败保持 dirty', CL.isDirty() === true, 'dirty=' + CL.isDirty());
  var before = lastPayloads.length;
  remoteData = {};                       /* 模拟重连后拉取（空数据，合并无副作用） */
  await CL.syncFromCloud();
  await new Promise(function (r) { setTimeout(r, 60); }); /* 等待补传异步完成 */
  check('offline: 重连拉取后自动补传 push', lastPayloads.length > before, 'before=' + before + ' after=' + lastPayloads.length);
  check('offline: 补传后 dirty 清除', CL.isDirty() === false, 'dirty=' + CL.isDirty());
  global.ChunkAPI.putData = origPut;

  console.log('\n[rev.test] passed=' + passed + ' failed=' + failed);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(function (err) {
  console.error('[rev.test] ERROR: ' + (err && err.stack || err));
  process.exit(1);
});
