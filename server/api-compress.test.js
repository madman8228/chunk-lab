/**
 * api-compress.test.js · API 响应压缩中间件测试（2026-09-10，8000 句扩容）
 *
 * 背景：上行拆表后，`GET /api/data` 仍是全量 7191KB（8000 句）。
 * brotli q=5 实测 11.1×，但**必须异步** —— 同步版并发 5 请求会让事件循环停顿 717ms。
 *
 * 本测试自包含：用 express 起一个隔离的测试服务器挂中间件（不依赖 chunklab 主服务），
 * 因此覆盖的是中间件契约本身，端到端正确性由 e2e 套件补充。
 *
 * 覆盖：
 *   A  编码协商（br 优先 / gzip 回退 / 不接受 / q=0 显式拒绝 / * 通配）
 *   B  响应正确性（解压后 JSON 与原对象一致、Content-Length 与实体一致）
 *   C  阈值（<1KB 不压）
 *   D  协议头（Vary、Content-Encoding、Content-Type）
 *   E  HEAD 不带 body
 *   F  非 JSON 响应（res.send）不受影响
 *   G  异步性（并发不串行化 —— 同步实现会让墙钟 ≈ 并发数 × 单次耗时）
 *
 * 运行：node api-compress.test.js   （退出码 0 = 全绿）
 */
'use strict';

const http = require('http');
const zlib = require('zlib');
const express = require('express');
const apiCompress = require('./api-compress');

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}

/* ---------- 造一份「够大且不可压缩到无意义」的 JSON，模拟 8000 句档案 ----------
   ⚠️ 必须打散字段值：若所有条目内容雷同，brotli 的窗口能把冗余吃到 30× 以上，
   测出来的压缩率是自欺（上一轮探针已踩过这个坑）。 */
function makeBigBody(n) {
  const bySentence = {};
  const events = [];
  const t0 = Date.parse('2026-08-01T10:00:00Z');
  for (let i = 0; i < n; i++) {
    const seed = (i * 2654435761) >>> 0;
    const key = 'deck-' + (seed % 97) + '#' + seed.toString(16).padStart(8, '0');
    bySentence[key] = {
      deckId: 'deck-' + (seed % 97),
      deckName: '题库 ' + (seed % 97),
      sentence: 'Sentence number ' + i + ' with some varying English content ' + seed.toString(36),
      translation: '第 ' + i + ' 句中文翻译，含有变化的字符 ' + (seed % 9973),
      times: 1 + (seed % 9), okTimes: seed % 7, wrongTimes: (seed >> 3) % 5,
      streak: seed % 4, maxStreak: seed % 6, lastAt: t0 + i * 4000,
      interval: [1, 2, 4, 7, 15][seed % 5], ease: 2.3 + (seed % 7) / 10,
      dueAt: t0 + i * 4000 + 86400000, repetition: seed % 5
    };
    events.push({
      id: (t0 + i).toString(36) + '-' + seed.toString(36).slice(0, 6),
      kind: 'answer', key: key, deckId: 'deck-' + (seed % 97),
      sentence: 'Sentence number ' + i + ' with some varying English content ' + seed.toString(36),
      ok: (seed % 5) !== 0, at: t0 + i * 4000
    });
  }
  return {
    mem: { stats: { totalRounds: n, totalAnswered: n, bySentence: bySentence, events: events } },
    revs: { decks: {}, kv: { stats: 17 } }
  };
}

const BIG = makeBigBody(2000);
const SMALL = { ok: true };

const app = express();
app.use('/api', apiCompress());
app.get('/api/big', function (req, res) { res.json(BIG); });
app.get('/api/small', function (req, res) { res.json(SMALL); });
app.get('/api/text', function (req, res) { res.type('text/plain').send('plain text response, not json'); });

