'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Database = require('../server/node_modules/better-sqlite3');
const { audit } = require('./audit-browser-course-backup.cjs');

function activate(db, manifest, backup, { userId, apply = false } = {}) {
  if (!Number.isSafeInteger(Number(userId)) || Number(userId) < 1) throw new Error('必须指定有效账号 ID');
  userId = Number(userId);
  const account = db.prepare('SELECT id FROM users WHERE id=?').get(userId);
  if (!account) throw new Error('指定账号不存在');
  const knownCourseIds = db.prepare(`SELECT c.course_id FROM course_contents c LEFT JOIN course_content_access a
    ON a.course_id=c.course_id AND a.subject_user_id=? WHERE c.visibility='public' OR a.subject_user_id IS NOT NULL`)
    .all(userId).map(row => row.course_id);
  const report = audit(backup, manifest, { knownCourseIds });
  if (String(report.accountId) !== String(userId)) throw new Error('浏览器备份账号与指定账号不一致');
  const entries = manifest.entries.filter(entry => Number(entry.userId) === userId);
  if (report.blockers.length) throw Object.assign(new Error('浏览器备份核对未通过，不能激活'), { blockers: report.blockers });
  if (report.confirmedCache?.key !== 'server-cache-v3') throw new Error('激活前必须提供仍绑定旧学习格式的确认缓存备份');

  function checkDatabase() {
    const seqRow = db.prepare('SELECT seq FROM user_change_seq WHERE user_id=?').get(userId);
    if (!seqRow || !Number.isSafeInteger(seqRow.seq)) throw new Error('账号服务端学习水位缺失，不能激活');
    if (report.confirmedCache.appliedSeq !== seqRow.seq) throw new Error('浏览器确认水位与服务端当前水位不一致；请重新同步并导出备份');
    const mappings = db.prepare(`SELECT course_id AS courseId,source_hash AS sourceHash FROM course_content_legacy_mappings
      WHERE source_user_id=? AND source_kind=? AND source_id=?`);
    const accessible = db.prepare(`SELECT 1 FROM course_contents c LEFT JOIN course_content_access a
      ON a.course_id=c.course_id AND a.subject_user_id=? WHERE c.course_id=? AND (c.visibility='public' OR a.subject_user_id IS NOT NULL)`);
    for (const entry of entries) {
      const mapping = mappings.get(userId, entry.kind, entry.legacyId);
      if (!mapping || mapping.courseId !== entry.courseId || mapping.sourceHash !== entry.sourceHash || !accessible.get(userId, entry.courseId)) {
        throw new Error('课程迁移映射或账号访问权未完整应用：' + entry.legacyId);
      }
    }
    const mapCount = db.prepare('SELECT count(*) AS count FROM course_content_legacy_mappings WHERE source_user_id=?').get(userId).count;
    if (mapCount !== entries.length) throw new Error('账号存在未纳入当前迁移清单的旧课程映射');
    return { seq: seqRow.seq, existing: db.prepare('SELECT format,migration_id AS migrationId FROM user_learning_data_formats WHERE user_id=?').get(userId) };
  }

  const verified = checkDatabase();
  const existing = verified.existing;
  if (existing) {
    if (existing.format === 'references-v1' && existing.migrationId === manifest.sourceDigest) {
      return { accountId: userId, format: existing.format, migrationId: existing.migrationId,
        confirmedSeq: verified.seq, migratedCourseCount: entries.length, applied: false, replay: true };
    }
    throw new Error('账号已使用其他学习数据迁移版本；拒绝覆盖');
  }

  if (apply) {
    db.transaction(() => {
      const fresh = checkDatabase();
      if (fresh.seq !== verified.seq) throw new Error('激活期间服务端学习水位发生变化；未切换格式');
      if (fresh.existing) throw new Error('账号格式已被其他进程切换；未覆盖现有记录');
      db.prepare(`INSERT INTO user_learning_data_formats(user_id,format,migration_id)
        VALUES(?,'references-v1',?)`).run(userId, manifest.sourceDigest);
    }).immediate();
  }
  return { accountId: userId, format: 'references-v1', migrationId: manifest.sourceDigest,
    confirmedSeq: verified.seq, migratedCourseCount: entries.length, applied: !!apply, replay: false };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (key === '--help') return { help: true };
    if (key === '--apply') { if (options.apply) throw new Error('参数重复：--apply'); options.apply = true; continue; }
    if (!['--db', '--course-manifest', '--browser-backup', '--uid'].includes(key) || !argv[index + 1] || argv[index + 1].startsWith('--')) {
      throw new Error('用法: --db <sqlite-file> --course-manifest <json> --browser-backup <json> --uid <id> [--apply]');
    }
    if (options[key]) throw new Error('参数重复：' + key);
    options[key] = argv[++index];
  }
  for (const key of ['--db', '--course-manifest', '--browser-backup', '--uid']) if (!options[key]) throw new Error('缺少参数：' + key);
  return options;
}

function run(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write('默认只读预览；核对通过后，显式添加 --apply 才会为一个账号激活 references-v1。\n' +
      'node scripts/activate-learning-data-format.cjs --db <sqlite-file> --course-manifest <json> --browser-backup <json> --uid <id> [--apply]\n');
    return 0;
  }
  const dbPath = path.resolve(options['--db']);
  if (!fs.existsSync(dbPath) || !fs.statSync(dbPath).isFile()) throw new Error('数据库文件不存在：' + dbPath);
  const manifest = JSON.parse(fs.readFileSync(path.resolve(options['--course-manifest']), 'utf8'));
  const backup = JSON.parse(fs.readFileSync(path.resolve(options['--browser-backup']), 'utf8'));
  const db = new Database(dbPath, { readonly: !options.apply, fileMustExist: true });
  try {
    const result = activate(db, manifest, backup, { userId: options['--uid'], apply: !!options.apply });
    process.stdout.write(JSON.stringify({ mode: options.apply ? 'apply' : 'preview', ...result }, null, 2) + '\n');
  } finally { db.close(); }
  return 0;
}

if (require.main === module) {
  try { process.exitCode = run(); }
  catch (error) {
    process.stderr.write(JSON.stringify({ error: error.message, blockers: error.blockers || [] }) + '\n');
    process.exitCode = 1;
  }
}

module.exports = { activate, parseArgs, run };
