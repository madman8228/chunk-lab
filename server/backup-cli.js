#!/usr/bin/env node
/**
 * backup-cli.js · Chunk Lab 自动备份 CLI（零依赖，上线准备 #2）
 *
 * 用法：
 *   node backup-cli.js backup              # 备份：GET /api/export → 落盘 + 保留 N 份自动清理
 *   node backup-cli.js preview <file>      # 固定恢复预览（只读，生成 .preview.json）
 *   node backup-cli.js apply <preview> --confirm [--selection <file>]  # 完整恢复或按明确选择恢复
 *   node backup-cli.js list                # 列出已有备份
 *
 * 环境变量：
 *   BASE_URL     后端地址（默认 http://127.0.0.1:8787）
 *   TOKEN        鉴权 token（REQUIRE_AUTH=true 时需要；开放模式无需）
 *   BACKUP_DIR   备份目录（默认 server/backups，可指向持久盘）
 *   BACKUP_KEEP  保留份数（默认 14，超出自动删除最旧）
 *
 * 调度（示例）：
 *   Linux  cron:  0 3 * * *  cd /path/to/chunk-practice && BASE_URL=http://localhost:8787 TOKEN=xxx node server/backup-cli.js backup
 *   Windows:      任务计划程序 → 每日 03:00 运行 node server/backup-cli.js backup
 *
 * 恢复演练（建议每月一次）：
 *   node server/backup-cli.js list                  # 看有哪些备份
 *   node server/backup-cli.js preview 备份文件.json # 生成固定恢复预览
 *   node server/backup-cli.js apply 预览文件.json --confirm # 空账号按固定预览恢复
 *   node server/backup-cli.js apply 预览文件.json --confirm --selection 选择.json # 非空账号仅添加明确选择的无冲突项目
 *   浏览器打开页面确认数据回来（错题本/统计/题库/课程）
 *
 * 设计说明：备份走应用级 /api/export；恢复原件进入不可变归档，先按来源 hash 和目标序号预览，
 * 再用确认过的 previewToken 应用。非空账号只能显式选择预览中的无冲突内容；冲突和聚合记录保留不覆盖。旧 restore FILE 覆盖路径已关闭。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { gzipSync } = require('zlib');

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const TOKEN = process.env.TOKEN || '';
const DIR = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, 'backups'));
const KEEP = parseInt(process.env.BACKUP_KEEP || '14', 10) || 14;
const PREFIX = 'chunklab_backup_';
const SUFFIX = '.json';
const PREVIEW_SUFFIX = '.preview.json';
const SCOPED_RECOVERY_REASONS = new Set([
  'server-not-empty', 'legacy-receipt-unknown', 'legacy-receipt-present', 'legacy-conflict-journal'
]);

function request(method, p, body, extraHeaders) {
  return new Promise(function (resolve, reject) {
    const url = new URL(BASE + p);
    const mod = url.protocol === 'https:' ? https : http;
    const data = Buffer.isBuffer(body) ? body : body ? Buffer.from(JSON.stringify(body)) : null;
    const headers = Object.assign({}, extraHeaders || {});
    if (TOKEN) headers.Authorization = 'Bearer ' + TOKEN;
    if (data && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const req = mod.request({
      hostname: url.hostname, port: url.port, path: url.pathname, method: method, headers: headers
    }, function (res) {
      let text = '';
      res.on('data', function (c) { text += c; });
      res.on('end', function () {
        let json = null;
        try { json = JSON.parse(text); } catch (e) { /* 非 JSON 响应 */ }
        if (res.statusCode >= 400) return reject(new Error((json && json.error) || ('HTTP ' + res.statusCode)));
        resolve(json);
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function stamp() {
  const d = new Date();
  const p = function (n) { return String(n).padStart(2, '0'); };
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' +
    p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + ms;
}

function listBackups() {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter(function (f) {
    return f.indexOf(PREFIX) === 0 && f.endsWith(SUFFIX) && !f.endsWith(PREVIEW_SUFFIX);
  }).sort();
}

/* 保留策略：超出 KEEP 份则删除最旧的，返回删除数 */
function prune() {
  const all = listBackups();
  const excess = all.length - KEEP;
  if (excess <= 0) return 0;
  all.slice(0, excess).forEach(function (f) { fs.unlinkSync(path.join(DIR, f)); });
  return excess;
}

