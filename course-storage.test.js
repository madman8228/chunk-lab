'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('./core.js'), 'utf8');
const COURSES = 'chunklab.courses.v1', PROGRESS = 'chunklab.course-progress.v1';
const clone = value => JSON.parse(JSON.stringify(value));
function sampleCourse() {
  // Read the shipped course fixture without creating or modifying extracted files.
  const zip = fs.readFileSync(require('node:path').join(__dirname, 'extra/lesson_1_excuse_me-1.0.0.course-package.zip'));
  for (let offset = 0; offset < zip.length - 46; offset++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) continue;
    const size = zip.readUInt32LE(offset + 20), nameLength = zip.readUInt16LE(offset + 28);
    if (zip.toString('utf8', offset + 46, offset + 46 + nameLength) !== 'course.json') continue;
    const local = zip.readUInt32LE(offset + 42);
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const bytes = zip.subarray(start, start + size);
    return JSON.parse((zip.readUInt16LE(offset + 10) === 0 ? bytes : require('node:zlib').inflateRawSync(bytes)).toString('utf8'));
  }
  throw new Error('fixture missing course.json');
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function setup(seed = {}, overrides = {}) {
  const storage = { ...seed }, disk = { courses: [], courseProgress: {} }, errors = [];
  const idb = {
    loadAll: async () => clone(disk),
    putCourses: async value => { disk.courses = clone(value); },
    putProgress: async value => { disk.courseProgress = clone(value); },
    ...overrides
  };
  const context = { console, setTimeout, clearTimeout, IDBStore: idb, localStorage: {
    getItem: key => storage[key] ?? null,
    setItem: (key, value) => { storage[key] = String(value); },
    removeItem: key => { delete storage[key]; }
  }};
  context.window = context;
  vm.runInNewContext(source, context);
  context.CL.on('persistError', event => errors.push(event));
  return { CL: context.CL, context, storage, disk, idb, errors };
}
async function main() {
  const legacy = { [COURSES]: JSON.stringify([{ courseId: 'old' }]), [PROGRESS]: JSON.stringify({ old: { seen: ['n1'] } }) };
  const gate = deferred();
  const a = setup(legacy, { putProgress: () => gate.promise });
  const migration = a.CL.preload();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(a.CL.preload(), migration, 'concurrent startup shares migration');
  assert.equal(a.storage[COURSES], legacy[COURSES], 'courses retained until both transactions finish');
  assert.equal(a.storage[PROGRESS], legacy[PROGRESS]);
  gate.reject(new Error('quota'));
  assert.equal(await migration, false);
  assert.equal(a.storage[COURSES], legacy[COURSES]);
  assert.equal(a.storage[PROGRESS], legacy[PROGRESS]);
  assert.equal(a.errors.length, 1);
  // Simulate a reload after the course transaction committed but progress failed.
  const retry = setup(a.storage);
  retry.disk.courses = clone(a.disk.courses);
  assert.equal(await retry.CL.preload(), true);
  assert.equal(retry.CL.readCourses()[0].courseId, 'old');
  assert.deepEqual(clone(retry.CL.readProgress()), { old: { seen: ['n1'] } });
  assert.equal(retry.storage[COURSES], undefined);
  assert.equal(retry.storage[PROGRESS], undefined);

  const b = setup(legacy, { putCourses: () => { throw new Error('transaction aborted'); } });
  assert.equal(await b.CL.preload(), false, 'synchronous throws retain legacy too');
  assert.equal(b.storage[COURSES], legacy[COURSES]);
  await assert.rejects(b.CL.writeCourses([{ courseId: 'new' }]), /transaction aborted/);
  assert.equal(b.CL.readCourses()[0].courseId, 'old', 'failed write never replaces committed cache');
  const changed = b.CL.readCourses(); changed[0].courseId = 'mutated';
  assert.equal(b.CL.readCourses()[0].courseId, 'old', 'readers cannot mutate committed cache');
  const unreadable = setup({}, { loadAll: async () => { throw new Error('unreadable'); } });
  await assert.rejects(unreadable.CL.writeCourses([{ courseId: 'unsafe-replacement' }]), /无法读取已有课程/);
  assert.equal(unreadable.disk.courses.length, 0, 'do not overwrite a store whose contents could not be read');

  const c = setup();
  await c.CL.preload();
  const hold = deferred(), calls = [];
  c.idb.putCourses = async value => { calls.push(clone(value)); if (calls.length === 1) await hold.promise; c.disk.courses = clone(value); };
  const value = [{ courseId: 'first' }];
  const first = c.CL.writeCourses(value);
  value[0].courseId = 'mutated-after-save';
  const second = c.CL.writeCourses([{ courseId: 'second' }]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.CL.readCourses().length, 0, 'pending transaction not reported as saved');
  assert.equal(calls.length, 1, 'writes are serialized');
  hold.resolve();
  await Promise.all([first, second]);
  assert.equal(calls[0][0].courseId, 'first', 'snapshot isolated from caller');
  assert.equal(c.disk.courses[0].courseId, 'second');
  assert.equal(c.CL.readCourses()[0].courseId, 'second');
  c.idb.putProgress = async () => { throw new Error('quota'); };
  await assert.rejects(c.CL.writeProgress({ second: { completed: true } }), /quota/);
  assert.deepEqual(clone(c.CL.readProgress()), {});
  c.idb.putProgress = async value => { c.disk.courseProgress = clone(value); };
  await c.CL.writeProgress({ second: { completed: true } });
  assert.equal(c.CL.readProgress().second.completed, true, 'failure does not poison write queue');

  delete c.context.IDBStore;
  await c.CL.writeCourses([{ courseId: 'local-only' }]);
  assert.equal(JSON.parse(c.storage[COURSES])[0].courseId, 'local-only', 'no IDB script still persists locally');

  const d = setup();
  await d.CL.preload();
  d.context.document = { addEventListener() {}, getElementById() { return null; } };
  vm.runInNewContext(fs.readFileSync(require.resolve('./course-package.js'), 'utf8'), d.context);
  const course = sampleCourse(), importGate = deferred();
  d.idb.putCourses = () => importGate.promise;
  let imported = false;
  const importing = d.context.ChunkCourse.importCourse(course, {}, false).then(() => { imported = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(imported, false, 'real import API waits for commit');
  importGate.reject(new Error('disk full'));
  await assert.rejects(importing, /disk full/);
  assert.equal(d.CL.readCourses().length, 0, 'failed import leaves original library intact');
  d.idb.putCourses = async value => { d.disk.courses = clone(value); };
  const other = clone(course); other.courseId = 'another-course';
  await Promise.all([
    d.context.ChunkCourse.importCourse(course, {}, false),
    d.context.ChunkCourse.importCourse(other, {}, false)
  ]);
  assert.equal(d.CL.readCourses().length, 2, 'concurrent imports merge after the previous commit');
  console.log('[course-storage] migration, commit, failure, isolation, ordering and retry passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
