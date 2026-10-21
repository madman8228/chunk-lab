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
    name: '教材草稿页面依赖不可漏部署',
    mutate: function (s) { return s.replace(/\bjs\/textbook-drafts\.js\b/g, ''); },
    expect: 'js/textbook-drafts.js'
  },
  {
    name:'实际依赖验证不可省略',
    mutate:function(s){return s.replace("node '$REMOTE_DIR/scripts/verify-server-dependencies.cjs' '$APP/server'",'true');},
    expect:'缺少覆盖应用前的实际依赖加载验证'
  },
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
      return s.replace('echo "[3/9] 迁移前全库快照"',
        'systemctl restart chunklab\necho "[3/9] 迁移前全库快照"');
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
  {
    name: 'F 删除本地完整回归',
    mutate: function (s) { return s.replace(/npm test|npm run test:accounts|npm run test:batch-sync|node e2e\/mobile-8000\.test\.js/g, ''); },
    expect: '缺少上传前的本地 主测试套件',
  },
  {
    name: 'G 删除远端生产配置预检',
    mutate: function (s) { return s.replace("grep -Eq '^REQUIRE_AUTH=true", "grep -Eq '^REQUIRE_AUTH=missing"); },
    expect: '缺少远端生产配置预检',
  },
  {
    name: 'I 删除反向代理信任预检',
    mutate: function (s) { return s.replace("grep -Eq '^TRUST_PROXY=true", "grep -Eq '^TRUST_PROXY=missing"); },
    expect: '缺少远端生产配置预检',
  },
  {
    name: 'H 恢复危险默认部署目标',
    mutate: function (s) { return s.replace('if [ "$#" -ne 1 ] || [ -z "$1" ]; then', 'if [ "$#" -ne 0 ] || [ -z "$1" ]; then'); },
    expect: '必须显式传入唯一目标主机',
  },
];
for (const key of ['PHONE_AUTH_ENABLED', 'SMS_PROVIDER',
  'ALIBABA_CLOUD_ACCESS_KEY_ID', 'ALIBABA_CLOUD_ACCESS_KEY_SECRET',
  'SMS_SIGN_NAME', 'SMS_TEMPLATE_CODE']) {
  CASES.push({
    name:'手机号发布预检不可省略：' + key,
    mutate:function(s){ return s.replace(key, 'REMOVED_' + key); },
    expect:'缺少快照前的手机号及短信配置预检'
  });
}
for (const check of ['config.requireAuth !== true', 'config.authMode !== "phone"', 'config.writeProtocol !== 3']) {
  CASES.push({
    name:'上线实际配置检查不可省略：' + check,
    mutate:function(s){return s.replace(check,'false');},
    expect:'缺少重启后的实际登录模式及保存协议检查'
  });
}

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

/* [1b] 发布阶段自身的 fail-closed 合同：这些约束必须跟随脚本变更持续验证，
   不能只依赖人工阅读远端 SSH 命令。 */