/* ---------- 请求工具：保留原始字节 + 响应头 ---------- */
function get(p, headers) {
  return new Promise(function (resolve, reject) {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: p, method: 'GET', headers: headers || {} },
      function (res) {
        const chunks = [];
        res.on('data', function (c) { chunks.push(c); });
        res.on('end', function () {
          resolve({ status: res.statusCode, headers: res.headers, raw: Buffer.concat(chunks) });
        });
      });
    req.on('error', reject);
    req.end();
  });
}

function head(p, headers) {
  return new Promise(function (resolve, reject) {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: p, method: 'HEAD', headers: headers || {} },
      function (res) {
        let n = 0;
        res.on('data', function (c) { n += c.length; });
        res.on('end', function () { resolve({ status: res.statusCode, headers: res.headers, bodyBytes: n }); });
      });
    req.on('error', reject);
    req.end();
  });
}

/** 按响应头声明的编码解压 */
function decode(r) {
  const enc = r.headers['content-encoding'];
  if (enc === 'br') return zlib.brotliDecompressSync(r.raw).toString('utf8');
  if (enc === 'gzip') return zlib.gunzipSync(r.raw).toString('utf8');
  return r.raw.toString('utf8');
}

const server = http.createServer(app);

server.listen(0, '127.0.0.1', async function () {
  console.log('\n' + '='.repeat(70));
  console.log('API 响应压缩中间件测试');
  console.log('='.repeat(70));

  const rawJson = JSON.stringify(BIG);
  const rawLen = Buffer.byteLength(rawJson);

  /* ---------- A 编码协商 ---------- */
  console.log('\n[A] 编码协商');
  const aBr = await get('/api/big', { 'Accept-Encoding': 'br' });
  check('A1 br 优先', aBr.headers['content-encoding'] === 'br', aBr.headers['content-encoding']);

  const aGz = await get('/api/big', { 'Accept-Encoding': 'gzip' });
  check('A2 gzip 回退', aGz.headers['content-encoding'] === 'gzip', aGz.headers['content-encoding']);

  const aBoth = await get('/api/big', { 'Accept-Encoding': 'gzip, deflate, br' });
  check('A3 br 与 gzip 并列时选 br', aBoth.headers['content-encoding'] === 'br', aBoth.headers['content-encoding']);

  const aNone = await get('/api/big', {});
  check('A4 不带 Accept-Encoding → 不压缩', aNone.headers['content-encoding'] === undefined, String(aNone.headers['content-encoding']));

  const aReject = await get('/api/big', { 'Accept-Encoding': 'br;q=0, gzip;q=0' });
  check('A5 q=0 显式拒绝 → 不压缩', aReject.headers['content-encoding'] === undefined, String(aReject.headers['content-encoding']));

  const aStar = await get('/api/big', { 'Accept-Encoding': '*' });
  check('A6 * 通配 → 压缩', !!aStar.headers['content-encoding'], String(aStar.headers['content-encoding']));

  const aQ = await get('/api/big', { 'Accept-Encoding': 'br;q=0.1, gzip;q=0.9' });
  check('A7 br 高优先（不按 q 值切换）', aQ.headers['content-encoding'] === 'br', aQ.headers['content-encoding']);

  /* ---------- B 响应正确性 ---------- */
  console.log('\n[B] 响应正确性');
  let brJson = null;
  try { brJson = decode(aBr); } catch (e) { brJson = null; }
  check('B1 br 解压后是合法 JSON', brJson !== null && (function () { try { JSON.parse(brJson); return true; } catch (e) { return false; } })());
  check('B2 解压后与未压缩响应完全一致', brJson === rawJson);
  check('B3 解压后条目数一致（2000 条 bySentence）', brJson ? Object.keys(JSON.parse(brJson).mem.stats.bySentence).length === 2000 : false);
  check('B4 Content-Length 等于实际字节数', Number(aBr.headers['content-length']) === aBr.raw.length,
    aBr.headers['content-length'] + ' vs ' + aBr.raw.length);
  check('B5 gzip 解压后同样一致', decode(aGz) === rawJson);

  /* ---------- C 阈值 ---------- */
  console.log('\n[C] 体积阈值');
  const cSmall = await get('/api/small', { 'Accept-Encoding': 'br' });
  check('C1 小响应（' + Buffer.byteLength(JSON.stringify(SMALL)) + 'B）不压缩', cSmall.headers['content-encoding'] === undefined,
    String(cSmall.headers['content-encoding']));
  check('C2 小响应内容正确', decode(cSmall) === JSON.stringify(SMALL));
  check('C3 大响应确实触发了压缩（> ' + apiCompress._internal.MIN_BYTES + 'B）', rawLen > apiCompress._internal.MIN_BYTES && aBr.headers['content-encoding'] === 'br');
  check('C4 压缩率 > 5×', rawLen / aBr.raw.length > 5, (rawLen / aBr.raw.length).toFixed(1) + '×');

  /* ---------- D 协议头 ---------- */
  console.log('\n[D] 协议头');
  check('D1 Vary: Accept-Encoding', String(aBr.headers['vary'] || '').toLowerCase().indexOf('accept-encoding') >= 0, aBr.headers['vary']);
  check('D2 Content-Type 是 JSON', String(aBr.headers['content-type'] || '').indexOf('application/json') >= 0, aBr.headers['content-type']);
  check('D3 未压缩分支也有正确 Content-Type', String(aNone.headers['content-type'] || '').indexOf('application/json') >= 0, aNone.headers['content-type']);

  /* ---------- E HEAD ---------- */
  console.log('\n[E] HEAD 请求');
  const eHead = await head('/api/big', { 'Accept-Encoding': 'br' });
  check('E1 HEAD 无 body', eHead.bodyBytes === 0, eHead.bodyBytes + ' bytes');
  check('E2 HEAD 未声明 Content-Encoding（未接管）', eHead.headers['content-encoding'] === undefined, String(eHead.headers['content-encoding']));

  /* ---------- F 非 JSON 响应 ---------- */
  console.log('\n[F] 非 JSON 响应');
  const fText = await get('/api/text', { 'Accept-Encoding': 'br' });
  check('F1 res.send 的文本响应不受影响', fText.headers['content-encoding'] === undefined, String(fText.headers['content-encoding']));
  check('F2 文本内容完整', decode(fText) === 'plain text response, not json', decode(fText).slice(0, 40));

  /* ---------- G 异步性（核心：不能阻塞事件循环） ---------- */
  console.log('\n[G] 异步性（不阻塞事件循环）');
  const t1 = process.hrtime.bigint();
  await get('/api/big', { 'Accept-Encoding': 'br' });
  const single = Number(process.hrtime.bigint() - t1) / 1e6;

  const t2 = process.hrtime.bigint();
  await Promise.all([0, 1, 2, 3].map(function () { return get('/api/big', { 'Accept-Encoding': 'br' }); }));
  const conc = Number(process.hrtime.bigint() - t2) / 1e6;

  check('G1 并发 4 墙钟 < 4× 单次（未串行化）', conc < single * 4,
    '单次 ' + single.toFixed(0) + 'ms，并发 4 ' + conc.toFixed(0) + 'ms');
  console.log('    单次 ' + single.toFixed(0) + ' ms ｜ 并发 4 ' + conc.toFixed(0) + ' ms（同步实现会 ≈ ' + (single * 4).toFixed(0) + ' ms）');

  /* ---------- 汇总 ---------- */
  console.log('\n' + '='.repeat(70));
  console.log('通过 ' + passed + ' / 失败 ' + failed + '（压缩率 ' + (rawLen / aBr.raw.length).toFixed(1) + '×：'
    + Math.round(rawLen / 1024) + 'KB → ' + Math.round(aBr.raw.length / 1024) + 'KB）');
  console.log('='.repeat(70));

  server.close();
  process.exit(failed ? 1 : 0);
});
