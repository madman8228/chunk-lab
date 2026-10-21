'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const nodes = [];
const timers = [];
let visibleUpdates = 0;
let listener;
const window = {
  CL: { getCloudConfig: () => ({ persistenceMode: 'server-authoritative', writeProtocol: 3 }) },
  document: {
    createElement: () => { const attributes={};return { textContent: '', setAttribute(key,value) { attributes[key]=value;if(key==='data-visible' && value==='true') visibleUpdates++; }, getAttribute(key){return attributes[key]||null;}, appendChild() {}, addEventListener() {} }; },
    head: { appendChild() {} }, body: { appendChild(node) { nodes.push(node); } },
    getElementById: () => null
  },
  setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {},
  addEventListener() {}, ServerStore: { onState(fn) { listener = fn; } }
};
vm.runInNewContext(fs.readFileSync(require.resolve('./save-status.js'), 'utf8'), { window, Date });
listener({ phase: 'pending', pending: 2, error: 'SERVER_SEQ_ROLLBACK' });
timers.splice(0).forEach(fn => fn());
assert.equal(nodes.at(-1).textContent, '进度已保存在此设备，暂未上传。');
assert.doesNotMatch(nodes.at(-1).textContent, /联网后会自动同步/);
const firstNotice = visibleUpdates;
listener({ phase: 'paused', pending: 2, error: 'SERVER_SEQ_ROLLBACK' });
assert.equal(visibleUpdates, firstNotice, 'the same unresolved conflict must not repeatedly interrupt the learner');
listener({ phase: 'saved', pending: 0, error: null });
assert.equal(nodes.at(-1).textContent, '已保存到云端。');
console.log('save-status: cache conflict is not reported as offline; confirmed save names cloud destination');
listener({ phase: 'blocked', pending: 0, blocked: 1, error: 'ENTITY_CHANGED' });
const beforeBlockedRepeat = visibleUpdates;
listener({ phase: 'blocked', pending: 0, blocked: 1, error: 'ENTITY_CHANGED' });
assert.equal(visibleUpdates, beforeBlockedRepeat, 'historical blocked operations must not repeatedly display a toast');
assert.doesNotMatch(nodes.at(-1).textContent, /有一项内容暂未完成保存/, 'never display the generic persistent blocked toast');
listener({ phase: 'deferred-version', pending: 0, blocked: 0, deferred: 2 });
assert.equal(nodes.at(-1).textContent, '有旧版学习记录尚未上传，已保留在此设备；新版练习可继续。');
assert.equal(nodes.at(-1).getAttribute('data-visible'), 'true');
