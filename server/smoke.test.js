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
  CHUNKLAB_DATA_DIR: TMP_DB
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
