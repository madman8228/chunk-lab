'use strict';
const assert = require('node:assert/strict');
const CourseEnrollment = require('../js/course-enrollment.js');

async function run() {
  let progress = { 'sentence-deck': { untouched: true }, 'package:story': { completed: true } };
  let clock = 100;
  let fail = false;
  const enrollment = CourseEnrollment.create({
    readProgress: () => JSON.parse(JSON.stringify(progress)),
    writeProgress: async (next) => { if (fail) return false; progress = next; return true; },
    now: () => ++clock
  });
  assert.equal(CourseEnrollment.keyFor('course / one'), 'enrollment:v1:course%20%2F%20one');
  await enrollment.join('builtin:oral');
  const firstJoin = progress[CourseEnrollment.keyFor('builtin:oral')];
  const writeBeforeIdempotentJoin = JSON.stringify(progress);
  await enrollment.join('builtin:oral');
  assert.equal(JSON.stringify(progress), writeBeforeIdempotentJoin);
  assert.equal(progress[CourseEnrollment.keyFor('builtin:oral')].joinedAt, firstJoin.joinedAt);
  await enrollment.join('package:story');
  assert.equal(enrollment.isJoined('builtin:oral'), true);
  assert.equal(progress['sentence-deck'].untouched, true);
  assert.equal(progress['package:story'].completed, true);
  assert.deepEqual(Object.keys(enrollment.readMemberships()).sort(), ['builtin:oral', 'package:story']);
  const oldAliasProgress = Object.assign({}, progress, {
    [CourseEnrollment.keyFor('user-deck:story')]: {
      kind:'course-enrollment', schemaVersion:1, courseId:'user-deck:story', joined:true, joinedAt:99, changedAt:99
    }
  });
  assert.equal(enrollment.readMemberships(oldAliasProgress, { 'user-deck:story':'package:story' })['package:story'].joined, true);
  assert.equal(enrollment.joinedCount(oldAliasProgress, { 'user-deck:story':'package:story' }), 2);
  const canonicalLeaveProgress = Object.assign({}, oldAliasProgress, {
    [CourseEnrollment.keyFor('package:story')]: {
      kind:'course-enrollment', schemaVersion:1, courseId:'package:story', joined:false, joinedAt:98, changedAt:101
    }
  });
  assert.equal(enrollment.readMemberships(canonicalLeaveProgress, { 'user-deck:story':'package:story' })['package:story'].joined, false);
  const joinedAt = progress[CourseEnrollment.keyFor('package:story')].joinedAt;
  await enrollment.leave('package:story');
  const tombstone = progress[CourseEnrollment.keyFor('package:story')];
  assert.equal(tombstone.joined, false);
  assert.equal(tombstone.joinedAt, joinedAt);
  assert.equal(enrollment.isJoined('package:story'), false);
  await enrollment.join('package:story');
  assert.equal(progress[CourseEnrollment.keyFor('package:story')].joined, true);
  assert.ok(progress[CourseEnrollment.keyFor('package:story')].joinedAt > joinedAt);

  progress['enrollment:v1:bad'] = { kind: 'course-enrollment', schemaVersion: 1, courseId: 'other', joined: true };
  progress['enrollment:v1:wrong-shape'] = { kind: 'course-enrollment', schemaVersion: 2, courseId: 'wrong-shape', joined: true };
  assert.equal(enrollment.readMemberships().other, undefined);
  assert.equal(enrollment.readMemberships()['wrong-shape'], undefined);
  progress[CourseEnrollment.keyFor('collision')] = { legacy: 'keep' };
  const collisionBefore = JSON.stringify(progress[CourseEnrollment.keyFor('collision')]);
  await assert.rejects(enrollment.join('collision'), /键冲突/);
  assert.equal(JSON.stringify(progress[CourseEnrollment.keyFor('collision')]), collisionBefore);

  const before = JSON.stringify(progress);
  fail = true;
  await assert.rejects(enrollment.leave('builtin:oral'), /未能保存/);
  assert.equal(JSON.stringify(progress), before);
  assert.throws(() => CourseEnrollment.keyFor('  '), /不能为空/);

  const limitedProgress = {};
  const limited = CourseEnrollment.create({
    readProgress: () => JSON.parse(JSON.stringify(limitedProgress)),
    writeProgress: async (next) => { Object.assign(limitedProgress, next); return true; }
  });
  assert.equal(CourseEnrollment.MAX_JOINED_COURSES, 3);
  await limited.join('course:one');
  await limited.join('course:two');
  await limited.join('course:three');
  assert.equal(limited.joinedCount(), 3);
  await limited.join('course:one'); // already joined remains idempotent at the cap
  await assert.rejects(limited.join('course:four'), /最多加入 3 门课程/);
  assert.equal(limited.isJoined('course:four'), false);
  await limited.leave('course:two');
  await limited.join('course:four');
  assert.equal(limited.joinedCount(), 3);

  const staleServerView = {};
  const serverMembership = { kind:'course-enrollment', schemaVersion:1, courseId:'cloud:course', joined:true, joinedAt:500, changedAt:500 };
  let adopted = null, serverWrites = 0;
  global.CL = {
    getCloudConfig: () => ({ persistenceMode:'server-authoritative', writeProtocol:3 }),
    serverPersistenceReady: () => true,
    adoptServerProgressProjection: async next => { adopted = next; return true; },
    writeProgress: async () => { serverWrites++; return true; }
  };
  global.AccountStorage = { owner:'owner-1' };
  global.ServerStore = { submitCommitted: async (type,payload) => {
    assert.equal(type,'course.enrollment'); assert.deepEqual(payload,{courseId:'cloud:course',joined:true});
    return {seq:10};
  }, pending: async () => [] };
  global.ServerCache = {
    read: async () => ({owner:'owner-1',snapshot:{courseProgress:{'enrollment:v1:cloud%3Acourse':serverMembership}}}),
    projectCourseProgress: row => row.snapshot.courseProgress
  };
  const cloud = CourseEnrollment.create({
    readProgress: () => JSON.parse(JSON.stringify(staleServerView)),
    writeProgress: async next => { serverWrites++; Object.assign(staleServerView,next); return true; }
  });
  const cloudResult = await cloud.join('cloud:course');
  assert.deepEqual(adopted,{'enrollment:v1:cloud%3Acourse':serverMembership},
    'protocol 3 adopts the confirmed narrow membership projection');
  assert.deepEqual(cloudResult,serverMembership,'the returned membership is server-confirmed');
  assert.equal(serverWrites,0,'protocol 3 never writes the full progress map after enrollment ACK');
  delete global.CL; delete global.AccountStorage; delete global.ServerStore; delete global.ServerCache;
  console.log('✓ course enrollment storage contract');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
