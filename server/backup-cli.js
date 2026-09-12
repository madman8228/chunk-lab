#!/usr/bin/env node
/**
 * backup-cli.js · Chunk Lab 自动备份 CLI（零依赖，上线准备 #2）
 *
 * 用法：
 *   node backup-cli.js backup              # 备份：GET /api/export → 落盘 + 保留 N 份自动清理
 *   node backup-cli.js preview <file>      # 固定恢复预览（只读，生成 .preview.json）
 *   node backup-cli.js apply <preview> --confirm  # 按固定预览执行账号级恢复
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
 *   node server/backup-cli.js apply 预览文件.json --confirm # 明确确认后恢复
 *   浏览器打开页面确认数据回来（错题本/统计/题库/课程）
 *
 * 设计说明：备份走应用级 /api/export；恢复必须先取得账号级固定快照 token，
 * 再用 /api/sync/batch/resolve 执行。旧的 restore FILE 覆盖式路径已关闭。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const TOKEN = process.env.TOKEN || '';
const DIR = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, 'backups'));
const KEEP = parseInt(process.env.BACKUP_KEEP || '14', 10) || 14;
const PREFIX = 'chunklab_backup_';
const SUFFIX = '.json';
const PREVIEW_SUFFIX = '.preview.json';

function request(method, p, body) {
  return new Promise(function (resolve, reject) {
    const url = new URL(BASE + p);
    const mod = url.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const headers = {};
    if (TOKEN) headers.Authorization = 'Bearer ' + TOKEN;
    if (data) headers['Content-Type'] = 'application/json';
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

function preview(file, output) {
  return readJSON(file, '备份文件').then(function (source) {
    const local = snapshotFromExport(source.data);
    return Promise.all([request('GET', '/api/sync/batch'), request('GET', '/api/auth/me')]).then(function (parts) {
      const remote = parts[0], me = parts[1];
      if (!remote || remote.kind !== 'batch' || typeof remote.token !== 'string' || !remote.snapshot) {
        throw new Error('服务端未返回可确认的账号级恢复预览');
      }
      if (!me || !me.user || me.user.id == null) throw new Error('无法确认当前账号，未生成预览');
      const previewPath = path.resolve(output || (source.path + PREVIEW_SUFFIX));
      const fixed = {
        schemaVersion: 1,
        kind: 'chunklab-restore-preview-v1',
        baseUrl: BASE,
        userId: String(me.user.id),
        source: { path: source.path, sha256: fileDigest(source.path), bytes: fs.statSync(source.path).size },
        requestId: crypto.randomUUID(),
        expectedToken: remote.token,
        remoteSeq: remote.seq,
        local: local,
        createdAt: new Date().toISOString()
      };
      fs.writeFileSync(previewPath, JSON.stringify(fixed, null, 2));
      console.log('[preview] OK ' + path.basename(previewPath) + '（未写入服务）');
      console.log('[preview] 云端序号 ' + remote.seq + '；执行前必须人工核对备份并使用 --confirm');
      return previewPath;
    });
  });
}

function applyPreview(file, confirmed) {
  if (!confirmed) return Promise.reject(new Error('恢复前必须明确确认：node backup-cli.js apply PREVIEW --confirm'));
  return readJSON(file, '预览文件').then(function (input) {
    const p = input.data;
    if (!p || p.kind !== 'chunklab-restore-preview-v1' || p.schemaVersion !== 1 ||
        typeof p.expectedToken !== 'string' || typeof p.requestId !== 'string' || !p.local || !p.source) {
      throw new Error('预览文件格式不受支持');
    }
    if (p.baseUrl !== BASE) throw new Error('预览绑定的服务地址已变化，请重新 preview');
    if (!fs.existsSync(p.source.path) || fileDigest(p.source.path) !== p.source.sha256) {
      throw new Error('备份原文件已变化或不存在，请重新 preview');
    }
    return request('GET', '/api/auth/me').then(function (me) {
      if (!me || !me.user || String(me.user.id) !== String(p.userId)) {
        throw new Error('当前账号已变化，请重新 preview');
      }
      return request('POST', '/api/sync/batch/resolve', {
        choice: 'local', requestId: p.requestId, expectedToken: p.expectedToken, local: p.local
      });
    }).then(function (result) {
      console.log('[apply] OK ' + path.basename(input.path) + '（已按固定预览恢复）');
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
      if (cmd === 'apply') return applyPreview(process.argv[3], process.argv[4] === '--confirm');
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
      console.error('用法: node backup-cli.js <backup | preview FILE | apply PREVIEW --confirm | list>');
      process.exit(1);
    })
    .catch(function (e) { console.error('[backup] 失败: ' + e.message); process.exit(1); });
}

module.exports = { backup: backup, preview: preview, applyPreview: applyPreview, listBackups: listBackups, prune: prune, request: request, DIR: DIR, KEEP: KEEP };
