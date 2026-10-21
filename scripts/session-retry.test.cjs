'use strict';
// Synthetic credentials and in-memory storage only; never touches real assets.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const token=id=>'test.'+Buffer.from(JSON.stringify({uid:id})).toString('base64url')+'.test';
const values=new Map([
  ['chunklab.session.v1',JSON.stringify({version:1,epoch:'old',base:'',token:token(27)})],
  ['chunklab_token',token(1)],['chunklab_api_base',''],['course-original','irreplaceable']
]);
const timers=[],nodes=[];
function element(tag){return {tag,style:{},children:[],setAttribute(){},appendChild(child){this.children.push(child);}};}
const context={URL,atob:s=>Buffer.from(s,'base64').toString('binary'),
  localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)},
  location:{origin:'http://isolated.invalid',reload(){}},
  document:{documentElement:{style:{}},createElement:element,body:{appendChild:n=>nodes.push(n)}},
  setTimeout:fn=>timers.push(fn),addEventListener(){}};
context.window=context;vm.createContext(context);
for(const file of ['js/account-storage.js','api.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
timers.shift()();
assert.throws(()=>context.AccountStorage.assertCurrent());
nodes[0].children[0].onclick();
vm.runInContext(fs.readFileSync(path.join(root,'js/account-storage.js'),'utf8'),context);
assert.equal(values.get('course-original'),'irreplaceable');
assert.doesNotThrow(()=>context.AccountStorage.assertCurrent(),'Retry must clear conflicting credentials coherently without deleting course data');
assert.equal(JSON.parse(context.AccountStorage.owner)[1],'local');
console.log('session retry: coherent signed-out scope, original course marker preserved');
