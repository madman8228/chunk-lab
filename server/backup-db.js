#!/usr/bin/env node
/**
 * backup-db.js · Chunk Lab SQLite 全库快照备份（零外部依赖，多用户完整备份）
 *
 * 为什么需要它：backup-cli.js 走应用级 /api/export，一次只能导一个账号（多用户模式下
 * 要逐用户 TOKEN）。SQLite 文件级 VACUUM INTO 快照一次覆盖全部 user 数据，才是多用户
 * 部署的完整备份。恢复 = 停服务 → 用备份文件替换 chunklab.db → 启服务。
 *
 * 用法：
 *   node server/backup-db.js backup            # 快照到 BACKUP_DIR + 保留 N 份
 *   node server/backup-db.js list              # 列出已有备份
 *
 * 环境变量：
 *   CHUNKLAB_DATA_DIR   数据库目录（必须与服务端一致；默认 server/data）
 *   BACKUP_DIR          备份目录（默认 server/backups）
 *   BACKUP_KEEP         保留份数（默认 14，超出自动删最旧）
 *
 * 调度（systemd timer 或 cron，注意 CHUNKLAB_DATA_DIR 要和服务端一致）：
 *   Linux cron:  0 3 * * *  cd /opt/chunklab && /usr/bin/node server/backup-db.js backup
 */
'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(process.env.CHUNKLAB_DATA_DIR || path.join(__dirname, 'data'));
const DIR = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, 'backups'));
const KEEP = parseInt(process.env.BACKUP_KEEP || '14', 10) || 14;
const DB = path.join(DATA_DIR, 'chunklab.db');
const PREFIX = 'chunklab_db_';
const SUFFIX = '.db';

function nowStamp() {
  const d = new Date();
  const p = function (n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}
function list() {
  fs.mkdirSync(DIR, { recursive: true });
  return fs.readdirSync(DIR)
    .filter(function (f) { return f.indexOf(PREFIX) === 0 && f.endsWith(SUFFIX); })
    .sort();
}
function prune() {
  const all = list();
  while (all.length > KEEP) {
    const old = all.shift();
    try { fs.unlinkSync(path.join(DIR, old)); console.log('[backup-db] 清理旧备份: ' + old); } catch (e) { console.error('[backup-db] 清理失败:', old, e.message); }
  }
}

async function backup() {
  if (!fs.existsSync(DB)) { console.error('[backup-db] 数据库不存在: ' + DB + '（检查 CHUNKLAB_DATA_DIR）'); process.exit(1); }
  fs.mkdirSync(DIR, { recursive: true });
  const out = path.join(DIR, PREFIX + nowStamp() + SUFFIX);
  /* VACUUM INTO：SQLite 在线一致性快照，服务运行中可直接执行，不锁主库。 */
  const Database = require('better-sqlite3');
  const db = new Database(DB, { readonly: true, fileMustExist: true });
  try {
    db.exec("VACUUM INTO '" + out.replace(/'/g, "''") + "'");
  } finally {
    db.close();
  }
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log('[backup-db] OK: ' + out + ' (' + kb + ' KB)');
  prune();
}

async function main() {
  const cmd = process.argv[2] || 'backup';
  if (cmd === 'backup') { await backup(); }
  else if (cmd === 'list') {
    const all = list();
    console.log(all.length ? all.join('\n') : '（无备份）');
  } else { console.error('用法: node server/backup-db.js backup|list'); process.exit(1); }
}

main().catch(function (e) { console.error('[backup-db] FATAL:', e.message); process.exit(1); });
