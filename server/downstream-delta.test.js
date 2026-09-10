/**
 * downstream-delta.test.js · 行级增量下行协议测试（2026-09-10 第三轮）
 *
 * 背景：`GET /api/data` 是全量组装 —— 8000 句时 7191KB（brotli 后 648KB），
 * 且服务端 buildMem 要 206ms 同步阻塞。客户端每次开页都要重拉一遍。
 * 本轮给每张用户数据表加单调 `seq`，支持 `?since=N` 只回变更。
 *
 * 覆盖（每条都对应一个真实会酿成事故的点）：
 *   A  全量响应带下行水位 seq，delta=false（老客户端可忽略，行为逐字节不变）
 *   B  写入推进 seq（单调）
 *   C  since=当前水位 → 空增量
 *   D  只回变更行（未变更的句子/实体不出现）
 *   E  增量携带墓碑：entityGone + deleted.*（取消标熟 / 删题库）
 *   F  增量下 stats 基座（daysLog 等）仍完整 —— 缺了会让客户端重建式合并算错
 *   G  水位超前于服务端（库被回滚/重置）→ 退回全量，避免「永远只拉增量、静默少数据」
 *   H  非法 since → 400（不静默当作 0 或全量）
 *   I  ★ 未变更实体绝不出现在 deleted.*（增量的 mem 是变更集，客户端不得用存在性推断）
 *   J  发布题库 bump rev + seq（旧实现不 bump rev → 发布状态永远传不到其他设备）
 *   K  重启迁移：存量行回填 seq=1 且计数器同步抬到 1（撞号会导致漏变更），
 *      迁移产生的行也带 seq（否则增量客户端收不到存量数据）
 *
 * 运行：node downstream-delta.test.js   （退出码 0 = 全绿）
 */
'use strict';

const { spawn } = require('child_process');
const http = require('http');
const os = require('os');
const path = require('path');

const SERVER_DIR = __dirname;
const PORT = 8817;
const TMP_DB = path.join(os.tmpdir(), 'chunklab-downdelta-' + Date.now());
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
  JWT_SECRET: 'downstream-delta-test-secret-not-for-production',
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
function openDb() {
  const Database = require('better-sqlite3');
  return new Database(DB_FILE);
}

/* 真实形状的句子档案（字段与 main.html recordSentenceResult 对齐） */
function sbsSample(times) {
  return {
    deckId: 'd1', deckName: 'Deck One', sentence: 'I have a dream.', translation: '我有一个梦想。',
    times: times, okTimes: times, wrongTimes: 0, streak: times, maxStreak: times,
    lastAt: 1700000000000, interval: 4, ease: 2.5, dueAt: 1700003600000, repetition: 2
  };
}
function evSample(id, key) {
  return { id: id, kind: 'answer', key: key || 'd1#aaaaaaaa', deckId: 'd1', sentence: 'I have a dream.', ok: true, at: 1700000000000 };
}
function masteredSample(deckId, sentence, markedAt) {
  return { deckId: deckId, sentence: sentence, markedAt: markedAt };
}
function deckSample(id, name, cid) {
  return { id: id, name: name, items: [{ cid: cid, sentence: 'Sentence ' + cid }] };
}

/* GET /api/data，可选带 since */
function getData(token, since) {
  const p = (since === undefined || since === null) ? '/api/data' : '/api/data?since=' + encodeURIComponent(since);
  return request('GET', p, token);
}

