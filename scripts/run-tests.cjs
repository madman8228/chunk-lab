'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const manifest = require('./test-manifest.cjs');

const ROOT = path.resolve(__dirname, '..');
const groups = new Set(process.argv.slice(2));
const selected = groups.size && !groups.has('all')
  ? manifest.filter((entry) => groups.has(entry.group))
  : manifest;
const timeoutMs = Number(process.env.TEST_TIMEOUT_MS || 180000);
const resultDir = path.join(ROOT, 'output', 'test-results');
const startedAt = new Date();
const runId = process.env.TEST_RUN_ID || (startedAt.toISOString().replace(/[-:.TZ]/g, '') + '-' + process.pid);
if (!/^[a-zA-Z0-9._-]+$/.test(runId)) throw new Error('TEST_RUN_ID contains unsafe path characters');
const runDir = path.join(resultDir, runId);

function redactOutput(value) {
  return String(value || '').replace(/((?:"?(?:password|token|apiKey|authorization|cookie)"?)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|Bearer\s+[^\s,;}]+|[^\s,;}]+)/ig, '$1[REDACTED]');
}

function safeFileName(value) {
  return String(value || 'test').replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function killProcessTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    try { spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (_) {}
    return;
  }
  try { process.kill(-pid, 'SIGKILL'); } catch (_) { try { process.kill(pid, 'SIGKILL'); } catch (_) {} }
}

function shouldFingerprint(file) {
  return file && !/(^|[\\/])(\.git|node_modules|output|coverage)([\\/]|$)/.test(file) &&
    !/(^|[\\/])(?:\.env(?:\.|$)|.*\.db(?:-shm|-wal)?$)/i.test(file);
}

function worktreeFingerprint() {
  const status = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: ROOT, encoding: 'utf8' });
  const files = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: ROOT, encoding: 'utf8' });
  const listed = files.status === 0 ? files.stdout.split('\0').filter(shouldFingerprint) : [];
  const unique = Array.from(new Set(listed)).sort();
  const hash = crypto.createHash('sha256');
  let hashedFiles = 0;
  unique.forEach((file) => {
    const full = path.join(ROOT, file);
    try {
      if (!fs.statSync(full).isFile()) return;
      hash.update(file.replace(/\\/g, '/') + '\0');
      hash.update(fs.readFileSync(full));
      hashedFiles++;
    } catch (_) {}
  });
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return {
    gitHead: head.status === 0 ? head.stdout.trim() : null,
    status: status.status === 0 ? status.stdout : null,
    contentSha256: hash.digest('hex'),
    hashedFiles,
  };
}

function writeAttempt(runDirPath, runIdValue, entry, attempt, index) {
  fs.writeFileSync(path.join(runDirPath, safeFileName(entry.id) + '.attempt-' + (index + 1) + '.json'), JSON.stringify({
    runId: runIdValue,
    entry,
    attempt: { code: attempt.code, signal: attempt.signal, timedOut: !!attempt.timedOut, ms: attempt.ms, error: attempt.error, stdout: attempt.stdout, stderr: attempt.stderr, output: attempt.output }
  }, null, 2) + '\n');
}

function run(entry, options) {
  /* 单次调用可覆盖超时预算：测试「调度器超时行为」时需要一个远小于夹具运行时长的小预算，
     而测试「夹具能否跑完」时需要大于宿主冷启动的大预算 —— 二者不能共用一个常量。 */
  const composite = entry.file.replace(/\\/g, '/') === 'e2e/transparent-save.test.js';
  const budgetMs = options && Number(options.timeoutMs) > 0 ? Number(options.timeoutMs)
    : composite && !process.env.TEST_TIMEOUT_MS ? timeoutMs * 6 + 30000 : timeoutMs;
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [entry.file].concat(entry.args || []), {
      cwd: path.resolve(ROOT, entry.cwd),
      env: options && options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    let timedOut = false;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child.pid);
    }, budgetMs);
    child.on('close', (code, signal) => {
      const output = stdout + stderr;
      finish({ id: entry.id, file: entry.file, group: entry.group, code: timedOut ? 124 : (code === null ? 1 : code), signal, timedOut, ms: Date.now() - started, stdout: redactOutput(stdout), stderr: redactOutput(stderr), output: redactOutput(output) });
    });
    child.on('error', (error) => {
      finish({ id: entry.id, file: entry.file, group: entry.group, code: 1, error: error.message, timedOut: false, ms: Date.now() - started, stdout: redactOutput(stdout), stderr: redactOutput(stderr), output: redactOutput(stdout + stderr) });
    });
  });
}

