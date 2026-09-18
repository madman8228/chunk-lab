/**
 * credentials.test.js · 「设置自己的账号凭据」单元测试（零依赖，Node 直跑）
 *
 * 被测：server/auth.js 的 readUser() / setCredentials()，以及它保证的两件事：
 *   ① 用户名的唯一真相是 users 表（不是 token 里的 uname 副本）—— 改名后必须立刻可读回新名；
 *   ② 改名**不改 user_id** ⇒ 学习数据零迁移（本文件用 user_kv 行做实证）。
 *
 * 护栏意图（为什么这些用例必须在）：
 *   - 首访会自动注册静默游客账号（guest_<随机>，密码随机且用户不知晓），用户换设备登不回来。
 *     本能力是唯一的补救路径，故「改完能登回来」「数据没丢」必须被钉死。
 *   - 越权方向必须被钉死：userId 只能来自 token，函数不得接受请求体传入的 userId。
 *
 * 负向自证（把实现改坏，本文件必须变红）：
 *   - 若 setCredentials 只在内存里改名、不落库 → 用例 2/3 红；
 *   - 若改名顺带改了 user_id（新建行）→ 用例 8 红；
 *   - 若唯一性只靠预检、不信 UPDATE 的 UNIQUE 约束 → 用例 5 仍绿，但用例 5b（直接插入同名行后再改）会红。
 *
 * 隔离：CHUNKLAB_DATA_DIR 必须在 require 之前注入（db.js/auth.js 都在模块加载时读环境变量）。
 * 运行：node credentials.test.js
 * 退出码：0 = 全部通过，1 = 有失败或异常
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

/* ★ 先注入临时 DATA_DIR 与鉴权环境，再 require —— auth.js 在模块加载时读取它们 */
const TMP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-credentials-test-'));
process.env.CHUNKLAB_DATA_DIR = TMP_DATA_DIR;
process.env.REQUIRE_AUTH = 'true';
process.env.JWT_SECRET = 'credentials-test-secret-at-least-32-chars-long';

const bcrypt = require('bcryptjs');
const auth = require('./auth');
const db = require('./db');

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}
function throwsWith(fn, fragment) {
  try { fn(); return null; }
  catch (e) { return e; }
}

const PASS_A = 'alice-original-pass';
const alice = auth.register('alice', PASS_A);
const bob = auth.register('bob', 'bob-original-pass');

/* ===== 1. 未被改动时，用户名来自数据库 ===== */
check('readUser 返回库中的账号', auth.readUser(alice.id).username === 'alice');
check('readUser 对不存在的账号返回 null', auth.readUser(999999) === null);

/* ===== 2. 改名后立刻可读回新名（唯一真相是库，不是 token） ===== */
const renamed = auth.setCredentials(alice.id, { username: 'alice-renamed' });
check('改名返回新用户名', renamed.username === 'alice-renamed', JSON.stringify(renamed));
check('readUser 立刻反映新名（无缓存遮蔽）', auth.readUser(alice.id).username === 'alice-renamed');

/* ===== 3. 旧名失效、新名可登录；密码未动 ===== */
check('新用户名可登录', auth.login('alice-renamed', PASS_A).id === alice.id);
check('旧用户名不再可登录', !!throwsWith(() => auth.login('alice', PASS_A), ''));

/* ===== 4. 改密码：新密码生效、旧密码失效，且 bcrypt 真的用了 ===== */
const hashBefore = db.prepare('SELECT password_hash FROM users WHERE id=?').get(alice.id).password_hash;
auth.setCredentials(alice.id, { password: 'alice-new-pass' });
const hashAfter = db.prepare('SELECT password_hash FROM users WHERE id=?').get(alice.id).password_hash;
check('密码以 bcrypt 哈希存储（非明文）', hashAfter !== 'alice-new-pass' && hashAfter.indexOf('$2') === 0);
check('改密后哈希确实变化', hashBefore !== hashAfter);
check('新密码可登录', auth.login('alice-renamed', 'alice-new-pass').id === alice.id);
check('旧密码不再可登录', !!throwsWith(() => auth.login('alice-renamed', PASS_A), ''));
check('哈希与明文一致（bcrypt 校验通过）',
  bcrypt.compareSync('alice-new-pass', db.prepare('SELECT password_hash h FROM users WHERE id=?').get(alice.id).h));

/* ===== 5. 用户名唯一性 ===== */
const dupErr = throwsWith(() => auth.setCredentials(alice.id, { username: 'bob' }), '');
check('占用他人用户名被拒', !!dupErr && /已被占用/.test(dupErr.message), dupErr && dupErr.message);
check('被拒后自己的账号名未被改动', auth.readUser(alice.id).username === 'alice-renamed');
check('被拒后 bob 的账号未受影响', auth.readUser(bob.id).username === 'bob');

