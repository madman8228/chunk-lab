'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

/* Keep the scheduler contract executable without adding a second test runner. */
/* 这条自测里有两个互相冲突的需求，必须分开，否则它量的就是「宿主进程创建有多快」：
 *   ① 正常夹具要能跑完 —— 预算必须大于宿主冷启动（本机实测普通 node 冷启动 5.4s）；
 *   ② 超时行为要能被断言 —— 预算必须远小于夹具运行时长。
 * 旧写法用一个 1500ms 常量同时满足 ① ②，只有在「宿主冷启动 < 1.5s」的机器上才成立，
 * 于是本机必然假红（夹具被超时杀掉 ⇒ 124 !== 0）。
 * 现改为：默认预算 60s（宽松、宿主无关）；只有验超时的两条显式传 { timeoutMs }，
 * 且夹具改为**永不自行退出** —— 这样「被杀」是唯一可能结局，与宿主快慢无关。 */
process.env.TEST_TIMEOUT_MS = '60000';
const { run, runWithRetry } = require('./run-tests.cjs');

const fixtureDir = path.resolve(__dirname, '..', 'output', 'test-runner-fixtures');
fs.mkdirSync(fixtureDir, { recursive: true });
fs.writeFileSync(path.join(fixtureDir, 'pass.js'), "console.log('pass fixture');\n");
fs.writeFileSync(path.join(fixtureDir, 'fail.js'), "console.error('fail fixture'); process.exit(7);\n");
/* 永不自行退出：只能被调度器杀掉，故 124 断言不依赖宿主速度 */
fs.writeFileSync(path.join(fixtureDir, 'hang.js'), "setInterval(function () {}, 1000);\n");
fs.writeFileSync(path.join(fixtureDir, 'flaky.js'), "const fs = require('fs'); const p = 'output/test-runner-fixtures/flaky.marker'; if (!fs.existsSync(p)) { fs.writeFileSync(p, 'seen'); console.error('flaky first attempt'); process.exit(9); } console.log('flaky retry passed');\n");
fs.writeFileSync(path.join(fixtureDir, 'secret.js'), "console.log(JSON.stringify({password:'password-secret', token:'token-secret', authorization:'Bearer auth-secret'}));\n");
fs.writeFileSync(path.join(fixtureDir, 'child-tree.js'), "const fs = require('fs'); const {spawn} = require('child_process'); const child = spawn(process.execPath, ['-e', 'setInterval(function(){}, 1000)'], {stdio:'ignore'}); fs.writeFileSync('output/test-runner-fixtures/child-pids.json', JSON.stringify({parent:process.pid, child:child.pid})); setInterval(function(){}, 1000);\n");

function withRetries(value, callback) {
  const previous = process.env.TEST_RETRIES;
  if (value === undefined) delete process.env.TEST_RETRIES;
  else process.env.TEST_RETRIES = String(value);
  return Promise.resolve().then(callback).finally(function () {
    if (previous === undefined) delete process.env.TEST_RETRIES;
    else process.env.TEST_RETRIES = previous;
  });
}

function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (_) { return false; }
}

async function waitUntilDead(pids) {
  /* Windows 上 taskkill /T /F 收尾可能慢于 1s（旧值 20×50ms）⇒ 放宽到 100×100ms=10s */
  for (let i = 0; i < 100; i++) {
    if (pids.every(function (pid) { return !isAlive(pid); })) return;
    await new Promise(function (resolve) { setTimeout(resolve, 100); });
  }
  assert.fail('timeout cleanup left a child process alive: ' + pids.join(','));
}

(async function () {
  try {
    const ok = await run({ id: 'fixture:pass', file: 'output/test-runner-fixtures/pass.js', cwd: '.', group: 'unit', args: [] });
    assert.strictEqual(ok.code, 0);
    assert.match(ok.output, /pass fixture/);

    const failed = await run({ id: 'fixture:fail', file: 'output/test-runner-fixtures/fail.js', cwd: '.', group: 'unit', args: [] });
    assert.strictEqual(failed.code, 7);
    assert.match(failed.output, /fail fixture/);

    const timedOut = await run({ id: 'fixture:hang', file: 'output/test-runner-fixtures/hang.js', cwd: '.', group: 'unit', args: [] }, { timeoutMs: 1500 });
    assert.strictEqual(timedOut.code, 124);
    const spawned = await run({ id: 'fixture:spawn-error', file: 'output/test-runner-fixtures/pass.js', cwd: 'output/test-runner-missing-cwd', group: 'unit', args: [] });
    assert.strictEqual(spawned.code, 1);
    assert.match(spawned.error, /ENOENT|not found/i);
    const secrets = await run({ id: 'fixture:secret', file: 'output/test-runner-fixtures/secret.js', cwd: '.', group: 'unit', args: [] });
    assert.strictEqual(secrets.code, 0);
    assert.ok(!/password-secret|token-secret|auth-secret/.test(secrets.output));
    assert.match(secrets.output, /\[REDACTED\]/);
    /* 预算需大于「父夹具冷启动 + 写 pids 文件」；夹具本身永不退出，故 124 与宿主无关 */
    const tree = await run({ id: 'fixture:child-tree', file: 'output/test-runner-fixtures/child-tree.js', cwd: '.', group: 'unit', args: [] }, { timeoutMs: 20000 });
    assert.strictEqual(tree.code, 124);
    const pids = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'child-pids.json'), 'utf8'));
    await waitUntilDead([pids.parent, pids.child]);
    const persistent = await withRetries(1, function () {
      return runWithRetry({ id: 'fixture:persistent', file: 'output/test-runner-fixtures/fail.js', cwd: '.', group: 'browser', args: [] });
    });
    assert.strictEqual(persistent.code, 7);
    assert.strictEqual(persistent.flaky, false);
    assert.strictEqual(persistent.attempts.length, 2);
    /* The strict full-suite gate intentionally sets TEST_RETRIES=0.  This
       contract test is specifically about the scheduler's default retry
       policy, so isolate it from the parent process override. */
    const previousRetries = process.env.TEST_RETRIES;
    delete process.env.TEST_RETRIES;
    let flaky;
    try {
      flaky = await runWithRetry({ id: 'fixture:flaky', file: 'output/test-runner-fixtures/flaky.js', cwd: '.', group: 'browser', args: [] });
    } finally {
      if (previousRetries === undefined) delete process.env.TEST_RETRIES;
      else process.env.TEST_RETRIES = previousRetries;
    }
    assert.strictEqual(flaky.code, 0);
    assert.strictEqual(flaky.flaky, true);
    assert.strictEqual(flaky.attempts.length, 2);
    assert.match(flaky.attempts[0].stderr, /flaky first attempt/);
    assert.match(flaky.attempts[1].stdout, /flaky retry passed/);
    console.log('run-tests scheduler contract passed');
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
})().catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