function backup() {
  return request('GET', '/api/export').then(function (data) {
    fs.mkdirSync(DIR, { recursive: true });
    const file = PREFIX + stamp() + SUFFIX;
    fs.writeFileSync(path.join(DIR, file), JSON.stringify(data, null, 2));
    const removed = prune();
    const sizeKB = Math.round(fs.statSync(path.join(DIR, file)).size / 1024);
    console.log('[backup] OK ' + file + ' (' + sizeKB + ' KB)');
    if (removed) console.log('[backup] 保留策略：清理旧备份 ' + removed + ' 份（最多 ' + KEEP + ' 份）');
    return file;
  });
}

function readJSON(file, label) {
  const fp = path.resolve(file);
  if (!fs.existsSync(fp)) return Promise.reject(new Error((label || '文件') + '不存在: ' + fp));
  try { return Promise.resolve({ path: fp, data: JSON.parse(fs.readFileSync(fp, 'utf8')) }); }
  catch (e) { return Promise.reject(new Error((label || '文件') + '不是合法 JSON: ' + e.message)); }
}

function fileDigest(fp) {
  return crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex');
}

function snapshotFromExport(payload) {
  if (!payload || payload.__app !== 'chunklab' || !payload.mem || typeof payload.mem !== 'object') {
    throw new Error('备份格式不受支持');
  }
  return {
    mem: payload.mem,
    courses: Array.isArray(payload.courses) ? payload.courses : [],
    courseProgress: payload.courseProgress && typeof payload.courseProgress === 'object' ? payload.courseProgress : {}
  };
}

function redactPrivateSettings(value, pathName, redacted) {
  if (Array.isArray(value)) return value.map(function (item, index) {
    return redactPrivateSettings(item, pathName + '[' + index + ']', redacted);
  });
  if (!value || typeof value !== 'object') return value;
  const output = {};
  Object.keys(value).forEach(function (key) {
    const child = value[key], childPath = pathName ? pathName + '.' + key : key;
    if (key === 'settings' && child && typeof child === 'object' && !Array.isArray(child) &&
        typeof child.apiKey === 'string' && child.apiKey) {
      output[key] = redactPrivateSettings(Object.assign({}, child, { apiKey: '' }), childPath, redacted);
      redacted.push(childPath + '.apiKey');
    } else output[key] = redactPrivateSettings(child, childPath, redacted);
  });
  return output;
}

function recoverySourceFromExport(payload) {
  const snapshot = snapshotFromExport(payload), redacted = [];
  const mem = redactPrivateSettings(snapshot.mem, 'backup.mem', redacted);
  const reinforceBook = redactPrivateSettings(Array.isArray(payload.reinforceBook) ? payload.reinforceBook : [], 'backup.reinforceBook', redacted);
  const courses = redactPrivateSettings(snapshot.courses, 'backup.courses', redacted);
  const courseProgress = redactPrivateSettings(snapshot.courseProgress, 'backup.courseProgress', redacted);
  const pendingRows = payload.saveState && Array.isArray(payload.saveState.unconfirmedOperations)
    ? payload.saveState.unconfirmedOperations.filter(function (row) { return row && typeof row.requestId === 'string' && row.requestId; }) : [];
  const pending = redactPrivateSettings(pendingRows, 'backup.saveState.unconfirmedOperations', redacted);
  return { format: 'chunklab.recovery-source', version: 1, capturedAt: payload.exportedAt || 'unknown',
    sourceKind: 'cli-backup-import', redactedPrivateFields: Array.from(new Set(redacted)).sort(),
    localStorage: { 'chunklab.v1': JSON.stringify(mem), chunklab_reinforce: JSON.stringify(reinforceBook),
      'chunklab.courses.v1': JSON.stringify(courses), 'chunklab.course-progress.v1': JSON.stringify(courseProgress),
      'chunklab.logical-courses.v1': '[]', chunklab_revs_v1: '{}' },
    stores: { courses: [], progress: [], sentenceStats: [], events: [], pendingOperations: pending,
      syncMeta: [], syncIntents: [] } };
}

