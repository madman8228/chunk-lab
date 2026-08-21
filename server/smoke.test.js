/**
 * smoke.test.js · 后端冒烟测试（零依赖，Node 直跑）
 *
 * 启动服务（多用户模式 + 临时 DB）→ 跑关键接口往返 → 断言 → 清理。
 * 不依赖任何测试框架；全部用 Node 内置模块。
 *
 * 运行：node smoke.test.js
 * 退出码：0 = 全部通过，1 = 有失败或异常
 */
'use strict';

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SERVER_DIR = __dirname;
const PORT = 8799;
const BASE = 'http://127.0.0.1:' + PORT;
const TMP_DB = path.join(os.tmpdir(), 'chunklab-smoke-' + Date.now());

let passed = 0;
let failed = 0;

function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log('  \u2713 ' + name);
  } else {
    failed++;
    console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : ''));
  }
}

function request(method, p, token, body) {
  return new Promise(function (resolve, reject) {
    const data = body ? JSON.stringify(body) : null;
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (data) headers['Content-Type'] = 'application/json';
    const u = new URL(BASE + p);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: method,
        headers: headers
      },
      function (res) {
        let raw = '';
        res.on('data', function (c) { raw += c; });
        res.on('end', function () {
          let json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch (e) {}
          if (res.statusCode >= 400) console.error('[smoke][HTTP]', method, p, res.statusCode, raw);
          resolve({ status: res.statusCode, json: json });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function waitHealth(timeoutMs) {
  const start = Date.now();
  return new Promise(function (resolve, reject) {
    (function tick() {
      request('GET', '/api/health')
        .then(function (r) {
          if (r.status === 200 && r.json && r.json.ok) return resolve();
          if (Date.now() - start > timeoutMs) return reject(new Error('server not healthy in ' + timeoutMs + 'ms'));
          setTimeout(tick, 250);
        })
        .catch(function () {
          if (Date.now() - start > timeoutMs) return reject(new Error('server not healthy in ' + timeoutMs + 'ms'));
          setTimeout(tick, 250);
        });
    })();
  });
}

const childEnv = Object.assign({}, process.env, {
  REQUIRE_AUTH: 'true',
  JWT_SECRET: 'smoke-test-secret-not-for-production',
  TOKEN_TTL: '30d',
  PORT: String(PORT),
  CHUNKLAB_DATA_DIR: TMP_DB,
  AI_CACHE_MAX: '5' /* 便于验证 ai_cache LRU 裁剪 */,
  AI_RATE_LIMIT: '3' /* 便于验证限流 */,
  AI_MOCK_RESPONSE: JSON.stringify({
    choices: [{ message: { content: '{"orig":"MOCK","zh":"mock-zh","chunks":[],"grammar":[],"collocations":[],"scenario":"mock"}' } }]
  }) /* 测试钩子：短路真实 DeepSeek 调用 */,
  AI_CACHE_TTL: '1' /* 便于验证缓存过期 */
});

let child = null;

async function main() {
  console.log('[smoke] starting server (multi-user mode) on port ' + PORT);
  console.log('[smoke] temp DB: ' + TMP_DB);
  child = spawn(process.execPath, ['index.js'], {
    cwd: SERVER_DIR,
    env: childEnv,
    stdio: ['ignore', 'ignore', 'inherit']
  });

  let token = null;
  try {
    await waitHealth(15000);
    console.log('[smoke] server healthy');

    let r;
    r = await request('GET', '/api/health');
    check('GET /api/health returns ok', r.status === 200 && r.json && r.json.ok === true);

    r = await request('GET', '/api/config');
    check('GET /api/config requireAuth=true', r.status === 200 && r.json && r.json.requireAuth === true, 'status=' + r.status);

    r = await request('POST', '/api/auth/register', null, { username: 'smoke_a', password: 'smoke123' });
    check('register returns token', r.status === 200 && r.json && typeof r.json.token === 'string', 'status=' + r.status);
    const regToken = r.json && r.json.token;

    r = await request('POST', '/api/auth/login', null, { username: 'smoke_a', password: 'smoke123' });
    check('login returns token', r.status === 200 && r.json && typeof r.json.token === 'string', 'status=' + r.status);
    token = (r.json && r.json.token) || regToken;

    r = await request('GET', '/api/data');
    check('GET /api/data without token -> 401', r.status === 401, 'status=' + r.status);

    const mem = {
      decks: [{
        id: 'd1', name: 'smoke deck', builtin: false,
        items: [{ sent: 'I am a student.', chunks: [{ t: 'I am', role: 'subj' }, { t: ' a student', role: 'pred' }] }]
      }],
      best: {}, mastered: {},
      stats: { totalRounds: 1, totalAnswered: 1, bySentence: {} },
      settings: { provider: 'deepseek' }
    };
    r = await request('PUT', '/api/data', token, { mem: mem, courses: [], courseProgress: {} });
    check('PUT /api/data ok', r.status === 200 && r.json && r.json.ok === true, 'status=' + r.status);

    /* ===== ADR-008：schema 校验（坏数据 400 而非 500） ===== */
    r = await request('PUT', '/api/data', token, { mem: { decks: 'not-array' } });
    check('ADR-008 非法 mem.decks → 400', r.status === 400, 'status=' + r.status);
    r = await request('PUT', '/api/data', token, { mem: { decks: [{ id: 'x' }] } });
    check('ADR-008 deck 缺 name → 400', r.status === 400, 'status=' + r.status);
    r = await request('PUT', '/api/data', token, { mem: { decks: [{ id: 'x', name: 'X', items: [{ noSent: 1 }] }] } });
    check('ADR-008 item 缺 sent/en → 400', r.status === 400, 'status=' + r.status);
    r = await request('PUT', '/api/data', token, { mem: { decks: [] }, courses: [{ title: 'NoId' }] });
    check('ADR-008 course 缺 courseId → 400', r.status === 400, 'status=' + r.status);
    r = await request('PUT', '/api/data', token, { mem: { decks: [], best: {}, mastered: {}, stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} }, settings: {} }, courses: [], courseProgress: {} });
    check('ADR-008 合法 payload 仍通过', r.status === 200, 'status=' + r.status);
    r = await request('POST', '/api/auth/register', null, { username: 'this-name-is-way-too-long-for-registration', password: 'ok123456' });
    check('ADR-008 超长用户名 → 400', r.status === 400, 'status=' + r.status);
    r = await request('POST', '/api/auth/register', null, { username: 'okname', password: '123456' + 'x'.repeat(200) });
    check('ADR-008 超长密码 → 400', r.status === 400, 'status=' + r.status);
    r = await request('POST', '/api/auth/register', null, { username: 12345, password: 'ok123456' });
    check('ADR-008 非字符串用户名 → 400', r.status === 400, 'status=' + r.status);

    r = await request('GET', '/api/data', token);
    check(
      'GET /api/data round-trips decks',
      r.status === 200 && r.json && r.json.mem && r.json.mem.decks &&
      r.json.mem.decks.length === 1 && r.json.mem.decks[0].id === 'd1',
      'status=' + r.status
    );

    r = await request('POST', '/api/courses', token, { course: { courseId: 'c1', title: 'Course 1' } });
    check('POST /api/courses ok', r.status === 200 && r.json && r.json.ok === true, 'status=' + r.status);

    r = await request('DELETE', '/api/courses/c1', token);
    check('DELETE /api/courses/:id ok', r.status === 200 && r.json && r.json.ok === true, 'status=' + r.status);

    r = await request('GET', '/api/export', token);
    check(
      'GET /api/export has structure',
      r.status === 200 && r.json && r.json.__app === 'chunklab' && r.json.mem &&
      typeof r.json.aiCache === 'object',
      'status=' + r.status
    );

    /* ===== ADR-005：实体级 rev upsert + 软删除（后端语义） ===== */
    // 先清空该用户已有 deck（软删），避免与上方 d1 残留互相干扰
    r = await request('GET', '/api/data', token);
    var existing = (r.json && r.json.mem && r.json.mem.decks) || [];
    if (existing.length) {
      var delList = existing.map(function (d) {
        var cur = (r.json.revs && r.json.revs.decks && r.json.revs.decks[d.id] != null) ? r.json.revs.decks[d.id] : 0;
        return { id: d.id, rev: cur + 1 };
      });
      await request('PUT', '/api/data', token, {
        mem: { decks: [], best: {}, mastered: {}, stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} }, settings: {}, reinforceBook: [], deletedItems: [] },
        courses: [], courseProgress: {},
        revs: { decks: {}, kv: {} }, deleted: { decks: delList, kv: [] }
      });
    }

    // 设备 A：写 deck dA (rev 1)
    r = await request('PUT', '/api/data', token, {
      mem: { decks: [{ id: 'dA', name: 'A-deck', items: [{ sent: 'A' }], builtin: false }], best: {}, mastered: {}, stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} }, settings: {}, reinforceBook: [], deletedItems: [] },
      courses: [], courseProgress: {},
      revs: { decks: { dA: 1 }, kv: {} }, deleted: { decks: [], kv: [] }
    });
    check('ADR-005 PUT dA ok', r.status === 200 && r.json && r.json.ok === true, 'status=' + r.status);

    // 设备 B：只写 deck dB (rev 1)，不应清掉 dA
    r = await request('PUT', '/api/data', token, {
      mem: { decks: [{ id: 'dB', name: 'B-deck', items: [{ sent: 'B' }], builtin: false }], best: {}, mastered: {}, stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} }, settings: {}, reinforceBook: [], deletedItems: [] },
      courses: [], courseProgress: {},
      revs: { decks: { dB: 1 }, kv: {} }, deleted: { decks: [], kv: [] }
    });
    check('ADR-005 PUT dB ok', r.status === 200 && r.json && r.json.ok === true, 'status=' + r.status);

    r = await request('GET', '/api/data', token);
    check('ADR-005 多设备互写不丢 deck（含 dA+dB）',
      r.status === 200 && r.json && r.json.mem && r.json.mem.decks &&
      r.json.mem.decks.length === 2 &&
      r.json.mem.decks.some(function (d) { return d.id === 'dA'; }) &&
      r.json.mem.decks.some(function (d) { return d.id === 'dB'; }),
      'decks=' + (r.json && r.json.mem && r.json.mem.decks && r.json.mem.decks.map(function (d) { return d.id; }).join(',')));

    check('ADR-005 GET 返回 revs',
      r.status === 200 && r.json && r.json.revs && r.json.revs.decks && r.json.revs.decks.dA === 1 && r.json.revs.decks.dB === 1,
      'revs=' + JSON.stringify(r.json && r.json.revs));

    // 软删除 dA（rev 升到 2）
    r = await request('PUT', '/api/data', token, {
      mem: { decks: [{ id: 'dB', name: 'B-deck', items: [{ sent: 'B' }], builtin: false }], best: {}, mastered: {}, stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} }, settings: {}, reinforceBook: [], deletedItems: [] },
      courses: [], courseProgress: {},
      revs: { decks: { dB: 1 }, kv: {} }, deleted: { decks: [{ id: 'dA', rev: 2 }], kv: [] }
    });
    check('ADR-005 软删 dA ok', r.status === 200 && r.json && r.json.ok === true, 'status=' + r.status);

    r = await request('GET', '/api/data', token);
    check('ADR-005 软删后 dA 不再返回，revs.dA=2',
      r.status === 200 && r.json && r.json.mem && r.json.mem.decks &&
      r.json.mem.decks.length === 1 && r.json.mem.decks[0].id === 'dB' &&
      r.json.revs.decks.dA === 2,
      'decks=' + (r.json && r.json.mem && r.json.mem.decks.map(function (d) { return d.id; }).join(',')));

    // 旧 rev 被拒：dB 当前 rev1，发 rev 0（更旧）→ 不更新
    r = await request('PUT', '/api/data', token, {
      mem: { decks: [{ id: 'dB', name: 'STALE-deck', items: [{ sent: 'stale' }], builtin: false }], best: {}, mastered: {}, stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} }, settings: {}, reinforceBook: [], deletedItems: [] },
      courses: [], courseProgress: {},
      revs: { decks: { dB: 0 }, kv: {} }, deleted: { decks: [], kv: [] }
    });
    r = await request('GET', '/api/data', token);
    check('ADR-005 旧 rev 写入被拒（dB 名称仍为 B-deck）',
      r.status === 200 && r.json && r.json.mem && r.json.mem.decks &&
      r.json.mem.decks[0].name === 'B-deck',
      'name=' + (r.json && r.json.mem && r.json.mem.decks[0] && r.json.mem.decks[0].name));

    // 旧客户端兼容：无 revs（rev=null）→ 总是覆盖
    r = await request('PUT', '/api/data', token, {
      mem: { decks: [{ id: 'dB', name: 'LEGACY-deck', items: [{ sent: 'legacy' }], builtin: false }], best: {}, mastered: {}, stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} }, settings: {}, reinforceBook: [], deletedItems: [] },
      courses: [], courseProgress: {}
    });
    r = await request('GET', '/api/data', token);
    check('ADR-005 旧客户端（无 revs）仍可用且覆盖',
      r.status === 200 && r.json && r.json.mem && r.json.mem.decks &&
      r.json.mem.decks[0].name === 'LEGACY-deck',
      'name=' + (r.json && r.json.mem && r.json.mem.decks[0] && r.json.mem.decks[0].name));

    // kv per-key upsert：best rev1→rev2 覆盖；旧 rev1 被拒
    r = await request('PUT', '/api/data', token, {
      mem: { decks: [], best: { x: 1 }, mastered: {}, stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} }, settings: {}, reinforceBook: [], deletedItems: [] },
      courses: [], courseProgress: {},
      revs: { decks: {}, kv: { best: 1 } }, deleted: { decks: [], kv: [] }
    });
    r = await request('PUT', '/api/data', token, {
      mem: { decks: [], best: { x: 2 }, mastered: {}, stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} }, settings: {}, reinforceBook: [], deletedItems: [] },
      courses: [], courseProgress: {},
      revs: { decks: {}, kv: { best: 2 } }, deleted: { decks: [], kv: [] }
    });
    r = await request('GET', '/api/data', token);
    check('ADR-005 kv.best rev2 覆盖 rev1', r.status === 200 && r.json && r.json.mem && r.json.mem.best && r.json.mem.best.x === 2,
      'best=' + JSON.stringify(r.json && r.json.mem && r.json.mem.best));

    r = await request('PUT', '/api/data', token, {
      mem: { decks: [], best: { x: 1 }, mastered: {}, stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} }, settings: {}, reinforceBook: [], deletedItems: [] },
      courses: [], courseProgress: {},
      revs: { decks: {}, kv: { best: 1 } }, deleted: { decks: [], kv: [] }
    });
    r = await request('GET', '/api/data', token);
    check('ADR-005 kv.best 旧 rev1 写入被拒（仍 x=2）', r.status === 200 && r.json && r.json.mem && r.json.mem.best && r.json.mem.best.x === 2,
      'best=' + JSON.stringify(r.json && r.json.mem && r.json.mem.best));

    /* ===== ADR-005 step 2：courses / courseProgress per-entity rev ===== */
    r = await request('PUT', '/api/data', token, {
      mem: { decks: [], best: {}, mastered: {}, stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} }, settings: {}, reinforceBook: [], deletedItems: [] },
      courses: [{ courseId: 'cA', title: 'Course A' }], courseProgress: {},
      revs: { decks: {}, kv: {}, courses: { cA: 1 }, courseProgress: {} },
      deleted: { decks: [], kv: [], courses: [], courseProgress: [] }
    });
    check('ADR-005s2 PUT course cA ok', r.status === 200 && r.json && r.json.ok === true, 'status=' + r.status);

    r = await request('PUT', '/api/data', token, {
      mem: { decks: [], best: {}, mastered: {}, stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} }, settings: {}, reinforceBook: [], deletedItems: [] },
      courses: [{ courseId: 'cB', title: 'Course B' }], courseProgress: {},
      revs: { decks: {}, kv: {}, courses: { cB: 1 }, courseProgress: {} },
      deleted: { decks: [], kv: [], courses: [], courseProgress: [] }
    });
    check('ADR-005s2 PUT course cB ok', r.status === 200 && r.json && r.json.ok === true, 'status=' + r.status);

    r = await request('GET', '/api/data', token);
    check('ADR-005s2 多设备互写不丢 course（cA+cB）',
      r.status === 200 && r.json && Array.isArray(r.json.courses) && r.json.courses.length === 2 &&
      r.json.courses.some(function (c) { return c.courseId === 'cA'; }) &&
      r.json.courses.some(function (c) { return c.courseId === 'cB'; }),
      'courses=' + JSON.stringify(r.json && r.json.courses && r.json.courses.map(function (c) { return c.courseId; })));
    check('ADR-005s2 GET 返回 courses revs',
      r.status === 200 && r.json && r.json.revs && r.json.revs.courses && r.json.revs.courses.cA === 1 && r.json.revs.courses.cB === 1,
      'revs=' + JSON.stringify(r.json && r.json.revs));

    // 软删 course cA（rev 2）
    r = await request('PUT', '/api/data', token, {
      mem: { decks: [], best: {}, mastered: {}, stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} }, settings: {}, reinforceBook: [], deletedItems: [] },
      courses: [{ courseId: 'cB', title: 'Course B' }], courseProgress: {},
      revs: { decks: {}, kv: {}, courses: { cB: 1 }, courseProgress: {} },
      deleted: { decks: [], kv: [], courses: [{ id: 'cA', rev: 2 }], courseProgress: [] }
    });
    check('ADR-005s2 软删 cA ok', r.status === 200 && r.json && r.json.ok === true, 'status=' + r.status);

    r = await request('GET', '/api/data', token);
    check('ADR-005s2 软删后 cA 不再返回且 revs.cA=2',
      r.status === 200 && r.json && r.json.courses && r.json.courses.length === 1 && r.json.courses[0].courseId === 'cB' &&
      r.json.revs.courses.cA === 2,
      'courses=' + JSON.stringify(r.json && r.json.courses && r.json.courses.map(function (c) { return c.courseId; })));

    // courseProgress：per-key rev 冲突
    r = await request('PUT', '/api/data', token, {
      mem: { decks: [], best: {}, mastered: {}, stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} }, settings: {}, reinforceBook: [], deletedItems: [] },
      courses: [], courseProgress: { pX: { done: 1 } },
      revs: { decks: {}, kv: {}, courses: {}, courseProgress: { pX: 1 } },
      deleted: { decks: [], kv: [], courses: [], courseProgress: [] }
    });
    r = await request('PUT', '/api/data', token, {
      mem: { decks: [], best: {}, mastered: {}, stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} }, settings: {}, reinforceBook: [], deletedItems: [] },
      courses: [], courseProgress: { pX: { done: 2 } },
      revs: { decks: {}, kv: {}, courses: {}, courseProgress: { pX: 2 } },
      deleted: { decks: [], kv: [], courses: [], courseProgress: [] }
    });
    r = await request('GET', '/api/data', token);
    check('ADR-005s2 progress pX rev2 覆盖 rev1',
      r.status === 200 && r.json && r.json.courseProgress && r.json.courseProgress.pX && r.json.courseProgress.pX.done === 2,
      'pX=' + JSON.stringify(r.json && r.json.courseProgress && r.json.courseProgress.pX));

    r = await request('PUT', '/api/data', token, {
      mem: { decks: [], best: {}, mastered: {}, stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} }, settings: {}, reinforceBook: [], deletedItems: [] },
      courses: [], courseProgress: { pX: { done: 99 } },
      revs: { decks: {}, kv: {}, courses: {}, courseProgress: { pX: 1 } },
      deleted: { decks: [], kv: [], courses: [], courseProgress: [] }
    });
    r = await request('GET', '/api/data', token);
    check('ADR-005s2 progress 旧 rev1 被拒（仍 done=2）',
      r.status === 200 && r.json && r.json.courseProgress && r.json.courseProgress.pX && r.json.courseProgress.pX.done === 2,
      'pX=' + JSON.stringify(r.json && r.json.courseProgress && r.json.courseProgress.pX));

    // DELETE /api/courses/:id 软删语义（cB rev1 → rev2）
    r = await request('DELETE', '/api/courses/cB', token);
    check('ADR-005s2 DELETE /api/courses/:id 软删 ok', r.status === 200 && r.json && r.json.ok === true, 'status=' + r.status);
    r = await request('GET', '/api/data', token);
    check('ADR-005s2 DELETE 后 cB 不再返回且 revs.cB=2',
      r.status === 200 && r.json && r.json.courses && r.json.courses.length === 0 && r.json.revs.courses.cB === 2,
      'courses=' + JSON.stringify(r.json && r.json.courses));

    /* ===== Phase D：公共题库市场 ===== */
    // A 创建自定义题库并发布
    r = await request('PUT', '/api/data', token, {
      mem: { decks: [{ id: 'pubdeck1', name: '公开测试题库', items: [{ sent: 'Market deck item.', chunks: ['Market deck', 'item.'], hints: ['市场', '项目'] }] }], best: {}, mastered: {}, stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} }, settings: {}, reinforceBook: [], deletedItems: [] },
      revs: { decks: { pubdeck1: 1 }, kv: {} }, deleted: {}
    });
    check('D: A 创建自定义题库', r.status === 200, 'status=' + r.status);
    r = await request('POST', '/api/deck/publish', token, { deckId: 'pubdeck1', publish: true });
    check('D: A 发布题库', r.status === 200 && r.json && r.json.isPublic === true, 'status=' + r.status + ' ' + JSON.stringify(r.json));
    // 匿名可浏览（公开市场语义）
    r = await request('GET', '/api/deck/public', null);
    check('D: 匿名浏览列表含 A 的题库（含作者）',
      r.status === 200 && r.json && r.json.decks && r.json.decks.some(function (d) { return d.id === 'pubdeck1' && d.author === 'smoke_a' && d.itemCount === 1; }),
      JSON.stringify(r.json && r.json.decks));
    // 匿名可拉取完整内容
    r = await request('GET', '/api/deck/public/pubdeck1', null);
    check('D: 匿名拉取完整题库（含 items）',
      r.status === 200 && r.json && r.json.deck && r.json.deck.items.length === 1 && r.json.deck.items[0].sent === 'Market deck item.',
      JSON.stringify(r.json && r.json.deck));
    // 他人不能发布我的题库
    r = await request('POST', '/api/auth/register', null, { username: 'smoke_b', password: 'smoke123' });
    const tokenB = r.json && r.json.token;
    r = await request('POST', '/api/deck/publish', tokenB, { deckId: 'pubdeck1', publish: true });
    check('D: B 不能发布 A 的题库 → 404', r.status === 404, 'status=' + r.status);
    // 下架后列表消失
    r = await request('POST', '/api/deck/publish', token, { deckId: 'pubdeck1', publish: false });
    check('D: A 下架题库', r.status === 200 && r.json && r.json.isPublic === false, 'status=' + r.status);
    r = await request('GET', '/api/deck/public', null);
    check('D: 下架后列表不再包含', r.status === 200 && !r.json.decks.some(function (d) { return d.id === 'pubdeck1'; }), JSON.stringify(r.json && r.json.decks));
    // 下架后详情不可读
    r = await request('GET', '/api/deck/public/pubdeck1', null);
    check('D: 下架后详情 404', r.status === 404, 'status=' + r.status);

    /* ===== ADR-008 / Phase A：ai_cache 容量上限（AI_CACHE_MAX=5，LRU 裁剪） ===== */
    const bigCache = {};
    for (let i2 = 1; i2 <= 8; i2++) bigCache['cache_k' + i2] = { v: i2 };
    r = await request('POST', '/api/import', token, { mem: { decks: [] }, courses: [], courseProgress: {}, aiCache: bigCache });
    check('ADR-008 ai_cache 导入 ok', r.status === 200, 'status=' + r.status);
    r = await request('GET', '/api/export', token);
    const cacheKeys = Object.keys((r.json && r.json.aiCache) || {});
    check('ADR-008 ai_cache 超限被 LRU 裁剪（8→5）', cacheKeys.length === 5, 'n=' + cacheKeys.length + ' keys=' + cacheKeys.join(','));

    /* ===== ADR-004：AI 后端代理（Key 不进前端；服务端缓存 + 限流） ===== */
    r = await request('POST', '/api/ai/explain', token, {});
    check('ADR-004 缺 sentence → 400', r.status === 400, 'status=' + r.status);

    // 服务端缓存命中（预置 key = model::norm(sentence)，命中不占限流额度、不发模型请求）
    const cacheSeed = { 'deepseek-v4-flash::i am a student': { orig: 'I am a student.', zh: '我是一个学生', chunks: [], grammar: [], collocations: [], scenario: '自我介绍' } };
    r = await request('POST', '/api/import', token, { mem: { decks: [] }, courses: [], courseProgress: {}, aiCache: cacheSeed });
    check('ADR-004 预置缓存 ok', r.status === 200, 'status=' + r.status);
    r = await request('POST', '/api/ai/explain', token, { sentence: 'I am a student.' });
    check('ADR-004 缓存命中 cached:true 且数据正确',
      r.status === 200 && r.json && r.json.ok && r.json.cached === true && r.json.data && r.json.data.zh === '我是一个学生',
      'status=' + r.status + ' ' + JSON.stringify(r.json));

    // mock 完整链路：未命中 → 调模型 → 写缓存 → 二次命中（不发模型请求）
    r = await request('POST', '/api/ai/explain', token, { sentence: 'She is a teacher.', apiKey: 'sk-test' });
    check('ADR-004 mock 调用成功 cached:false 且数据正确',
      r.status === 200 && r.json && r.json.ok && r.json.cached === false && r.json.data && r.json.data.orig === 'MOCK',
      'status=' + r.status + ' ' + JSON.stringify(r.json && r.json.data));
    r = await request('POST', '/api/ai/explain', token, { sentence: 'She is a teacher.' });
    check('ADR-004 调用后二次命中 cached:true', r.status === 200 && r.json && r.json.cached === true, 'status=' + r.status);

    /* ===== Phase C：ai_cache TTL（AI_CACHE_TTL=1 天） ===== */
    // 预置缓存（'I am a student.' 上方案例写入，updated_at=now → 未过期命中）
    r = await request('POST', '/api/ai/explain', token, { sentence: 'I am a student.' });
    check('ADR-008 TTL 内缓存命中 cached:true', r.status === 200 && r.json && r.json.cached === true, 'status=' + r.status);
    // 把该条 updated_at 改为 3 天前 → 过期 → 视为 miss 重新生成（占 1 次限流额度）
    const sdb = new (require('better-sqlite3'))(path.join(TMP_DB, 'chunklab.db'));
    sdb.prepare("UPDATE ai_cache SET updated_at = datetime('now','-3 days') WHERE key=?").run('deepseek-v4-flash::i am a student');
    sdb.close();
    r = await request('POST', '/api/ai/explain', token, { sentence: 'I am a student.', apiKey: 'sk-test' });
    check('ADR-008 TTL 过期后重新生成（cached:false）',
      r.status === 200 && r.json && r.json.cached === false && r.json.data && r.json.data.orig === 'MOCK',
      'status=' + r.status + ' ' + JSON.stringify(r.json && r.json.data));
    // 重新生成后 updated_at=now → 再次命中（不占额度）
    r = await request('POST', '/api/ai/explain', token, { sentence: 'I am a student.' });
    check('ADR-008 重新生成后再次命中 cached:true', r.status === 200 && r.json && r.json.cached === true, 'status=' + r.status);

    // 限流：AI_RATE_LIMIT=3（'She is a teacher.' 1 次 + TTL 过期 miss 1 次，已占 2 次），再 1 次后第 4 次 → 429
    await request('POST', '/api/ai/explain', token, { sentence: 'limit sentence number 1', apiKey: 'sk-test' });
    r = await request('POST', '/api/ai/explain', token, { sentence: 'fourth sentence triggers limit', apiKey: 'sk-test' });
    check('ADR-004 超限 → 429', r.status === 429, 'status=' + r.status + ' ' + JSON.stringify(r.json));
  } finally {
    if (child) child.kill('SIGKILL');
  }
}

main()
  .then(function () {
    try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
    console.log('\n[smoke] passed=' + passed + ' failed=' + failed);
    process.exit(failed === 0 ? 0 : 1);
  })
  .catch(function (err) {
    console.error('[smoke] ERROR: ' + (err && err.message));
    if (child) child.kill('SIGKILL');
    try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
    process.exit(1);
  });
