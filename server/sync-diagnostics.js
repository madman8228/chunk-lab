'use strict';

/* Read-only inspection of conflict archives. This file deliberately opens the
 * database in readonly mode when used as a CLI; it never prints snapshots. */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const MAX_ROWS = 100;
const MAX_BYTES = 64 * 1024 * 1024;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function inspect(db, userId) {
  if (!Number.isSafeInteger(userId) || userId < 1) throw new Error('userId must be a positive integer');
  const rows = db.prepare(
    'SELECT request_id, backup_json, created_at FROM user_sync_resolutions WHERE user_id=? ORDER BY created_at ASC, request_id ASC'
  ).all(userId);
  let bytes = 0;
  let auto = 0;
  let historicalUnknown = 0;
  let malformed = 0;
  const dates = Object.create(null);
  const pairs = Object.create(null);
  for (const row of rows) {
    const raw = Buffer.byteLength(String(row.backup_json || ''), 'utf8');
    bytes += raw;
    const day = String(row.created_at || '').slice(0, 10) || 'unknown';
    dates[day] = (dates[day] || 0) + 1;
    /* UUIDs and old request IDs do not carry a trustworthy origin marker.
       Report them as unknown instead of falsely calling every non-auto row
       a manual action. */
    if (String(row.request_id).startsWith('auto-reconcile-')) auto += 1;
    else historicalUnknown += 1;
    try {
      const archive = JSON.parse(row.backup_json);
      const local = fingerprint(archive.local || null);
      const remote = fingerprint(archive.remote || null);
      const pair = local + ':' + remote;
      pairs[pair] = (pairs[pair] || 0) + 1;
    } catch (_) {
      malformed += 1;
    }
  }
  const duplicateSnapshotRows = Object.values(pairs).reduce((sum, count) => sum + (count > 1 ? count - 1 : 0), 0);
  return {
    userId,
    archiveRows: rows.length,
    archiveBytes: bytes,
    limits: { maxRows: MAX_ROWS, maxBytes: MAX_BYTES },
    remaining: {
      rows: Math.max(0, MAX_ROWS - rows.length),
      bytes: Math.max(0, MAX_BYTES - bytes)
    },
    atCapacity: rows.length >= MAX_ROWS || bytes >= MAX_BYTES,
    counts: { autoReconcile: auto, historicalUnknown, malformed },
    dates: { ...dates },
    duplicateSnapshotRows,
    observed: rows.length === 0 ? 'no conflict archives for this user' : 'archive metadata only; cause is not proven by this report'
  };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--db') args.db = argv[++i];
    else if (argv[i] === '--user-id') args.userId = Number(argv[++i]);
    else if (argv[i] === '--help' || argv[i] === '-h') args.help = true;
    else throw new Error('unknown argument: ' + argv[i]);
  }
  return args;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: node server/sync-diagnostics.js --db <chunklab.db> --user-id <id>');
    return 0;
  }
  if (!args.db || !Number.isSafeInteger(args.userId) || args.userId < 1) {
    throw new Error('Usage: node server/sync-diagnostics.js --db <chunklab.db> --user-id <positive integer>');
  }
  const dbPath = path.resolve(args.db);
  if (!fs.existsSync(dbPath)) throw new Error('database does not exist: ' + dbPath);
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try { console.log(JSON.stringify(inspect(db, args.userId), null, 2)); }
  finally { db.close(); }
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { inspect, parseArgs, MAX_ROWS, MAX_BYTES };
