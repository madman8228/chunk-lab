'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Database = require('../server/node_modules/better-sqlite3');
const { ensureCourseLibrarySchema } = require('../server/services/course-library-schema');
const { buildManifest, applyManifest } = require('../server/services/course-library-migration');

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--help') return { help: true };
    if (!['--db', '--write-manifest', '--apply-manifest'].includes(key) || !argv[i + 1] || argv[i + 1].startsWith('--')) {
      throw new Error('用法: --db <sqlite-file> [--write-manifest <file>] | [--apply-manifest <file>]');
    }
    if (out[key]) throw new Error('参数重复：' + key);
    out[key] = argv[++i];
  }
  if (!out['--db'] || (out['--write-manifest'] && out['--apply-manifest'])) {
    throw new Error('必须提供 --db；预览可选 --write-manifest，应用需提供 --apply-manifest');
  }
  return out;
}

function run(argv = process.argv.slice(2)) {
  const options = args(argv);
  if (options.help) {
    process.stdout.write('迁移预览（只读）: node scripts/migrate-independent-course-library.cjs --db <sqlite-file> [--write-manifest <file>]\n' +
      '应用预览清单: node scripts/migrate-independent-course-library.cjs --db <sqlite-file> --apply-manifest <file>\n');
    return 0;
  }
  const dbPath = path.resolve(options['--db']);
  if (!fs.existsSync(dbPath) || !fs.statSync(dbPath).isFile()) throw new Error('数据库文件不存在：' + dbPath);
  if (!options['--apply-manifest']) {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      const manifest = buildManifest(db);
      if (options['--write-manifest']) fs.writeFileSync(path.resolve(options['--write-manifest']), JSON.stringify(manifest, null, 2), { flag: 'wx' });
      process.stdout.write(JSON.stringify({ mode: 'dry-run', ...manifest }, null, 2) + '\n');
    } finally { db.close(); }
    return 0;
  }

  const manifestPath = path.resolve(options['--apply-manifest']);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const check = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const actual = buildManifest(check, { createdAt: manifest.createdAt });
    if (actual.sourceDigest !== manifest.sourceDigest || JSON.stringify(actual.entries) !== JSON.stringify(manifest.entries)) {
      throw Object.assign(new Error('源数据与预览清单不一致，未进行迁移'), { code: 'MIGRATION_SOURCE_CHANGED' });
    }
  } finally { check.close(); }

  const db = new Database(dbPath, { fileMustExist: true });
  try {
    db.pragma('foreign_keys = ON');
    ensureCourseLibrarySchema(db);
    process.stdout.write(JSON.stringify({ mode: 'apply', ...applyManifest(db, manifest) }, null, 2) + '\n');
  } finally { db.close(); }
  return 0;
}

if (require.main === module) {
  try { process.exitCode = run(); }
  catch (error) {
    process.stderr.write(JSON.stringify({ error: error.message, code: error.code || 'MIGRATION_FAILED',
      ...(Array.isArray(error.blockers) ? { blockers: error.blockers } : {}) }) + '\n');
    process.exitCode = 1;
  }
}

module.exports = { args, run };