function uploadRecoverySource(sourceId, sourceHash, raw, compressed, requestApi) {
  requestApi = requestApi || request;
  const chunkSize = 4 * 1024 * 1024;
  if (compressed.length <= chunkSize) {
    return requestApi('POST', '/api/recovery/ingest', compressed, {
      'Content-Type': 'application/vnd.chunklab.recovery+gzip',
      'X-ChunkLab-Recovery-Source': sourceId, 'X-ChunkLab-Recovery-SHA256': sourceHash
    });
  }
  const chunkCount = Math.ceil(compressed.length / chunkSize);
  if (chunkCount > 32) return Promise.reject(new Error('备份压缩后超过恢复接口上限；原备份文件未更改'));
  let chain = Promise.resolve();
  for (let index = 0; index < chunkCount; index++) {
    const start = index * chunkSize, part = compressed.subarray(start, Math.min(compressed.length, start + chunkSize));
    const chunkHash = crypto.createHash('sha256').update(part).digest('hex');
    chain = chain.then(function () {
      return requestApi('POST', '/api/recovery/ingest/chunk', part, {
        'Content-Type': 'application/vnd.chunklab.recovery+gzip',
        'X-ChunkLab-Recovery-Source': sourceId, 'X-ChunkLab-Recovery-SHA256': sourceHash,
        'X-ChunkLab-Recovery-Chunk-Index': String(index), 'X-ChunkLab-Recovery-Chunk-Count': String(chunkCount),
        'X-ChunkLab-Recovery-Chunk-SHA256': chunkHash,
        'X-ChunkLab-Recovery-Uncompressed-Bytes': String(raw.length)
      });
    });
  }
  return chain.then(function () {
    return requestApi('POST', '/api/recovery/ingest/complete', {
      sourceId: sourceId, sourceHash: sourceHash, chunkCount: chunkCount, uncompressedBytes: raw.length
    });
  });
}

function preview(file, output) {
  return readJSON(file, '备份文件').then(function (source) {
    const recoverySource = recoverySourceFromExport(source.data);
    const raw = Buffer.from(JSON.stringify(recoverySource));
    const sourceHash = crypto.createHash('sha256').update(raw).digest('hex');
    const sourceId = 'backup-import-' + fileDigest(source.path);
    const compressed = gzipSync(raw);
    return request('GET', '/api/auth/me').then(function (me) {
      if (!me || !me.user || me.user.id == null) throw new Error('无法确认当前账号，未生成预览');
      return uploadRecoverySource(sourceId, sourceHash, raw, compressed);
    }).then(function (archived) {
      if (!archived || archived.ok !== true || archived.sourceId !== sourceId || archived.sourceHash !== sourceHash ||
          !archived.manifest || archived.manifest.verified !== true) throw new Error('服务端未确认备份原件已保全');
      return Promise.all([request('GET', '/api/auth/me'), request('POST', '/api/recovery/' + encodeURIComponent(sourceId) + '/preview',
        { sourceHash: sourceHash })]);
    }).then(function (parts) {
      const me = parts[0], remote = parts[1];
      if (!me || !me.user || me.user.id == null) throw new Error('无法确认当前账号，未生成预览');
      if (!remote || remote.sourceId !== sourceId || remote.sourceHash !== sourceHash ||
          !Number.isSafeInteger(remote.expectedSeq) || typeof remote.previewToken !== 'string') {
        throw new Error('服务端未返回与归档匹配的恢复预览');
      }
      const previewPath = path.resolve(output || (source.path + PREVIEW_SUFFIX));
      const fixed = { schemaVersion: 2, kind: 'chunklab-recovery-preview-v2', baseUrl: BASE,
        userId: String(me.user.id), source: { path: source.path, sha256: fileDigest(source.path), bytes: fs.statSync(source.path).size },
        sourceId: sourceId, sourceHash: sourceHash, expectedSeq: remote.expectedSeq, previewToken: remote.previewToken,
        eligible: remote.eligible === true, reason: remote.reason || null, counts: remote.counts || null,
        merge: remote.merge || null,
        createdAt: new Date().toISOString() };
      fs.writeFileSync(previewPath, JSON.stringify(fixed, null, 2));
      console.log('[preview] OK ' + path.basename(previewPath) + '（活动学习数据未变更，恢复原件已归档）');
      console.log('[preview] 服务器序号 ' + remote.expectedSeq + '；' + (fixed.eligible ? '可应用' : '暂不可应用：' + fixed.reason));
      console.log('[preview] 恢复原件已在服务器保全；执行前必须人工核对并使用 --confirm');
      return previewPath;
    });
  });
}

