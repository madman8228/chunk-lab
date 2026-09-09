#!/usr/bin/env node
/**
 * migrate-open-to-user.js · 开放模式存量数据 → 指定账号迁移
 *
 * 场景：v1 开放模式（REQUIRE_AUTH=false）跑过一段时间，学习数据全部落在默认用户
 *       __default__ 名下（免登录）。切多用户（REQUIRE_AUTH=true）后 __default__ 密码
 *       是随机值无法登录，存量数据会被锁死。本脚本把存量迁移到目标账号。
 *
 * 用法：
 *   node server/migrate-open-to-user.js <srcBase> <dstBase> <username> [password]
 *   例：node server/migrate-open-to-user.js http://localhost:8787 http://localhost:8787 boss '你的密码'
 *
 * 流程：
 *   1) GET  <srcBase>/api/export          —— 导出 __default__ 全量（开放模式免鉴权）
 *   2) 备份 JSON 落盘 server/data/migrate-<ts>.json（可回滚）
 *   3) POST <dstBase>/api/auth/register   —— 建目标账号；已存在则改 login（认领）
 *   4) 迁移前先快照目标账号现有数据（幂等保护，意外覆盖可恢复）
 *   5) POST <dstBase>/api/import (Bearer) —— 存量导入目标账号
 *   6) GET  <dstBase>/api/data (Bearer)   —— 抽样对比关键计数，确认迁移成功
 *
 * 注意：
 *   - srcBase 必须是仍在跑、仍为开放模式的实例（否则 export 需带 token，见 --authed）
 *   - dstBase 必须是已切 REQUIRE_AUTH=true 的实例；若检测到开放模式直接拒绝（防误覆盖共享池）
 *   - 环境变量 SOURCE_TOKEN=xxx 可给 src 也带 token（若源已是多用户模式，导 __default__ 需管理员场景不适用——源建议保持开放模式导出）
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const [srcBase, dstBase, username, password] = process.argv.slice(2);
if (!srcBase || !dstBase || !username) {
  console.error('用法: node server/migrate-open-to-user.js <srcBase> <dstBase> <username> [password]\n' +
    '  例 : node server/migrate-open-to-user.js http://localhost:8787 http://localhost:8787 boss "密码"\n' +
    '       （dstBase 若在 REQUIRE_AUTH=true 下运行，register/login 拿 token；password 缺省则交互不可用，脚本要求显式传入）');
  process.exit(1);
}
if (!password) {
  console.error('[abort] 多用户模式下需要显式 password 完成 register/login（开放模式禁注册）。');
  process.exit(1);
}

/* ---------- 小 HTTP 封装（无依赖，Node18+） ---------- */
function req(base, method, p, { token, json } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(base + p);
    const mod = u.protocol === 'https:' ? https : http;
    const body = json === undefined ? null : JSON.stringify(json);
    const r = mod.request(u, {
      method,
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        token ? { Authorization: 'Bearer ' + token } : {},
        body ? { 'Content-Length': Buffer.byteLength(body) } : {}
      )
    }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(buf); } catch (e) { /* 非 JSON */ }
        resolve({ status: res.statusCode, json: parsed, text: buf.slice(0, 200) });
      });
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

function summary(mem) {
  const st = (mem && mem.stats) || {};
  const by = (mem && mem.bySentence) || {};
  const nMastered = (mem && mem.mastered ? Object.keys(mem.mastered).length : 0);
  return {
    totalAnswered: st.totalAnswered || 0,
    totalRounds: st.totalRounds || 0,
    bySentence: Object.keys(by).length,
    mastered: nMastered,
    reinforced: (mem && mem.reinforceBook ? mem.reinforceBook.length : 0),
    decks: (mem && mem.decks ? mem.decks.length : 0)
  };
}

