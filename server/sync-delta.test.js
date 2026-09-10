/**
 * sync-delta.test.js · 增量同步协议测试（2026-09-10，8000 句扩容）
 *
 * 背景：`stats.bySentence` / `stats.events` 原先塞在 user_kv 的 k='stats' 单行 blob 里，
 * 使单条 kv 占掉 86.8% 的同步体积（8000 句实测 7191KB/次），而 PUT 是热路径（每答一题）
 * → 每答一题重传整份学习档案。拆成 user_sentence_stats / user_events 行表后
 * 客户端只上行变更行（~0.5KB）。
 *
 * 覆盖：
 *   A/B  新协议 statsDelta 增量上行与累加
 *   C    sbsGone 软删除
 *   D    旧客户端仍发整份 mem.stats.bySentence/events → 兼容且不丢
 *   E    stats blob 不再承载大对象（否则拆表等于白做）
 *   F    行表写入是 UPSERT，不会误删「其他设备有而本次没发」的条目
 *   G    启动迁移：旧 blob → 行表，且幂等
 *
 * 运行：node sync-delta.test.js   （退出码 0 = 全绿）
 */
'use strict';

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SERVER_DIR = __dirname;
const PORT = 8813;
const BASE = 'http://127.0.0.1:' + PORT;
const TMP_DB = path.join(os.tmpdir(), 'chunklab-syncdelta-' + Date.now());
const DB_FILE = path.join(TMP_DB, 'chunklab.db');

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}

