'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Database = require('../server/node_modules/better-sqlite3');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const allowed = new Set(['user_activity', 'user_change_seq', 'user_kv']);
const disposableLearning = new Set(['user_batch_receipts','user_client_save_health','user_course_progress','user_events','user_sentence_stats','user_operation_receipts']);
function contentFingerprint(db, excludedCourseUsers = []) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name)
    .filter(name => ['user_courses','user_decks','personal_wordbook_versions'].includes(name) || /^(course_content|course_asset|membership_course_publications|membership_content_publication)/.test(name));
  return hash(tables.map(name => {
    const rows = db.prepare('SELECT * FROM ' + quote(name)).all().filter(row => name !== 'user_courses' || !excludedCourseUsers.includes(row.user_id));
    return [name, hash(rows.map(row => JSON.stringify(row)).sort())];
  }));
}
function archivedSources(file) {
  if (!file) return new Map();
  const root = path.dirname(path.resolve(file)), archive = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (archive.kind !== 'system-course-source-archive' || archive.ownership !== 'system' || !Array.isArray(archive.sources) || !Array.isArray(archive.assets)) throw Error('Invalid preserved course archive');
  const read = ref => {
    const target = fs.realpathSync(path.resolve(root, ref.file));
    if (!target.startsWith(fs.realpathSync(root) + path.sep)) throw Error('Archive path escapes source directory');
    const bytes = fs.readFileSync(target);
    if (bytes.length !== ref.bytes || crypto.createHash('sha256').update(bytes).digest('hex') !== ref.sha256) throw Error('Preserved course archive integrity failed');
    return bytes;
  };
  archive.assets.forEach(read);
  return new Map(archive.sources.map(ref => {
    const bytes = read(ref), course = JSON.parse(bytes);
    if (course.courseId !== archive.courseId) throw Error('Preserved source course identity mismatch');
    return [ref.originalUserId + ':' + course.courseId, { hash: crypto.createHash('sha256').update(bytes).digest('hex') }];
  }));
}
function inspect(db, ids, options = {}) {
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || ids.some(id => !Number.isSafeInteger(id) || id <= 1)) throw Error('Explicit distinct test account IDs above 1 are required');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
  const digestRows = rows => hash(rows.map(row => JSON.stringify(row)).sort());
  const contentHash = contentFingerprint(db);
  const preserved = archivedSources(options.sourceArchive);
  const accounts = ids.map(id => {
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
    if (!user || !/^(guest_|smoke_)/.test(user.username)) throw Error('Account is absent or is not an explicit legacy guest/test account: ' + id);
    const related = [], blockers = [];
    for (const name of tables) {
      const columns = db.prepare('PRAGMA table_info(' + quote(name) + ')').all().map(row => row.name);
      const fks = db.prepare('PRAGMA foreign_key_list(' + quote(name) + ')').all().filter(row => row.table === 'users');
      const owners = [...new Set([...fks.map(row => row.from), ...columns.filter(column => ['user_id','source_user_id','subject_user_id'].includes(column)),
        ...(name === 'course_contents' ? ['created_by'] : [])])];
      for (const column of owners) {
        const rows = db.prepare('SELECT * FROM ' + quote(name) + ' WHERE ' + quote(column) + '=?').all(id);
        if (!rows.length) continue;
        related.push({ table: name, column, count: rows.length, hash: digestRows(rows) });
        const archivedCourse = name === 'user_courses' && options.discardLearning && rows.every(row =>
          preserved.get(id + ':' + row.course_id)?.hash === crypto.createHash('sha256').update(row.data_json).digest('hex'));
        if (!allowed.has(name) && !(options.discardLearning && disposableLearning.has(name)) && !archivedCourse) blockers.push(name + '.' + column);
        if (name === 'user_kv') for (const row of rows) {
          const value = JSON.parse(row.v_json);
          if (row.deleted_at || !['best','stats','settings'].includes(row.k) ||
              row.k === 'best' && !options.discardLearning && (!value || Object.keys(value).length) ||
              row.k === 'stats' && !options.discardLearning && (value.totalRounds !== 0 || value.totalAnswered !== 0 || !value.daysLog || Object.keys(value.daysLog).length || Object.keys(value).some(key => !['totalRounds','totalAnswered','daysLog'].includes(key))) ||
              row.k === 'settings' && (value.apiKey || Object.values(value).some(item => item && typeof item === 'object'))) blockers.push('nonempty user_kv:' + row.k);
        }
      }
    }
    if (blockers.length) throw Error('Account ' + id + ' has protected data: ' + blockers.join(', '));
    return { id, username: user.username, userHash: hash(user), related };
  });
  const policy = { ...(options.discardLearning ? { discardLearning: true } : {}), ...(options.sourceArchive ? { sourceArchive: path.resolve(options.sourceArchive) } : {}) };
  return { version: 1, ids, ...policy, contentHash, accounts, sourceHash: hash({ contentHash, accounts, ...policy }) };
}
function apply(db, manifest, backupFile) {
  if (manifest?.version !== 1 || !backupFile) throw Error('A preview manifest and consistent backup are required');
  const backup = new Database(path.resolve(backupFile), { readonly: true, fileMustExist: true });
  try {
    if (backup.pragma('integrity_check', { simple: true }) !== 'ok' || inspect(backup, manifest.ids, manifest).sourceHash !== manifest.sourceHash) throw Error('Backup does not match the reviewed target data');
  } finally { backup.close(); }
  return db.transaction(() => {
    const actual = inspect(db, manifest.ids, manifest);
    if (actual.sourceHash !== manifest.sourceHash || JSON.stringify(actual.accounts) !== JSON.stringify(manifest.accounts) || actual.contentHash !== manifest.contentHash) throw Error('Reviewed data changed; no accounts deleted');
    const beforeUsers = db.prepare('SELECT * FROM users ORDER BY id').all().filter(user => !manifest.ids.includes(user.id));
    const retainedContentHash = contentFingerprint(db, manifest.ids);
    for (const account of manifest.accounts) {
      for (const row of account.related) db.prepare('DELETE FROM ' + quote(row.table) + ' WHERE ' + quote(row.column) + '=?').run(account.id);
      if (db.prepare('DELETE FROM users WHERE id=?').run(account.id).changes !== 1) throw Error('Account changed during retirement');
    }
    if (hash(db.prepare('SELECT * FROM users ORDER BY id').all()) !== hash(beforeUsers)) throw Error('Unselected account changed');
    const removedCourseRows = actual.accounts.flatMap(account => account.related.filter(row => row.table === 'user_courses'));
    if (contentFingerprint(db) !== retainedContentHash) throw Error('Course preservation check failed');
    if (db.pragma('foreign_key_check').length) throw Error('Foreign key verification failed; rolled back');
    return { deletedIds: manifest.ids, deletedCount: manifest.ids.length, courseContentUnchanged: !removedCourseRows.length,
      ...(removedCourseRows.length ? { archivedCourseRows: removedCourseRows.reduce((sum, row) => sum + row.count, 0) } : {}) };
  }).immediate();
}
function run(argv) {
  const args = {};
  for (let i=0; i<argv.length; i+=2) {
    if (!['--db','--ids','--write-manifest','--apply-manifest','--backup','--discard-learning','--source-archive'].includes(argv[i]) || !argv[i+1] || args[argv[i]]) throw Error('Invalid or repeated arguments');
    args[argv[i]] = argv[i+1];
  }
  if (!args['--db'] || !!args['--ids'] === !!args['--apply-manifest']) throw Error('Supply --db and either --ids or --apply-manifest');
  const file = path.resolve(args['--db']);
  const db = new Database(file, { readonly: !args['--apply-manifest'], fileMustExist: true });
  try {
    db.pragma('foreign_keys = ON');
    if (args['--apply-manifest']) {
      const manifest = JSON.parse(fs.readFileSync(args['--apply-manifest'], 'utf8'));
      if (manifest.database !== file) throw Error('Manifest targets another database');
      return apply(db, manifest, args['--backup']);
    }
    if (args['--discard-learning'] && args['--discard-learning'] !== 'true') throw Error('--discard-learning must explicitly be true');
    const manifest = db.transaction(() => ({ database: file, ...inspect(db, args['--ids'].split(',').map(Number),
      { discardLearning: args['--discard-learning'] === 'true', sourceArchive: args['--source-archive'] }) }))();
    if (args['--write-manifest']) fs.writeFileSync(args['--write-manifest'], JSON.stringify(manifest, null, 2), { flag: 'wx' });
    return { mode: 'preview', ...manifest };
  } finally { db.close(); }
}
if (require.main === module) {
  try { console.log(JSON.stringify(run(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { inspect, apply, run };
