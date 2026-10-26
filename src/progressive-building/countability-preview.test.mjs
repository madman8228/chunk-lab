import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {countability} from './countability-v3.mjs';
import {massQuantity} from './countability-lexicon.mjs';
import {validatePreviewLesson,matchesTransfer} from './lessons-v3.mjs';
import {visualScenes} from './visual-scenes.mjs';
validatePreviewLesson(countability);
assert.equal(countability.sequence.length,16);
assert.deepEqual(countability.sentenceStepIndexes,[3,10,11,13,14], 'merged measure phrases belong in the first display area');
assert.deepEqual(countability.sequence.filter(s=>s.type==='classify').map(s=>s.answer),['expression','yes','unit']);
assert.deepEqual(massQuantity('water'),['some','water']);
assert.deepEqual(massQuantity('milk',{unitId:'glass',number:2}),['two','glasses','of','milk']);
// Held-out material and unit: no renderer changes or new lesson-specific logic.
assert.deepEqual(massQuantity('rice'),['some','rice']);
assert.deepEqual(massQuantity('water',{unitId:'bottle',number:2}),['two','bottles','of','water']);
assert.throws(()=>massQuantity('unknown'),/reviewed mass/);
assert.throws(()=>massQuantity('book'),/reviewed mass/);
assert.throws(()=>massQuantity('water',{number:2}),/requires a unit/);
assert.throws(()=>massQuantity('water',{unitId:'milk',number:2}),/countable unit/);
for(const id of ['emptyGlass','twoWater','milk','twoMilk']){const asset=visualScenes.assets[id],file=new URL('../../'+asset.src,import.meta.url);assert.ok(statSync(file).size<20000);assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),asset.sha256);}
for(const wrong of ['You need two glass of milk','You need two glasses of milks','You need two glasses milk'])assert.ok(!matchesTransfer(countability.sequence.at(-1),wrong));
assert.ok(matchesTransfer(countability.sequence.at(-1),'You need two glasses of milk.'));
console.log('Sense-based countability, measured units, held-out vocabulary and transfer checks passed');
