'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

/* Tests that read real course drafts/assets or the private acceptance
 * previews. Public CI excludes them; a private content job runs them with
 * TEST_PRIVATE_CONTENT=1. */
const PRIVATE_SERVER_TESTS = new Set([
  'server/admin-wordbook-imports.test.js',
  'server/personal-wordbook-materials.test.js',
  'server/vocabulary-attempt-http.test.js',
  'server/vocabulary-browse-http.test.js',
  'server/vocabulary-chunk-order-content.test.js',
  'server/vocabulary-material-backup.test.js',
  'server/vocabulary-material-library.test.js',
  'server/vocabulary-material-release.test.js',
  'server/vocabulary-practice-summary.test.js',
  'server/vocabulary-read-aloud-content.test.js',
  'server/vocabulary-read-aloud-http.test.js',
  'server/vocabulary-sentence-audio.test.js',
  'server/vocabulary-study.test.js',
  'server/vocabulary-teaching-scale.test.js',
  'server/vocabulary-word-choice-content.test.js',
  'server/wordbook-publishing.test.js',
]);
const PRIVATE_BROWSER_RE = /drafts\/|assets\/(?:vocab-|highschool-|scene-)|output\/textbook-extractions|serve-wordbook-acceptance|serve-borrow-preview|prepare-borrow-pilot|serve-zero-foundation-preview/;

function requiresPrivate(file) {
  if (PRIVATE_SERVER_TESTS.has(file)) return 'private-content';
  if (!/^e2e[\\/]|^scripts[\\/]/.test(file)) return undefined;
  let source = '';
  try { source = fs.readFileSync(path.join(ROOT, file), 'utf8'); } catch (_) { return undefined; }
  if (source.includes('synthetic-vocabulary-16x9')) return undefined;
  return PRIVATE_BROWSER_RE.test(source) ? 'private-content' : undefined;
}

/* Tests that launch a real browser must not run in the unit job: the unit CI
 * job does not install Chromium, and a browser test that waits on a page can
 * consume the whole job timeout. Classify by dependency, not only by filename. */
