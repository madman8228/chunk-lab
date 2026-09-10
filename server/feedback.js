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

function submit(req, res) {
  let imagePath = null;
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
      fs.writeFileSync(path.join(FEEDBACK_DIR, name), buf);
      imagePath = name;
    }

    const info = db.prepare(
      'INSERT INTO feedback (text, image_path, meta, created_at) VALUES (?, ?, ?, ?)'
    ).run(text, imagePath, meta ? JSON.stringify(meta) : null, Date.now());

    res.json({ ok: true, id: Number(info.lastInsertRowid) });
  } catch (e) {
    /* fail-closed：不泄露堆栈，仅记录摘要并返回通用 500 */
    console.error('[feedback] 提交失败：', e && e.message);
    res.status(500).json({ error: '反馈提交失败，请稍后再试' });
  }
}

module.exports = { submit: submit };
