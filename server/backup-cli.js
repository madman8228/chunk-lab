#!/usr/bin/env node
/**
 * backup-cli.js · Chunk Lab 自动备份 CLI（零依赖，上线准备 #2）
 *
 * 用法：
 *   node backup-cli.js backup              # 备份：GET /api/export → 落盘 + 保留 N 份自动清理
 *   node backup-cli.js restore <file>      # 恢复：POST /api/import（覆盖式，恢复语义）
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
 *   node server/backup-cli.js restore 备份文件.json  # 恢复到服务（覆盖当前数据）
 *   浏览器打开页面确认数据回来（错题本/统计/题库/课程）
 *
 * 设计说明：备份走应用级 /api/export（可移植 JSON，恢复即 /api/import，链路对称）。
 *   export 输出的 __app/__version/reinforceBook 等字段 import 会忽略；revs 缺失时
 *   import 退化为"总是覆盖"——正好是恢复语义（smoke 已验证旧客户端无 revs 覆盖兼容）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const TOKEN = process.env.TOKEN || '';
const DIR = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, 'backups'));
const KEEP = parseInt(process.env.BACKUP_KEEP || '14', 10) || 14;
const PREFIX = 'chunklab_backup_';
const SUFFIX = '.json';

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
  return fs.readdirSync(DIR).filter(function (f) { return f.indexOf(PREFIX) === 0 && f.endsWith(SUFFIX); }).sort();
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

function restore(file) {
  const fp = path.resolve(file);
  if (!fs.existsSync(fp)) return Promise.reject(new Error('备份文件不存在: ' + fp));
  const payload = JSON.parse(fs.readFileSync(fp, 'utf8'));
  return request('POST', '/api/import', payload).then(function (r) {
    console.log('[restore] OK ' + path.basename(fp));
    return r;
  });
}

const cmd = process.argv[2];
if (cmd) {
  Promise.resolve()
    .then(function () {
      if (cmd === 'backup') return backup();
      if (cmd === 'restore') return restore(process.argv[3]);
      if (cmd === 'list') {
        const all = listBackups();
        if (!all.length) { console.log('(无备份)'); return; }
        all.forEach(function (f) {
          const kb = Math.round(fs.statSync(path.join(DIR, f)).size / 1024);
          console.log(f + '  (' + kb + ' KB)');
        });
        return;
      }
      console.error('用法: node backup-cli.js <backup | restore FILE | list>');
      process.exit(1);
    })
    .catch(function (e) { console.error('[backup] 失败: ' + e.message); process.exit(1); });
}

module.exports = { backup: backup, restore: restore, listBackups: listBackups, prune: prune, request: request, DIR: DIR, KEEP: KEEP };