function request(method, p, token, body) {
  return new Promise(function (resolve, reject) {
    const data = body ? JSON.stringify(body) : null;
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (data) headers['Content-Type'] = 'application/json';
    const req = http.request({ hostname: '127.0.0.1', port: PORT, path: p, method: method, headers: headers }, function (res) {
      let raw = '';
      res.on('data', function (c) { raw += c; });
      res.on('end', function () {
        let json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch (e) { /* 非 JSON */ }
        resolve({ status: res.statusCode, json: json, raw: raw });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function waitHealth(timeoutMs) {
  const start = Date.now();
  return new Promise(function (resolve, reject) {
    (function tick() {
      request('GET', '/api/health').then(function (r) {
        if (r.status === 200 && r.json && r.json.ok) return resolve();
        if (Date.now() - start > timeoutMs) return reject(new Error('server not healthy'));
        setTimeout(tick, 200);
      }).catch(function () {
        if (Date.now() - start > timeoutMs) return reject(new Error('server not healthy'));
        setTimeout(tick, 200);
      });
    })();
  });
}

const childEnv = Object.assign({}, process.env, {
  REQUIRE_AUTH: 'true',
  JWT_SECRET: 'sync-delta-test-secret-not-for-production',
  TOKEN_TTL: '30d',
  PORT: String(PORT),
  CHUNKLAB_DATA_DIR: TMP_DB
});

let child = null;
function startServer() {
  child = spawn(process.execPath, ['index.js'], { cwd: SERVER_DIR, env: childEnv, stdio: ['ignore', 'ignore', 'inherit'] });
  return waitHealth(15000);
}
function stopServer() {
  return new Promise(function (resolve) {
    if (!child) return resolve();
    const c = child; child = null;
    c.on('exit', function () { setTimeout(resolve, 400); });
    try { c.kill('SIGKILL'); } catch (e) { resolve(); }
  });
}

/* 真实形状的句子档案（字段与 main.html recordSentenceResult 对齐） */
function sbsSample(times) {
  return {
    deckId: 'd1', deckName: 'Deck One', sentence: 'I have a dream.', translation: '我有一个梦想。',
    times: times, okTimes: times, wrongTimes: 0, streak: times, maxStreak: times,
    lastAt: 1700000000000, interval: 4, ease: 2.5, dueAt: 1700003600000, repetition: 2
  };
}
function evSample(id) {
  return { id: id, kind: 'answer', key: 'd1#aaaaaaaa', deckId: 'd1', sentence: 'I have a dream.', ok: true, at: 1700000000000 };
}
/* mastered 值形状（main.html:2693 写入）：{ deckId, sentence, markedAt } */
function masteredSample(deckId, markedAt) {
  return { deckId: deckId, sentence: 'I have a dream.', markedAt: markedAt };
}
/* 错题本元素形状（main.html:1641 写入）：整题快照，主键是 _key */
function reinforceSample(key) {
  return {
    _key: key, deckId: 'd1', deckName: 'Deck One', addedAt: '2026-09-10 12:00:00',
    sentence: 'I have a dream.', translation: '我有一个梦想。',
    chunks: ['I', 'have', 'a dream'], hints: [], grammar: null, mistakes: []
  };
}

function openDb() {
  const Database = require('better-sqlite3');
  return new Database(DB_FILE);
}

(async function main() {
  console.log('[sync-delta] temp DB: ' + TMP_DB);
  await startServer();
  console.log('[sync-delta] server healthy');

  const reg = await request('POST', '/api/auth/register', null, { username: 'delta_u', password: 'delta123' });
  const token = reg.json && reg.json.token;
  check('注册拿到 token', typeof token === 'string', 'status=' + reg.status);

  /* ---------- A. 新协议：首次增量上行 ---------- */
  let r = await request('PUT', '/api/data', token, {
    mem: { stats: { totalRounds: 1, totalAnswered: 1, daysLog: { '2026-09-10': { rounds: 1 } } } },
    statsDelta: { sbs: { 'd1#aaaaaaaa': sbsSample(1) }, evs: [evSample('ev-1')] }
  });
  check('A1 PUT statsDelta -> 200', r.status === 200, 'status=' + r.status + ' ' + r.raw);

  r = await request('GET', '/api/data', token);
  let st = r.json && r.json.mem && r.json.mem.stats;
  check('A2 bySentence 落库', !!(st && st.bySentence && st.bySentence['d1#aaaaaaaa']), JSON.stringify(st && Object.keys(st.bySentence || {})));
  check('A3 bySentence times 正确', !!(st && st.bySentence['d1#aaaaaaaa'].times === 1));
  check('A4 events 落库', !!(st && st.events && st.events.length === 1), 'len=' + (st && st.events && st.events.length));
  check('A5 stats 小字段同批写入', !!(st && st.totalRounds === 1 && st.daysLog && st.daysLog['2026-09-10']));

  /* ---------- B. 续增量：只发变更行 ---------- */
  r = await request('PUT', '/api/data', token, {
    mem: { stats: { totalRounds: 2, totalAnswered: 2, daysLog: { '2026-09-10': { rounds: 2 } } } },
    statsDelta: { sbs: { 'd1#aaaaaaaa': sbsSample(2) }, evs: [evSample('ev-2')] }
  });
  check('B1 二次 PUT -> 200', r.status === 200);
  r = await request('GET', '/api/data', token);
  st = r.json.mem.stats;
  check('B2 变更行被覆盖（times=2）', st.bySentence['d1#aaaaaaaa'].times === 2, 'times=' + st.bySentence['d1#aaaaaaaa'].times);
  check('B3 新增事件累加（2 条）', st.events.length === 2, 'len=' + st.events.length);
  check('B4 totalRounds 更新为 2', st.totalRounds === 2);

  /* ---------- F. UPSERT 语义：不误删未提及的条目（多设备场景） ---------- */
  r = await request('PUT', '/api/data', token, {
    mem: {},
    statsDelta: { sbs: { 'd1#bbbbbbbb': sbsSample(1) }, evs: [] }
  });
  check('F1 只带一条 sbs 的 PUT -> 200', r.status === 200);
  r = await request('GET', '/api/data', token);
  st = r.json.mem.stats;
  check('F2 旧 key 仍在（未被整表替换）', !!(st.bySentence['d1#aaaaaaaa'] && st.bySentence['d1#bbbbbbbb']),
    JSON.stringify(Object.keys(st.bySentence)));

  /* ---------- C. sbsGone 软删除 ---------- */
  r = await request('PUT', '/api/data', token, { mem: {}, statsDelta: { sbsGone: ['d1#bbbbbbbb'], evs: [] } });
  check('C1 PUT sbsGone -> 200', r.status === 200);
  r = await request('GET', '/api/data', token);
  st = r.json.mem.stats;
  check('C2 该 key 已消失', !st.bySentence['d1#bbbbbbbb'], JSON.stringify(Object.keys(st.bySentence)));
  check('C3 其他 key 不受影响', !!st.bySentence['d1#aaaaaaaa']);

  /* ---------- D. 旧客户端兼容：整份 mem 带大对象 ---------- */
  r = await request('PUT', '/api/data', token, {
    mem: {
      stats: {
        totalRounds: 3, totalAnswered: 4,
        bySentence: { 'd1#cccccccc': sbsSample(7) },
        events: [evSample('ev-old-1'), evSample('ev-old-2')]
      }
    }
  });
  check('D1 旧格式整份 payload -> 200', r.status === 200, 'status=' + r.status + ' ' + r.raw);
  r = await request('GET', '/api/data', token);
  st = r.json.mem.stats;
  check('D2 旧格式的 bySentence 已入库', !!st.bySentence['d1#cccccccc'], JSON.stringify(Object.keys(st.bySentence)));
  check('D3 旧格式的 events 已入库', st.events.some(function (e) { return e.id === 'ev-old-1'; }));
  check('D4 旧格式与已有数据共存不丢', !!st.bySentence['d1#aaaaaaaa']);

  /* ---------- H. entityDelta：mastered / reinforceBook / deletedItems 增量上行 ----------
     与 stats 同一类根因：这三个对象原先也在 kv blob 里，每次答题全量重传
     （mastered 8000 条约 227KB、错题本上限 200 条约 176KB）。 */
  r = await request('PUT', '/api/data', token, {
    mem: {},
    entityDelta: {
      mastered: { up: { 'd1#aaaaaaaa': masteredSample('d1', 1700000000000) } },
      reinforceBook: { up: { 'd1::I have a dream.': reinforceSample('d1::I have a dream.') } },
      deletedItems: { up: { 'd1#zzzzzzzz': true } }
    }
  });
  check('H1 PUT entityDelta -> 200', r.status === 200, 'status=' + r.status + ' ' + r.raw);

  r = await request('GET', '/api/data', token);
  let mem = r.json.mem;
  check('H2 mastered 落库', !!(mem.mastered && mem.mastered['d1#aaaaaaaa']), JSON.stringify(Object.keys(mem.mastered || {})));
  check('H3 mastered 值完整', !!(mem.mastered['d1#aaaaaaaa'] && mem.mastered['d1#aaaaaaaa'].markedAt === 1700000000000));
  check('H4 reinforceBook 落库（数组）', Array.isArray(mem.reinforceBook) && mem.reinforceBook.length === 1 &&
    mem.reinforceBook[0]._key === 'd1::I have a dream.', 'len=' + (mem.reinforceBook || []).length);
  check('H5 deletedItems 落库（映射）', !!(mem.deletedItems && mem.deletedItems['d1#zzzzzzzz'] === true), JSON.stringify(mem.deletedItems));

  /* 追加第二条：验证 UPSERT（不是整表替换），且错题本保持插入序 */
  r = await request('PUT', '/api/data', token, {
    mem: {},
    entityDelta: {
      mastered: { up: { 'd1#bbbbbbbb': masteredSample('d1', 1700000001000) } },
      reinforceBook: { up: { 'd1::second.': reinforceSample('d1::second.') } }
    }
  });
  r = await request('GET', '/api/data', token);
  mem = r.json.mem;
  check('H6 旧 mastered 未被整表替换', !!(mem.mastered['d1#aaaaaaaa'] && mem.mastered['d1#bbbbbbbb']),
    JSON.stringify(Object.keys(mem.mastered)));
  check('H7 错题本累加且保持插入序', mem.reinforceBook.length === 2 && mem.reinforceBook[0]._key === 'd1::I have a dream.',
    JSON.stringify(mem.reinforceBook.map(function (b) { return b._key; })));

  /* gone = 取消标熟 / 恢复删除；必须软删（保留墓碑）以便跨设备传播 */
  r = await request('PUT', '/api/data', token, {
    mem: {},
    entityDelta: { mastered: { gone: ['d1#bbbbbbbb'] }, deletedItems: { gone: ['d1#zzzzzzzz'] } }
  });
  check('H8 PUT entityDelta.gone -> 200', r.status === 200);
  r = await request('GET', '/api/data', token);
  mem = r.json.mem;
  check('H9 取消标熟的 key 已消失', !mem.mastered['d1#bbbbbbbb'], JSON.stringify(Object.keys(mem.mastered)));
  check('H10 其他 mastered 不受影响', !!mem.mastered['d1#aaaaaaaa']);
  check('H11 恢复的 deletedItem 已消失', !mem.deletedItems['d1#zzzzzzzz'], JSON.stringify(mem.deletedItems));
  check('H12 删除墓碑随响应下发（防他机复活）',
    !!(r.json.entityGone && r.json.entityGone.mastered && r.json.entityGone.mastered.indexOf('d1#bbbbbbbb') >= 0 &&
       r.json.entityGone.deletedItem.indexOf('d1#zzzzzzzz') >= 0),
    JSON.stringify(r.json.entityGone));

  /* 重新标熟同一个 key：墓碑必须被清掉（否则下次合并又把它删掉） */
  r = await request('PUT', '/api/data', token, {
    mem: {}, entityDelta: { mastered: { up: { 'd1#bbbbbbbb': masteredSample('d1', 1700000002000) } } }
  });
  r = await request('GET', '/api/data', token);
  check('H13 重标熟后复活', !!r.json.mem.mastered['d1#bbbbbbbb']);
  check('H14 复活后墓碑已清除', r.json.entityGone.mastered.indexOf('d1#bbbbbbbb') < 0,
    JSON.stringify(r.json.entityGone.mastered));

  /* ---------- I. 旧客户端兼容：整份 blob 走 UPSERT 而非整替 ---------- */
  r = await request('PUT', '/api/data', token, {
    mem: {
      mastered: { 'd1#old0001': masteredSample('d1', 1700000003000) },
      reinforceBook: [reinforceSample('d1::old.')],
      deletedItems: { 'd1#old0002': true }
    }
  });
  check('I1 旧格式整份 blob -> 200', r.status === 200, 'status=' + r.status + ' ' + r.raw);
  r = await request('GET', '/api/data', token);
  mem = r.json.mem;
  check('I2 旧格式 mastered 已入库', !!mem.mastered['d1#old0001']);
  check('I3 旧格式错题本已入库', mem.reinforceBook.some(function (b) { return b._key === 'd1::old.'; }));
  check('I4 旧格式 deletedItems 已入库', !!mem.deletedItems['d1#old0002']);
  check('I5 旧格式与已有数据共存不丢', !!(mem.mastered['d1#aaaaaaaa'] && mem.mastered['d1#bbbbbbbb']),
    JSON.stringify(Object.keys(mem.mastered)));
  check('I6 旧格式错题本不吞已有序', mem.reinforceBook[0]._key === 'd1::I have a dream.',
    JSON.stringify(mem.reinforceBook.map(function (b) { return b._key; })));

  /* ---------- E. blob 里不能再有大对象 ---------- */
  await stopServer();
  let db = openDb();
  const blobRow = db.prepare("SELECT v_json FROM user_kv WHERE k='stats'").get();
  let blob = blobRow ? JSON.parse(blobRow.v_json) : {};
  check('E1 stats blob 已无 bySentence', !('bySentence' in blob), Object.keys(blob).join(','));
  check('E2 stats blob 已无 events', !('events' in blob), Object.keys(blob).join(','));
  check('E3 stats blob 保留小字段', blob.totalRounds === 3 && blob.totalAnswered === 4, JSON.stringify(blob).slice(0, 120));
  /* 注：此处不检查 daysLog —— D1 的 payload 本身没带它，kv 是整实体覆盖语义（非本用例目标）。
     daysLog 的落库在 A5 单独覆盖。 */

  const sbsCount = db.prepare('SELECT COUNT(*) AS n FROM user_sentence_stats').get().n;
  const evCount = db.prepare('SELECT COUNT(*) AS n FROM user_events').get().n;
  check('E4 行表有句子档案', sbsCount >= 2, 'n=' + sbsCount);
  check('E5 行表有事件', evCount >= 4, 'n=' + evCount);

  /* 这三个大对象必须彻底离开 user_kv —— 只要还留一份 blob，每答一题就还在全量搬运 */
  const stillInKv = db.prepare("SELECT k FROM user_kv WHERE user_id=(SELECT id FROM users WHERE username='delta_u') AND k IN ('mastered','reinforceBook','deletedItems')").all();
  check('E6 三个大对象已不在 user_kv', stillInKv.length === 0, JSON.stringify(stillInKv.map(function (x) { return x.k; })));
  const entCounts = {};
  db.prepare('SELECT kind, COUNT(*) AS n FROM user_entity_rows GROUP BY kind').all()
    .forEach(function (x) { entCounts[x.kind] = x.n; });
  check('E7 行表有 mastered（含软删）', (entCounts.mastered || 0) >= 3, JSON.stringify(entCounts));
  check('E8 行表有 reinforce（含软删）', (entCounts.reinforce || 0) >= 3, JSON.stringify(entCounts));
  check('E9 行表有 deletedItem（含墓碑）', (entCounts.deletedItem || 0) >= 2, JSON.stringify(entCounts));

  /* ---------- G. 启动迁移：把旧格式 blob 搬进行表 ---------- */
  const uid = db.prepare("SELECT id FROM users WHERE username='delta_u'").get().id;
  /* 模拟升级前的库：把大对象塞回 blob，同时清掉行表 → 服务启动必须能自愈 */
  db.prepare("DELETE FROM user_sentence_stats WHERE user_id=?").run(uid);
  db.prepare("DELETE FROM user_events WHERE user_id=?").run(uid);
  db.prepare("UPDATE user_kv SET v_json=? WHERE user_id=? AND k='stats'").run(JSON.stringify({
    totalRounds: 9, totalAnswered: 9, daysLog: { '2026-09-10': { rounds: 9 } },
    bySentence: { 'd1#legacy01': sbsSample(5) },
    events: [evSample('ev-legacy')]
  }), uid);
  /* 同一批模拟：这三个大对象在升级前也是 kv blob（第一轮拆表没覆盖到它们） */
  db.prepare('DELETE FROM user_entity_rows WHERE user_id=?').run(uid);
  const putKv = db.prepare("INSERT INTO user_kv (user_id,k,v_json,updated_at) VALUES (?,?,?,datetime('now')) ON CONFLICT(user_id,k) DO UPDATE SET v_json=excluded.v_json, updated_at=datetime('now')");
  putKv.run(uid, 'mastered', JSON.stringify({ 'd1#legacy99': masteredSample('d1', 1700000009000) }));
  putKv.run(uid, 'reinforceBook', JSON.stringify([reinforceSample('d1::legacy.')]));
  putKv.run(uid, 'deletedItems', JSON.stringify({ 'd1#legacydel': true }));
  /* 只有空 blob 的用户：空值不必搬内容，但 kv 行**必须被清掉**（否则这两个键永远留在库里） */
  db.prepare("INSERT INTO users (username,password_hash) VALUES ('empty_blob_u','x')").run();
  const eu = db.prepare("SELECT id FROM users WHERE username='empty_blob_u'").get().id;
  putKv.run(eu, 'mastered', '{}');
  putKv.run(eu, 'reinforceBook', '[]');
  db.close();

  await startServer();
  r = await request('POST', '/api/auth/login', null, { username: 'delta_u', password: 'delta123' });
  const token2 = r.json && r.json.token;
  r = await request('GET', '/api/data', token2);
  st = r.json.mem.stats;
  check('G1 迁移后 bySentence 可读', !!(st.bySentence && st.bySentence['d1#legacy01']), JSON.stringify(Object.keys(st.bySentence || {})));
  check('G2 迁移后 events 可读', st.events.some(function (e) { return e.id === 'ev-legacy'; }));
  check('G3 迁移后小字段保留', st.totalRounds === 9, 'totalRounds=' + st.totalRounds);
  const memAfter = r.json.mem;
  check('G7 迁移后 mastered 可读', !!(memAfter.mastered && memAfter.mastered['d1#legacy99']), JSON.stringify(Object.keys(memAfter.mastered || {})));
  check('G8 迁移后 reinforceBook 可读', memAfter.reinforceBook.length === 1 && memAfter.reinforceBook[0]._key === 'd1::legacy.',
    JSON.stringify(memAfter.reinforceBook.map(function (b) { return b._key; })));
  check('G9 迁移后 deletedItems 可读', memAfter.deletedItems['d1#legacydel'] === true, JSON.stringify(memAfter.deletedItems));

  await stopServer();
  db = openDb();
  const afterBlob = JSON.parse(db.prepare("SELECT v_json FROM user_kv WHERE user_id=? AND k='stats'").get(uid).v_json);
  check('G4 迁移后 blob 已清理大对象', !('bySentence' in afterBlob) && !('events' in afterBlob), Object.keys(afterBlob).join(','));
  const migrated = db.prepare('SELECT COUNT(*) AS n FROM user_sentence_stats WHERE user_id=?').get(uid).n;
  check('G5 行表已写入迁移数据', migrated === 1, 'n=' + migrated);
  const leftKv = db.prepare("SELECT k FROM user_kv WHERE user_id=? AND k IN ('mastered','reinforceBook','deletedItems')").all(uid);
  check('G10 迁移后三个 kv blob 已删除', leftKv.length === 0, JSON.stringify(leftKv.map(function (x) { return x.k; })));
  const entMigrated = db.prepare('SELECT COUNT(*) AS n FROM user_entity_rows WHERE user_id=?').get(uid).n;
  check('G11 行表已写入迁移数据', entMigrated === 3, 'n=' + entMigrated);
  const emptyLeft = db.prepare("SELECT k FROM user_kv WHERE user_id=? AND k IN ('mastered','reinforceBook')").all(eu);
  check('G13 空 blob 的 kv 行也已清理', emptyLeft.length === 0, JSON.stringify(emptyLeft.map(function (x) { return x.k; })));
  db.close();

  /* ---------- 迁移幂等：再启一次不应重复/报错 ---------- */
  await startServer();
  r = await request('POST', '/api/auth/login', null, { username: 'delta_u', password: 'delta123' });
  r = await request('GET', '/api/data', r.json.token);
  st = r.json.mem.stats;
  check('G6 二次启动幂等（数据不变）', !!(st.bySentence['d1#legacy01'] && st.events.length === 1),
    JSON.stringify({ sbs: Object.keys(st.bySentence), ev: st.events.length }));
  check('G12 二次启动幂等（实体行不重复）',
    !!(r.json.mem.mastered['d1#legacy99'] && r.json.mem.reinforceBook.length === 1),
    JSON.stringify({ mastered: Object.keys(r.json.mem.mastered), reinforce: r.json.mem.reinforceBook.length }));
  await stopServer();

  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) { /* best-effort */ }

  console.log('\n[sync-delta] ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
})().catch(function (e) {
  console.error('[sync-delta] FATAL', e);
  if (child) { try { child.kill('SIGKILL'); } catch (x) { /* noop */ } }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (x) { /* noop */ }
  process.exit(1);
});
