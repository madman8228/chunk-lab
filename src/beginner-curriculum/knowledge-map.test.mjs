import test from 'node:test';
import assert from 'node:assert/strict';
import map from './knowledge-map.json' with { type: 'json' };
import legacy from './legacy-map.json' with { type: 'json' };
import { validateKnowledgeMap, validateLegacyMap } from './validate.mjs';

test('knowledge map has explicit goals, demonstrations, checks, and acyclic stage dependencies', () => {
  assert.equal(validateKnowledgeMap(map).valid, true, validateKnowledgeMap(map).errors.join('\n'));
  assert.ok(map.items.length >= 25);
  assert.equal(new Set(map.items.map(item => item.knowledgeId)).size, map.items.length);
});

test('rejects dangling, cyclic, and backwards-stage prerequisites', () => {
  const broken = structuredClone(map);
  broken.items[0].prerequisiteIds = ['missing'];
  broken.items[1].prerequisiteIds = [broken.items[0].knowledgeId];
  assert.equal(validateKnowledgeMap(broken).valid, false);
  const cycle = structuredClone(map);
  cycle.items[0].prerequisiteIds = [cycle.items[1].knowledgeId];
  assert.equal(validateKnowledgeMap(cycle).valid, false);
});

test('legacy mappings are opt-in candidates and never guess unmapped courses', () => {
  assert.equal(validateLegacyMap(legacy).valid, true);
  assert.equal(legacy.courses.some(course => course.courseId.toLowerCase().includes('drink')), false);
});