if (base.code === 0) {
  const contracts = [
    ['拒绝跳过发布回归且在远端清理 trap 前退出',
      /if \[ "\$\{DEPLOY_SKIP_TESTS:-0\}" != "0" \]; then[\s\S]*?exit 2\s*fi/.test(ORIG) &&
      ORIG.indexOf('DEPLOY_SKIP_TESTS') < ORIG.indexOf('trap cleanup_remote_stage EXIT') &&
      !/DEPLOY_SKIP_TESTS[\s\S]*?else\s*npm test/.test(ORIG)],
    ['使用唯一临时目录并在退出时清理', /DEPLOY_TOKEN=.*chunklab-deploy-/.test(ORIG) && /REMOTE_DIR="\/tmp\/\$DEPLOY_TOKEN"/.test(ORIG) && /trap cleanup_remote_stage EXIT/.test(ORIG)],
    ['公开部署包排除词汇原图与拼图源文件',
      ORIG.includes("--exclude='assets/vocabulary-*-landscape-master-v2.png'") &&
      ORIG.includes("--exclude='assets/vocabulary-scenes-v1.png'") &&
      ORIG.includes("--exclude='assets/vocabulary-landscapes-v2.sources.json'")],
    ['远端落盘命令启用 fail-closed shell', /bash -s -- '\$APP' '\$REMOTE_DIR'/.test(ORIG) && /set -euo pipefail/.test(ORIG)],
    ['健康检查拒绝 HTTP 错误', /curl --fail --silent --show-error/.test(ORIG)],
    /* 2026-10-07：根路径语义变了 —— 合并落地页后 server/index.js 里那行
       「重定向 /main.html」已删除，根路径由 express.static 托管 index.html。
       契约随之从「校验 302 重定向」改为「校验 200 且正文含品牌标识」，
       并要求冒烟真的覆盖 robots.txt / sitemap.xml（它们是百度收录的前置文件）。 */
    ['根路径严格校验落地页（200 + 品牌正文）', /test "\$ROOT_CODE" = 200/.test(ORIG) && /jqka\.top/.test(ORIG) && /ROOT_BODY=/.test(ORIG)],
    ['冒烟覆盖 robots.txt / sitemap.xml', /127\.0\.0\.1:8787\/robots\.txt/.test(ORIG) && /127\.0\.0\.1:8787\/sitemap\.xml/.test(ORIG)],
    ['部署前锁定服务端依赖版本', /server\/package-lock\.json/.test(ORIG) && /SERVER_LOCK_SHA=/.test(ORIG)],
    /* 复用已验收发布包必须是「有校验的」：盲跳过（DEPLOY_SKIP_TESTS）仍被拒绝，
       改由 DEPLOY_ACCEPTED_SHA 承载，且必须校验 HEAD 一致 + 待部署文件无未提交改动。 */
    ['复用已验收发布包需校验 HEAD 与部署文件未变',
      /DEPLOY_ACCEPTED_SHA/.test(ORIG) &&
      /git rev-parse HEAD/.test(ORIG) &&
      /git status --porcelain[^\n]*\$\{FILES\[@\]\}/.test(ORIG) &&
      /RUN_REGRESSION=1/.test(ORIG) &&
      /if \[ "\$RUN_REGRESSION" = "1" \]; then/.test(ORIG)],
  ];
  contracts.forEach(function (entry) {
    total++;
    if (entry[1]) { pass++; console.log('  ✓ ' + entry[0]); }
    else console.log('  ✗ ' + entry[0]);
  });
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

// Execute the exact deployed stdin validator, not a duplicated implementation.
const smokeSource = ORIG.match(/\/api\/config \| node -e '([\s\S]*?)';?\r?\n/);
for (const [label,input,expected] of [
  ['正确生产配置',JSON.stringify({requireAuth:true,authMode:'phone',writeProtocol:3}),0],
  ['无登录保护',JSON.stringify({requireAuth:false,authMode:'phone',writeProtocol:3}),1],
  ['旧密码模式',JSON.stringify({requireAuth:true,authMode:'password',writeProtocol:3}),1],
  ['旧保存协议',JSON.stringify({requireAuth:true,authMode:'phone',writeProtocol:2}),1],
  ['缺少字段','{}',1], ['非JSON响应','<html>error</html>',1]
]) {
  total++;
  const result=smokeSource && cp.spawnSync(process.execPath,['-e',smokeSource[1]],{input,encoding:'utf8'});
  if(result && result.status===expected){pass++;console.log('  ✓ 实际配置校验执行：'+label);}
  else console.log('  ✗ 实际配置校验执行：'+label);
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
    const originalsPreserved = Array.from({length:KEEP},(_,i)=>'chunklab_db_2020010'+(i+1)+'_030000.db')
      .every(file=>fs.existsSync(path.join(BK,file)) && fs.readFileSync(path.join(BK,file),'utf8')==='old');

    total += 2;
    if (r.status === 0 && originalsPreserved && fs.readdirSync(BK).length === KEEP+1) {
      pass++;
      console.log('  ✓ 创建新快照不删除或修改任何旧备份');
    } else {
      console.log('  ✗ 新快照失败或旧备份未完整保留');
    }
    if (viaGrep.indexOf('backup-db] OK:') >= 0 && out.indexOf('清理旧备份') < 0) {
      pass++;
      console.log('  ✓ 快照输出包含成功标记且没有旧清理行为');
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
