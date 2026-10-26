import assert from 'node:assert/strict';
import {postmodifier as lesson} from './postmodifier-v3.mjs';
import {validatePreviewLesson, matchesTransfer} from './lessons-v3.mjs';
validatePreviewLesson(lesson);
assert.equal(lesson.sequence.length,15);
assert.deepEqual(lesson.sequence[5].annotations.filter(a=>a.label==='完整主语').map(a=>[a.start,a.end]),[[0,5]]);
assert.deepEqual(lesson.sequence[5].annotations.filter(a=>a.label==='后置定语').map(a=>[a.start,a.end]),[[2,5]]);
assert.deepEqual(lesson.sequence[13].annotations.filter(a=>a.label==='地点表语').map(a=>[a.start,a.end]),[[3,6]]);
for(const step of lesson.sequence.filter(s=>!s.type)){
 const bank=[...step.bankWordIds].reverse(), selected=[];
 for(const id of step.wordIds){assert.equal(bank.find(x=>!selected.includes(x)&&lesson.words[x].en[0].toLowerCase()===lesson.words[id].en[0].toLowerCase()),id);selected.push(id);}
}
const final=lesson.sequence.at(-1);
assert.ok(matchesTransfer(final,'The bag under the desk is mine.'));
for(const wrong of ['The bag is under the desk','The bag under the desk mine','The bag on the desk is mine','The book under the desk is mine','The bag under desk is mine'])assert.ok(!matchesTransfer(final,wrong));
assert.ok(!lesson.sequence.slice(0,-1).some(s=>s.wordIds.join('|')===final.wordIds.join('|')),'final combination must be held out');
console.log('PB07 attachment, full subject, repeated tokens and held-out transfer passed');
