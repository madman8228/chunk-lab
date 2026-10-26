import assert from 'node:assert/strict';
import {articleSound} from './article-sound-v3.mjs';
import {validatePreviewLesson,matchesTransfer} from './lessons-v3.mjs';
validatePreviewLesson(articleSound);
assert.equal(articleSound.sequence.length,13);
assert.deepEqual(articleSound.sequence.filter(s=>s.type==='classify').map(s=>s.answer),['a','an','nextSound']);
assert.ok(articleSound.sequence[6].learningNote.explanation.includes('h 不发音'));
assert.ok(articleSound.sequence[3].learningNote.explanation.includes('元音音'));
assert.ok(articleSound.sequence[1].learningNote.explanation.includes('辅音音'));
for(const s of articleSound.sequence.filter(s=>!s.type)){
 const bank=[...s.bankWordIds].reverse(),selected=[];
 for(const id of s.wordIds){assert.equal(bank.find(x=>!selected.includes(x)&&articleSound.words[x].en[0].toLowerCase()===articleSound.words[id].en[0].toLowerCase()),id);selected.push(id);}
}
assert.ok(matchesTransfer(articleSound.sequence.at(-1),'You need a red apple.'));
assert.ok(!matchesTransfer(articleSound.sequence.at(-1),'You need an red apple.'));
assert.ok(!articleSound.sequence.slice(0,-1).some(s=>s.wordIds.join('|')===articleSound.sequence.at(-1).wordIds.join('|')));
console.log('a/an sound reasoning, contextual next word, keyboard, independent combination passed');
