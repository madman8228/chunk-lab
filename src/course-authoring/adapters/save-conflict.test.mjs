import assert from 'node:assert/strict';
import { ExistingCourseGateway } from './course-gateway.mjs';
let submitted=0;
const win={AccountStorage:{owner:'synthetic',assertCurrent(){}},ChunkCourse:{},
  CL:{preload:async()=>{},getCloudConfig:()=>({writeProtocol:3})},
  ServerCache:{read:async()=>({owner:'synthetic',snapshot:{mem:{decks:[]},revs:{decks:{}}}})},
  ServerStore:{pending:async()=>[{status:'acked-awaiting-apply',lastError:'SERVER_SEQ_ROLLBACK'}],
    submitCommitted:async()=>{submitted++;throw Error('must not submit');}}};
// This fixture implements only the browser dependencies used by the gateway.
const gateway=new ExistingCourseGateway({getWindow:()=>/** @type {Window & typeof globalThis} */ (/** @type {unknown} */ (win)),scopeGuard:{assert(){}}});
await assert.rejects(gateway.saveSentenceCourse({id:'new-course',items:[]},{}),e=>e instanceof Error && 'code' in e && e.code==='SERVER_SEQ_ROLLBACK');
assert.equal(submitted,0,'known cache conflict must not enqueue a new import');
console.log('course save preflight: known cache conflict rejects before submission');
