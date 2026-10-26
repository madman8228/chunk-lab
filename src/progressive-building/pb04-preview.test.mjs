import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {nounPhrase} from './noun-phrase-v3.mjs';
import {visualScenes} from './visual-scenes.mjs';
import {validatePreviewLesson,matchesTransfer} from './lessons-v3.mjs';
validatePreviewLesson(nounPhrase);
assert.equal(nounPhrase.sequence.length,13);
assert.ok(!nounPhrase.sequence.some(s=>['replace','insert-modifier','teach'].includes(s.type)));
assert.deepEqual(nounPhrase.sentenceStepIndexes,[2,5,8,11]);
assert.equal(nounPhrase.sequence[4].learningNote.term,'定语');
assert.ok(nounPhrase.sequence[5].annotations.some(a=>a.label==='宾语'&&a.start===2&&a.end===5));
for(const step of nounPhrase.sequence.filter(s=>!s.type)){
 const bank=[...step.bankWordIds].reverse(),selected=[];
 for(const id of step.wordIds){assert.equal(bank.find(x=>!selected.includes(x)&&nounPhrase.words[x].en[0].toLowerCase()===nounPhrase.words[id].en[0].toLowerCase()),id,'keyboard supports repeated B in order');selected.push(id);}
}
for(const id of ['redBag','blueBag']){const a=visualScenes.assets[id],p=new URL('../../'+a.src,import.meta.url);assert.ok(statSync(p).size<20000);assert.equal(createHash('sha256').update(readFileSync(p)).digest('hex'),a.sha256);}
const transfer=nounPhrase.sequence.at(-1);assert.ok(matchesTransfer(transfer,'You need a blue bag.'));assert.ok(!matchesTransfer(transfer,'You need blue bag.'));
console.log('PB04 data, phrase scope, visual size/hash, keyboard and transfer checks passed');
