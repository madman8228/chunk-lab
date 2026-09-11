/**
 * feedback-images-verify.js · 反馈弹窗「最多 3 张截图 + 逐张删除」（2026-09-11）
 *
 * 老板要求：反馈问题里上传图片一次只能一张且不能删 → 改成最多 3 张，
 * 每个 item 右侧有可删除按钮。
 *
 * 这次改动是**前后端一起动**（后端原只支持单图 image/imageType，DB 也只有 image_path 单列）：
 *   - server/db.js：feedback 加 image_paths（JSON 数组），保留 image_path 存第一张（向下兼容）
 *   - server/feedback.js：新协议 images:[{data,type}]（≤3、每张 ≤5MB、magic 嗅探），
 *     旧 image/imageType 仍可用；任一张失败 → 回滚删除本次全部已写文件（不留孤儿）
 *   - main.html：input 加 multiple + 缩略图列表 + 每项右侧 SVG trash 删除按钮
 *
 * 断言：
 *   A. 初始态：列表空 / 计数空 / 上传按钮可用
 *   B. 选 3 张 → 3 个 item，每个都有缩略图 + 文件名 + **SVG 删除按钮**（非字符 icon）；
 *      计数「已选 3/3」；满额后上传按钮禁用
 *   C. 删中间那张 → 剩 2 项且剩下的文件名正确（验证删的是对的那个，不是末位）
 *   D. 再选 2 张（只剩 1 个空位）→ 只补 1 张 + 提示「已忽略多出的 1 张」
 *   E. 提交 → 服务端 SQLite image_paths 长度 = 剩余张数，且每个文件都在磁盘上
 *   F. 重开弹窗 → 列表已清空（不残留上次的图）
 *   G. 零 pageerror
 *
 * 运行：node output/e2e/feedback-images-verify.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

/* 端口：避开宿主机已占端口（共享工具，根因见 e2e/lib/free-port.js 头部注释） */
const PORT = require('../../e2e/lib/free-port').freePort(8980, 40);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-fbimg-'));
/* 真实 PNG 文件（1x1）：setInputFiles 要磁盘路径，且服务端按 magic number 校验必须是真图片 */
const TMP_IMG = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-fbimg-files-'));
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
['a.png', 'b.png', 'c.png', 'd.png', 'e.png'].forEach(function (n) {
  fs.writeFileSync(path.join(TMP_IMG, n), PNG_1x1);
});
const P = function (n) { return path.join(TMP_IMG, n); };

let server = null;
function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT) }),
      stdio: 'ignore'
    });
    let tries = 0;
    const iv = setInterval(function () {
      tries++;
      if (server.exitCode !== null) { clearInterval(iv); reject(new Error('server exit ' + server.exitCode)); return; }
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (r) {
        if (r.statusCode === 200) { clearInterval(iv); resolve(); }
      });
      req.on('error', function () { /* retry */ });
      req.setTimeout(600, function () { req.destroy(); });
      if (tries > 40) { clearInterval(iv); reject(new Error('server start timeout')); }
    }, 400);
  });
}
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) { /* noop */ } server = null; }
  [TMP_DB, TMP_IMG].forEach(function (d) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
  });
}

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (detail !== undefined ? '  → ' + detail : '')); }
}

const CHROMIUM = process.env.CHROMIUM_PATH ||
  'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe';

/* 读取当前截图列表的渲染结果 */
function readList(pg) {
  return pg.evaluate(function () {
    var box = document.getElementById('feedbackImages');
    var btn = document.getElementById('btnFeedbackPick');
    var cnt = document.getElementById('feedbackCount');
    var items = box ? Array.prototype.slice.call(box.querySelectorAll('.fb-img-item')) : [];
    return {
      n: items.length,
      names: items.map(function (it) {
        var s = it.querySelector('.fb-img-name');
        return s ? s.textContent.trim() : null;
      }),
      thumbs: items.map(function (it) {
        var im = it.querySelector('img.fb-img-thumb');
        return im ? (im.getAttribute('src') || '').slice(0, 15) : null;
      }),
      delBtns: items.map(function (it) {
        var b = it.querySelector('button.fb-img-del');
        if (!b) return null;
        var r = b.getBoundingClientRect();
        return {
          hasSvg: !!b.querySelector('svg.icon'),
          aria: b.getAttribute('aria-label') || '',
          w: Math.round(r.width),
          h: Math.round(r.height)
        };
      }),
      count: cnt ? cnt.textContent.trim() : null,
      pickDisabled: btn ? !!btn.disabled : null
    };
  });
}