function usesBrowser(file) {
  try {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    return /(?:require\(['"](?:playwright|playwright-core|puppeteer)['"]\)|from ['"](?:playwright|playwright-core|puppeteer)['"]|chromium\.launch)/.test(source);
  } catch (_) {
    return false;
  }
}

function inferGroup(file, cwd) {
  if (cwd === 'server') return 'server';
  /* Needs server/node_modules (better-sqlite3); run it in the job that installs them. */
  if (/static-course-registry/i.test(file)) return 'server';
  if (/^e2e[\\/]/i.test(file)) return 'browser';
  if (usesBrowser(file)) return 'browser';
  if (/vocabulary-material-(?:library-browser|course-draft)|sentence-layout-preview/i.test(file)) return 'browser';
  if (/playwright|scene-wordbook-ui|wordbook-materials-ui|word-dictation-ui|word-choice-ui|chunk-order-ui|mobile|sw-cache|action-game-ui|initials-ui|wordbook-ai-authoring-ui|wordbook-ai-bundle|course-create-ui|workspace-entry-ui|settings-groups-ui|personal-wordbook-recovery-ui/i.test(file)) return 'browser';
  if (/check-|validate|deploy-safety|sw-policy|sw-hash/i.test(file)) return 'checks';
  return 'unit';
}

function walk(dir, out) {
  for (const name of require('fs').readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'output') continue;
    const file = path.join(dir, name);
    const stat = require('fs').statSync(file);
    if (stat.isDirectory()) walk(file, out);
    else if (/\.test\.(?:[mc]?js)$/i.test(file)) out.push(path.relative(ROOT, file).replace(/\\/g, '/'));
  }
  return out;
}

function parseTestFiles() {
  // Requires a separately checked-out course creator export; keep it out of the
  // self-contained CI browser group and run it through the integration command.
  const excluded = new Set([
    // Requires a separately checked-out course creator export.
    'e2e/course-package-v2-real-export.test.js',
  ]);
  return walk(ROOT, []).filter((file) => !excluded.has(file)).map((file) => {
    const cwd = file.startsWith('server/') ? 'server' : '.';
    const requires = requiresPrivate(file);
    return { id: file.replace(/[\\/]/g, ':').replace(/\.[mc]?js$/, ''), file: cwd === 'server' ? file.slice('server/'.length) : file, cwd, group: inferGroup(file, cwd), args: [], ...(requires ? { requires } : {}) };
  });
}

const base = parseTestFiles();
const checks = [
  'scripts/check-sw.js', 'scripts/sw-hash.test.js', 'scripts/check-contrast.js',
  'scripts/deploy-safety.test.js', 'scripts/check-deploy-files.js', 'sw-policy.test.js',
  'validate_builtins.js', 'validate_oral_book.js', 'validate_distractors.js',
  'scripts/check-cross-source-dup.mjs', 'scripts/validate-content.mjs', 'scripts/chunk-hint-alignment.test.mjs',
  'scripts/book-content-check.mjs', 'scripts/check-content-generated.mjs', 'scripts/lib-deps.test.js', 'scripts/content-runtime-contract.test.js',
].map((file) => ({ id: file.replace(/[\\/]/g, ':').replace(/\.m?js$/, ''), file, cwd: '.', group: 'checks', args: [] }));
for (const entry of checks) {
  const existing = base.find((item) => item.file === entry.file && item.cwd === entry.cwd);
  if (existing) existing.group = entry.group;
  else base.push(entry);
}
const extras = [
  ['sentence-cloze-engine', 'landing/sentence-cloze-engine.test.cjs', '.', 'unit'],
  ['admin-overview-diagnostics', 'services/admin-overview.test.js', 'server', 'server'],
  ['admin-account-types', 'services/admin-account-type.test.js', 'server', 'server'],
  ['client-save-health-route', 'routes/client-save-health.test.js', 'server', 'server'],
  ['server-operations', 'operations.test.js', 'server', 'server'],
  ['server-store-save-health', 'js/server-store-save-health.test.js', '.', 'unit'],
  ['admin-sync-diagnostics-e2e', 'e2e/admin-sync-diagnostics.test.js', '.', 'browser'],
  ['account-storage', 'account-storage.test.js', '.', 'unit'],
  ['batch-sync-e2e', 'e2e/batch-sync.test.js', '.', 'browser'],
  ['course-package-import-e2e', 'e2e/course-package-import.test.js', '.', 'browser'],
  ['course-package-v2-import-e2e', 'e2e/course-package-v2-import.test.js', '.', 'browser'],
  ['exit-performance-e2e', 'e2e/exit-performance.test.js', '.', 'browser'],
  ['main-persistence-e2e', 'e2e/main-persistence.test.js', '.', 'browser'],
  ['recovery-handover-gate-e2e', 'e2e/recovery-handover-gate.test.js', '.', 'browser'],
  ['server-store-queue-e2e', 'e2e/server-store-queue.test.js', '.', 'browser'],
  ['stats-mastered-e2e', 'e2e/stats-mastered.test.js', '.', 'browser'],
  ['tab-content-consistency-e2e', 'e2e/tab-content-consistency.test.js', '.', 'browser'],
  ['sw-upgrade-e2e', 'e2e/upgrade-check.js', '.', 'browser'],
  ['lib-deps', 'scripts/lib-deps.test.js', '.', 'checks'],
];
for (const [id, file, cwd, group] of extras) {
  if (!base.some((entry) => entry.file === file && entry.cwd === cwd)) {
    const requires = requiresPrivate(cwd === 'server' ? 'server/' + file : file);
    base.push({ id, file, cwd, group, args: [], ...(requires ? { requires } : {}) });
  }
}

const __qaOnly = process.env.QA_ONLY_FILES ? new Set(process.env.QA_ONLY_FILES.split(',')) : null;
module.exports = Object.freeze(base.filter((entry) => !__qaOnly || __qaOnly.has(entry.id)).map((entry) => Object.freeze(entry)));
