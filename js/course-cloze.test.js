const assert = require('node:assert/strict');
const { buildWordBank } = require('./course-cloze.js');

const node = {
  gaps: [
    { correctChoiceId: 'g0-right', choices: [{ id: 'g0-right', text: 'is' }, { id: 'g0-wrong', text: 'excuse' }] },
    { correctChoiceId: 'g1-right', choices: [{ id: 'g1-right', text: 'this' }, { id: 'g1-wrong', text: 'excuse' }] },
    { correctChoiceId: 'g2-right', choices: [{ id: 'g2-right', text: 'your' }, { id: 'g2-wrong', text: 'me' }] },
    { correctChoiceId: 'g3-right', choices: [{ id: 'g3-right', text: 'handbag' }, { id: 'g3-wrong', text: 'yes' }] }
  ]
};

const actual = buildWordBank(node);
assert.deepEqual(actual.map(choice => choice.text), ['is', 'this', 'your', 'handbag']);

const repeated = buildWordBank({
  gaps: [
    { correctChoiceId: 'hot-1', choices: [{ id: 'hot-1', text: 'hot' }, { id: 'cold', text: 'cold' }] },
    { correctChoiceId: 'hot-2', choices: [{ id: 'hot-2', text: 'hot' }, { id: 'warm', text: 'warm' }] }
  ]
});
assert.deepEqual(repeated.map(choice => choice.text), ['hot', 'hot']);

const explicit = buildWordBank({
  wordBank: ['g1-right', { id: 'custom', text: 'please' }],
  gaps: [{ correctChoiceId: 'g1-right', choices: [{ id: 'g1-right', text: 'can' }] }]
});
assert.deepEqual(explicit.map(choice => choice.text), ['can', 'please']);
console.log('course-cloze.test: 1 passed / 0 failed');
