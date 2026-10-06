/**
 * backup-cli.test.js · 自动备份 CLI 单测（零依赖）
 *
 * 起一个 mock HTTP server 模拟 /api/export 与 /api/import，
 * 用异步子进程跑 backup-cli.js 验证：备份落盘 / 保留策略 / 恢复往返 / 错误处理。
 * Node 直跑：node server/backup-cli.test.js
 */
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { gunzipSync } = require('zlib');
const crypto = require('crypto');
const BackupCLI = require('./backup-cli');

const CLI = path.join(__dirname, 'backup-cli.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-backup-test-'));
const BACKUP_DIR = path.join(TMP, 'backups');

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}

const EXPORT_PAYLOAD = {
  __app: 'chunklab', __version: 2, exportedAt: new Date().toISOString(),
  mem: { decks: [{ id: 'd1', name: 'Deck', items: [{ sent: 'A' }] }], best: {}, mastered: {}, stats: {}, settings: { apiKey: 'private-key' }, reinforceBook: [] },
  courses: [], courseProgress: {}, saveState: { unconfirmedOperations: [{ requestId: 'pending-cli-01', operation: { type: 'learning.answer' } }] }
};

const state = { importBodies: [], resolveBodies: [], recoveryBodies: [], previewBodies: [], applyBodies: [], legacyCalls: 0 };
const server = http.createServer(function (req, res) {
  const chunks = [];
  req.on('data', function (c) { chunks.push(c); });
  req.on('end', function () {
    const bytes = Buffer.concat(chunks), text = bytes.toString('utf8');
    if (req.url === '/api/export' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(EXPORT_PAYLOAD));
    } else if (req.url === '/api/auth/me' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ user: { id: 1, username: 'backup-test' } }));
    } else if (req.url === '/api/sync/batch' && req.method === 'GET') {
      state.legacyCalls++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ kind: 'batch', seq: 7, token: 'a'.repeat(64), snapshot: { mem: {}, courses: [], courseProgress: {} } }));
    } else if (req.url === '/api/sync/batch/resolve' && req.method === 'POST') {
      state.legacyCalls++;
      state.resolveBodies.push(JSON.parse(text || '{}'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, kind: 'batch', seq: 8 }));
    } else if (req.url === '/api/recovery/ingest' && req.method === 'POST') {
      const sourceId = req.headers['x-chunklab-recovery-source'], sourceHash = req.headers['x-chunklab-recovery-sha256'];
      const raw = gunzipSync(bytes);
      if (crypto.createHash('sha256').update(raw).digest('hex') !== sourceHash) {
        res.writeHead(400); res.end('{"error":"hash mismatch"}'); return;
      }
      state.recoveryBodies.push({ sourceId, sourceHash, source: JSON.parse(raw.toString('utf8')) });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, sourceId, sourceHash, manifest: { verified: true } }));
    } else if (/^\/api\/recovery\/[^/]+\/preview$/.test(req.url) && req.method === 'POST') {
      const sourceId = decodeURIComponent(req.url.split('/')[3]), body = JSON.parse(text || '{}');
      state.previewBodies.push({ sourceId, body });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, sourceId, sourceHash: body.sourceHash, expectedSeq: 7,
        previewToken: 'b'.repeat(64), eligible: true, reason: null, counts: { decks: 1, courses: 0 } }));
    } else if (/^\/api\/recovery\/[^/]+\/apply$/.test(req.url) && req.method === 'POST') {
      const sourceId = decodeURIComponent(req.url.split('/')[3]);
      state.applyBodies.push({ sourceId, body: JSON.parse(text || '{}') });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end('{"ok":true,"state":"applied","seq":8}');
    } else if (req.url === '/api/data' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ seq: 0, mem: {}, courses: [], courseProgress: {} }));
    } else if (req.url === '/api/import' && req.method === 'POST') {
      state.importBodies.push(JSON.parse(text || '{}'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } else {
      res.writeHead(404); res.end('{"error":"not found"}');
    }
  });
});

function run(args, env) {
  return new Promise(function (resolve) {
    const child = spawn(process.execPath, [CLI].concat(args), {
      env: Object.assign({}, process.env, {
        BASE_URL: 'http://127.0.0.1:' + PORT,
        BACKUP_DIR: BACKUP_DIR,
        BACKUP_KEEP: (env && env.KEEP) || '14'
      })
    });
    let out = '', err = '';
    child.stdout.on('data', function (c) { out += c; });
    child.stderr.on('data', function (c) { err += c; });
    child.on('close', function (code) { resolve({ status: code, stdout: out, stderr: err }); });
  });
}
function backups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR).filter(function (f) { return f.indexOf('chunklab_backup_') === 0; }).sort();
}

