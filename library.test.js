'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function boot(window) {
  window.window = window;
  window.localStorage = window.localStorage || {
    getItem() { return null; },
    setItem() {},
  };
  const context = vm.createContext({ window, JSON, Object, Array, String, Number, Math, Date, Promise });
  vm.runInContext(fs.readFileSync(require.resolve('./library.js'), 'utf8'), context);
  return window.Library;
}

async function main() {
  const legacyCourse = { courseId: 'legacy-course', metadata: { title: 'Legacy' } };
  let legacyWrite = null;
  const legacy = boot({
    CL: {
      readCourses: () => [legacyCourse],
      writeCourses: async courses => { legacyWrite = courses; return true; },
      getCloudConfig: () => ({ persistenceMode: 'legacy', writeProtocol: 2 }),
    },
  });
  const legacyResult = await legacy.setLibMeta('legacy-course', { seriesId: 's-nce', volumeName: '第一册' });
  assert.equal(legacyResult.lib.seriesId, 's-nce');
  assert.equal(legacyWrite[0].lib.volumeName, '第一册', 'legacy mode retains its established local course writer');

  let writeCoursesCalls = 0;
  let adoptedCourses = null;
  let submitted = null;
  const serverCourse = { courseId: 'server-course', metadata: { title: 'Server course' }, version: '1' };
  const cache = { owner: 'owner-a', snapshot: { courses: [serverCourse], revs: { courses: { 'server-course': 9 } } } };
  const account = { owner: 'owner-a', assertCurrent() {} };
  const protocol3 = boot({
    CL: {
      getCloudConfig: () => ({ persistenceMode: 'server-authoritative', writeProtocol: 3 }),
      readCourses: () => [serverCourse],
      writeCourses: async courses => { writeCoursesCalls++; return courses; },
      adoptServerCoursesProjection: async courses => { adoptedCourses = courses; return true; },
    },
    AccountStorage: account,
    crypto: { randomUUID: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' },
    ServerCache: {
      read: async () => cache,
      refresh: async () => {
        cache.snapshot.courses[0] = submitted.payload.course;
        cache.snapshot.revs.courses['server-course'] = 10;
      },
    },
    ServerStore: {
      submitCommitted: async (type, payload, options) => {
        submitted = { type, payload, options };
        return { ok: true, requestId: options.requestId };
      },
    },
  });
  const confirmed = await protocol3.setLibMeta('server-course', {
    seriesId: 's-nce', seriesName: '新概念英语', volumeIndex: 1, volumeName: '第一册', sortOrder: 2,
  });
  assert.equal(submitted.type, 'course.put', 'protocol 3 uses a versioned course operation');
  assert.equal(submitted.options.expectedRev, 9, 'the write is guarded by the confirmed course revision');
  assert.equal(submitted.options.requestId, 'library-course-aaaaaaaabbbbccccddddeeeeeeeeeeee');
  assert.equal(confirmed.lib.volumeName, '第一册');
  assert.equal(writeCoursesCalls, 0, 'a confirmed server write never re-enters the legacy user-edit writer');
  assert.equal(adoptedCourses[0].lib.volumeName, '第一册', 'the confirmed entity updates only the local read projection');

  let unsafeWriteCalls = 0;
  const unavailable = boot({
    CL: { getCloudConfig: () => ({ persistenceMode: 'server-authoritative', writeProtocol: 3 }),
      readCourses: () => [serverCourse], writeCourses: async () => { unsafeWriteCalls++; } },
    AccountStorage: account,
  });
  await assert.rejects(unavailable.setLibMeta('server-course', { seriesId: 'unsafe-local' }), /未就绪/);
  assert.equal(unsafeWriteCalls, 0, 'protocol 3 never falls back to a local full-course write when server services are unavailable');

  const staleLocalCourse = { courseId: 'stale-local-course', metadata: { title: 'Stale local course' } };
  const protocol3WithoutReader = boot({
    CL: { getCloudConfig: () => ({ persistenceMode: 'server-authoritative', writeProtocol: 3 }) },
    localStorage: { getItem: key => key === 'chunklab.courses.v1' ? JSON.stringify([staleLocalCourse]) : null },
  });
  assert.equal(protocol3WithoutReader.getCourse('stale-local-course'), null,
    'protocol 3 never presents a stale browser course when its confirmed course reader is unavailable');

  const legacyWithoutReader = boot({
    CL: { getCloudConfig: () => ({ persistenceMode: 'legacy', writeProtocol: 2 }) },
    localStorage: { getItem: key => key === 'chunklab.courses.v1' ? JSON.stringify([staleLocalCourse]) : null },
  });
  assert.equal(legacyWithoutReader.getCourse('stale-local-course').metadata.title, 'Stale local course',
    'legacy mode retains its local-storage compatibility reader');
  console.log('library course metadata writes use a guarded protocol-3 operation');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