(async function main() {
  const BASE = 'http://127.0.0.1:' + PORT;
  await startServer();
  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', function (e) { errs.push(String(e)); });

  async function openFeedback() {
    await page.waitForSelector('#btnSettingsTop', { timeout: 10000 });
    await page.locator('#btnSettingsTop').click();
    await page.waitForSelector('#btnFeedback', { timeout: 5000 });
    await page.locator('#btnFeedback').click();
    await page.waitForFunction(function () {
      var m = document.getElementById('feedbackMask');
      return m && !m.hidden;
    }, { timeout: 5000 });
  }

  console.log('[1] 初始态');
  await page.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
  await openFeedback();
  const s0 = await readList(page);
  check('打开弹窗时截图列表为空', s0.n === 0, JSON.stringify(s0));
  check('计数为空（未选图不显示「已选」）', s0.count === '', s0.count);
  check('上传按钮可用（未满额）', s0.pickDisabled === false, s0.pickDisabled);
  const multiple = await page.evaluate(function () {
    var i = document.getElementById('feedbackFile');
    return !!(i && i.multiple);
  });
  check('file input 带 multiple（支持一次选多张）', multiple, multiple);

  console.log('[2] 一次选 3 张 → 3 个 item + 满额禁用');
  await page.locator('#feedbackFile').setInputFiles([P('a.png'), P('b.png'), P('c.png')]);
  await page.waitForFunction(function () {
    return document.querySelectorAll('#feedbackImages .fb-img-item').length === 3;
  }, { timeout: 8000 });
  const s1 = await readList(page);
  check('列表渲染 3 个 item', s1.n === 3, JSON.stringify(s1.names));
  check('文件名按选择顺序正确', s1.names.join(',') === 'a.png,b.png,c.png', JSON.stringify(s1.names));
  check('每项都有缩略图（data URL）', s1.thumbs.every(function (t) { return t && t.indexOf('data:image') === 0; }), JSON.stringify(s1.thumbs));
  check('每项右侧都有删除按钮且是 SVG 图标（非字符 icon）',
    s1.delBtns.every(function (b) { return b && b.hasSvg && /删除/.test(b.aria); }), JSON.stringify(s1.delBtns));
  check('删除按钮尺寸 ≥24px（可点击，非退化成 0）',
    s1.delBtns.every(function (b) { return b && b.w >= 24 && b.h >= 24; }), JSON.stringify(s1.delBtns.map(function (b) { return b && (b.w + 'x' + b.h); })));
  check('计数显示「已选 3/3 张」', s1.count === '已选 3/3 张', s1.count);
  check('满额后上传按钮禁用', s1.pickDisabled === true, s1.pickDisabled);
  await page.screenshot({ path: path.join(SHOTS, 'feedback-images-3.png') });

  console.log('[3] 删中间那张 → 必须删对，不是删末位');
  await page.locator('#feedbackImages .fb-img-item').nth(1).locator('.fb-img-del').click();
  await page.waitForFunction(function () {
    return document.querySelectorAll('#feedbackImages .fb-img-item').length === 2;
  }, { timeout: 5000 });
  const s2 = await readList(page);
  check('剩 2 项', s2.n === 2, JSON.stringify(s2.names));
  check('删掉的是中间那张 b.png（剩 a、c）', s2.names.join(',') === 'a.png,c.png', JSON.stringify(s2.names));
  check('计数更新为「已选 2/3 张」', s2.count === '已选 2/3 张', s2.count);
  check('未满额 → 上传按钮恢复可用', s2.pickDisabled === false, s2.pickDisabled);

  console.log('[4] 只剩 1 个空位时选 2 张 → 只补 1 张 + 提示');
  await page.locator('#feedbackFile').setInputFiles([P('d.png'), P('e.png')]);
  await page.waitForFunction(function () {
    return document.querySelectorAll('#feedbackImages .fb-img-item').length === 3;
  }, { timeout: 8000 });
  const s3 = await readList(page);
  check('只补进 1 张（仍是 3 项）', s3.n === 3, JSON.stringify(s3.names));
  check('补进来的是 d.png（前 1 张）', s3.names.join(',') === 'a.png,c.png,d.png', JSON.stringify(s3.names));
  const msg = await page.evaluate(function () { return document.getElementById('feedbackMsg').textContent.trim(); });
  check('给出「已忽略多出的 1 张」提示', /已忽略多出的 1 张/.test(msg), msg);
  await page.screenshot({ path: path.join(SHOTS, 'feedback-images-full.png') });

  console.log('[5] 提交 → 服务端落库 3 张');
  await page.locator('#feedbackText').fill('e2e 多图反馈：三张截图');
  await page.locator('#btnFeedbackSubmit').click();
  let toast = 'TIMEOUT';
  try {
    await page.waitForFunction(function () {
      var t = document.getElementById('sysToast');
      return t && t.textContent && t.textContent.indexOf('已收到反馈') >= 0;
    }, { timeout: 12000 });
    toast = await page.evaluate(function () { return document.getElementById('sysToast').textContent; });
  } catch (e) { /* keep TIMEOUT */ }
  check('提交成功（toast「已收到反馈」）', toast.indexOf('已收到反馈') >= 0, 'toast=' + toast);

  let dbPaths = null;
  let diskOk = false;
  try {
    const BetterSqlite3 = require(path.join(ROOT, 'server', 'node_modules', 'better-sqlite3'));
    const fdb = new BetterSqlite3(path.join(TMP_DB, 'chunklab.db'));
    const row = fdb.prepare('SELECT text, image_path, image_paths FROM feedback ORDER BY id DESC LIMIT 1').get();
    fdb.close();
    if (row && row.image_paths) dbPaths = JSON.parse(row.image_paths);
    const dir = path.join(TMP_DB, 'feedback');
    diskOk = !!dbPaths && dbPaths.every(function (p) { return fs.existsSync(path.join(dir, p)); });
    check('服务端文本落库正确', !!row && row.text === 'e2e 多图反馈：三张截图', row && row.text);
    check('服务端 image_paths 长度 = 3（与前端剩余张数一致）',
      Array.isArray(dbPaths) && dbPaths.length === 3, JSON.stringify(dbPaths));
    check('3 个文件都在磁盘上', diskOk, JSON.stringify(dbPaths));
    check('image_path 仍存第一张（向下兼容）', !!row && !!dbPaths && row.image_path === dbPaths[0],
      'image_path=' + (row && row.image_path));
  } catch (e) {
    check('服务端 SQLite 复核', false, 'ERR:' + e.message);
  }

  console.log('[6] 重开弹窗 → 列表已清空');
  await openFeedback();
  const s4 = await readList(page);
  check('重开后截图列表为空（不残留上次图片）', s4.n === 0, JSON.stringify(s4.names));
  check('重开后上传按钮可用', s4.pickDisabled === false, s4.pickDisabled);

  console.log('[7] 零 pageerror');
  check('零 pageerror', errs.length === 0, errs.join('\n  '));

  console.log('\n结果：' + passed + ' 通过 / ' + failed + ' 失败');
  await browser.close();
  stopServer();
  process.exit(failed ? 1 : 0);
})().catch(function (e) { console.error(e); stopServer(); process.exit(2); });
