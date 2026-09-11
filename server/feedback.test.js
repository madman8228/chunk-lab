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
 *   8. IP 限流：每 IP 60 秒最多 5 次，第 6 次 429 + Retry-After
 *   9. meta JSON 字符串 >4KB → 400
 *  10. INSERT 失败 → 删除孤儿图（磁盘文件数不增加）
 *  11. 图片 magic number 校验：非图片字节 → 400；内容为 JPG 但 imageType 误报 → sniff 纠正为 .jpg
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

/* mock res：记录 status + headers + body，供 submit 直接调用 */
function makeRes() {
  const res = { statusCode: 200, _body: null, _headers: {} };
  res.status = function (c) { this.statusCode = c; return this; };
  res.set = function (k, v) { this._headers[k] = v; return this; };
  res.json = function (b) { this._body = b; return this; };
  return res;
}

/* 每次普通 submit 用独立 IP（模块级限流 Map 会跨用例持久，若都走同一 IP 会误触限流）。
   限流用例单独传固定 IP 复用。 */
let _ipSeq = 0;
function submit(body, ip) {
  const res = makeRes();
  feedback.submit({ body: body, ip: ip || ('10.0.0.' + (++_ipSeq)) }, res);
  return res;
}

/* 查询最新一条反馈（本测试为顺序插入，直接取 id 最大的一条即可） */
function latestRow() {
  return db.prepare('SELECT * FROM feedback ORDER BY id DESC LIMIT 1').get();
}

/* ===== 1. 正常提交（含 image base64） ===== */
/* 带真实 PNG magic 头（8 字节），否则 magic 校验会 400 */
const imgBuf = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  Buffer.from('fake-png-bytes-for-feedback-test', 'utf8')
]);
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

/* ===== 8. IP 限流：每 IP 60 秒最多 5 次 ===== */
const RATE_IP = '10.9.9.9';
let allOk = true;
for (let i = 0; i < 5; i++) {
  if (submit({ text: '限流测试 ' + i }, RATE_IP).statusCode !== 200) allOk = false;
}
check('8 前 5 次同 IP 提交均 200', allOk);
r = submit({ text: '第 6 次应被限流' }, RATE_IP);
check('8 第 6 次同 IP → 429', r.statusCode === 429, 'status=' + r.statusCode);
check('8 429 带 Retry-After=60 头', r._headers && r._headers['Retry-After'] === '60', JSON.stringify(r._headers));

/* ===== 9. meta JSON 字符串 >4KB → 400 ===== */
r = submit({ text: 'meta 过大', meta: { ua: 'x'.repeat(5000) } });
check('9 meta JSON >4KB → 400', r.statusCode === 400, 'status=' + r.statusCode);
r = submit({ text: 'meta 边界内', meta: { ua: 'x'.repeat(4000) } });
check('9 meta JSON ≤4KB → 200', r.statusCode === 200, 'status=' + r.statusCode);

/* ===== 10. INSERT 失败 → 删除孤儿图 ===== */
const filesBefore = fs.readdirSync(FEEDBACK_DIR).length;
const origPrepare = db.prepare;
db.prepare = function (sql) {
  if (typeof sql === 'string' && sql.indexOf('INSERT INTO feedback') === 0) {
    throw new Error('模拟 INSERT 失败');
  }
  return origPrepare.call(db, sql);
};
r = submit({ text: 'INSERT 失败应清理图片', image: 'data:image/png;base64,' + imgB64, imageType: 'image/png' });
db.prepare = origPrepare;
check('10 INSERT 失败 → 500', r.statusCode === 500, 'status=' + r.statusCode);
check('10 孤儿图已删除（文件数与提交前一致）',
  fs.readdirSync(FEEDBACK_DIR).length === filesBefore,
  'before=' + filesBefore + ' after=' + fs.readdirSync(FEEDBACK_DIR).length);

/* ===== 11. 图片 magic number 校验（2026-09-11 P1） ===== */
/* 可执行文件 MZ 头（0x4D 0x5A）伪装成图片 → 必须 400 */
r = submit({ text: '伪图片', image: Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]).toString('base64'), imageType: 'image/png' });
check('11 非图片字节（EXE MZ 头）→ 400', r.statusCode === 400, 'status=' + r.statusCode);
/* 内容是 JPG、但 imageType 误报 png → 用 magic 嗅探纠正扩展名为 .jpg，仍 200 */
const jpgBuf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
r = submit({ text: 'JPG 但 imageType 误报 png', image: jpgBuf.toString('base64'), imageType: 'image/png' });
check('11 内容为 JPG、imageType 误报 → sniff 纠正为 .jpg 且 200',
  r.statusCode === 200 && (function () { const x = latestRow(); return !!x && !!x.image_path && /\.jpg$/.test(x.image_path); })(),
  'status=' + r.statusCode + ' path=' + (function () { const x = latestRow(); return x && x.image_path; })());
check('11 纠正后的 .jpg 文件已落盘且内容一致',
  (function () { const x = latestRow(); return !!x && !!x.image_path && fs.existsSync(path.join(FEEDBACK_DIR, x.image_path)) && fs.readFileSync(path.join(FEEDBACK_DIR, x.image_path)).equals(jpgBuf); })(),
  '内容不一致');

/* ===== 收尾 ===== */
try { fs.rmSync(TMP_DATA_DIR, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
console.log('\n[feedback.test] passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
