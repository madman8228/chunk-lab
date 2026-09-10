#!/usr/bin/env node
'use strict';
/**
 * deploy-safety.test.js · 部署安全护栏的验证（静态 + 运行时）
 *
 * 为什么需要它：scripts/check-deploy-files.js 里的「快照 → 重启」护栏如果永远不响，
 * 它就只是一段没人验证过的代码——护栏失效和护栏被删掉一样危险。
 *
 * 背景（2026-09-10）：行级实体迁移是**有损**的——把 mastered/reinforceBook/deletedItems
 * 从 user_kv 的 blob 搬进 user_entity_rows 并删掉原 blob 行。后果是回滚不再能只回代码，
 * 所以部署脚本新增了「迁移前全库快照」步骤，且该步骤必须 fail-closed。
 *
 * [1] 静态：把部署脚本篡改成 5 种「已经不安全」的形态，确认每种都被拦下。
 *     篡改的是**临时副本**（通过 CHUNKLAB_DEPLOY_SCRIPT 指给检查器），
 *     绝不写真实仓库文件（否则测试中途崩溃会留下被改坏的 deploy-prod.sh）。
 *
 * [2] 运行时：对真实 server/backup-db.js 实证「不能取原始输出最后一行」。
 *     备份超出保留份数时会追加一行「清理旧备份」，那才是最后一行——
 *     用 tail -1 判成败会在备份满份数后稳定误判为失败、把部署卡死。
 *     这一段不碰服务器：临时库里造最小 DB + 预置旧备份，跑一次真实备份即可触发 prune。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const REAL = path.join(ROOT, 'scripts', 'deploy-prod.sh');
const ORIG = fs.readFileSync(REAL, 'utf8');
const TMP = path.join(os.tmpdir(), 'chunklab-deploy-safety-' + process.pid + '.sh');

let pass = 0, total = 0;

/* ============ [1] 静态：篡改副本必须被拦 ============ */

const CASES = [
  {
    name: 'A 快照失败分支去掉 exit 1（fail-open）',
    mutate: function (s) {
      const i = s.indexOf('backup-db.js backup');
      const j = s.indexOf('systemctl restart chunklab');
      return s.slice(0, i) + s.slice(i, j).replace('exit 1', 'true') + s.slice(j);
    },
    expect: '缺少 exit 1',
  },
  {
    name: 'B 快照被排到重启之后',
    mutate: function (s) {
      return s.replace('echo "[1/6] 迁移前全库快照"',
        'systemctl restart chunklab\necho "[1/6] 迁移前全库快照"');
    },
    expect: '排在重启之后',
  },
  {
    name: 'C 快照步骤整块删除',
    mutate: function (s) {
      return s.split('\n').filter(function (l) { return l.indexOf('backup-db.js backup') < 0; }).join('\n');
    },
    expect: '找不到迁移前快照',
  },
  {
    name: 'D 不再校验 backup-db.js 成功标记',
    /* 兼容两种写法：日志原样 `[backup-db] OK:` 与被 grep 转义过的 `backup-db\] OK:` */
    mutate: function (s) { return s.replace(/backup-db\\?\] OK:/g, 'backup-db\\] NOPE:'); },
    expect: '没有校验 backup-db.js 的成功标记',
  },
  {
    name: 'E 改回取原始输出最后一行（踩「清理旧备份」坑）',
    /* 精确重现踩过的坑：在 ssh 边界就把输出掐到最后一行，后面的 grep 便无从补救。
       只动 SNAP_OUT 那行，成功标记的校验保持完好，确保 E 单独被触发。 */
    mutate: function (s) {
      const lines = s.split('\n');
      const i = lines.findIndex(function (l) { return l.indexOf('SNAP_OUT=$(ssh') === 0; });
      if (i < 0) return s;
      lines[i] = lines[i].replace('2>&1 || true)', '2>&1 | tail -1 || true)');
      return lines.join('\n');
    },
    expect: '直接取原始输出最后一行',
  },
];

function runChecker(scriptPath) {
  try {
    return { code: 0, out: cp.execSync('node scripts/check-deploy-files.js',
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe',
        env: Object.assign({}, process.env, { CHUNKLAB_DEPLOY_SCRIPT: scriptPath }) }) };
  } catch (e) {
    return { code: e.status || 1, out: (e.stdout || '') + (e.stderr || '') };
  }
}

