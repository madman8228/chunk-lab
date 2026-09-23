#!/usr/bin/env node
'use strict';
/* ============================================================================
 * normalize-null-revs.js · 一次性运维脚本（2026-09-22，F-002 收尾）
 *
 * 目的
 *   把同步表里 `rev IS NULL` 的历史行**归一为 0**。
 *   为什么是 0 而不是 1：读侧 `server/sync-conflict.js` 本来就把 NULL 归一为 0
 *   （`current.rev != null ? current.rev : 0`），把库写成 0 只是让**存储侧与读侧口径一致**；
 *   0 表示「存在但未版本化」。写 1 会伪造一个并不存在的版本号，可能误伤随后的
 *   条件写入（把某台设备的 rev=1 当成旧版本拒掉），因此**绝不写 1**。
 *
 * 为什么需要它
 *   F-002 的机制是：旧客户端在「冲突处理成功」后会把 rev 重新写成 NULL。即使服务端
 *   已把 `baseRev === null` 的语义放宽为「不存在或未版本化」，历史库里仍会残留
 *   `rev = NULL` 的行。把它们归一为 0 可让库处于一个干净、与读侧自洽的状态。
 *
 * ⚠️ 执行时机是个坑（务必遵守）
 *   现在线上跑的仍是**旧前端**。旧客户端在「冲突处理成功」后仍会把 rev 重新写成 NULL。
 *   **若先校正数据、后部署**，NULL 会被旧前端重新制造出来，等于白跑。
 *   正确顺序：**部署修复（服务端 + 前端）→ 用户刷新到新版 → 再跑本脚本**。
 *   脚本**幂等 / 可重跑**，正是为了让这一步随时补做都安全。
 *
 * ⚠️ 这是**一次性运维脚本**（放在 scripts/，不参与部署）。生产执行前需**老板明确授权**。
 *
 * 用法
 *   node scripts/normalize-null-revs.js --db <path>             # dry-run，只报告（默认）
 *   node scripts/normalize-null-revs.js --db <path> --confirm   # 真正写库
 *   node scripts/normalize-null-revs.js --help
 *
 * 行为
 *   - 以 schema 为准，自动枚举**所有带 `rev` 列的表**（不硬编码表名）；
 *   - dry-run 打开只读连接，**不可能**写入；
 *   - --confirm：写前 `PRAGMA integrity_check` 必须为 ok；**单事务**写入；任何异常整批回滚、
 *     退出码非 0；写后再校验一次 integrity_check；
 *   - 幂等：NULL 已为 0 时第二次运行 0 变更；
 *   - 输出 before / after 对照 + 每表受影响行数。
 * ==========================================================================*/

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const Database = require(path.join(ROOT, 'server', 'node_modules', 'better-sqlite3'));

const USAGE = [
  '用法:',
  '  node scripts/normalize-null-revs.js --db <path>             # dry-run（默认，只报告，只读打开）',
  '  node scripts/normalize-null-revs.js --db <path> --confirm   # 真正写库（单事务）',
  '  node scripts/normalize-null-revs.js --help',
].join('\n');

function parseArgs(argv) {
  const opts = { db: null, confirm: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--db') { opts.db = argv[++i]; }
    else if (arg.startsWith('--db=')) { opts.db = arg.slice('--db='.length); }
    else if (arg === '--confirm' || arg === '--apply') { opts.confirm = true; }
    else if (arg === '--help' || arg === '-h') { opts.help = true; }
    else throw new Error('未知参数：' + arg);
  }
  return opts;
}

