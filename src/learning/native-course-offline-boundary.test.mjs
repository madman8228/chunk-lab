import assert from 'node:assert/strict';
import {NativeCourseSession} from './native-course-session.mjs';

const noop=()=>{};
const doc={createElement:()=>({append:noop,prepend:noop,setAttribute:noop,remove:noop}),addEventListener:noop,removeEventListener:noop};
const host={ownerDocument:doc,querySelector:()=>null,prepend:noop};
const win={location:{href:'http://localhost/main.html?course=fixture'},navigator:{onLine:true},
  AccountStorage:{owner:'["http://localhost","fixture"]',sessionEpoch:1},
  ChunkAPI:{getBase:()=>'',getToken:()=> 'fixture'},addEventListener:noop,removeEventListener:noop,clearInterval:noop};
const cached={courses:[{courseId:'fixture',title:'Synthetic',units:[{unitId:'unit',recordIdentity:{deckId:'fixture'},itemIds:['one'],itemCount:1}]}]};
for(const status of [401,403,404,500]){
  const session=new NativeCourseSession({host,win,courseId:'fixture',unitId:'unit',getMem:()=>({}),onBatch:noop});
  let fallback=0;
  session.client.catalog=async()=>{throw Object.assign(new TypeError('server refusal'),{status});};
  session.offlineCache.catalog=async()=>{fallback++;return cached;};
  await assert.rejects(session.open(),error=>error.status===status);
  assert.equal(fallback,0,'HTTP refusal must not fall back to an offline package');
  session.dispose();
}
const session=new NativeCourseSession({host,win,courseId:'fixture',unitId:'unit',getMem:()=>({}),onBatch:noop});
session.client.catalog=async()=>{throw new TypeError('Failed to fetch');};
session.offlineCache.catalog=async()=>cached;
await session.open();assert.equal(session.offline,true);assert.equal(session.unitId,'unit');session.dispose();
console.log('Native entry: network failure uses verified cache; HTTP 401/403/404/500 never bypass server refusal');
