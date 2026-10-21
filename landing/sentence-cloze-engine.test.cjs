'use strict';
const assert=require('node:assert/strict');
const engine=require('./sentence-cloze-engine');
const {lessons}=require('./practice-content');
for(const lesson of lessons){
  assert.equal(engine.validate(lesson.exercise),lesson.exercise);
  assert.equal(engine.sentence(lesson.exercise),lesson.example,'Authored sentence matches its rendered parts');
  const answers=Object.fromEntries(engine.blanks(lesson.exercise).map(blank=>[blank.id,blank.answers[0]]));
  assert.ok(engine.evaluate(lesson.exercise,answers).correct);
  assert.ok(!engine.evaluate(lesson.exercise).correct);
  for(const blank of engine.blanks(lesson.exercise)){
    assert.ok(!engine.evaluate(lesson.exercise,{...answers,[blank.id]:'not-the-answer'}).correct);
    const statuses=engine.evaluate(lesson.exercise,{...answers,[blank.id]:blank.answers[0].toUpperCase()+'  '});
    assert.ok(statuses.correct,'Case and edge whitespace are normalized');
  }
}
const novel={version:1,parts:[{text:'They '},{id:'action',label:'出发',answers:['set off','departed']},{text:' '},{id:'time',label:'昨天',answers:['yesterday']},{text:'.'}]};
assert.ok(engine.evaluate(novel,{action:'SET   OFF',time:'yesterday!'}).correct,'Unseen multiword blanks need no renderer changes');
assert.ok(engine.evaluate(novel,{action:'departed',time:'yesterday'}).correct,'Accepted alternatives are data-driven');
assert.equal(engine.sentence(novel,{action:'set off',time:'yesterday'}),'They set off yesterday.');
assert.equal(engine.evaluate(novel,{action:'set off'}).firstInvalid,'time');
assert.equal(engine.evaluate(lessons[0].exercise,{verb:'decide',link:'to'}).fields[0].message,'这里说已经发生的决定，用过去式 decided。');
assert.equal(engine.evaluate(lessons[0].exercise,{verb:'decide',link:'to'}).fields[1].state,'correct');
assert.throws(()=>engine.validate({version:2,parts:novel.parts}));
assert.throws(()=>engine.validate({version:1,parts:[{text:'No blanks'}]}));
assert.throws(()=>engine.validate({version:1,parts:[novel.parts[1],novel.parts[1]]}));
assert.throws(()=>engine.validate({version:1,parts:[{id:'bad',label:'x',answers:['  ']}]}));
assert.ok(!engine.evaluate(novel,{action:'<script>alert(1)</script>',time:'yesterday'}).correct);
console.log('PASS: generic cloze schema, alternatives, normalization, validation and authored lessons');
