import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeResource, safeCover, canonicalResourceId, collectPersonalResources } from './resource-model.mjs';
import { filterResources, facetOptions, selectionFromUrl, groupTextbooks, resourceKindCounts } from './facets.mjs';
import { buildHomeModel } from './home-model.mjs';
import { resolveEntry } from '../main/entry.mjs';

test('discovery defaults to all and category totals retain other filters', () => {
  assert.equal(selectionFromUrl('?view=discover').kind, '');
  assert.equal(selectionFromUrl('?kind=course').kind, 'course');
  const rows = [
    { resourceId: 'a', kind: 'course', title: '英语', facets: { levels: ['A1'] } },
    { resourceId: 'b', kind: 'wordbook', title: '英语词书', facets: { levels: ['A1'] } },
    { resourceId: 'c', kind: 'textbook', title: '英语教材', facets: { levels: ['B1'] } }
  ];
  assert.deepEqual(resourceKindCounts([...rows, rows[0]], { kind: 'course', levels: ['A1'], query: '英语' }), { all: 2, course: 1, wordbook: 1, textbook: 0 });
  assert.equal(filterResources(rows, selectionFromUrl('?view=discover')).length, 3);
});

test('workspace entry survives refresh without taking over explicit practice handoffs', () => {
  assert.equal(resolveEntry({ search: '?view=discover', navigationType: 'reload' }).view, 'discover');
  assert.equal(resolveEntry({ search: '?view=home&course=c&lesson=l' }).kind, 'catalog');
  assert.equal(resolveEntry({ search: '?view=home&direct=1' }).kind, 'direct');
  assert.equal(resolveEntry({ search: '?view=discover&assessmentKey=a' }).kind, 'assessment');
  assert.equal(resolveEntry({ search: '?view=discover&autostart=1&reviewHandoff=x' }).kind, 'review-handoff');
});

test('content capabilities are derived from real references; unsafe covers are rejected', () => {
  const resource = normalizeResource({ resourceId: 'r', title: '三年级', activities: ['listening'], sourceRefs: [{ type: 'sentence-deck', id: 'd' }] });
  assert.deepEqual(resource.activities, ['chunks']); assert.deepEqual(resource.facets.levels, []);
  assert.equal(safeCover('javascript:alert(1)'), ''); assert.equal(safeCover('assets/../private'), '');
  assert.equal(normalizeResource({ title: 'empty' }).available, false);
});
test('facet dimensions use AND while values use OR; no implicit personal filters', () => {
  const resources = ['primary', 'secondary'].map((stage, index) => normalizeResource({ resourceId: String(index), title: stage,
    sourceRefs: [{ type: 'sentence-deck', id: String(index) }], facets: { schoolStages: [stage], topics: ['travel'] } }));
  assert.equal(filterResources(resources, { schoolStages: ['primary', 'secondary'], topics: ['travel'] }).length, 2);
  assert.equal(filterResources(resources, { schoolStages: ['primary'], topics: ['business'] }).length, 0);
  assert.equal(facetOptions(resources, {}).schoolStages.length, 2);
  assert.equal(selectionFromUrl('?kind=textbook&grades=3&grades=4').grades.length, 2);
});
test('unknown saved references are retained and aliases do not rewrite records', () => {
  assert.equal(canonicalResourceId('course:old', { old: 'new' }), 'course:new');
  const result = collectPersonalResources([], { a: { itemType: 'resource', selected: true, targetId: 'course:missing' } });
  assert.equal(result.length, 1); assert.equal(result[0].available, false);
});
test('textbook editions are separate; empty home does not fake due tasks or personalized tools', () => {
  const books = ['2024', '2025'].map(edition => normalizeResource({ resourceId: edition, kind: 'textbook', facets: { seriesId: 's', edition } }));
  assert.equal(groupTextbooks(books).length, 2);
  const home = buildHomeModel(); assert.equal(home.due, 0); assert.equal(home.resume, null);
  assert.equal(home.personalized, false); assert.deepEqual(home.tools.map(tool => tool.id), ['vocabulary', 'chunks']);
});
