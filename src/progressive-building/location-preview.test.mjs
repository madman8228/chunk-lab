import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {locationLesson} from './location-v3.mjs';
import {validatePreviewLesson,matchesTransfer} from './lessons-v3.mjs';
import {visualScenes} from './visual-scenes.mjs';
validatePreviewLesson(locationLesson);
assert.equal(locationLesson.sequence.length,23);
for (const id of ['in', 'on', 'under', 'next', 'to', 'behind', 'front', 'of']) assert.ok(locationLesson.sequence.some(s => s.wordIds.includes(id)));
assert.deepEqual(locationLesson.sequence[17].annotations.filter(a=>a.label==='复合介词').map(a=>[a.start,a.end]),[[3,5]]);
assert.deepEqual(locationLesson.sequence[21].annotations.filter(a=>a.label==='介词宾语').map(a=>[a.start,a.end]),[[6,8]]);
assert.deepEqual(locationLesson.sequence[21].annotations.filter(a=>a.label==='地点表语').map(a=>[a.start,a.end]),[[3,8]]);
assert.deepEqual(locationLesson.sequence[2].wordIds,['on','thePlace','desk']);
assert.deepEqual(locationLesson.sequence[4].annotations.filter(a=>a.label==='介词宾语').map(a=>[a.start,a.end]),[[4,6]]);
assert.deepEqual(locationLesson.sequence[4].annotations.filter(a=>a.label==='地点表语').map(a=>[a.start,a.end]),[[3,6]]);
for(const step of locationLesson.sequence.filter(s=>!s.type)){
 const bank=[...step.bankWordIds].reverse(),selected=[];
 for(const id of step.wordIds){assert.equal(bank.find(x=>!selected.includes(x)&&locationLesson.words[x].en[0].toLowerCase()===locationLesson.words[id].en[0].toLowerCase()),id,'repeated the is selectable in order');selected.push(id);}
}
for(const sceneId of ['book-on-desk','book-under-desk','bag-on-desk','bag-under-desk','book-in-box','book-next-to-box','book-behind-box','book-in-front-of-box']){const scene=visualScenes.scenes[sceneId],asset=visualScenes.assets[scene.assetIds[0]],file=new URL('../../'+asset.src,import.meta.url);assert.ok(statSync(file).size<20000);assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),asset.sha256);}
const transfer=locationLesson.sequence.at(-1);
assert.ok(matchesTransfer(transfer,'The bag is behind the desk.'));assert.ok(matchesTransfer(transfer,"The bag’s behind the desk."));
for(const bad of ['The bag behind the desk','The bag is behind desk','The bag is on the desk','The book is behind the box'])assert.ok(!matchesTransfer(transfer,bad));
console.log('PB06 phrase scopes, repeated occurrences, resources and transfer passed');