/* Identifier quoting keeps a table name from sqlite_master safe to interpolate. */
function quoteIdent(name) { return '"' + String(name).replace(/"/g, '""') + '"'; }

/* Enumerate every table that actually has a `rev` column (schema is the source of truth). */
function revTables(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map(function (row) { return row.name; })
    .filter(function (name) {
      return db.prepare('PRAGMA table_info(' + quoteIdent(name) + ')').all().some(function (col) { return col.name === 'rev'; });
    });
}

function counts(db, tables) {
  const out = {};
  tables.forEach(function (table) {
    const rows = db.prepare('SELECT COUNT(*) AS n FROM ' + quoteIdent(table)).get().n;
    const nul = db.prepare('SELECT COUNT(*) AS n FROM ' + quoteIdent(table) + ' WHERE rev IS NULL').get().n;
    out[table] = { rows: rows, nullRevs: nul };
  });
  return out;
}

function integrityOk(db) {
  const rows = db.pragma('integrity_check');
  const first = rows && rows[0] ? rows[0].integrity_check : null;
  return first === 'ok';
}

function report(title, snapshot, tables) {
  console.log('  ' + title);
  let totalRows = 0, totalNulls = 0;
  tables.forEach(function (table) {
    const c = snapshot[table];
    totalRows += c.rows; totalNulls += c.nullRevs;
    console.log('    - ' + table.padEnd(24) + ' rows=' + String(c.rows).padStart(6) + '  rev IS NULL=' + c.nullRevs);
  });
  console.log('    ' + 'TOTAL'.padEnd(24) + ' rows=' + String(totalRows).padStart(6) + '  rev IS NULL=' + totalNulls);
  return { totalRows: totalRows, totalNulls: totalNulls };
}

function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help) { console.log(USAGE); return 0; }
  /* Fail-closed: never guess a target database (production writes must be explicit). */
  if (!opts.db) { console.error('缺少 --db <path>（为安全起见不提供默认库路径）。\n' + USAGE); return 2; }
  const dbPath = path.resolve(opts.db);
  if (!fs.existsSync(dbPath)) { console.error('数据库文件不存在：' + dbPath); return 2; }

  console.log('[normalize-null-revs] ' + (opts.confirm ? 'APPLY (--confirm)' : 'DRY-RUN (只报告，不写入)'));
  console.log('[normalize-null-revs] db = ' + dbPath);

  /* dry-run 一律只读打开：即便脚本有 bug 也不可能写入。 */
  const db = new Database(dbPath, opts.confirm ? { fileMustExist: true } : { readonly: true, fileMustExist: true });
  try {
    const tables = revTables(db);
    if (!tables.length) { console.log('[normalize-null-revs] 未发现带 rev 列的表，无事可做。'); return 0; }
    console.log('[normalize-null-revs] 带 rev 列的表（以 schema 为准）：' + tables.join(', '));

    const before = counts(db, tables);
    const beforeTotals = report('BEFORE', before, tables);

    if (beforeTotals.totalNulls === 0) {
      console.log('[normalize-null-revs] 没有 rev IS NULL 的行（幂等：0 变更）。');
      return 0;
    }
    if (!opts.confirm) {
      console.log('[normalize-null-revs] dry-run：以上为待归一（NULL -> 0）的行数；确认后加 --confirm 执行。');
      return 0;
    }

    if (!integrityOk(db)) { console.error('[normalize-null-revs] PRAGMA integrity_check 不是 ok，拒绝写入。'); return 1; }

    /* 单事务：任何异常整批回滚（better-sqlite3 在回调抛错时自动 rollback）。 */
    const applied = db.transaction(function () {
      const changes = {};
      tables.forEach(function (table) {
        changes[table] = db.prepare('UPDATE ' + quoteIdent(table) + ' SET rev=0 WHERE rev IS NULL').run().changes;
      });
      return changes;
    })();

    console.log('  APPLIED (单事务)');
    let changed = 0;
    tables.forEach(function (table) { changed += applied[table]; console.log('    - ' + table.padEnd(24) + ' updated=' + applied[table]); });
    console.log('    ' + 'TOTAL'.padEnd(24) + ' updated=' + changed);

    const after = counts(db, tables);
    const afterTotals = report('AFTER', after, tables);
    if (!integrityOk(db)) { console.error('[normalize-null-revs] 写入后 integrity_check 不是 ok！'); return 1; }

    /* 断言：NULL 归零、行数不变（只改 rev 值，不增删行）。 */
    let ok = true;
    tables.forEach(function (table) {
      if (after[table].nullRevs !== 0) ok = false;
      if (after[table].rows !== before[table].rows) ok = false;
    });
    if (!ok || afterTotals.totalNulls !== 0) { console.error('[normalize-null-revs] 归一后校验失败（仍有 NULL 或行数变化）。'); return 1; }
    console.log('[normalize-null-revs] 完成：rev IS NULL 归零为 0，非 NULL 行未改，行数不变，integrity_check=ok。');
    console.log('[normalize-null-revs] 可重复执行；再次运行应为 0 变更。');
    return 0;
  } finally {
    db.close();
  }
}

if (require.main === module) {
  try { process.exit(main(process.argv.slice(2))); }
  catch (error) { console.error('[normalize-null-revs] 失败：' + (error && error.stack || error)); process.exit(1); }
}

module.exports = { main, revTables, quoteIdent };