console.log('[1] 静态：篡改 deploy-prod.sh 的副本');
const base = runChecker(REAL);
total++;
if (base.code === 0) { pass++; console.log('  ✓ 基线：未篡改的 deploy-prod.sh 通过护栏'); }
else {
  console.log('  ✗ 基线不通过，后续结论无意义：\n    ' + base.out.trim().split('\n').join('\n    '));
}

if (base.code === 0) {
  for (const c of CASES) {
    fs.writeFileSync(TMP, c.mutate(ORIG));
    const r = runChecker(TMP);
    total++;
    if (r.code !== 0 && r.out.indexOf(c.expect) >= 0) {
      pass++;
      console.log('  ✓ ' + c.name + ' → 已拦截');
    } else {
      console.log('  ✗ ' + c.name + ' → 未拦截（exit=' + r.code + '，期望含「' + c.expect + '」）');
      console.log('    ' + r.out.trim().split('\n').join('\n    '));
    }
  }
  try { fs.unlinkSync(TMP); } catch (e) { /* 临时文件，清不掉不影响结论 */ }
}

/* ============ [2] 运行时：真实 backup-db.js 的输出契约 ============ */

console.log('[2] 运行时：实证不能取原始输出最后一行');
(function runtimeProof() {
  let BASE;
  try {
    BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-snap-'));
    const DATA = path.join(BASE, 'data');
    const BK = path.join(BASE, 'backups');
    const KEEP = 3;
    fs.mkdirSync(DATA, { recursive: true });
    fs.mkdirSync(BK, { recursive: true });

    const Database = require(path.join(ROOT, 'server', 'node_modules', 'better-sqlite3'));
    const db = new Database(path.join(DATA, 'chunklab.db'));
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');
    db.prepare('INSERT INTO t (v) VALUES (?)').run('x'.repeat(2000));
    db.close();

    /* 预置旧备份到刚好占满保留份数，一次真实备份即触发 prune。
       注意不能靠连跑多次凑份数：backup-db.js 按秒命名，同秒重复会因目标文件
       已存在而 VACUUM INTO 失败。 */
    for (let i = 1; i <= KEEP; i++) {
      fs.writeFileSync(path.join(BK, 'chunklab_db_2020010' + i + '_030000.db'), 'old');
    }

    const r = cp.spawnSync(process.execPath, ['server/backup-db.js', 'backup'], {
      cwd: ROOT, encoding: 'utf8',
      env: Object.assign({}, process.env, {
        CHUNKLAB_DATA_DIR: DATA, BACKUP_DIR: BK, BACKUP_KEEP: String(KEEP),
      }),
    });
    const out = (r.stdout || '') + (r.stderr || '');

    /* 两种取法 —— 左边是部署脚本里被修掉的那版，右边是现行版 */
    const viaTail = out.trim().split('\n').pop() || '';
    const viaGrep = out.split('\n').filter(function (l) {
      return l.indexOf('backup-db] OK:') >= 0; }).pop() || '';
    const pruned = out.indexOf('清理旧备份') >= 0;

    total += 2;
    if (pruned) {
      pass++;
      console.log('  ✓ 备份超限时确实追加了「清理旧备份」行（用例前提成立）');
    } else {
      console.log('  ✗ 未触发 prune，用例没造出超限场景，本段结论无效');
    }
    if (pruned && viaTail.indexOf('backup-db] OK:') < 0 && viaGrep.indexOf('backup-db] OK:') >= 0) {
      pass++;
      console.log('  ✓ tail -1 取到的是「清理旧备份」→ 会误判失败；按标记 grep 取到成功行');
    } else {
      console.log('  ✗ 取法区别未复现：tail=' + viaTail.slice(0, 50));
    }
  } catch (e) {
    total += 2;
    console.log('  ✗ 运行时段异常: ' + e.message);
  } finally {
    if (BASE) { try { fs.rmSync(BASE, { recursive: true, force: true }); } catch (e) { /* 忽略 */ } }
  }
})();

const ok = pass === total;
console.log('deploy-safety: ' + pass + '/' + total + ' ' + (ok ? '通过' : '失败'));
if (!ok) process.exit(1);
