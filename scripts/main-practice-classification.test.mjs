import assert from 'node:assert/strict';
import {
  classifyStat,
  hasMasteredKey,
  isDueStat,
  isFluencyStat,
  rankOfClassify,
} from '../src/main/practice-classification.mjs';

assert.equal(classifyStat(null), 'unseen');
assert.equal(classifyStat({ times: 0, okTimes: 0 }), 'unseen');
assert.equal(classifyStat({ times: 3, okTimes: 3 }), 'master');
assert.equal(classifyStat({ times: 2, okTimes: 0 }), 'weak');
assert.equal(classifyStat({ times: 2, okTimes: 2 }), 'learn');
assert.deepEqual(['weak', 'unseen', 'learn', 'master'].map(rankOfClassify), [0, 1, 2, 3]);
assert.equal(isFluencyStat({ okTimes: 3, streak: 3 }), true);
assert.equal(isFluencyStat({ okTimes: 4, streak: 2 }), false);
assert.equal(hasMasteredKey({ a: true }, 'a'), true);
assert.equal(hasMasteredKey({ a: true }, 'b'), false);
assert.equal(isDueStat({ dueAt: 1 }, () => true), true);
assert.equal(isDueStat({ dueAt: 1 }, () => false), false);
console.log('main-practice-classification.test.mjs passed');
