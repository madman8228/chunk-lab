'use strict';

/* 开放模式存量迁移隔离回归：真实源/目标服务 + 只转发请求的目标代理。
 * 代理会把旧 /api/import 直接拒绝，确保迁移脚本没有悄悄回到覆盖式旁路。
 */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { freePort } = require('./lib/free-port');

const ROOT = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(ROOT, 'server');
const SOURCE_PORT = freePort(9710, 100);
const TARGET_PORT = freePort(9810, 100);
const SOURCE = 'http://127.0.0.1:' + SOURCE_PORT;
const TARGET = 'http://127.0.0.1:' + TARGET_PORT;
/* The host may reserve individual ports even when netstat reports them as
 * free.  Let the OS choose the proxy port to avoid a test-only EACCES race. */
let PROXY = '';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-migrate-'));
const sourceDb = path.join(TMP, 'source');
const targetDb = path.join(TMP, 'target');
const backupDir = path.join(TMP, 'migration-backups');
const username = 'migration-test-user';
const password = 'migration-test-password-123';
const children = [];
let proxy;
let importAttempts = 0;
let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (detail ? ' → ' + detail : '')); }
}

function request(base, method, route, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(base + route);
    const raw = body === undefined ? null : JSON.stringify(body);
    const headers = raw ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw) } : {};
    if (token) headers.Authorization = 'Bearer ' + token;
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers }, res => {
      let text = '';
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch (_) {}
        resolve({ status: res.statusCode, json, text });
      });
    });
    req.on('error', reject);
    if (raw) req.write(raw);
    req.end();
  });
}

function startServer(port, dataDir, requireAuth) {
  const child = spawn(process.execPath, ['index.js'], {
    cwd: SERVER_DIR,
    env: Object.assign({}, process.env, {
      PORT: String(port), CHUNKLAB_DATA_DIR: dataDir,
      REQUIRE_AUTH: requireAuth ? 'true' : 'false',
      NODE_ENV: 'test',
      JWT_SECRET: 'migration-test-jwt-secret-012345678901234567890123'
    }),
    stdio: 'ignore'
  });
  children.push(child);
  return child;
}

async function waitHealthy(base) {
  /* 2026-09-13 根因修复：原预算 80×50ms=4s。Windows 冷启动（杀软扫描 node_modules、
     磁盘冷缓存）实测可超 4s → 探活超时假红，且它是 test 链里第一个 server 级测试，
     一红整条 && 链全断。手动同参启动 server 实测 health 可 200，证明是预算问题非服务问题。
     放宽到 200×100ms=20s：就绪仍秒级返回（首次 200 即 return），只是给慢启动留余量。 */
  for (let i = 0; i < 200; i++) {
    try { if ((await request(base, 'GET', '/api/health')).status === 200) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('服务未就绪: ' + base);
}

function startRejectingImportProxy() {
  proxy = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (req.url === '/api/import' && req.method === 'POST') {
        importAttempts++;
        res.writeHead(599, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'legacy import is forbidden in this test' }));
        return;
      }
      const upstream = http.request({ hostname: '127.0.0.1', port: TARGET_PORT,
        path: req.url, method: req.method, headers: req.headers }, response => {
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res);
      });
      upstream.on('error', error => { res.writeHead(502); res.end(error.message); });
      if (body) upstream.write(body);
      upstream.end();
    });
  });
  return new Promise((resolve, reject) => {
    proxy.once('error', reject);
    proxy.listen(0, '127.0.0.1', () => {
      PROXY = 'http://127.0.0.1:' + proxy.address().port;
      resolve();
    });
  });
}

function stopChild(child) {
  return new Promise(resolve => {
    if (!child || child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill();
  });
}

const sourceMem = {
  decks: [{ id: 'open-deck', name: '开放模式存量', items: [{ sentence: 'Hello there.' }] }],
  best: { 'open-deck': 3 },
  mastered: { 'open-sentence': { at: 1 } },
  stats: {
    totalAnswered: 4, totalRounds: 2,
    bySentence: { 'open-sentence': { sentence: 'Hello there.', times: 4, correct: 3 } },
    events: [{ id: 'open-event', kind: 'answer', ok: true, key: 'open-sentence', at: 1 }]
  },
  settings: { mode: 'choose' }, reinforceBook: [], deletedItems: {}
};
const sourcePayload = { mem: sourceMem, courses: [], courseProgress: {} };

(async () => {
  try {
    startServer(SOURCE_PORT, sourceDb, false);
    startServer(TARGET_PORT, targetDb, true);
    await waitHealthy(SOURCE);
    await waitHealthy(TARGET);
    await startRejectingImportProxy();

    let r = await request(SOURCE, 'PUT', '/api/data', sourcePayload);
    check('开放模式源数据可建立测试快照', r.status === 200, r.text);

    const cli = path.join(SERVER_DIR, 'migrate-open-to-user.js');
    const run = args => new Promise(resolve => {
      const child = spawn(process.execPath, [cli].concat(args), {
        cwd: ROOT,
        env: Object.assign({}, process.env, { MIGRATION_BACKUP_DIR: backupDir }),
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let stdout = '', stderr = '';
      child.stdout.on('data', c => { stdout += c; });
      child.stderr.on('data', c => { stderr += c; });
      child.on('close', code => resolve({ code, stdout, stderr }));
    });

    r = await run([SOURCE, PROXY, username, password]);
    check('缺少 --confirm 时迁移不执行', r.code !== 0 && importAttempts === 0,
      'code=' + r.code + ' ' + r.stderr);

    r = await run([SOURCE, PROXY, username, password, '--confirm']);
    check('显式确认后迁移成功', r.code === 0, 'code=' + r.code + ' ' + r.stderr);
    check('迁移过程未调用旧 /api/import 旁路', importAttempts === 0, 'attempts=' + importAttempts);
    const backups = fs.existsSync(backupDir) ? fs.readdirSync(backupDir).filter(f => f.startsWith('migrate-')) : [];
    check('迁移前源快照已写入独立备份目录', backups.length === 1, JSON.stringify(backups));

    r = await request(PROXY, 'POST', '/api/auth/login', { username, password });
    check('目标账号可登录', r.status === 200 && r.json && r.json.token, r.text);
    const token = r.json && r.json.token;
    const after = await request(PROXY, 'GET', '/api/data', undefined, token);
    const mem = after.json && after.json.mem;
    check('目标账号获得完整题库与学习记录', after.status === 200 && mem && mem.decks.length === 1 &&
      mem.stats.bySentence['open-sentence'] && mem.stats.events.length === 1 &&
      mem.mastered['open-sentence'], after.text);

    const businessSnapshot = value => JSON.stringify({
      mem: value.mem, courses: value.courses, courseProgress: value.courseProgress
    });
    const beforeRepeat = businessSnapshot(after.json);
    r = await run([SOURCE, PROXY, username, password, '--confirm']);
    const repeat = await request(PROXY, 'GET', '/api/data', undefined, token);
    check('重复迁移不会增加题库/事件副本且结果稳定', r.code === 0 &&
      businessSnapshot(repeat.json) === beforeRepeat, 'code=' + r.code);
    check('重复迁移仍未调用旧 /api/import', importAttempts === 0, 'attempts=' + importAttempts);
  } catch (error) {
    failed++;
    console.error('[migrate-open-to-user e2e] ' + error.stack);
  } finally {
    if (proxy) await new Promise(resolve => proxy.close(resolve));
    for (const child of children) await stopChild(child);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log('\n[migrate-open-to-user e2e] passed=' + passed + ' failed=' + failed);
  process.exitCode = failed ? 1 : 0;
})();
