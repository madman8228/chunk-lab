import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {quantity} from './quantity-v3.mjs';
import {validatePreviewLesson,matchesTransfer} from './lessons-v3.mjs';
import {visualScenes} from './visual-scenes.mjs';
validatePreviewLesson(quantity);
assert.deepEqual(quantity.sentenceStepIndexes,[3,7,9]);
for(const step of quantity.sequence.filter(s=>s.type==='quantity')){
 assert.equal(step.changes.length,2);const current=[...step.sourceWordIds];for(const change of step.changes)current[change.index]=change.to;assert.deepEqual(current,step.wordIds);
 assert.equal(step.visual.show,'after-correct');
}
assert.deepEqual(quantity.sequence[8].wordIds,['a','book']);
for(const id of ['bags','book','books']){const a=visualScenes.assets[id],p=new URL('../../'+a.src,import.meta.url);assert.ok(statSync(p).size<20000);assert.equal(createHash('sha256').update(readFileSync(p)).digest('hex'),a.sha256);}
assert.ok(matchesTransfer(quantity.sequence.at(-1),'You need two bags.'));
assert.ok(!matchesTransfer(quantity.sequence.at(-1),'You need two bag.'));
console.log('PB05 count agreement, reverse change, visual hashes/sizes and independent answer passed');
