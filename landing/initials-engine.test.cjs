'use strict';
const assert=require('node:assert/strict'),engine=require('./initials-engine.js'),task=require('./charger-quest.js');
function type(model,keys){let state=engine.start(model);for(const key of keys)state=engine.input(model,state,key).state;return state;}
const borrow=engine.prepare(task.nodes.borrow.exercise),enough=engine.prepare(task.nodes.charged.exercise),lend=engine.prepare(task.nodes.lend.exercise);
assert.deepEqual(borrow.tokens.map(token=>token.word.length),[3,1,6,4,7]);
let state=type(borrow,'cibycc');assert.deepEqual(state.words,['Can','I','borrow','your','charger']);assert.ok(engine.evaluate(borrow,state).correct);assert.deepEqual(engine.evaluate(borrow,state).values,{word:'borrow'});
assert.ok(engine.evaluate(enough,type(enough,'ihebtc')).correct);assert.ok(engine.evaluate(lend,type(lend,'iclytcc')).correct);
state=type(borrow,'c');state=engine.input(borrow,state,'c').state;assert.equal(state.words[0],'charger');state=engine.input(borrow,state,'c').state;assert.equal(state.words[0],'Can');
state=engine.input(borrow,state,'i').state;assert.equal(state.active,1);state=engine.input(borrow,state,'Backspace').state;assert.equal(state.words[1],'');state=engine.input(borrow,state,'Backspace').state;assert.equal(state.active,0);assert.equal(state.words[0],'');
assert.equal(engine.input(borrow,state,'z').state,state);assert.equal(engine.start(borrow,{active:2,words:['Can','I','lend']}).words[2],'lend');
const same=engine.prepare({version:1,parts:[{id:'x',label:'短句',answers:['Can cats']}],annotations:['猫能']});assert.ok(engine.evaluate(same,type(same,['c',' ','c','c'])).correct);
const wrong=type(borrow,'cilycc');assert.equal(engine.evaluate(borrow,wrong).correct,false);assert.match(engine.evaluate(borrow,wrong).fields[2].message,/借给我/);
console.log('PASS: initials tokenization, collisions, continuous typing, same-initial adjacency, editing and assessment');