let PORT = 0;
server.listen(0, '127.0.0.1', async function () {
  PORT = server.address().port;

  /* ===== 1. backup 落盘 + 内容 ===== */
  let r = await run(['backup']);
  check('backup: 退出码 0', r.status === 0, 'status=' + r.status + ' ' + r.stderr);
  const b1 = backups();
  check('backup: 生成 1 份备份文件', b1.length === 1, JSON.stringify(b1));
  const content = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, b1[0]), 'utf8'));
  check('backup: 内容为 export 全量（mem.decks 可解析）',
    content && content.__app === 'chunklab' && content.mem && content.mem.decks && content.mem.decks.length === 1,
    JSON.stringify(content && content.mem && content.mem.decks));

  /* ===== 2. 保留策略：KEEP=2 时连续 3 次只留 2 份 ===== */
  await run(['backup'], { KEEP: '2' });
  r = await run(['backup'], { KEEP: '2' });
  check('backup: KEEP=2 连续 3 次后只保留 2 份', backups().length === 2, JSON.stringify(backups()));
  check('backup: 清理提示输出', r.stdout.indexOf('清理旧备份') >= 0, r.stdout);

  /* ===== 3. 固定来源预览 → 明确确认 → server-authoritative apply ===== */
  const latest = backups()[backups().length - 1];
  const backupPath = path.join(BACKUP_DIR, latest);
  r = await run(['preview', backupPath]);
  const previewPath = backupPath + '.preview.json';
  check('preview: 退出码 0 且生成固定预览', r.status === 0 && fs.existsSync(previewPath), 'status=' + r.status + ' ' + r.stderr);
  const fixed = JSON.parse(fs.readFileSync(previewPath, 'utf8'));
  check('preview: 绑定账号/来源 hash/服务端 seq 与原文件摘要', state.applyBodies.length === 0 && fixed.kind === 'chunklab-recovery-preview-v2' &&
    fixed.userId === '1' && fixed.previewToken.length === 64 && fixed.sourceHash.length === 64 && fixed.source.sha256,
    JSON.stringify(fixed));
  const archivedSource = state.recoveryBodies[0] && state.recoveryBodies[0].source;
  check('preview: 服务器已保全脱敏来源及完整未确认操作', !!archivedSource && archivedSource.format === 'chunklab.recovery-source' &&
    archivedSource.localStorage['chunklab.v1'].indexOf('private-key') < 0 &&
    archivedSource.stores.pendingOperations[0].requestId === 'pending-cli-01' &&
    archivedSource.stores.pendingOperations[0].operation.type === 'learning.answer', JSON.stringify(archivedSource && archivedSource.stores));
  r = await run(['apply', previewPath]);
  check('apply: 缺少 --confirm 时拒绝写入', r.status !== 0 && state.applyBodies.length === 0, 'status=' + r.status + ' ' + r.stderr);
  r = await run(['apply', previewPath, '--confirm']);
  check('apply: 按固定 previewToken/hash/seq 调用 recovery apply', r.status === 0 && state.applyBodies.length === 1 &&
    state.applyBodies[0].sourceId === fixed.sourceId && state.applyBodies[0].body.sourceHash === fixed.sourceHash &&
    state.applyBodies[0].body.expectedSeq === fixed.expectedSeq && state.applyBodies[0].body.previewToken === fixed.previewToken,
    JSON.stringify(state.applyBodies));
  check('preview/apply: 不再调用旧整账号冲突接口', state.legacyCalls === 0 && state.resolveBodies.length === 0,
    JSON.stringify({ calls: state.legacyCalls, resolves: state.resolveBodies.length }));
  const chunkCalls = [];
  const chunkResult = await BackupCLI.uploadRecoverySource('large-backup-source', 'c'.repeat(64), Buffer.alloc(9),
    Buffer.alloc(4 * 1024 * 1024 + 5), async (method, route, body, headers) => {
      chunkCalls.push({ method, route, body, headers });
      return route.endsWith('/complete') ? { ok: true, state: 'archived' } : { state: 'staged' };
    });
  check('preview: 大归档按 4 MiB 分块并在完整清单上收尾', chunkResult.ok &&
    chunkCalls.filter(call => call.route.endsWith('/chunk')).length === 2 &&
    chunkCalls[0].headers['X-ChunkLab-Recovery-Chunk-Index'] === '0' &&
    chunkCalls[1].headers['X-ChunkLab-Recovery-Chunk-Index'] === '1' && chunkCalls[2].route.endsWith('/complete'),
    JSON.stringify(chunkCalls.map(call => call.route)));
  r = await run(['restore', backupPath]);
  check('restore: 旧覆盖式命令拒绝执行', r.status !== 0 && r.stderr.indexOf('旧 restore FILE 已关闭') >= 0, 'status=' + r.status + ' stderr=' + r.stderr);

  /* ===== 4. 错误处理：preview 不存在的文件 ===== */
  r = await run(['preview', path.join(TMP, 'nope.json')]);
  check('preview: 文件不存在 → 非零退出 + 错误信息', r.status !== 0 && r.stderr.indexOf('备份文件不存在') >= 0, 'status=' + r.status + ' stderr=' + r.stderr);

  /* ===== 5. list ===== */
  r = await run(['list']);
  check('list: 列出备份文件', r.status === 0 && r.stdout.indexOf('chunklab_backup_') >= 0, r.stdout);

  try { fs.unlinkSync(previewPath); } catch (e) { /* best-effort */ }
  server.close();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
  console.log('\n[backup-cli.test] passed=' + passed + ' failed=' + failed);
  process.exit(failed === 0 ? 0 : 1);
});
