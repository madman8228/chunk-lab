import assert from 'node:assert/strict';
import { CoreSyncKv } from '../src/core/sync-kv-merge.mjs';

const clone = (value) => JSON.parse(JSON.stringify(value));
const deps = {
  cloneJSON: clone,
  mergeStats: (left, right) => ({ totalAnswered: (left.totalAnswered || 0) + (right.totalAnswered || 0) }),
  mergeBest: (left, right) => ({ ...(left || {}), ...(right || {}) }),
  eqJson: (left, right) => JSON.stringify(left) === JSON.stringify(right),
};

const pending = CoreSyncKv.mergeSyncKv(
  { stats: { totalAnswered: 2 }, best: { streak: 1 } },
  { stats: { totalAnswered: 3 }, best: { streak: 2 } },
  { kv: { stats: 1, best: 4 } },
  { kv: { stats: 2, best: 4 } },
  ['stats', 'best'],
  [{ entity: 'events', id: 'e1' }],
  false,
  deps,
);
assert.deepEqual(pending.mem.stats, { totalAnswered: 5 });
assert.deepEqual(pending.mem.best, { streak: 2 });
assert.equal(pending.localRevs.kv.stats, 3);
assert.equal(pending.localRevs.kv.best, 5);
assert.equal(pending.dirty, true);

const emptyRemote = CoreSyncKv.mergeSyncKv(
  { stats: { totalAnswered: 2 } },
  { stats: {} },
  { kv: {} },
  { kv: {} },
  ['stats'],
  [],
  false,
  deps,
);
assert.deepEqual(emptyRemote.mem.stats, { totalAnswered: 2 });
assert.equal(emptyRemote.dirty, true);

/* —— best 的 LWW 整块替换缺陷回归（2026-09-22）——
   旧实现要求 remoteRev === localRev 才走并集；remoteRev > localRev 时整块替换
   （mem[key] = remote[key]），会把「本机已产生、尚未上行」的 best 条目**静默丢弃**。
   现在两侧都存在时**一律并集**。以下三条把这个失效形态钉住。 */

// A. rRev > lRev 且双方各有独有 key ⇒ 并集，本机未上行的条目不得丢
const bestNewerRemote = CoreSyncKv.mergeSyncKv(
  { best: { 'builtin-daily': { acc: 70, lastPlayed: 100 } } },
  { best: { 'oral-居家生活': { acc: 90, lastPlayed: 200 } } },
  { kv: { best: 1 } },
  { kv: { best: 2 } },
  ['best'],
  [],
  false,
  deps,
);
assert.deepEqual(Object.keys(bestNewerRemote.mem.best).sort(), ['builtin-daily', 'oral-居家生活']);
assert.equal(bestNewerRemote.mem.best['builtin-daily'].acc, 70,
  'remoteRev > localRev 时，本机未上行的 best 条目不得被整块替换丢掉');
assert.equal(bestNewerRemote.localRevs.kv.best, 3);
assert.equal(bestNewerRemote.dirty, true, '并集结果变化 ⇒ 必须标记上行（本机独有条目要推到云端）');

// B. rRev > lRev 且远端是子集 ⇒ 本机条目保留；并集未变化 ⇒ 只采纳 rev、不无谓上行
const bestRemoteSubset = CoreSyncKv.mergeSyncKv(
  { best: { 'builtin-daily': { acc: 70 } } },
  { best: {} },
  { kv: { best: 1 } },
  { kv: { best: 2 } },
  ['best'],
  [],
  false,
  deps,
);
assert.equal(bestRemoteSubset.mem.best['builtin-daily'].acc, 70);
assert.equal(bestRemoteSubset.localRevs.kv.best, 2);
assert.equal(bestRemoteSubset.dirty, false);

// C. 远端根本没有 best ⇒ 不进入该分支，本机原样保留
const noRemoteBest = CoreSyncKv.mergeSyncKv(
  { best: { 'builtin-daily': { acc: 70 } } },
  { stats: {} },
  { kv: { best: 1 } },
  { kv: {} },
  ['best'],
  [],
  false,
  deps,
);
assert.equal(noRemoteBest.mem.best['builtin-daily'].acc, 70);
assert.equal(noRemoteBest.localRevs.kv.best, 1);
assert.equal(noRemoteBest.dirty, false);

console.log('core-sync-kv.test.mjs passed');