async function runWithRetry(entry, options) {
  const configured = process.env.TEST_RETRIES;
  const retries = configured === undefined
    ? (entry.group === 'browser' ? 1 : 0)
    : Math.max(0, Number(configured) || 0);
  const attempts = [];
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) console.log('[tests] ' + entry.id + ' retry ' + attempt + '/' + retries + ' ...');
    const result = await run(entry);
    attempts.push(result);
    if (options && options.runDir) writeAttempt(options.runDir, options.runId, entry, result, attempt);
    if (result.code === 0) {
      return { ...result, flaky: attempts.length > 1, attempts };
    }
  }
  const last = attempts[attempts.length - 1];
  return { ...last, flaky: false, attempts };
}

async function main() {
  fs.mkdirSync(resultDir, { recursive: true });
  if (fs.existsSync(runDir)) throw new Error('test result runId already exists: ' + runId);
  fs.mkdirSync(runDir, { recursive: true });
  const worktreeBefore = worktreeFingerprint();
  const config = {
    testRetries: process.env.TEST_RETRIES === undefined ? null : process.env.TEST_RETRIES,
    timeoutMs,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    manifestSha256: crypto.createHash('sha256').update(JSON.stringify(selected)).digest('hex'),
  };
  const results = [];
  for (const entry of selected) {
    process.stdout.write('[tests] ' + entry.id + ' ... ');
    const result = await runWithRetry(entry, { runDir, runId });
    results.push(result);
    /* 显式 skip（子进程打印 [SKIP] 后以 0 退出）必须在日志里可见并单独计数：
       否则 CI 会把「因缺 fixture 没跑」误读成「跑过且通过」—— 安全网就不可信了。
       注意：skip 只对「显式打印 [SKIP] 且退出 0」成立，真正的失败（含找不到必须判红的场景）不受影响。 */
    const skipped = result.code === 0 && /\[SKIP\]/.test(result.output || '');
    const label = result.code === 0 ? (skipped ? 'SKIP' : 'PASS') : 'FAIL(' + result.code + ')';
    console.log(label + ' ' + (result.ms / 1000).toFixed(1) + 's');
    if (result.flaky) console.log('  [tests] flaky: 首次失败后重跑通过');
    if (skipped) {
      result.output.split(/\r?\n/).filter((line) => line.indexOf('[SKIP]') >= 0)
        .forEach((line) => console.log('  ' + line.trim()));
    } else if (result.code !== 0) {
      const lines = result.output.split(/\r?\n/).filter(Boolean);
      lines.slice(-12).forEach((line) => console.log('  ' + line));
    }
  }
  const finishedAt = new Date();
  const worktreeAfter = worktreeFingerprint();
  const failed = results.filter((result) => result.code !== 0);
  const skipped = results.filter((result) => result.code === 0 && /\[SKIP\]/.test(result.output || ''));
  const skippedSet = new Set(skipped.map((result) => result.id));
  const passed = results.filter((result) => result.code === 0 && !skippedSet.has(result.id));
  const summary = {
    runId,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    timeoutMs,
    config,
    worktreeBefore,
    worktreeAfter,
    worktreeChanged: worktreeBefore.contentSha256 !== worktreeAfter.contentSha256 || worktreeBefore.status !== worktreeAfter.status,
    selected: selected.map((entry) => entry.id),
    counts: { total: results.length, passed: passed.length, failed: failed.length, skipped: skipped.length, flaky: results.filter((result) => result.flaky).length },
    results,
  };
  for (const group of new Set(selected.map((entry) => entry.group))) {
    const groupResults = results.filter((result) => result.group === group);
    fs.writeFileSync(path.join(resultDir, group + '.json'), JSON.stringify({ runId, startedAt: summary.startedAt, finishedAt: summary.finishedAt, config, group, results: groupResults }, null, 2) + '\n');
  }
  fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log('[tests] passed ' + passed.length + '/' + results.length +
    (skipped.length ? '（skipped ' + skipped.length + '：' + skipped.map((result) => result.id).join(', ') + '）' : ''));
  if (failed.length) console.log('[tests] failed: ' + failed.map((result) => result.id).join(', '));
  process.exitCode = failed.length ? 1 : 0;
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });

module.exports = { run, runWithRetry, manifest };
