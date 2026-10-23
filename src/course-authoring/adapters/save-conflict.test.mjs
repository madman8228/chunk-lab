import assert from 'node:assert/strict';
import { ExistingCourseGateway } from './course-gateway.mjs';
let submitted=0;
const courseRequests=[];
const win={AccountStorage:{owner:'synthetic',assertCurrent(){}},ChunkCourse:{},
  CL:{preload:async()=>{},getCloudConfig:()=>({writeProtocol:3})},
  ChunkAPI:{request:async(path)=>{courseRequests.push(path);return {courseId:'independent-course',releaseId:'release-1'};}},
  ServerCache:{read:async()=>({owner:'synthetic',snapshot:{mem:{decks:[]},revs:{decks:{}}}})},
  ServerStore:{pending:async()=>[{status:'acked-awaiting-apply',lastError:'SERVER_SEQ_ROLLBACK'}],
    submitCommitted:async()=>{submitted++;throw Error('must not submit');}}};
// This fixture implements only the browser dependencies used by the gateway.
const gateway=new ExistingCourseGateway({getWindow:()=>/** @type {Window & typeof globalThis} */ (/** @type {unknown} */ (win)),scopeGuard:{assert(){}}});
const deck={id:'new-course',items:[]};
const receipt=await gateway.saveSentenceCourse(deck,{});
assert.equal(receipt.storageKind,'personal-course');
assert.equal(deck.id,'independent-course');
assert.deepEqual(courseRequests,['/api/course-library/import'],'course content is saved only to the independent library');
assert.equal(submitted,0,'course content save never submits personal learning snapshot changes');
console.log('course save boundary: pending learning conflict does not route course content into personal learning data');
