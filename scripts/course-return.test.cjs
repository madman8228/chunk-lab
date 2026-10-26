'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const api=require('../js/course-return');
assert.equal(api.safe('https://evil.example/main.html'),'');
assert.equal(api.safe('//evil.example/main.html'),'');
assert.equal(api.safe('javascript:alert(1)'),'');
assert.equal(api.safe('server/data/chunklab.db'),'');
assert.equal(api.destination('?returnTo=https%3A%2F%2Fevil.example'),'main.html?view=my-learning');
assert.equal(api.destination('?returnView=discover'),'main.html?view=discover');
assert.equal(api.safe('decks.html?courseView=joined&courseType=decks'),'main.html?view=my-learning');
assert.equal(api.safe('decks.html?courseView=discover'),'main.html?view=discover');
assert.equal(api.safe('decks.html'),'main.html?view=discover');
assert.equal(api.safe('decks.html?manage=1&courseView=joined'),'decks.html?manage=1&courseView=joined');
assert.equal(api.destination('?returnTo='+encodeURIComponent('decks.html?courseView=joined')),'main.html?view=my-learning');
const entryScript=fs.readFileSync('decks.html','utf8').match(/<script>\s*([\s\S]*?)<\/script>/)[1];
for(const [search,expected] of [['?courseView=joined&courseType=decks','main.html?view=my-learning'],['','main.html?view=discover'],['?course=builtin%3Aoral',null],['?manage=1&courseView=joined',null]]){
 let redirected=null;
 vm.runInNewContext(entryScript,{URLSearchParams,CourseReturn:api,location:{href:'http://localhost/decks.html'+search,search,replace:value=>{redirected=value;}}});
 assert.equal(redirected,expected,'legacy list entry redirects while course directories and editing remain available');
}
const original='main.html?view=my-learning&contentStatus=completed&contentQuery=hello';
const detail=api.forward('wordbook-details.html?book=sample',original);
assert.equal(api.destination('?'+detail.split('?')[1]),original);
const parent=api.forward('decks.html?course=c&returnView=discover',original);
const player=api.forward('main.html?course=c&lesson=l',parent);
assert.equal(api.destination('?'+player.split('?')[1]),parent);
assert.equal(api.label('main.html?view=discover&kind=wordbook'),'返回发现');
assert.equal(api.label('wordbook-details.html?book=sample'),'返回课程目录');

async function main(){
 const scope={URL,URLSearchParams,location:{origin:'http://localhost',href:'http://localhost/wordbook.html?book=b',search:'?book=b'}};scope.window=scope;
 vm.runInNewContext(fs.readFileSync('js/course-return.js','utf8'),scope);
 const attrs={},link={setAttribute:(key,value)=>attrs[key]=value,getAttribute:key=>attrs[key],removeAttribute:key=>delete attrs[key]};let error;
 scope.CourseReturn.bind(link,{href:'wordbook-details.html?book=b',beforeLeave:async()=>{throw Error('save failed');},onError:e=>{error=e.message;}});
 await link.onclick({button:0,preventDefault(){}});
 assert.equal(error,'save failed');assert.equal(scope.location.href,'http://localhost/wordbook.html?book=b');
 scope.CourseReturn.bind(link,{href:'wordbook-details.html?book=b',beforeLeave:async()=>{}});
 await link.onclick({button:0,preventDefault(){}});
 assert.equal(scope.location.href,'wordbook-details.html?book=b');
 assert.equal(attrs['aria-busy'],undefined);
 console.log('Course return: list filters, nested directory return, direct links, external URL rejection and save failure passed');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
