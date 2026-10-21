'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const server=require('../js/vocabulary-application-material'),sandbox={window:{}};vm.runInNewContext(fs.readFileSync('js/vocabulary-application-material.js','utf8'),sandbox);
const sense={senseId:'sense:borrow',revision:'a'.repeat(64),word:'borrow'},material={materialId:'material:request',revision:'b'.repeat(64),kind:'dialogue',authorship:'original',title:'借用物品',lines:[{speaker:'A',en:'Can I borrow your pen?',zh:'我能借你的笔吗？',senseRefs:[{senseId:sense.senseId,revision:sense.revision}]}]};
for(const model of [server,sandbox.window.VocabularyApplicationMaterial]){
 const original=JSON.stringify(material);model.validate(material,()=>sense);assert.equal(JSON.stringify(material),original);
 const reject=(change,pattern)=>{const next=structuredClone(material);change(next);assert.throws(()=>model.validate(next,()=>sense),pattern);};
 reject(next=>delete next.lines[0].zh,/双语/);reject(next=>delete next.lines[0].speaker,/说话人/);reject(next=>next.kind='reading',/说话人/);
 reject(next=>next.lines[0].senseRefs[0].revision='c'.repeat(64),/版本/);reject(next=>next.lines[0].senseRefs.push({...next.lines[0].senseRefs[0]}),/重复/);
 reject(next=>next.lines[0].en='Can I lend your pen?',/未出现/);reject(next=>next.lines[0].en='borrowing',/未出现/);reject(next=>next.lines[0].extra=true,/未知/);
 reject(next=>next.authorship='textbook',/来源/);reject(next=>next.lines=[],/无效/);
 const reading=structuredClone(material);reading.kind='reading';delete reading.lines[0].speaker;model.validate(reading,()=>sense);
 assert.throws(()=>model.validate(material,()=>null),/版本/);
}
console.log('Application material contract: same browser/server validation, bilingual lines, dialogue/reading distinction, versioned senses, target presence, duplicate rejection and immutable input passed.');