/* 5b. 唯一性必须由 users.username UNIQUE 约束兜底，而不是只靠预检 —— 预检与 UPDATE 之间有竞态。
       竞态无法在单进程里真造，故直接验证「UPDATE 抛约束错误时被映射成用户可懂的提示」
       这一分支本身（否则该分支是死代码，竞态下会把 500 泄漏给用户）。 */
const realPrepare = db.prepare.bind(db);
db.prepare = function (sql) {
  const stmt = realPrepare(sql);
  if (/UPDATE users SET username/.test(sql)) {
    return {
      get: stmt.get.bind(stmt),
      run: function () {
        const e = new Error('UNIQUE constraint failed: users.username');
        e.code = 'SQLITE_CONSTRAINT_UNIQUE';
        throw e;
      }
    };
  }
  return stmt;
};
const mapped = throwsWith(() => auth.setCredentials(alice.id, { username: 'race-name' }), '');
db.prepare = realPrepare;
check('UPDATE 撞 UNIQUE 约束 → 映射为「用户名已被占用」（不泄漏 500）',
  !!mapped && /已被占用/.test(mapped.message), mapped && mapped.message);
check('约束分支被触发后账号名未被改动', auth.readUser(alice.id).username === 'alice-renamed');

/* ===== 6. 入参校验 ===== */
[
  ['用户名过短', { username: 'a' }],
  ['用户名过长', { username: 'x'.repeat(33) }],
  ['用户名非字符串', { username: 12345 }],
  ['密码过短', { password: '12345' }],
  ['密码非字符串', { password: 123456 }],
  ['密码超过 72 字节', { password: 'x'.repeat(73) }],
  ['空改动', {}]
].forEach(function (pair) {
  const e = throwsWith(() => auth.setCredentials(alice.id, pair[1]), '');
  check('入参校验：' + pair[0] + ' → 拒绝', !!e, e ? '' : '未抛错');
});
check('校验失败未改动任何字段', auth.readUser(alice.id).username === 'alice-renamed'
  && auth.login('alice-renamed', 'alice-new-pass').id === alice.id);

/* ===== 7. 越权方向：函数只认 userId，改不到别人的账号 ===== */
const beforeBob = auth.readUser(bob.id).username;
auth.setCredentials(bob.id, { username: 'bob-renamed' });
check('改自己生效', auth.readUser(bob.id).username === 'bob-renamed');
check('改自己不影响他人', auth.readUser(alice.id).username === 'alice-renamed');
check('bob 原名确实变了（对照组有效）', beforeBob !== 'bob-renamed');
const ghostErr = throwsWith(() => auth.setCredentials(999999, { username: 'ghost' }), '');
check('不存在的账号被拒', !!ghostErr && /账号不存在/.test(ghostErr.message), ghostErr && ghostErr.message);

/* ===== 8. 数据零迁移自证：改名不改 user_id ⇒ 原数据仍挂在同一账号下 ===== */
db.prepare('INSERT INTO user_kv (user_id, k, v_json, rev, deleted_at) VALUES (?,?,?,?,NULL)')
  .run(alice.id, 'stats', JSON.stringify({ answered: 42 }), 1);
const kvByOldId = db.prepare('SELECT v_json FROM user_kv WHERE user_id=? AND k=?').get(alice.id, 'stats');
check('改名前数据挂在 alice.id 下', !!kvByOldId && JSON.parse(kvByOldId.v_json).answered === 42);

auth.setCredentials(alice.id, { username: 'alice-final' });
const kvAfterRename = db.prepare('SELECT v_json FROM user_kv WHERE user_id=? AND k=?').get(alice.id, 'stats');
check('改名后同一 user_id 仍能取回数据（零迁移）', !!kvAfterRename && JSON.parse(kvAfterRename.v_json).answered === 42);
check('改名后登录仍拿到同一个 user_id', auth.login('alice-final', 'alice-new-pass').id === alice.id);

/* ===== 9. token 里的 uname 是签发时的副本，不随改名更新（提醒别拿它当账号名展示） ===== */
const staleToken = auth.signToken(alice.id, 'alice-renamed');
const decoded = auth.verifyToken(staleToken);
check('旧 token 仍然有效且 uid 正确', !!decoded && decoded.userId === alice.id);
check('token 内 uname 保持签发时的旧值（故服务端必须回查 users 表）', decoded.username === 'alice-renamed');

console.log('\n[credentials] ' + passed + ' 通过 / ' + failed + ' 失败');
if (failed === 0) {
  console.log('[credentials] 改名不换 user_id、旧名失效新名可登、唯一性由 DB 约束兜底、越权面封闭');
}
process.exitCode = failed === 0 ? 0 : 1;
