/**
 * feedback.js · 用户反馈提交（游客可访问，无需登录）
 *
 * POST /api/feedback
 *   body: {
 *     text      — 必填，问题描述（≤2000 字符）
 *     image     — 可选，base64（可带 data:image/...;base64, 前缀）
 *     imageType — 可选，MIME 类型（用于推断扩展名，缺省 .png）
 *     meta      — 可选，诊断信息对象（UA/屏幕/页面/版本/SW 状态/console 错误等）
 *   }
 *
 * 图片 base64 解码后写入磁盘 server/data/feedback/<时间戳>-<随机>.<ext>，
 * 元数据存 SQLite 表 feedback（image_path 只存相对文件名）。只存服务器，不做任何推送。
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./db');

/* 与 db.js 保持一致的数据目录获取方式：环境变量 CHUNKLAB_DATA_DIR 或默认 server/data */
const DATA_DIR = process.env.CHUNKLAB_DATA_DIR || path.join(__dirname, 'data');
const FEEDBACK_DIR = path.join(DATA_DIR, 'feedback');

const MAX_TEXT = 2000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_META_BYTES = 4 * 1024; // 4KB
const FEEDBACK_RATE_MAX = 5; // 每 IP 每 60 秒最多 5 次（游客匿名提交，仅能按 IP 限流防刷爆磁盘/SQLite）
const FEEDBACK_RATE_WINDOW = 60 * 1000;

const EXT_BY_TYPE = {
  'image/png': 'png',
  'image/jpg': 'jpg',
  'image/jpeg': 'jpg',
  'image/webp': 'webp'
};

function extForImageType(imageType) {
  if (typeof imageType === 'string') {
    const t = imageType.trim().toLowerCase();
    if (EXT_BY_TYPE[t]) return EXT_BY_TYPE[t];
  }
  return 'png';
}

/* 剥离可能存在的 data:image/...;base64, 前缀，只留纯 base64 内容 */
function stripBase64Prefix(image) {
  const s = String(image);
  const i = s.indexOf('base64,');
  return i >= 0 ? s.slice(i + 'base64,'.length) : s;
}

/* IP 滑动窗口限流（2026-09-11 安全审查 P1）：游客可匿名提交、无鉴权可识别，
   只能按 IP 限流。纯内存、单实例自托管够用；反代部署需 TRUST_PROXY=true（index.js 已设 trust proxy）。
   请求到达即计数（含非法请求），防攻击者用垃圾 payload 刷爆磁盘与 SQLite。 */
const _feedbackRateMap = new Map(); // ip -> number[] 时间戳
function feedbackRateBlocked(ip) {
  const arr = _feedbackRateMap.get(ip);
  if (!arr) return false;
  const now = Date.now();
  while (arr.length && arr[0] <= now - FEEDBACK_RATE_WINDOW) arr.shift();
  return arr.length >= FEEDBACK_RATE_MAX;
}
function feedbackRateHit(ip) {
  let arr = _feedbackRateMap.get(ip);
  if (!arr) { arr = []; _feedbackRateMap.set(ip, arr); }
  const now = Date.now();
  while (arr.length && arr[0] <= now - FEEDBACK_RATE_WINDOW) arr.shift();
  arr.push(now);
}
/* 定时清理过期桶，防 Map 无限膨胀（unref：不阻塞进程退出） */
setInterval(function () {
  const now = Date.now();
  for (const [ip, arr] of _feedbackRateMap) {
    while (arr.length && arr[0] <= now - FEEDBACK_RATE_WINDOW) arr.shift();
    if (!arr.length) _feedbackRateMap.delete(ip);
  }
}, FEEDBACK_RATE_WINDOW).unref();

function submit(req, res) {
  let imagePath = null;
  const ip = (req && req.ip) || 'unknown';
  if (feedbackRateBlocked(ip)) {
    res.set('Retry-After', String(Math.ceil(FEEDBACK_RATE_WINDOW / 1000)));
    return res.status(429).json({ error: '反馈过于频繁，请稍后再试' });
  }
  feedbackRateHit(ip);
  try {
    const body = (req && req.body) || {};

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return res.status(400).json({ error: '反馈内容不能为空' });
    if (text.length > MAX_TEXT) return res.status(400).json({ error: '反馈内容过长（最多 2000 字）' });

    let meta = null;
    if (body.meta !== undefined && body.meta !== null) {
      if (typeof body.meta !== 'object' || Array.isArray(body.meta)) {
        return res.status(400).json({ error: 'meta 必须是对象' });
      }
      /* P1（2026-09-11 安全审查）：meta 以 JSON 字符串落 SQLite，超大对象会膨胀存储；限 4KB。 */
      if (Buffer.byteLength(JSON.stringify(body.meta), 'utf8') > MAX_META_BYTES) {
        return res.status(400).json({ error: '诊断信息过大（最多 4KB）' });
      }
      meta = body.meta;
    }

    if (body.image !== undefined && body.image !== null && body.image !== '') {
      if (typeof body.image !== 'string') {
        return res.status(400).json({ error: 'image 必须是 base64 字符串' });
      }
      const buf = Buffer.from(stripBase64Prefix(body.image), 'base64');
      if (buf.length === 0) return res.status(400).json({ error: 'image 解码后为空' });
      if (buf.length > MAX_IMAGE_BYTES) return res.status(400).json({ error: '截图超过 5MB 上限' });

      const ext = extForImageType(body.imageType);
      if (!fs.existsSync(FEEDBACK_DIR)) fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
      const name = Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '.' + ext;
      /* 先登记 imagePath 再写盘：即便 writeFileSync 半途抛错，catch 里的清理也能删掉残留。 */
      imagePath = name;
      fs.writeFileSync(path.join(FEEDBACK_DIR, name), buf);
    }

    const info = db.prepare(
      'INSERT INTO feedback (text, image_path, meta, created_at) VALUES (?, ?, ?, ?)'
    ).run(text, imagePath, meta ? JSON.stringify(meta) : null, Date.now());

    res.json({ ok: true, id: Number(info.lastInsertRowid) });
  } catch (e) {
    /* P1（2026-09-11 安全审查）：图片已落盘但后续（如 INSERT）失败 → 删除孤儿图，
       避免半截反馈占满磁盘。删除失败也不影响主错误返回（best-effort）。 */
    if (imagePath) {
      try { fs.unlinkSync(path.join(FEEDBACK_DIR, imagePath)); } catch (e2) { /* best-effort */ }
    }
    /* fail-closed：不泄露堆栈，仅记录摘要并返回通用 500 */
    console.error('[feedback] 提交失败：', e && e.message);
    res.status(500).json({ error: '反馈提交失败，请稍后再试' });
  }
}

module.exports = { submit: submit };
