import assert from 'node:assert/strict';
import {pluralForms} from './plural-forms-v3.mjs';
import {pluralEntry,pluralLexicon} from './plural-lexicon.mjs';
import {buildPluralPair} from './plural-practice.mjs';
import {validatePreviewLesson,matchesTransfer} from './lessons-v3.mjs';
validatePreviewLesson(pluralForms);
assert.equal(pluralForms.sequence.length,17);
assert.deepEqual(new Set(['book','box','baby','child','foot','sheep'].map(id=>pluralEntry(id).pattern)),new Set(['s','es','y','irregular','unchanged']));
assert.deepEqual(pluralForms.sequence.filter(s=>s.type==='classify').map(s=>s.answer),['regular','pair','plural']);
for(const id of ['dish','city','mouse','bag']){
 const pair=buildPluralPair(id,0),entry=pluralEntry(id);
 assert.equal(pair.words[id+'Plural'].en,entry.plural);
 assert.deepEqual(pair.steps[1].wordIds,['two',id+'Plural']);
 assert.ok(pair.steps[1].learningNote.explanation.includes(entry.plural));
 validatePreviewLesson({id:'holdout-'+id,words:{a:pluralForms.words.a,two:pluralForms.words.two,...pair.words},sentence:{wordIds:['two',id+'Plural']},sequence:pair.steps});
 assert.ok(!Object.keys(pluralForms.words).includes(id+'Plural'),'holdout remains outside lesson');
}
assert.throws(()=>buildPluralPair('unknown',0),/Missing reviewed/);
const original=pluralLexicon.box.plural;try{pluralLexicon.box.plural='boxs';assert.throws(()=>pluralEntry('box'),/disagrees/);}finally{pluralLexicon.box.plural=original;}
for(const bad of ['Four sheeps','Four sheepes'])assert.ok(!matchesTransfer(pluralForms.sequence.at(-1),bad));
assert.ok(matchesTransfer(pluralForms.sequence.at(-1),'Four sheep.'));
console.log('Five patterns, reviewed-fact guards, four held-out words and transfer passed');