(async function main() {
  console.log('[down-delta] temp DB: ' + TMP_DB);
  await startServer();
  console.log('[down-delta] server healthy');

  const reg = await request('POST', '/api/auth/register', null, { username: 'dd_user', password: 'downstream123' });
  const token = reg.json && reg.json.token;
  check('注册拿到 token', typeof token === 'string', 'status=' + reg.status + ' ' + reg.raw);

  /* ---------- A. 全量响应带下行水位 ---------- */
  let r = await getData(token);
  check('A1 全量 GET 200', r.status === 200, 'status=' + r.status + ' ' + r.raw);
  check('A2 全量 delta=false', r.json && r.json.delta === false, 'delta=' + (r.json && r.json.delta));
  check('A3 全量带 seq 数字', r.json && typeof r.json.seq === 'number' && r.json.seq >= 0, 'seq=' + (r.json && r.json.seq));
  const seqEmpty = r.json.seq;

  /* 建基准：1 个 deck + 1 条句档案 + 1 条标熟 + 1 条事件 */
  r = await request('PUT', '/api/data', token, {
    mem: {
      decks: [deckSample('d1', 'D1', 'aaaaaaaa')],
      stats: { totalRounds: 1, totalAnswered: 1, daysLog: { '2026-09-10': { rounds: 1 } } }
    },
    revs: { decks: { d1: 1 }, kv: { stats: 1 } },
    statsDelta: { sbs: { 'd1#aaaaaaaa': sbsSample(1) }, evs: [evSample('ev-1')] },
    entityDelta: { mastered: { up: { 'd1#aaaaaaaa': masteredSample('d1', 'I have a dream.', 1) } } }
  });
  check('A4 基准写入 200', r.status === 200, 'status=' + r.status + ' ' + r.raw);

  r = await getData(token);
  const seqBase = r.json.seq;
  check('B1 写入后 seq 推进', seqBase > seqEmpty, seqEmpty + ' -> ' + seqBase);
  check('B2 全量含 deck/句档案/标熟',
    r.json.mem.decks.length === 1 &&
    !!r.json.mem.stats.bySentence['d1#aaaaaaaa'] &&
    !!r.json.mem.mastered['d1#aaaaaaaa']);

  /* B3~B5：去冗余（2026-09-10）—— buildMem 组装时剥离 deckName/translation，
     但保留 sentence/deckId（反查锚点）与 SRS 计数。 */
  const _sbs = r.json.mem.stats.bySentence['d1#aaaaaaaa'];
  check('B3 bySentence 已剥离 deckName/translation',
    _sbs && !('deckName' in _sbs) && !('translation' in _sbs),
    JSON.stringify(_sbs));
  check('B4 bySentence 保留 sentence/deckId 反查锚点',
    _sbs && _sbs.sentence === 'I have a dream.' && _sbs.deckId === 'd1',
    JSON.stringify(_sbs));
  check('B5 bySentence 保留 SRS 计数', _sbs && _sbs.times === 1 && _sbs.okTimes === 1 && typeof _sbs.dueAt === 'number');

  /* B6~B7：events 去冗余 —— answer 事件的 deckId/sentence 与 key 重复、全链路从未被读，
     组装时同样剥离；id/kind/ok/key/at 必须保留。 */
  const _ev1 = r.json.mem.stats.events[0];
  check('B6 events 已剥离 deckId/sentence',
    _ev1 && !('deckId' in _ev1) && !('sentence' in _ev1),
    JSON.stringify(_ev1));
  check('B7 events 保留 id/kind/ok/key/at',
    _ev1 && _ev1.id === 'ev-1' && _ev1.kind === 'answer' && _ev1.ok === true && _ev1.key === 'd1#aaaaaaaa' && typeof _ev1.at === 'number',
    JSON.stringify(_ev1));

  /* ---------- C. since=当前水位 → 空增量 ---------- */
  r = await getData(token, seqBase);
  check('C1 since=当前 → delta=true', r.json.delta === true);
  check('C2 空增量：无句档案变更', Object.keys(r.json.mem.stats.bySentence).length === 0,
    'n=' + Object.keys(r.json.mem.stats.bySentence).length);
  check('C3 空增量：无事件', r.json.mem.stats.events.length === 0);
  check('C4 空增量：无 deck', r.json.mem.decks.length === 0);
  check('C5 空增量：无删除清单', r.json.deleted.decks.length === 0 && r.json.deleted.courses.length === 0);
  check('C6 空增量：水位不变', r.json.seq === seqBase, r.json.seq + ' vs ' + seqBase);

  /* ---------- D. 只回变更行 ---------- */
  r = await request('PUT', '/api/data', token, {
    mem: {},
    statsDelta: { sbs: { 'd1#cccccccc': sbsSample(1) }, evs: [evSample('ev-2', 'd1#cccccccc')] }
  });
  check('D0 增量写入 200', r.status === 200, 'status=' + r.status + ' ' + r.raw);
  r = await getData(token, seqBase);
  check('D1 增量只含新变更的句档案',
    Object.keys(r.json.mem.stats.bySentence).length === 1 && !!r.json.mem.stats.bySentence['d1#cccccccc'],
    'keys=' + Object.keys(r.json.mem.stats.bySentence));
  check('D2 未变更的旧句档案不在增量里', r.json.mem.stats.bySentence['d1#aaaaaaaa'] === undefined);
  check('D3 增量只含新事件', r.json.mem.stats.events.length === 1 && r.json.mem.stats.events[0].id === 'ev-2');
  check('D4 未变更的实体不在增量里', Object.keys(r.json.mem.mastered).length === 0);
  const seqAfterD = r.json.seq;
  check('D5 增量水位更新', seqAfterD > seqBase, seqBase + ' -> ' + seqAfterD);

  /* ---------- E. 增量携带墓碑 ---------- */
  // 先新增一条标熟，再取消它 —— 取消必须能让其他设备看见
  r = await request('PUT', '/api/data', token, {
    mem: {},
    entityDelta: { mastered: { up: { 'd1#ffffffff': masteredSample('d1', 'Tombstone me.', 2) } } }
  });
  check('E0 标熟写入 200', r.status === 200, 'status=' + r.status + ' ' + r.raw);
  r = await getData(token);
  const seqWithMastered = r.json.seq;
  check('E1 新标熟已落库', !!r.json.mem.mastered['d1#ffffffff']);

  r = await request('PUT', '/api/data', token, {
    mem: {},
    entityDelta: { mastered: { gone: ['d1#ffffffff'] } }
  });
  check('E2a 取消标熟 200', r.status === 200, 'status=' + r.status + ' ' + r.raw);
  r = await getData(token, seqWithMastered);
  check('E2 取消标熟出现在墓碑里', r.json.entityGone.mastered.indexOf('d1#ffffffff') >= 0,
    JSON.stringify(r.json.entityGone.mastered));
  check('E3 取消后不在存活列表', r.json.mem.mastered['d1#ffffffff'] === undefined);
  const seqAfterMiss = r.json.seq;

  // 删除一个题库：deleted.decks 必须显式给出，且只含真正被删的那个
  await request('PUT', '/api/data', token, {
    mem: { decks: [deckSample('d2', 'D2', 'bbbbbbbb')] },
    revs: { decks: { d2: 1 } }
  });
  r = await getData(token);
  const seqWithD2 = r.json.seq;
  check('E4 d2 已建', r.json.mem.decks.length === 2);

  await request('PUT', '/api/data', token, {
    mem: { decks: [] },
    deleted: { decks: [{ id: 'd2', rev: 2 }] }
  });
  r = await getData(token, seqWithD2);
  check('E5 删除的 deck 出现在 deleted.decks', r.json.deleted.decks.indexOf('d2') >= 0,
    JSON.stringify(r.json.deleted.decks));
  check('E6 deleted.decks 不含未变更的 d1（★ 未变更 ≠ 已删除）',
    r.json.deleted.decks.indexOf('d1') < 0, JSON.stringify(r.json.deleted.decks));
  check('E7 d1 不出现在增量 mem.decks（它没有变更）', r.json.mem.decks.length === 0,
    'n=' + r.json.mem.decks.length);
  const seqAfterDel = r.json.seq;

  /* ---------- F. 增量下 stats 基座仍完整 ---------- */
  // 这次写入只动 entityDelta，完全不碰 kv.stats
  r = await request('PUT', '/api/data', token, {
    mem: {},
    entityDelta: { deletedItems: { up: { 'd1#aaaaaaaa': 1 } } }
  });
  check('F0 写入 200', r.status === 200, 'status=' + r.status + ' ' + r.raw);
  r = await getData(token, seqAfterDel);
  check('F1 增量未变更 kv.stats → 但基座仍完整下发',
    !!r.json.mem.stats.daysLog && !!r.json.mem.stats.daysLog['2026-09-10'],
    'daysLog=' + JSON.stringify(r.json.mem.stats.daysLog));
  check('F2 基座 totalRounds 正确', r.json.mem.stats.totalRounds === 1, 'v=' + r.json.mem.stats.totalRounds);
  const seqAfterF = r.json.seq;

  /* ---------- I. 未变更实体绝不出现在删除清单 ---------- */
  // 这是整个协议最容易出人命的点：增量的 mem 是变更集，客户端一旦沿用
  // 「远端没给 = 已删」的存在性推断，就会把未变更的实体整批删掉。
  await request('PUT', '/api/data', token, {
    mem: { decks: [deckSample('d3', 'D3', 'dddddddd')] },
    revs: { decks: { d3: 1 } }
  });
  r = await getData(token, seqAfterF);
  check('I1 增量只含新 deck d3', r.json.mem.decks.length === 1 && r.json.mem.decks[0].id === 'd3',
    JSON.stringify(r.json.mem.decks.map(function (d) { return d.id; })));
  check('I2 未变更的 d1 不在 mem.decks', !r.json.mem.decks.some(function (d) { return d.id === 'd1'; }));
  check('I3 未变更的 d1 也不在 deleted.decks', r.json.deleted.decks.indexOf('d1') < 0);
  check('I4 revs.decks 只给变更的 d3', Object.keys(r.json.revs.decks).join(',') === 'd3',
    Object.keys(r.json.revs.decks).join(','));
  const seqBeforePub = r.json.seq;

  /* ---------- J. 发布题库：rev + seq 都要推进 ---------- */
  r = await request('POST', '/api/deck/publish', token, { deckId: 'd3', publish: true });
  check('J1 发布 200', r.status === 200, 'status=' + r.status + ' ' + r.raw);
  r = await getData(token, seqBeforePub);
  check('J2 发布出现在增量里（seq 已推进）', r.json.mem.decks.length === 1 && r.json.mem.decks[0].id === 'd3',
    JSON.stringify(r.json.mem.decks.map(function (d) { return d.id; })));
  check('J3 增量里 isPublic=true', !!r.json.mem.decks[0].isPublic);
  check('J4 rev 被 bump（否则其他设备 LWW 会忽略）', (r.json.revs.decks.d3 || 0) > 1,
    'rev=' + r.json.revs.decks.d3);

  /* ---------- G. 水位超前于服务端 → 退回全量 ---------- */
  r = await getData(token, 999999999);
  check('G1 水位超前 → delta=false（退回全量）', r.json.delta === false);
  check('G2 退回全量确实给了全部 deck', r.json.mem.decks.length >= 2,
    'n=' + r.json.mem.decks.length);
  check('G3 退回全量给了完整句档案', !!r.json.mem.stats.bySentence['d1#aaaaaaaa']);

  /* ---------- H. 非法 since → 400 ---------- */
  r = await request('GET', '/api/data?since=abc', token);
  check('H1 since=abc → 400', r.status === 400, 'status=' + r.status);
  r = await request('GET', '/api/data?since=-1', token);
  check('H2 since=-1 → 400', r.status === 400, 'status=' + r.status);
  /* 协议契约：PUT 必须带 mem（客户端 memForCloud 永远返回对象）。
     缺了就响亮报错，不放宽校验去"容忍"——宽容会让客户端的协议误用长期隐形。 */
  r = await request('PUT', '/api/data', token, { statsDelta: { sbs: {}, evs: [] } });
  check('H3 PUT 缺 mem → 400（协议要求 mem）', r.status === 400, 'status=' + r.status + ' ' + r.raw);

  /* ---------- K. 重启迁移：回填不撞号 + 迁移行带 seq ---------- */
  let seqBeforeRestart = (await getData(token)).json.seq;
  await stopServer();

  // 造「本特性上线前的存量行」：seq 为 NULL（模拟旧版本写入）
  const dbFile = openDb();
  const uid = dbFile.prepare('SELECT id FROM users WHERE username=?').get('dd_user').id;
  dbFile.prepare("INSERT INTO user_kv (user_id,k,v_json,rev) VALUES (?,?,?,1)").run(uid, 'best', JSON.stringify({ 'd1#aaaaaaaa': 3 }));
  dbFile.prepare("INSERT INTO user_kv (user_id,k,v_json,rev) VALUES (?,?,?,1)")
    .run(uid, 'mastered', JSON.stringify({ 'd1#legacy01': masteredSample('d1', 'Legacy row.', 3) }));
  // 用户计数器归零，模拟「从未分配过序号」（新库靠 initChangeSeq 铺计数器）
  dbFile.prepare('DELETE FROM user_change_seq WHERE user_id=?').run(uid);
  const nullBefore = dbFile.prepare('SELECT COUNT(*) n FROM user_kv WHERE user_id=? AND seq IS NULL').get(uid).n;
  dbFile.close();
  check('K1 造出待回填的存量行', nullBefore === 2, 'n=' + nullBefore);

  await startServer();
  const db2 = openDb();
  const bestSeq = db2.prepare("SELECT seq FROM user_kv WHERE user_id=? AND k='best'").get(uid).seq;
  const counter = db2.prepare('SELECT seq FROM user_change_seq WHERE user_id=?').get(uid).seq;
  const nullAfter = db2.prepare('SELECT COUNT(*) n FROM user_kv WHERE user_id=? AND seq IS NULL').get(uid).n;
  db2.close();
  check('K2 存量行回填 seq=1', bestSeq === 1, 'seq=' + bestSeq);
  check('K3 无残留 NULL 行', nullAfter === 0, 'n=' + nullAfter);
  check('K4 计数器同步抬到 1（★ 不抬会与回填值撞号 → 漏变更）', counter === 1, 'counter=' + counter);

  // 回填之后的新写入必须拿到 >1 的序号，否则「水位=1 的客户端」永远收不到它
  r = await request('PUT', '/api/data', token, {
    mem: {},
    entityDelta: { mastered: { up: { 'd1#nnnnnnnn': masteredSample('d1', 'After backfill.', 4) } } }
  });
  check('K5a 回填后写入 200', r.status === 200, 'status=' + r.status + ' ' + r.raw);
  const db3 = openDb();
  const newSeq = db3.prepare("SELECT seq FROM user_entity_rows WHERE user_id=? AND item_key='d1#nnnnnnnn'").get(uid).seq;
  db3.close();
  check('K5 回填后新写入的 seq > 1（不与回填撞号）', newSeq > 1, 'seq=' + newSeq);

  // 回填的存量行必须能被「水位从 0 开始」的客户端拉到
  r = await getData(token, 0);
  check('K6 since=0 能拉到回填的存量标熟', !!r.json.mem.mastered['d1#legacy01'],
    JSON.stringify(Object.keys(r.json.mem.mastered)));
  check('K7 since=0 能拉到回填的 best', r.json.mem.best['d1#aaaaaaaa'] === 3,
    JSON.stringify(r.json.mem.best));

  // 存量迁移：blob 里的 mastered 已被搬进行表并删除
  const db4 = openDb();
  const legacyBlobLeft = db4.prepare("SELECT COUNT(*) n FROM user_kv WHERE user_id=? AND k='mastered'").get(uid).n;
  db4.close();
  check('K8 存量 blob 已被迁移清掉', legacyBlobLeft === 0, 'n=' + legacyBlobLeft);

  await stopServer();

  console.log('\n[down-delta] ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch(function (e) {
  console.error('[down-delta] FATAL', e);
  stopServer().then(function () { process.exit(1); });
});
