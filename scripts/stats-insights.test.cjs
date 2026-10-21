const {test}=require('node:test');
const assert=require('node:assert/strict');
const {model}=require('../js/stats-insights.js');
test('daily deduplication separates observed new learning and review',()=>{
 const now=new Date(2026,9,16,12).getTime(),yesterday=now-86400000;
 const records=[{key:'a',stat:{times:3},fingerprint:'v'}];
 const data=model(records,[{id:'1',kind:'answer',key:'a',at:yesterday},{id:'2',kind:'answer',key:'a',at:now},{id:'2',kind:'answer',key:'a',at:now}],5,now,()=>({verifiedMastered:false}),[]);
 assert.equal(data.week[5].fresh,1);assert.equal(data.week[6].review,1);assert.equal(data.learned,1);assert.equal(data.total,5);
});
test('legacy snapshots do not become invented error counts',()=>{
 const data=model([],[],0,Date.now(),()=>({}),[{sentence:'legacy',mistakes:[{userAnswer:'x'}]},{sentence:'tracked',history:[{mode:'typing',mistakes:[{wrongAttemptCount:3}]}]}]);
 assert.equal(data.rank.length,1);assert.equal(data.rank[0].count,3);assert.equal(data.modes.typing,3);
});
