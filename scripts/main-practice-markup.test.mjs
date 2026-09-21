import assert from 'node:assert/strict';
import { buildChunkMarkup } from '../src/main/practice-markup.mjs';

const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const choose = buildChunkMarkup({
  chunk: 'Every Tom,', index: 2, hint: '固定表达', mode: 'choose',
  grammar: { role: '主句', color: '#3358e0' }, escapeHtml: esc,
});
assert.match(choose, /class="chunk-answer" data-i="2"/);
assert.match(choose, /--answer-chars:10/);
assert.match(choose, /chunk-role-wrap/);
assert.match(choose, /固定表达/);
assert.doesNotMatch(choose, /word-input/);

const typed = buildChunkMarkup({
  chunk: 'go home', index: 1, hint: '2 词', mode: 'type', escapeHtml: esc,
});
assert.match(typed, /data-ci="1" data-wi="0"/);
assert.match(typed, /data-ci="1" data-wi="1"/);
assert.match(typed, /style="width:38px"/);
assert.match(typed, /class="word-ul ul-seg" style="width:28px"/);
assert.doesNotMatch(typed, /chunk-answer/);

const escaped = buildChunkMarkup({ chunk: 'safe', hint: '<tag>', index: 0, mode: 'type', escapeHtml: esc });
assert.match(escaped, /&lt;tag&gt;/);
console.log('main-practice-markup.test.mjs passed');
