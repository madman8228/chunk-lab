/**
 * feedback.test.js · 「反馈问题」后端单元测试（零依赖，Node 直跑）
 *
 * 覆盖 POST /api/feedback 的处理函数 feedback.submit(req, res)：
 *   1. 正常提交（含 image base64）→ ok:true + 反馈表有记录 + 磁盘有图片 + image_path 指向存在文件
 *   2. 只传 text（无 image）→ 正常，image_path 为 null
 *   3. text 缺失 / 空白 → 400
 *   4. text 超长（>2000）→ 400
 *   5. image 解码后 >5MB → 400
 *   6. 游客可提交：index.js 里该路由未挂 auth.authenticate（静态校验）
 *   7. meta 非对象（字符串/数组）→ 400；meta 为对象 → 正确落库
 *
 * 隔离：通过 CHUNKLAB_DATA_DIR 指向临时目录，在 require 之前注入，避免污染真实 server/data。
 * 运行：node feedback.test.js
 * 退出码：0 = 全部通过，1 = 有失败或异常
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

/* ★ 必须先注入临时 DATA_DIR，再 require feedback/db —— db.js 与 feedback.js 都在模块加载时读该变量 */
const TMP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-feedback-test-'));
process.env.CHUNKLAB_DATA_DIR = TMP_DATA_DIR;

const feedback = require('./feedback');
const db = require('./db');

const FEEDBACK_DIR = path.join(TMP_DATA_DIR, 'feedback');

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}

/* mock res：记录 status + body，供 submit 直接调用 */
function makeRes() {
  const res = { statusCode: 200, _body: null };
  res.status = function (c) { this.statusCode = c; return this; };
  res.json = function (b) { this._body = b; return this; };
  return res;
}

function submit(body) {
  const res = makeRes();
  feedback.submit({ body: body }, res);
  return res;
}

/* 查询最新一条反馈（本测试为顺序插入，直接取 id 最大的一条即可） */
function latestRow() {
  return db.prepare('SELECT * FROM feedback ORDER BY id DESC LIMIT 1').get();
}

/* ===== 1. 正常提交（含 image base64） ===== */
const imgBuf = Buffer.from('fake-png-bytes-for-feedback-test', 'utf8');
const imgB64 = imgBuf.toString('base64');
let r = submit({ text: '  手机端练习页白屏  ', image: 'data:image/png;base64,' + imgB64, imageType: 'image/png', meta: { ua: 'test' } });
check('1 含图提交返回 ok:true 且 id 为数字',
  r.statusCode === 200 && r._body && r._body.ok === true && typeof r._body.id === 'number',
  'status=' + r.statusCode + ' ' + JSON.stringify(r._body));
const row1 = latestRow();
check('1 反馈表有记录且 text 已 trim',
  !!row1 && row1.text === '手机端练习页白屏',
  JSON.stringify(row1 && row1.text));
check('1 image_path 指向存在的磁盘文件',
  !!row1 && !!row1.image_path && fs.existsSync(path.join(FEEDBACK_DIR, row1.image_path)),
  'image_path=' + (row1 && row1.image_path));
check('1 磁盘图片内容与上传一致',
  !!row1 && !!row1.image_path &&
  fs.readFileSync(path.join(FEEDBACK_DIR, row1.image_path)).equals(imgBuf),
  '内容不一致');
check('1 image_path 只存相对文件名（不含目录）',
  !!row1 && row1.image_path.indexOf('/') < 0 && row1.image_path.indexOf('\\') < 0,
  'image_path=' + (row1 && row1.image_path));
check('1 meta 落库为 JSON 字符串且可还原',
  !!row1 && (function () { try { return JSON.parse(row1.meta).ua === 'test'; } catch (e) { return false; } })(),
  'meta=' + (row1 && row1.meta));

/* ===== 2. 只传 text（无 image） ===== */
r = submit({ text: '只反馈文字，不上传截图' });
const row2 = latestRow();
check('2 无图提交返回 ok:true', r.statusCode === 200 && r._body && r._body.ok === true, 'status=' + r.statusCode);
check('2 image_path 为 null', !!row2 && row2.image_path === null, 'image_path=' + (row2 && row2.image_path));

/* ===== 3. text 缺失 / 空白 ===== */
r = submit({});
check('3 text 缺失 → 400', r.statusCode === 400, 'status=' + r.statusCode);
r = submit({ text: '   ' });
check('3 text 全空白 → 400', r.statusCode === 400, 'status=' + r.statusCode);

/* ===== 4. text 超长（>2000） ===== */
r = submit({ text: 'x'.repeat(2001) });
check('4 text 2001 字 → 400', r.statusCode === 400, 'status=' + r.statusCode);
r = submit({ text: 'x'.repeat(2000) });
check('4 text 恰 2000 字 → 200', r.statusCode === 200, 'status=' + r.statusCode);

/* ===== 5. image 解码后 >5MB ===== */
const bigB64 = Buffer.alloc(5 * 1024 * 1024 + 1, 0x41).toString('base64');
r = submit({ text: '超大截图', image: bigB64 });
check('5 image 解码后 >5MB → 400', r.statusCode === 400, 'status=' + r.statusCode);
check('5 超限未写磁盘文件', fs.readdirSync(FEEDBACK_DIR).length === 1, '文件数=' + fs.readdirSync(FEEDBACK_DIR).length);

/* ===== 6. 游客可提交：路由未挂 auth.authenticate ===== */
const indexSrc = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
const routeLine = indexSrc.split('\n').filter(function (l) { return l.indexOf("app.post('/api/feedback'") >= 0; })[0];
check('6 index.js 注册了 POST /api/feedback', !!routeLine, 'routeLine=' + routeLine);
check('6 该路由未挂 auth.authenticate（游客可访问）',
  !!routeLine && routeLine.indexOf('auth.authenticate') < 0,
  'routeLine=' + routeLine);

/* ===== 7. meta 校验 ===== */
r = submit({ text: 'meta 是字符串', meta: 'not-an-object' });
check('7 meta 非对象字符串 → 400', r.statusCode === 400, 'status=' + r.statusCode);
r = submit({ text: 'meta 是数组', meta: [1, 2] });
check('7 meta 为数组 → 400', r.statusCode === 400, 'status=' + r.statusCode);
r = submit({ text: 'meta 为 null 正常', meta: null });
check('7 meta 为 null → 200 且落库 null',
  r.statusCode === 200 && (function () { const x = latestRow(); return x && x.meta === null; })(),
  'status=' + r.statusCode);

/* ===== 收尾 ===== */
try { fs.rmSync(TMP_DATA_DIR, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
console.log('\n[feedback.test] passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