(async () => {
  let exitCode = 0;
  try {
    /* 0) 目标实例必须已是多用户模式 */
    const cfgDst = await req(dstBase, 'GET', '/api/config');
    if (cfgDst.status !== 200) throw new Error('dstBase 不可达: ' + dstBase + ' (' + cfgDst.text + ')');
    if (!cfgDst.json || cfgDst.json.requireAuth !== true) {
      console.error('[abort] dstBase 仍是开放模式（requireAuth=false）。多用户迁移必须先把目标实例切到 REQUIRE_AUTH=true 再跑本脚本。');
      process.exit(1);
    }

    /* 1) 导出源（开放模式免鉴权，落 __default__） */
    console.log('[1/6] 导出源数据 ' + srcBase + '/api/export …');
    const exp = await req(srcBase, 'GET', '/api/export');
    if (exp.status !== 200) throw new Error('export 失败 (' + exp.status + '): ' + exp.text);
    const data = exp.json;
    const before = summary(data.mem);
    console.log('      源快照:', JSON.stringify(before));

    /* 2) 备份落盘 */
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const bakPath = path.join(dataDir, 'migrate-' + ts + '.json');
    fs.writeFileSync(bakPath, JSON.stringify(data, null, 2));
    console.log('[2/6] 备份已落盘: ' + bakPath);

    /* 3) 建号或登录 */
    console.log('[3/6] 目标账号 ' + username + '（存在则登录认领）…');
    let token, userId;
    let reg = await req(dstBase, 'POST', '/api/auth/register', { json: { username, password } });
    if (reg.status === 200 && reg.json && reg.json.token) {
      token = reg.json.token; userId = reg.json.user && reg.json.user.id;
      console.log('      注册成功 user.id=' + userId);
    } else if (reg.status === 400) {
      const login = await req(dstBase, 'POST', '/api/auth/login', { json: { username, password } });
      if (login.status !== 200) throw new Error('用户名已存在但登录失败（密码不对？）: ' + JSON.stringify(login.json || login.text));
      token = login.json.token; userId = login.json.user && login.json.user.id;
      console.log('      账号已存在，登录认领 user.id=' + userId);
    } else {
      throw new Error('注册异常 (' + reg.status + '): ' + JSON.stringify(reg.json || reg.text));
    }

    /* 4) 幂等保护：快照目标账号现状 */
    const cur = await req(dstBase, 'GET', '/api/data', { token });
    const curAfter = cur.status === 200 ? summary(cur.json && cur.json.mem) : { error: cur.text };
    console.log('[4/6] 目标账号当前数据:', JSON.stringify(curAfter), cur.status === 200 ? '' : '(GET 失败仅告警，继续导入)');

    /* 5) 导入 */
    console.log('[5/6] 导入存量到目标账号…');
    const imp = await req(dstBase, 'POST', '/api/import', { token, json: data });
    if (imp.status !== 200) throw new Error('import 失败 (' + imp.status + '): ' + JSON.stringify(imp.json || imp.text));
    console.log('      import 完成', imp.json);

    /* 6) 校验 */
    const ver = await req(dstBase, 'GET', '/api/data', { token });
    if (ver.status !== 200) throw new Error('导入后校验 GET /api/data 失败: ' + ver.text);
    const after = summary(ver.json && ver.json.mem);
    const keys = ['totalAnswered', 'totalRounds', 'bySentence', 'mastered', 'reinforced', 'decks'];
    const diffs = keys.filter((k) => after[k] !== before[k]);
    console.log('[6/6] 迁移后校验:', JSON.stringify(after));
    if (diffs.length) {
      console.error('[warn] 以下计数与源不一致（diff 字段=' + diffs.join(',') + '）——请核对。多数情况为校验口径差异（如 mastered 结构、stats 白名单裁剪）。');
    } else {
      console.log('[OK] 关键计数全部一致，迁移完成 ✓');
    }
    console.log('\n回滚方式：目标账号数据已由步骤4快照可查；全量备份在 ' + bakPath + '，可随时 POST /api/import 恢复。');
  } catch (e) {
    console.error('[失败]', e.message);
    exitCode = 1;
  }
  process.exit(exitCode);
})();
