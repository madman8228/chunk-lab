'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');

const main = fs.readFileSync('main.html', 'utf8');
const repair = fs.readFileSync('browser-confirmation-repair.html', 'utf8');
const start = main.indexOf('id="settingsBackupSection"');
const end = main.indexOf('id="settingsImageCacheSection"', start);
assert.ok(start >= 0 && end > start, 'backup and restore section exists');
const backupSettings = main.slice(start, end);
assert.match(backupSettings, /id="btnReviewLearningCache" href="browser-confirmation-repair\.html"/,
  'the current account can open the explicit cache review flow from backup settings');
assert.match(backupSettings, /核查学习缓存/);
assert.match(backupSettings, /旧分区会保留，不会自动合并或删除/);
assert.match(repair, /先预览，再保存并回读验证完整本地分区备份/);
assert.match(repair, /旧分区与完整备份会保留/);
assert.match(repair, /有待提交学习操作时会停止/);
console.log('Personal-center cache review entry is connected to the explicit, backup-first, non-destructive repair workflow.');
