'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const choice=require('../js/vocabulary-word-choice'),draftModel=require('../js/wordbook-draft'),engine=require('../landing/sentence-cloze-engine'),contract=require('../js/vocabulary-course-contract'),materials=require('./lib/vocabulary-materials.cjs');
const input='drafts/scene-wordbooks/borrow-things-v1/audio-a-v3/integrated-v4/',originals=['wordbook.json','library.json','approval.json'].map(name=>({name,bytes:fs.readFileSync(input+name)}));
const body={field:'blank1',options:[{id:'a',text:'lend',feedback:'lend表示借出；这里是向对方借入。'},{id:'b',text:'borrow',feedback:'borrow表示借入；Can I borrow…? 用来请求借用。'},{id:'c',text:'return',feedback:'return表示归还；此处正在请求借用，不是归还。'}],correctOptionId:'b'};
const activity={schemaVersion:1,...body,revision:crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex')};
(async()=>{
 const draft=JSON.parse(originals[0].bytes),source=structuredClone(draft.items[0]);source.wordChoice=structuredClone(body);draft.items[0]=source;
 choice.validate(source,activity,engine);
 assert.equal(choice.evaluate(source,activity,{optionId:'b'},engine).correct,true);
 for(const value of [{optionId:'a'},{optionId:'missing'},{word:'borrow'},{optionId:'borrow'},{optionId:'b',word:'borrow'},{optionId:['b']},null,[],{optionId:true}])assert.equal(choice.evaluate(source,activity,value,engine).correct,false);
 assert.match(choice.evaluate(source,activity,{optionId:'a'},engine).feedback,/借出/);
 const verdict=choice.evaluate(source,activity,{optionId:'b'},engine);assert.equal(verdict.assisted,true);assert.equal(verdict.ability,'word-recognition-in-authored-context');assert.equal(verdict.practiceRevision,activity.revision);
 const reject=(change,pattern)=>{const bad=structuredClone(activity);change(bad);assert.throws(()=>choice.validate(source,bad,engine),pattern);};
 reject(b=>b.options[0].id='b',/重复|不一致/);reject(b=>b.options[0].text='BORROW!',/不一致|重复/);reject(b=>b.options[0].feedback='',/解释/);reject(b=>b.correctOptionId='missing',/不一致|缺少/);reject(b=>b.field='foreign',/唯一目标/);reject(b=>b.options[0].generated=true,/解释/);reject(b=>b.audio={},/未知字段/);reject(b=>b.options.splice(1,1),/缺少/);
 reject(b=>b.options[2].text='LEND.',/重复/);reject(b=>b.options[0].id='__proto__',/编号/);
 assert.throws(()=>choice.validate({...source,word:'charger'},activity,engine),/词头/);
 assert.throws(()=>choice.validate({...source,exercise:draftModel.exercise('[Can] I [borrow] your charger?')},activity,engine),/唯一目标/);
 const compiled=await draftModel.compile(draft),item=compiled.items[0];assert.deepEqual(item.learning.wordChoice,activity);contract.validateLearning(item,engine);
 const available=contract.capabilities(item,engine).find(mode=>mode.practiceType==='word-choice');assert.equal(available.available,true);assert.equal(contract.capabilities({...item,learning:undefined},engine).find(mode=>mode.practiceType==='word-choice').reason,'缺少课程选词素材');
 const changed=structuredClone(draft);changed.items[0].wordChoice.options[0].feedback='明确改写的解释';const revised=await draftModel.compile(changed);assert.notEqual(revised.items[0].learning.wordChoice.revision,activity.revision);assert.notEqual(revised.items[0].contentRevision,item.contentRevision);assert.deepEqual(revised.items.slice(1),compiled.items.slice(1),'unrelated items retain identities and revisions');
 const library=JSON.parse(originals[1].bytes),task=library.activities.find(row=>row.itemId===source.itemId);task.wordChoice=structuredClone(body);Object.assign(task,materials.versioned(task));
 for(const course of library.courses){for(const unit of course.units)for(const ref of unit.activityRefs)if(ref.itemId===task.itemId)ref.revision=task.revision;Object.assign(course,materials.versioned(course));}
 const previews=await Promise.all(library.courses.map(course=>materials.previewCourse(library,course.courseId)));for(const preview of previews)assert.deepEqual(preview.wordbookPackage.items.find(row=>row.itemId===source.itemId).learning.wordChoice,activity,'two arrangements reuse the same authored choice task');
 const orphan=structuredClone(library);orphan.activities.push(materials.versioned({...task,itemId:'unused-invalid-choice',wordChoice:{...body,field:'missing'}}));assert.throws(()=>materials.validate(orphan),/唯一目标/,'unreferenced malformed activities also rejected');
 const context=vm.createContext({});for(const file of ['landing/sentence-cloze-engine.js','js/vocabulary-word-choice.js','js/vocabulary-course-contract.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);assert.equal(context.VocabularyWordChoice.evaluate(source,activity,{optionId:'b'},context.JQKAClozeEngine).correct,true,'browser contract uses the same strict judge');
 for(const original of originals)assert.deepEqual(fs.readFileSync(input+original.name),original.bytes,'original drafts and approvals unchanged');
 console.log('Word choice authoring: explicit field/options/feedback, strict option-ID judging, invalid and ambiguous configuration rejection, immutable revisions, two-course reuse and browser/Node parity passed; missing materials remain unavailable.');
})().catch(error=>{console.error(error);process.exitCode=1;});
