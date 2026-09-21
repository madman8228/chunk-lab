import assert from 'node:assert/strict';
import { getAutoAdvanceDecision, getNextLabel } from '../src/main/practice-policy.mjs';

assert.equal(getNextLabel(0, 3), '下一题');
assert.equal(getNextLabel(2, 3), '查看结果');
assert.deepEqual(getAutoAdvanceDecision({ available: true, perfectThis: true }), { eligible: true, seconds: 3 });
assert.deepEqual(getAutoAdvanceDecision({ available: true, perfectThis: false }), { eligible: true, seconds: 5 });
assert.deepEqual(getAutoAdvanceDecision({ available: true, wrongAttempts: [0, 1] }), { eligible: false, seconds: 0 });
assert.deepEqual(getAutoAdvanceDecision({ available: true, hinted: true }), { eligible: false, seconds: 0 });
assert.deepEqual(getAutoAdvanceDecision({ available: true, status: ['ok', 'revealed'] }), { eligible: false, seconds: 0 });
assert.deepEqual(getAutoAdvanceDecision({ finished: true, available: true }), { eligible: false, seconds: 0 });
console.log('main-practice-policy.test.mjs passed');
