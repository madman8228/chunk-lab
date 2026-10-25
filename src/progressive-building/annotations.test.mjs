import test from 'node:test';
import assert from 'node:assert/strict';
import { lesson } from './content/pb01.mjs';
import { resolveSyntaxRanges, visibleSyntax, hasSyntaxCycle } from './annotations.mjs';

test('syntax annotations resolve against token identity and display after every token in a role is built', () => {
  const step = lesson.steps[2];
  assert.deepEqual(resolveSyntaxRanges(step).map(item => item.segments[0]), [
    { tokenIds: ['i'], start: 0, end: 1 }, { tokenIds: ['work'], start: 1, end: 2 },
  ]);
  assert.deepEqual(visibleSyntax(step, ['i']).map(item => item.role), ['主语']);
});

test('syntax tree cycle check detects parent cycles', () => {
  assert.equal(hasSyntaxCycle([{ id: 'a', parentId: 'b' }, { id: 'b', parentId: 'a' }]), true);
  assert.equal(hasSyntaxCycle([{ id: 'a' }, { id: 'b', parentId: 'a' }]), false);
});