function applyPreview(file, confirmed, selectionFile) {
  if (!confirmed) return Promise.reject(new Error('恢复前必须明确确认：node backup-cli.js apply PREVIEW --confirm'));
  return readJSON(file, '预览文件').then(function (input) {
    const p = input.data;
    if (!p || p.kind !== 'chunklab-recovery-preview-v2' || p.schemaVersion !== 2 ||
        typeof p.sourceHash !== 'string' || typeof p.sourceId !== 'string' || typeof p.previewToken !== 'string' ||
        !Number.isSafeInteger(p.expectedSeq) || !p.source) {
      throw new Error('预览文件格式不受支持');
    }
    const partialRecovery = p.eligible !== true && SCOPED_RECOVERY_REASONS.has(p.reason) && p.merge && selectionFile;
    if (p.eligible !== true && !partialRecovery) {
      const hint = SCOPED_RECOVERY_REASONS.has(p.reason) && p.merge
        ? '该恢复来源需要按范围处理；请检查预览中的无冲突项目，并通过 --selection FILE 明确选择后再应用'
        : '该预览不可应用（' + (p.reason || 'RECOVERY_NOT_ELIGIBLE') + '）；服务端已保留原件';
      return Promise.reject(new Error(hint));
    }
    if (p.eligible === true && selectionFile) return Promise.reject(new Error('空账号恢复不接受部分选择；请重新预览并使用完整恢复'));
    if (p.baseUrl !== BASE) throw new Error('预览绑定的服务地址已变化，请重新 preview');
    if (!fs.existsSync(p.source.path) || fileDigest(p.source.path) !== p.source.sha256) {
      throw new Error('备份原文件已变化或不存在，请重新 preview');
    }
    let selection;
    if (selectionFile) {
      let parsedSelection;
      try { parsedSelection = JSON.parse(fs.readFileSync(selectionFile, 'utf8')); }
      catch (_) { throw new Error('恢复选择文件不存在或不是有效 JSON；预览和原件保持不变'); }
      if (!parsedSelection || typeof parsedSelection !== 'object' || Array.isArray(parsedSelection)) {
        throw new Error('恢复选择文件必须是 JSON 对象；预览和原件保持不变');
      }
      selection = parsedSelection;
    }
    return request('GET', '/api/auth/me').then(function (me) {
      if (!me || !me.user || String(me.user.id) !== String(p.userId)) {
        throw new Error('当前账号已变化，请重新 preview');
      }
      return request('POST', '/api/recovery/' + encodeURIComponent(p.sourceId) + '/apply', {
        sourceHash: p.sourceHash, expectedSeq: p.expectedSeq, previewToken: p.previewToken,
        ...(selection ? { selection: selection } : {})
      });
    }).then(function (result) {
      if (!result || !['applied', 'already-present', 'partially-applied'].includes(result.state)) {
        throw new Error('服务端未应用该预览（' + ((result && result.reason) || result && result.state || '状态不明') + '）；原件仍已保留');
      }
      console.log('[apply] OK ' + path.basename(input.path) + (selection
        ? '（已恢复所选无冲突内容；其他记录仍保留）' : '（已按固定预览恢复）'));
      return result;
    });
  });
}

const cmd = process.argv[2];
if (cmd) {
  Promise.resolve()
    .then(function () {
      if (cmd === 'backup') return backup();
      if (cmd === 'preview') return preview(process.argv[3], process.argv[4]);
      if (cmd === 'apply') {
        const args = process.argv.slice(4);
        const confirmed = args.includes('--confirm');
        const selectionIndex = args.indexOf('--selection');
        if (selectionIndex >= 0 && (!args[selectionIndex + 1] || args[selectionIndex + 1].startsWith('--'))) {
          throw new Error('--selection 后必须指定恢复选择 JSON 文件');
        }
        const selectionFile = selectionIndex >= 0 ? args[selectionIndex + 1] : null;
        if (args.some(arg => arg !== '--confirm' && arg !== '--selection' && arg !== selectionFile)) {
          throw new Error('apply 参数无效');
        }
        return applyPreview(process.argv[3], confirmed, selectionFile);
      }
      if (cmd === 'restore') return Promise.reject(new Error('旧 restore FILE 已关闭，请先 preview FILE，再 apply PREVIEW --confirm'));
      if (cmd === 'list') {
        const all = listBackups();
        if (!all.length) { console.log('(无备份)'); return; }
        all.forEach(function (f) {
          const kb = Math.round(fs.statSync(path.join(DIR, f)).size / 1024);
          console.log(f + '  (' + kb + ' KB)');
        });
        return;
      }
      console.error('用法: node backup-cli.js <backup | preview FILE | apply PREVIEW --confirm [--selection FILE] | list>');
      process.exit(1);
    })
    .catch(function (e) { console.error('[backup] 失败: ' + e.message); process.exit(1); });
}

module.exports = { backup: backup, preview: preview, applyPreview: applyPreview, listBackups: listBackups,
  prune: prune, request: request, uploadRecoverySource: uploadRecoverySource, DIR: DIR, KEEP: KEEP };
