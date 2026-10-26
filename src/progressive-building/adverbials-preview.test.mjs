import assert from 'node:assert/strict';
import {adverbials as lesson} from './adverbials-v3.mjs';
import {validatePreviewLesson,matchesTransfer} from './lessons-v3.mjs';
validatePreviewLesson(lesson);
assert.equal(lesson.sequence.length,21);
for(const step of lesson.sequence.filter(s=>!s.type)){
 const bank=[...step.bankWordIds].reverse(),selected=[];
 for(const id of step.wordIds){assert.equal(bank.find(x=>!selected.includes(x)&&lesson.words[x].en[0].toLowerCase()===lesson.words[id].en[0].toLowerCase()),id,'shortcut collision');selected.push(id);}
}
assert.deepEqual(lesson.sequence[11].annotations.slice(3).map(a=>[a.start,a.end,a.label]),[[3,5,'伴随状语'],[5,7,'地点状语'],[7,9,'时间状语']]);
const target=lesson.sequence.at(-1);
for(const answer of target.answers)assert.ok(matchesTransfer(target,answer));
for(const wrong of ['I study English at home every week','I study English with you at home every day','I study English with you home every week','I studies English with you at home every week'])assert.ok(!matchesTransfer(target,wrong));
assert.ok(!lesson.sequence.slice(0,-1).some(s=>s.wordIds.join('|')===target.wordIds.join('|')));
console.log('PB08 contextual ranges, keyboard collisions and transfer checks passed');
